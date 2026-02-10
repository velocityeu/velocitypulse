# Deployment Setup Checklist

One-time setup tasks to complete the deployment pipeline.

## Vercel Git Integration

- [x] Connect `velocitypulse-web` Vercel project to GitHub repo `velocityeu/velocitypulse` (root: `velocitypulse-web`)
- [x] Connect `velocitypulse-dashboard` Vercel project to GitHub repo `velocityeu/velocitypulse` (root: `velocitypulse-dashboard`)
- [x] Delete or disconnect any stale `velocitypulse` Vercel project — deleted

## Verify Auto-Deploy

- [ ] Push a test change to `velocitypulse-web/` and verify only the web project deploys
- [x] Push a test change to `velocitypulse-dashboard/` and verify only the dashboard deploys — confirmed: `efe3d2a` push auto-deployed dashboard in ~1m; web correctly skipped by ignoreCommand
- [x] Verify build ID in production footer matches the git commit SHA — web shows `281dd96` (its last deploy commit), dashboard deployed with `efe3d2a`

## Agent Release

- [x] Test agent release workflow by tagging `agent-v1.0.0` and pushing — completed in 38s
- [x] Verify GitHub Release is created with the pre-built archive — both `.tar.gz` (122K) and `.zip` (170K) assets attached
- [x] Test Linux installer downloads from the new monorepo release — verified: API discovery, asset download (via `GITHUB_TOKEN` for private repo), extraction to wrapper dir, `dist/index.js` + `package.json` + `src/ui/public` all present
- [ ] Test Windows installer downloads from the new monorepo release (needs Windows machine)

## Version Display

- [ ] Verify dashboard sidebar shows `v0.1.0 (abc1234)` format (requires auth — can't verify via curl)
- [x] Verify web footer shows `v0.1.1 (abc1234)` format — confirmed `281dd96` in HTML
- [ ] Verify agent UI header and footer show build ID when built via CI
