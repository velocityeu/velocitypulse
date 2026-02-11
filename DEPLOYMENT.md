# VelocityPulse Deployment Guide

## Architecture Overview

```
velocitypulse/                    # Monorepo (velocityeu/velocitypulse)
  velocitypulse-web/              # Marketing website  -> velocitypulse.io
  velocitypulse-dashboard/        # Dashboard app      -> app.velocitypulse.io
  velocitypulse-agent/            # Network agent      -> GitHub Releases
  supabase/                       # Database migrations -> Supabase CI
```

## Repository Visibility

`velocityeu/velocitypulse` is public. Agent release assets are publicly downloadable from GitHub Releases.

## Automatic Deployment Pipeline

### On push to `main`:

| Component | Deploy Method | Trigger |
|-----------|--------------|---------|
| Marketing website | GitHub Actions (`main-build-deploy.yml`) -> Vercel CLI | Every push to `main` |
| Dashboard app | GitHub Actions (`main-build-deploy.yml`) -> Vercel CLI | Every push to `main` |
| Agent build/test | GitHub Actions (`main-build-deploy.yml`) | Every push to `main` |
| Agent release archives | GitHub Actions (`main-build-deploy.yml`) | Every push to `main` if release `agent-vX.Y.Z` does not already exist |
| Database migrations | GitHub Actions (`supabase-migrate.yml`) | Push to `main` (if `supabase/` changed) |

`main-build-deploy.yml` gates deployment on successful rebuilds of all three components and then deploys dashboard + marketing web to Vercel production.

### Agent Releases (from `main` pipeline):

`main-build-deploy.yml` publishes the agent release when:
1. `velocitypulse-agent/package.json` version matches `velocitypulse-agent/src/utils/version.ts`
2. release `agent-vX.Y.Z` does not already exist

The release step:
1. Verifies tag matches `package.json` and `version.ts`
2. Injects the git SHA as build ID
3. Builds and tests the agent
4. Creates a pre-built archive (`velocitypulse-agent-X.Y.Z.tar.gz`)
5. Publishes a GitHub Release with the archive attached

Manual tag-based release (`agent-release.yml`) is still available if you intentionally push `agent-v*` tags.

## Vercel Project Configuration

### velocitypulse-web (velocitypulse.io)
- **Vercel Project:** Connect to `velocityeu/velocitypulse`
- **Root Directory:** `velocitypulse-web`
- **Framework:** Next.js
- **Build Command:** `npm run build`
- **Output Directory:** `.next`

### velocitypulse-dashboard (app.velocitypulse.io)
- **Vercel Project:** Connect to `velocityeu/velocitypulse`
- **Root Directory:** `velocitypulse-dashboard`
- **Framework:** Next.js
- **Build Command:** `npm run build`
- **Output Directory:** `.next`

### Connecting Vercel to GitHub (one-time setup):
1. Go to Vercel Dashboard > Project Settings > Git
2. Connect to `velocityeu/velocitypulse`
3. Set Root Directory to the appropriate sub-project folder

## Environment Variables

### Vercel (Dashboard)
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `CLERK_SECRET_KEY` - Clerk authentication secret
- `CLERK_WEBHOOK_SECRET` - Clerk webhook verification
- `STRIPE_SECRET_KEY` - Stripe payment secret
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook verification
- `STRIPE_STARTER_PRICE_ID` - Stripe starter plan price
- `STRIPE_UNLIMITED_PRICE_ID` - Stripe unlimited plan price
- `SENTRY_AUTH_TOKEN` - Sentry error tracking
- `NEXT_PUBLIC_SENTRY_DSN` - Sentry DSN (public)

### Vercel (Web)
- `NEXT_PUBLIC_DASHBOARD_URL` - Dashboard URL
- `SENTRY_AUTH_TOKEN` - Sentry error tracking
- `NEXT_PUBLIC_SENTRY_DSN` - Sentry DSN (public)

### GitHub Actions (Agent Release)
- No additional secrets required (uses `GITHUB_TOKEN` with `contents: write`)
- Agent install scripts do not require user-provided GitHub tokens in normal operation

### GitHub Actions (Main Build + Deploy)
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_DASHBOARD_PROJECT_ID`
- `VERCEL_WEB_PROJECT_ID`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (dashboard build step)

### Auto-injected by Vercel
- `VERCEL_GIT_COMMIT_SHA` - Used to derive `NEXT_PUBLIC_BUILD_ID`

## Version Verification

After deployment, verify version strings appear correctly:

| Location | Where to check |
|----------|---------------|
| Dashboard sidebar | Bottom of sidebar: `v<dashboard-package-version> (<build-id>)` |
| Marketing footer | Bottom bar: `v<web-package-version> (<build-id>)` |
| Agent header badge | Header: `v<agent-version> (<build-id>)` |
| Agent footer | Footer: `VelocityPulse Agent v<agent-version> (<build-id>)` |

The build ID should match the first 7 chars of the deployed git commit SHA.

## Rollback Procedures

### Vercel (Web / Dashboard)
Vercel provides instant rollback:
1. Go to Vercel Dashboard > Deployments
2. Find the previous working deployment
3. Click "..." > "Promote to Production"

### Database Migrations
1. Create a new migration that reverses the changes
2. Push to `main` to trigger `supabase-migrate.yml`

### Agent
Users can reinstall the previous version:
```bash
# Linux
curl -sSL https://get.velocitypulse.io/agent.sh | sudo bash

# Windows (PowerShell as Admin)
irm https://get.velocitypulse.io/agent | iex
```

## Local Development

```bash
# Dashboard
cd velocitypulse-dashboard
npm install
npm run dev          # http://localhost:3000

# Marketing website
cd velocitypulse-web
npm install
npm run dev          # http://localhost:3000

# Agent
cd velocitypulse-agent
npm install
npm run build
npm start            # http://localhost:3001
```
