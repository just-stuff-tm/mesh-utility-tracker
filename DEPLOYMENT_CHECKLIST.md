# Worker Deployment Checklist

Use this checklist to deploy the mesh-utility-worker from scratch.

## Prerequisites

- [ ] Node.js 18+ installed
- [ ] Cloudflare account created (free tier)
- [ ] GitHub account
- [ ] Git CLI installed
- [ ] Wrangler CLI installed (`npm install -g wrangler`)

## Part 1: Cloudflare Setup (15 minutes)

- [ ] Login to Cloudflare: `npx wrangler login`
- [ ] Navigate to worker directory: `cd worker`
- [ ] Install dependencies: `npm install`
- [ ] Create D1 database: `npm run db:create`
- [ ] Copy `database_id` from output
- [ ] Update `wrangler.toml` with `database_id`
- [ ] Initialize database schema: `npm run db:init`
- [ ] Verify tables created: `npx wrangler d1 execute mesh-utility-db --command "SELECT name FROM sqlite_master WHERE type='table'"`
- [ ] Expected output: `scans`, `commits`

## Part 2: GitHub Data Repository (10 minutes)

- [ ] Create new public repository: `just-stuff-tm/mesh-data`
- [ ] Clone repository locally: `git clone https://github.com/YOUR_USERNAME/mesh-data.git`
- [ ] Create directory structure:
  ```bash
  cd mesh-data
  mkdir -p scans deletions
  cp ../mesh-utility-tracker/DATA_REPO_README.md README.md
  git add .
  git commit -m "Initial repository structure"
  git push origin main
  ```

## Part 3: GitHub Token (5 minutes)

- [ ] Go to: https://github.com/settings/tokens?type=beta
- [ ] Click "Generate new token"
- [ ] Set token name: `mesh-utility-worker`
- [ ] Set expiration: `90 days` (or custom)
- [ ] Repository access: Only select `mesh-data` repository
- [ ] Permissions:
  - [ ] Contents: **Read and write** ✓
  - [ ] Metadata: Read-only (automatic) ✓
