# Changelog

All notable changes to VelocityPulse Dashboard will be documented in this file.

## [Unreleased]

### Fixed

#### Stripe Integration Fixes (2026-01-30)

**Root Cause:** Vercel environment variables were corrupted with trailing `\n` characters, causing:
1. Stripe API key to be invalid → "Connection to Stripe failed after 3 retries"
2. App URL to be invalid → "Not a valid URL" when creating checkout sessions

**Environment Variables Fixed (17 total):**
- `STRIPE_SECRET_KEY` - Stripe API secret key
- `STRIPE_WEBHOOK_SECRET` - Webhook signature verification
- `STRIPE_STARTER_PRICE_ID` - Starter plan price ID
- `STRIPE_UNLIMITED_PRICE_ID` - Unlimited plan price ID
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Client-side Stripe key
- `NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID` - Client-side starter price
- `NEXT_PUBLIC_STRIPE_UNLIMITED_PRICE_ID` - Client-side unlimited price
- `NEXT_PUBLIC_APP_URL` - Application URL for redirects
- `CLERK_SECRET_KEY` - Clerk authentication
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Client-side Clerk key
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL` - Sign-in route
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL` - Sign-up route
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` - Post sign-in redirect
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` - Post sign-up redirect
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key

**How to Fix Corrupted Vercel Env Vars:**
```javascript
// fix-env.js - Run with: node fix-env.js
const { spawn } = require('child_process');

const envVars = {
  'VAR_NAME': 'value_without_newline',
};

async function setEnvVar(name, value) {
  return new Promise((resolve) => {
    const proc = spawn('npx', ['vercel', 'env', 'add', name, 'production', '--force'], {
      stdio: ['pipe', 'inherit', 'inherit'],
      shell: true
    });
    proc.stdin.write(value); // Write without newline
    proc.stdin.end();
    proc.on('close', resolve);
  });
}

(async () => {
  for (const [name, value] of Object.entries(envVars)) {
    await setEnvVar(name, value);
  }
})();
```

**Key Lesson:** When setting Vercel env vars via CLI, piping values adds newlines. Use stdin.write() without newline to set clean values.

---

#### Next.js 16 Proxy Migration (2026-01-30)

**Change:** Renamed `src/middleware.ts` → `src/proxy.ts`

**Reason:** Next.js 16 deprecated the "middleware" file convention in favor of "proxy" to:
- Clarify its role as a network boundary/routing layer
- Address confusion with Express.js middleware
- Respond to CVE-2025-29927 (middleware auth bypass vulnerability)

**Impact:** None - Clerk's `clerkMiddleware()` function works unchanged, only the filename changed.

---

#### Stripe SDK Downgrade (2026-01-30)

**Change:** Downgraded Stripe packages to match working velocitypulse-web:
- `stripe`: `20.3.0` → `16.12.0`
- `@stripe/stripe-js`: `8.7.0` → `4.10.0`

**Reason:** SDK v20.3.0 had TypeScript incompatibilities with `apiVersion: '2024-06-20'` requiring `@ts-expect-error` comments.

**Note:** This fix was applied but wasn't the root cause. The actual issue was corrupted environment variables (see above).

---

## Stripe Integration Reference

### Environment Variables Required

```bash
# Server-side (secret - never expose to client)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_STARTER_PRICE_ID=price_...
STRIPE_UNLIMITED_PRICE_ID=price_...

# Client-side (safe to expose)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID=price_...
NEXT_PUBLIC_STRIPE_UNLIMITED_PRICE_ID=price_...
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

### Stripe SDK Configuration

```typescript
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
  maxNetworkRetries: 3,
  timeout: 30000,
})
```

### Checkout Session Creation

```typescript
const session = await stripe.checkout.sessions.create({
  customer: customerId,
  payment_method_types: ['card'],
  line_items: [{ price: priceId, quantity: 1 }],
  mode: 'subscription',
  success_url: `${appUrl}/dashboard?checkout=success`,
  cancel_url: `${appUrl}/billing?checkout=cancelled`,
  metadata: { organization_id: orgId },
})
```

### Test Cards

| Card Number | Scenario |
|-------------|----------|
| 4242 4242 4242 4242 | Successful payment |
| 4000 0000 0000 3220 | 3D Secure authentication |
| 4000 0000 0000 9995 | Declined (insufficient funds) |
| 4000 0000 0000 0002 | Declined (generic) |

Use any future expiry date and any 3-digit CVC.
