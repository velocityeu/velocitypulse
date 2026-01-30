# Stripe Integration for Next.js

**Purpose:** Comprehensive guide for integrating Stripe payments into Next.js applications, based on production experience with VelocityPulse.

**Scope:** Checkout sessions, subscriptions, webhooks, and common pitfalls.

---

## 1. Package Versions (Tested & Working)

Use these exact versions for stability:

```json
{
  "dependencies": {
    "stripe": "^16.12.0",
    "@stripe/stripe-js": "^4.10.0"
  }
}
```

**Warning:** Stripe SDK v20+ has breaking changes with TypeScript and API version configuration. Stick with v16.x for stability.

---

## 2. Environment Variables

### Required Variables

```bash
# Server-side (NEVER expose to client)
STRIPE_SECRET_KEY=sk_test_...              # From Stripe Dashboard > API Keys
STRIPE_WEBHOOK_SECRET=whsec_...            # From Stripe Dashboard > Webhooks
STRIPE_STARTER_PRICE_ID=price_...          # From Stripe Dashboard > Products
STRIPE_UNLIMITED_PRICE_ID=price_...        # From Stripe Dashboard > Products

# Client-side (safe to expose - these are publishable)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID=price_...
NEXT_PUBLIC_STRIPE_UNLIMITED_PRICE_ID=price_...
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

### CRITICAL: Vercel Environment Variable Corruption

**Problem:** When setting Vercel env vars via CLI with piping, newline characters get appended:
```bash
# BAD - This adds \n to the value!
echo "sk_test_xxx" | vercel env add STRIPE_SECRET_KEY production
```

**Symptoms:**
- "An error occurred with our connection to Stripe. Request was retried 3 times."
- "Not a valid URL" errors
- Authentication failures

**Solution:** Use Node.js stdin.write() without newlines:

```javascript
// fix-vercel-env.js
const { spawn } = require('child_process');

async function setEnvVar(name, value) {
  return new Promise((resolve) => {
    const proc = spawn('npx', ['vercel', 'env', 'add', name, 'production', '--force'], {
      stdio: ['pipe', 'inherit', 'inherit'],
      shell: true
    });
    proc.stdin.write(value); // NO newline added
    proc.stdin.end();
    proc.on('close', resolve);
  });
}

// Usage
setEnvVar('STRIPE_SECRET_KEY', 'sk_test_xxx');
```

**Verification:** After setting, pull and check:
```bash
vercel env pull .env.check --environment production
# Look for \n at end of values - should NOT be there
```

---

## 3. Server-Side Stripe Client

### Recommended Configuration

```typescript
// lib/stripe.ts
import Stripe from 'stripe'

let stripeInstance: Stripe | null = null

export function getStripe(): Stripe {
  if (stripeInstance) return stripeInstance

  const apiKey = process.env.STRIPE_SECRET_KEY
  if (!apiKey) {
    throw new Error('STRIPE_SECRET_KEY is not configured')
  }

  stripeInstance = new Stripe(apiKey, {
    apiVersion: '2024-06-20',  // Use stable API version
    maxNetworkRetries: 3,      // Retry on network failures
    timeout: 30000,            // 30 second timeout
  })

  return stripeInstance
}
```

### API Route Setup

```typescript
// app/api/checkout/route.ts
import { NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'

// IMPORTANT: Force Node.js runtime for Stripe
export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const { priceId, customerId } = await request.json()
    const stripe = getStripe()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${appUrl}/dashboard?checkout=success`,
      cancel_url: `${appUrl}/billing?checkout=cancelled`,
      metadata: {
        // Add any custom metadata
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Checkout error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to create checkout session: ${message}` },
      { status: 500 }
    )
  }
}
```

---

## 4. Webhook Handler

```typescript
// app/api/webhook/stripe/route.ts
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import Stripe from 'stripe'
import { getStripe } from '@/lib/stripe'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const body = await request.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  const stripe = getStripe()
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured')
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // Handle events
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object as Stripe.Checkout.Session
      // Handle successful checkout
      break

    case 'customer.subscription.updated':
      // Handle subscription update
      break

    case 'customer.subscription.deleted':
      // Handle subscription cancellation
      break

    case 'invoice.payment_failed':
      // Handle failed payment
      break

    case 'invoice.payment_succeeded':
      // Handle successful payment
      break
  }

  return NextResponse.json({ received: true })
}
```

---

## 5. Client-Side Stripe

```typescript
// lib/stripe-client.ts
import { loadStripe, Stripe } from '@stripe/stripe-js'

let stripePromise: Promise<Stripe | null>

export function getStripeClient() {
  if (!stripePromise) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    if (!key) {
      console.error('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY not set')
      return Promise.resolve(null)
    }
    stripePromise = loadStripe(key)
  }
  return stripePromise
}
```

### Checkout Button Component

```typescript
'use client'

