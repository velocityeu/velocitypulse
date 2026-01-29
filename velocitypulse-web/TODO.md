# VelocityPulse.io - Remaining Work

This document tracks remaining work needed for full production deployment.

## Completed (Production Ready)

- [x] Security headers middleware (CSP, X-Frame-Options, etc.)
- [x] Rate limiting for API routes
- [x] Input validation with Zod schemas
- [x] Environment variable validation
- [x] Branding update (symbol + VelocityPulse.io)
- [x] Form error handling with user-friendly messages
- [x] Accessible mobile navigation (keyboard, focus trap, ARIA)
- [x] Skip-to-content link
- [x] Footer accordion accessibility
- [x] Error boundary component
- [x] Constants extraction
- [x] TypeScript type safety improvements

## High Priority

### Zoho Help Desk Integration
**Files:** `app/api/contact/route.ts`, `app/api/partners/route.ts`

The contact and partner application forms currently log submissions in development mode. To enable production functionality:

1. Set up Zoho Help Desk account
2. Create OAuth app and obtain credentials
3. Add environment variables:
   - `ZOHO_ACCESS_TOKEN`
   - `ZOHO_ORG_ID`
4. Implement OAuth token refresh logic
5. Uncomment the Zoho API calls in the route handlers

### Stripe Webhook Handlers
**File:** `app/api/stripe/webhook/route.ts`

The webhook handlers have placeholder implementations. When database is ready:

1. `handleSubscriptionCreated`:
   - Create organization record in database
   - Create admin user account
   - Send welcome email with setup instructions
   - Store Stripe subscription ID

2. `handleSubscriptionUpdated`:
   - Check if plan changed (upgrade/downgrade)
   - Update organization device limits
   - Send confirmation email

3. `handleSubscriptionDeleted`:
   - Mark organization as cancelled
   - Set data deletion date (30 days)
   - Send cancellation confirmation
   - Schedule data cleanup job

4. `handlePaymentFailed`:
   - Mark subscription as past due
   - Send payment failed notification
   - Start 7-day grace period
   - Schedule access restriction

5. `handlePaymentSucceeded`:
   - Update subscription status
   - Clear past due status
   - Send payment receipt

### Database Setup

Choose and implement database:

**Recommended: Supabase (PostgreSQL)**
- Organizations table (id, name, stripe_customer_id, plan, device_limit, created_at)
- Users table (id, organization_id, email, role, created_at)
- Subscriptions table (id, organization_id, stripe_subscription_id, status, current_period_end)

Alternatively: Prisma + PlanetScale or Prisma + Neon

### Authentication System

**Recommended: NextAuth.js or Clerk**

Features needed:
- Email/password authentication
- Magic link login
- Organization-based access control
- Session management
- Password reset flow

## Medium Priority

### Email Notifications
**Recommended: Resend or Postmark**

Templates needed:
- Welcome email (post-signup)
- Payment receipt
- Payment failed notification
- Subscription cancelled
- Password reset
- Weekly activity summary (optional)

### Analytics Integration

Options:
- Vercel Analytics (simple)
- PostHog (self-hosted option, feature flags)
- Mixpanel (advanced user tracking)
- Plausible (privacy-focused)

Track:
- Page views
- Form submissions
- Conversion funnel (pricing > demo > checkout)
- Feature usage (once app is built)

### A/B Testing Framework

For pricing experiments:
- Pricing page variants
- CTA button text
- Landing page hero
- Feature descriptions

Options:
- Vercel Edge Config
- LaunchDarkly
- PostHog experiments

## Low Priority

### Performance Optimizations

- [ ] Image optimization (WebP, AVIF)
- [ ] Lazy loading for below-fold content
- [ ] Prefetch critical pages
- [ ] Bundle analysis and tree-shaking

### SEO Improvements

- [ ] Structured data (JSON-LD)
- [ ] Dynamic sitemap generation
- [ ] robots.txt configuration
- [ ] Canonical URLs
- [ ] Blog with MDX (content marketing)

### Monitoring & Observability

- [ ] Error tracking (Sentry)
- [ ] Uptime monitoring
- [ ] Performance monitoring (Web Vitals)
- [ ] Log aggregation

### Legal Pages Enhancement

- [ ] Cookie consent banner
- [ ] Dynamic legal page dates
- [ ] Version history for legal documents

## Environment Variables Required

```env
# Stripe
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_STARTER=price_xxx
STRIPE_PRICE_UNLIMITED=price_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx

# Zoho (when ready)
ZOHO_ACCESS_TOKEN=xxx
ZOHO_ORG_ID=xxx

# App
NEXT_PUBLIC_APP_URL=https://velocitypulse.io

# Database (when ready)
DATABASE_URL=xxx

# Auth (when ready)
NEXTAUTH_SECRET=xxx
NEXTAUTH_URL=https://velocitypulse.io
```

## Deployment Checklist

Before deploying to production:

1. [ ] Set all environment variables in Vercel/hosting provider
2. [ ] Configure Stripe webhooks to point to production URL
3. [ ] Test Stripe checkout flow in live mode
4. [ ] Verify security headers with securityheaders.com
5. [ ] Run Lighthouse audit (target: 90+ all categories)
6. [ ] Test all forms submit successfully
7. [ ] Verify mobile responsiveness
8. [ ] Test dark/light mode
9. [ ] Verify og:image and social sharing preview
10. [ ] Set up Vercel Analytics or alternative
11. [ ] Configure domain DNS
12. [ ] Enable Vercel DDoS protection

## Notes

- The demo form currently simulates a successful signup. Connect to auth system when ready.
- ESLint was updated to v9 but may need config migration from eslintrc to flat config format.
- Rate limiting uses in-memory store; for multi-instance deployment, switch to Redis.
