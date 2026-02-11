# VelocityPulse.io — Marketing Site Status

Status tracker for the marketing/landing site only. Dashboard, agent, billing, and auth are tracked in the main [DEVELOPMENT_PLAN.md](../DEVELOPMENT_PLAN.md).

## Completed

- [x] Landing page with hero, features, pricing, CTAs
- [x] Features page with feature showcase
- [x] Pricing page with plan comparison (Starter / Unlimited)
- [x] About page
- [x] Contact form (Resend email + Supabase storage + Zoho Help Desk)
- [x] Partner application form (Resend email + Supabase storage + Zoho Help Desk)
- [x] Free trial / demo signup page
- [x] Legal pages (Privacy Policy, Terms of Service, GDPR)
- [x] Dark/light theme with system preference detection
- [x] Security headers middleware (CSP, HSTS, X-Frame-Options)
- [x] Rate limiting for API routes
- [x] Input validation with Zod schemas
- [x] Environment variable validation
- [x] Accessible mobile navigation (keyboard, focus trap, ARIA)
- [x] Skip-to-content link and footer accordion accessibility
- [x] Error boundary with Sentry integration
- [x] Health check endpoint (`/api/health`)
- [x] Stripe checkout integration (redirects to dashboard for subscription management)
- [x] Dashboard link in footer
- [x] Vitest unit tests (env validation — 11 tests)

## Remaining — Marketing Site Only

### Performance Optimizations
- [ ] Image optimization (WebP/AVIF with `next/image`)
- [ ] Lazy loading for below-fold sections
- [ ] Prefetch critical pages
- [ ] Bundle analysis and tree-shaking audit

### SEO Improvements
- [ ] Structured data (JSON-LD for Product, Organization, FAQ)
- [ ] Dynamic sitemap generation (`sitemap.xml`)
- [ ] `robots.txt` configuration
- [ ] Canonical URLs on all pages
- [ ] Blog with MDX for content marketing

### Analytics & Experimentation
- [ ] Analytics integration (Vercel Analytics, PostHog, or Plausible)
- [ ] Conversion funnel tracking (pricing > demo > checkout)
- [ ] A/B testing framework for pricing page and CTA copy

### Legal & Compliance
- [ ] Cookie consent banner (GDPR)
- [ ] Dynamic legal page dates / version history

## Deployment Checklist

1. [x] Environment variables configured in Vercel
2. [x] Stripe checkout flow tested in live mode
3. [x] Security headers verified
4. [x] All forms submit successfully
5. [x] Mobile responsiveness tested
6. [x] Dark/light mode verified
7. [x] Domain DNS configured (velocitypulse.io)
8. [ ] Lighthouse audit (target: 90+ all categories)
9. [ ] `og:image` and social sharing preview verified
10. [ ] Vercel Analytics or alternative enabled

## Notes

- ESLint v9 may need migration from `.eslintrc` to flat config format.
- Rate limiting uses in-memory store; for multi-instance deployment, consider Redis.