import { useState } from 'react'

export function CheckoutButton({ priceId }: { priceId: string }) {
  const [loading, setLoading] = useState(false)

  async function handleCheckout() {
    setLoading(true)
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      })

      const { url, error } = await response.json()

      if (error) {
        console.error('Checkout error:', error)
        alert(error)
        return
      }

      // Redirect to Stripe Checkout
      window.location.href = url
    } finally {
      setLoading(false)
    }
  }

  return (
    <button onClick={handleCheckout} disabled={loading}>
      {loading ? 'Loading...' : 'Subscribe'}
    </button>
  )
}
```

---

## 6. Test Cards

| Card Number | Scenario |
|-------------|----------|
| `4242 4242 4242 4242` | Successful payment |
| `4000 0025 0000 3155` | Requires authentication (3D Secure) |
| `4000 0000 0000 3220` | 3D Secure 2 authentication |
| `4000 0000 0000 9995` | Declined (insufficient funds) |
| `4000 0000 0000 0002` | Declined (generic decline) |
| `4000 0000 0000 0069` | Declined (expired card) |
| `4000 0000 0000 0127` | Declined (incorrect CVC) |

**For all test cards:**
- Use any future expiration date (e.g., 12/34)
- Use any 3-digit CVC (e.g., 123)
- Use any billing postal code

---

## 7. Webhook Testing

### Local Development with Stripe CLI

```bash
# Install Stripe CLI
# macOS: brew install stripe/stripe-cli/stripe
# Windows: scoop install stripe

# Login
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/webhook/stripe

# Note the webhook signing secret (whsec_...) and add to .env.local
```

### Trigger Test Events

```bash
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
stripe trigger invoice.payment_failed
```

---

## 8. Common Errors & Solutions

### "An error occurred with our connection to Stripe"

**Cause:** Invalid or corrupted API key (often has newline characters)

**Fix:**
1. Check `STRIPE_SECRET_KEY` doesn't have `\n` at the end
2. Re-set the environment variable using the Node.js method above
3. Redeploy

### "Not a valid URL"

**Cause:** `NEXT_PUBLIC_APP_URL` has newline or invalid characters

**Fix:** Same as above - re-set without newlines

### "No such price"

**Cause:** Price ID doesn't exist or wrong environment (test vs live)

**Fix:**
1. Verify price exists in Stripe Dashboard
2. Ensure using test keys with test prices, live keys with live prices

### Webhook signature verification failed

**Cause:** Wrong webhook secret or request body was modified

**Fix:**
1. Verify `STRIPE_WEBHOOK_SECRET` matches the webhook endpoint in Stripe Dashboard
2. Ensure using `request.text()` not `request.json()` before verification
3. Each webhook endpoint has its own secret - use the correct one

### TypeScript errors with apiVersion

**Cause:** Stripe SDK version mismatch

**Fix:** Use `stripe@^16.12.0` which supports `apiVersion: '2024-06-20'` without TypeScript errors

---

## 9. Security Checklist

- [ ] `STRIPE_SECRET_KEY` is server-side only (no `NEXT_PUBLIC_` prefix)
- [ ] `STRIPE_WEBHOOK_SECRET` is server-side only
- [ ] Webhook signature is verified before processing events
- [ ] API routes use `runtime = 'nodejs'` (not Edge)
- [ ] Price IDs are validated before creating checkout sessions
- [ ] Customer metadata includes your internal identifiers
- [ ] Webhook events are idempotent (handle duplicates)
- [ ] Test mode keys are used in development, live keys in production

---

## 10. Stripe Dashboard Setup

### Create Products and Prices

1. Go to Stripe Dashboard > Products
2. Create a product (e.g., "Starter Plan")
3. Add a price (e.g., $29/month recurring)
4. Copy the price ID (starts with `price_`)
5. Add to environment variables

### Create Webhook Endpoint

1. Go to Stripe Dashboard > Developers > Webhooks
2. Add endpoint: `https://your-app.vercel.app/api/webhook/stripe`
3. Select events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Copy the signing secret (starts with `whsec_`)
5. Add to environment variables

---

## 11. AI Model Instructions

### ALWAYS DO

1. Use `runtime = 'nodejs'` for Stripe API routes
2. Use lazy initialization for Stripe client (singleton pattern)
3. Verify webhook signatures before processing
4. Use `request.text()` for webhook body (not `request.json()`)
5. Include proper error handling with descriptive messages
6. Use test keys in development, live keys in production

### NEVER DO

1. Never expose `STRIPE_SECRET_KEY` to the client
2. Never skip webhook signature verification
3. Never use Edge runtime for Stripe operations
4. Never hardcode API keys in source code
5. Never trust client-provided price IDs without validation
6. Never use Stripe SDK v20+ (stick with v16.x for stability)