- [ ] Click "Generate token"
- [ ] **Copy token immediately** (won't be shown again!)
- [ ] Format: `github_pat_11AAAAAAA0ABcDeFgHiJkLmNoPqRsTuVwXyZ`

## Part 4: Worker Configuration (5 minutes)

- [ ] Return to worker directory: `cd ../mesh-utility-tracker/worker`
- [ ] Set GitHub token secret: `npm run secret:github`
  - [ ] Paste token when prompted
  - [ ] Press Enter
- [ ] Verify secret: `npx wrangler secret list`
  - [ ] Should show: `GITHUB_TOKEN`
- [ ] Update `wrangler.toml`:
  ```toml
  [vars]
  GITHUB_REPO = "YOUR_USERNAME/mesh-data"  # ← Update
  ALLOWED_ORIGINS = "https://YOUR_USERNAME.github.io"  # ← Update
  ```

## Part 5: Local Testing (10 minutes)

- [ ] Start local dev server: `npm run dev`
- [ ] Worker should be at: `http://127.0.0.1:8787`
- [ ] Test health endpoint:
  ```bash
  curl http://127.0.0.1:8787/health
  ```
  - [ ] Expected: `{"status":"ok"}`
- [ ] Test scan upload:
  ```bash
  curl -X POST http://127.0.0.1:8787/scans \
    -H "Content-Type: application/json" \
    -d '[{"radioId":"!test1234","timestamp":1705334400000,"location":{"lat":37.7749,"lon":-122.4194},"nodes":[{"nodeId":"!abc","rssi":-85,"snr":8.5}]}]'
  ```
  - [ ] Expected: `{"success":true,"queued":1,...}`
- [ ] Check D1 database:
  ```bash
  npx wrangler d1 execute mesh-utility-db --command "SELECT COUNT(*) FROM scans"
  ```
  - [ ] Should show: `1` (or more)
- [ ] Stop dev server: `Ctrl+C`

## Part 6: Production Deployment (5 minutes)

- [ ] Deploy to production: `npm run deploy`
- [ ] Copy worker URL from output
  - [ ] Format: `https://mesh-utility-worker.YOUR_SUBDOMAIN.workers.dev`
- [ ] Test production health:
  ```bash
  curl https://mesh-utility-worker.YOUR_SUBDOMAIN.workers.dev/health
  ```
  - [ ] Expected: `{"status":"ok"}`

## Part 7: Frontend Integration (10 minutes)

- [ ] Navigate to project root: `cd ..`
- [ ] Create `.env.production`:
  ```bash
  echo "VITE_WORKER_URL=https://mesh-utility-worker.YOUR_SUBDOMAIN.workers.dev" > .env.production
  ```
- [ ] Update GitHub Pages CORS in `wrangler.toml`:
  ```toml
  [vars]
  ALLOWED_ORIGINS = "https://just-stuff-tm.github.io,http://localhost:5173"
  ```
- [ ] Redeploy worker: `cd worker && npm run deploy && cd ..`
- [ ] Build frontend: `npm run build`
- [ ] Push to GitHub:
  ```bash
  git add .
  git commit -m "Configure worker URL"
  git push origin mesh-utility
  ```
- [ ] Wait for GitHub Actions deployment (~2 min)

## Part 8: End-to-End Testing (15 minutes)

- [ ] Open app: `https://just-stuff-tm.github.io/mesh-utility-tracker/`
- [ ] Connect Meshtastic device via Bluetooth
- [ ] Navigate to Settings
- [ ] Check "Enable data sharing" (if implemented)
- [ ] Navigate to Map page
- [ ] Perform a few scans (walk around with GPS)
- [ ] Wait 5 minutes OR trigger 20 scans
- [ ] Check worker logs:
  ```bash
  cd worker
  npx wrangler tail
  ```
  - [ ] Look for: `Successfully committed X scans to GitHub`
- [ ] Check GitHub repository:
  ```bash
  cd ../mesh-data
  git pull
  ls -la scans/$(date +%Y-%m-%d)/
  ```
  - [ ] Should see: `batch-TIMESTAMP.json`
- [ ] View file contents:
  ```bash
  cat scans/$(date +%Y-%m-%d)/batch-*.json | jq .
  ```
  - [ ] Should show: Array of scan objects

## Part 9: Monitoring Setup (5 minutes)

- [ ] Bookmark Cloudflare dashboard: `https://dash.cloudflare.com`
- [ ] Navigate to Workers & Pages
- [ ] Click `mesh-utility-worker`
- [ ] Bookmark "Metrics" tab for monitoring
- [ ] Set up email alerts (optional):
  - [ ] Go to "Settings" → "Triggers"
  - [ ] Add trigger for error rate > 5%

## Verification Checklist

After deployment, verify:

- [ ] Worker health endpoint returns `{"status":"ok"}`
- [ ] Scan upload endpoint accepts data
- [ ] D1 database contains scans
- [ ] GitHub repository receives commits
- [ ] Frontend can fetch history
- [ ] CORS allows GitHub Pages origin
- [ ] Logs show successful commits
- [ ] No errors in worker logs
- [ ] GitHub Actions deployment succeeds

## Common Issues

### "Invalid binding DB"
- **Cause:** `database_id` not set in `wrangler.toml`
- **Fix:** Re-run Part 1, step 5-6

### "GitHub API 401 Unauthorized"
- **Cause:** Invalid or missing GitHub token
- **Fix:** Re-run Part 3, then Part 4

### "CORS policy blocked"
- **Cause:** Origin not in `ALLOWED_ORIGINS`
- **Fix:** Update `wrangler.toml` and redeploy worker

### "No data in GitHub after 5 minutes"
- **Cause:** Batch not triggered yet
- **Check:** Query pending scans:
  ```bash
  npx wrangler d1 execute mesh-utility-db --command "SELECT COUNT(*) FROM scans WHERE committed = 0"
  ```
- **Fix:** Wait longer or reduce batch size in `batch.ts`

### "Worker deployment fails"
- **Cause:** Syntax error or missing dependency
- **Check logs:** Error message in terminal
- **Fix:** Review code changes, ensure TypeScript compiles

## Rollback Procedure

If deployment fails:

1. [ ] Revert worker deployment:
   ```bash
   git log --oneline
   git revert HEAD
   cd worker && npm run deploy
   ```

2. [ ] Restore previous worker version:
   ```bash
   npx wrangler rollback
   ```

3. [ ] Check Cloudflare dashboard for previous version

4. [ ] Redeploy from known good commit:
   ```bash
   git checkout <good-commit-sha>
   cd worker && npm run deploy
   ```

## Maintenance Schedule

### Daily
- [ ] Check worker logs for errors
- [ ] Monitor GitHub commit frequency

### Weekly
- [ ] Review D1 database size
- [ ] Check GitHub repository size
- [ ] Review Cloudflare usage statistics

### Monthly
- [ ] Rotate GitHub token (if expiring)
- [ ] Review and optimize batch size
- [ ] Archive old scan data (optional)

### Quarterly
- [ ] Update Wrangler CLI: `npm install -g wrangler@latest`
- [ ] Review Cloudflare pricing changes
- [ ] Audit CORS origins

## Support Resources

- [ ] Worker README: `worker/README.md`
- [ ] Setup Guide: `WORKER_SETUP.md`
- [ ] Architecture: `ARCHITECTURE.md`
- [ ] Cloudflare Docs: https://developers.cloudflare.com/workers/
- [ ] GitHub API Docs: https://docs.github.com/en/rest
- [ ] Project Issues: https://github.com/just-stuff-tm/mesh-utility-tracker/issues

## Completion

- [ ] All steps completed successfully
- [ ] End-to-end test passed
- [ ] Monitoring configured
- [ ] Documentation bookmarked
- [ ] Team notified (if applicable)

**Deployment Date:** _______________  
**Worker URL:** _______________  
**GitHub Data Repo:** _______________  
**Deployed By:** _______________

---

**Congratulations! 🎉** Your mesh utility worker is now live and collecting data.
