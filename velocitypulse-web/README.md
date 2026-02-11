# VelocityPulse.io

Professional network monitoring from $50/year. Your network's heartbeat, at a glance.

## Tech Stack

- **Framework:** Next.js 16.1 (App Router)
- **Language:** TypeScript 5.7
- **Styling:** Tailwind CSS 4.1
- **Animations:** Framer Motion 12
- **Payments:** Stripe
- **Validation:** Zod
- **Icons:** Lucide React

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/velocityeu/velocitypulse-web.git
cd velocitypulse-web

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the site.

### Environment Variables

Create a `.env.local` file with the following variables:

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_STARTER=price_xxx
STRIPE_PRICE_UNLIMITED=price_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional: Zoho Help Desk (for contact forms)
# ZOHO_ACCESS_TOKEN=xxx
# ZOHO_ORG_ID=xxx
```

For development, you can run without Stripe configured - the app will show appropriate warnings.

## Available Scripts

```bash
# Development server with hot reload
npm run dev

# Production build
npm run build

# Start production server
npm start

# Run ESLint
npm run lint
```

## Project Structure

```
velocitypulse-web/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   │   ├── contact/       # Contact form handler
│   │   ├── partners/      # Partner application handler
│   │   └── stripe/        # Stripe checkout, portal, webhooks
│   ├── about/             # About page
│   ├── contact/           # Contact page
│   ├── demo/              # Free trial signup
│   ├── features/          # Features page
│   ├── legal/             # Privacy, Terms, GDPR pages
│   ├── partners/          # Partner program page
│   ├── pricing/           # Pricing page
│   └── layout.tsx         # Root layout
├── components/
│   ├── layout/            # Navbar, Footer
│   ├── sections/          # Hero, CTABanner, etc.
│   ├── ui/                # Button, Card, Input, etc.
│   ├── ErrorBoundary.tsx  # React error boundary
│   └── ThemeProvider.tsx  # Dark/light theme
├── hooks/
│   └── useFormSubmit.ts   # Reusable form submission hook
├── lib/
│   ├── constants.ts       # Form options, pricing, etc.
│   ├── env.ts             # Environment validation
│   ├── stripe.ts          # Stripe configuration
│   ├── validation.ts      # Zod schemas
│   └── zoho.ts            # Zoho Help Desk (placeholder)
├── public/                # Static assets
│   ├── symbol.png         # Logo symbol (light)
│   ├── symbol-white.png   # Logo symbol (dark)
│   └── manifest.json      # PWA manifest
├── middleware.ts          # Security headers & rate limiting
└── TODO.md               # Remaining work documentation
```

## Security Features

- **Content Security Policy** - Restricts resource loading
- **Rate Limiting** - Protects API endpoints from abuse
- **Input Validation** - All form inputs validated with Zod
- **Environment Validation** - Fails fast if required vars missing
- **Security Headers** - X-Frame-Options, HSTS, etc.

## Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

### Manual Deployment

```bash
# Build for production
npm run build

# Start production server
npm start
```

## Stripe Setup

1. Create a Stripe account at https://stripe.com
2. Create two products/prices:
   - Starter: $50/year
   - Unlimited: $950/year
3. Copy the price IDs to your environment variables
4. Set up webhooks pointing to `/api/stripe/webhook`
5. Add webhook signing secret to environment variables

Required webhook events:
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

## Contributing

See [TODO.md](./TODO.md) for remaining work items.

## License

Copyright 2026 Velocity EU Ltd. All rights reserved.
