# Deployment Setup Checklist

One-time setup tasks to complete the deployment pipeline.

## Vercel Git Integration

- [ ] Connect `velocitypulse-web` Vercel project to GitHub repo `velocityeu/velocitypulse` (root: `velocitypulse-web`)
- [ ] Connect `velocitypulse-dashboard` Vercel project to GitHub repo `velocityeu/velocitypulse` (root: `velocitypulse-dashboard`)
- [ ] Delete or disconnect any stale `velocitypulse` Vercel project (if one exists from manual deploys)

## Verify Auto-Deploy

- [ ] Push a test change to `velocitypulse-web/` and verify only the web project deploys
- [ ] Push a test change to `velocitypulse-dashboard/` and verify only the dashboard deploys
- [ ] Verify build ID in production footer matches the git commit SHA

## Agent Release

- [ ] Test agent release workflow by tagging `agent-v1.0.0` and pushing
- [ ] Verify GitHub Release is created with the pre-built archive
- [ ] Test Linux installer downloads from the new monorepo release
- [ ] Test Windows installer downloads from the new monorepo release

## Version Display

- [ ] Verify dashboard sidebar shows `v0.1.0 (abc1234)` format
- [ ] Verify web footer shows `v0.1.1 (abc1234)` format
- [ ] Verify agent UI header and footer show build ID when built via CI
