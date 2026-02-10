# VelocityPulse Deployment Guide

## Architecture Overview

```
velocitypulse/                    # Monorepo (velocityeu/velocitypulse)
  velocitypulse-web/              # Marketing website  -> velocitypulse.io
  velocitypulse-dashboard/        # Dashboard app      -> app.velocitypulse.io
  velocitypulse-agent/            # Network agent      -> GitHub Releases
  supabase/                       # Database migrations -> Supabase CI
```

## Automatic Deployment Pipeline

### On push to `main`:

| Component | Deploy Method | Trigger |
|-----------|--------------|---------|
| Marketing website | Vercel Git Integration | Push to `main` (if `velocitypulse-web/` changed) |
| Dashboard app | Vercel Git Integration | Push to `main` (if `velocitypulse-dashboard/` changed) |
| Database migrations | GitHub Actions (`supabase-migrate.yml`) | Push to `main` (if `supabase/` changed) |

Each Vercel project uses `ignoreCommand: "git diff --quiet HEAD^ HEAD -- ."` to only deploy when its directory has changes.

### Agent Releases (manual tag):

The agent is released via GitHub Releases using tag-prefixed releases (`agent-v*`).

```bash
# 1. Bump version in both files:
#    - velocitypulse-agent/package.json
#    - velocitypulse-agent/src/utils/version.ts
# 2. Commit and push to main
# 3. Tag and push:
git tag agent-v1.0.1
git push origin agent-v1.0.1
```

This triggers `.github/workflows/agent-release.yml` which:
1. Verifies tag matches `package.json` and `version.ts`
2. Injects the git SHA as build ID
3. Builds and tests the agent
4. Creates a pre-built archive (`velocitypulse-agent-X.Y.Z.tar.gz`)
5. Publishes a GitHub Release with the archive attached

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

### Auto-injected by Vercel
- `VERCEL_GIT_COMMIT_SHA` - Used to derive `NEXT_PUBLIC_BUILD_ID`

## Version Verification

After deployment, verify version strings appear correctly:

| Location | Where to check |
|----------|---------------|
| Dashboard sidebar | Bottom of sidebar: `v0.1.0 (abc1234)` |
| Marketing footer | Bottom bar: `v0.1.1 (abc1234)` |
| Agent header badge | Header: `v1.0.0 (abc1234)` |
| Agent footer | Footer: `VelocityPulse Agent v1.0.0 (abc1234)` |

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
