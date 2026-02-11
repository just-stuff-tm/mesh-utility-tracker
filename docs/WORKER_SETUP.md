# Cloudflare Worker Setup Guide

Complete step-by-step guide to deploy the mesh-utility-worker and set up the data repository.

## Prerequisites

- Node.js 18+ installed
- Cloudflare account (free tier works)
- GitHub account
- Git CLI installed

## Part 1: Cloudflare Worker Setup

### Step 1: Install Dependencies

```bash
cd worker
npm install
```

### Step 2: Login to Cloudflare

```bash
npx wrangler login
```

This will open your browser to authenticate with Cloudflare.

### Step 3: Create D1 Database

```bash
npm run db:create
```

**Output:**
```
✅ Successfully created DB 'mesh-utility-db'
database_id = "abc123-def456-ghi789"
```

**Action:** Copy the `database_id` and update `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "mesh-utility-db"
database_id = "abc123-def456-ghi789"  # ← Paste your ID here
```

### Step 4: Initialize Database Schema

```bash
npm run db:init
```

**Verify:**
```bash
npx wrangler d1 execute mesh-utility-db --command "SELECT name FROM sqlite_master WHERE type='table'"
```

You should see: `scans` and `commits` tables.

### Step 5: Test Locally

```bash
npm run dev
```

**Test endpoints:**
```bash
# Health check
curl http://127.0.0.1:8787/health

# Expected: {"status":"ok"}
```

## Part 2: GitHub Data Repository

### Step 6: Create Data Repository

1. Go to https://github.com/new
2. Repository name: `mesh-data`
3. Description: "Public MeshCore scan data"
4. **Public** visibility
5. Create repository

### Step 7: Initialize Repository Structure

```bash
# Clone your new repository
cd ..
git clone https://github.com/YOUR_USERNAME/mesh-data.git
cd mesh-data

# Create directory structure
mkdir -p scans deletions

# Copy README
cp ../mesh-utility-tracker/DATA_REPO_README.md README.md

# Initial commit
git add .
git commit -m "Initial repository structure"
git push origin main
```

### Step 8: Create GitHub Fine-Grained Token

1. Go to https://github.com/settings/tokens?type=beta
2. Click **"Generate new token"**
3. Token name: `mesh-utility-worker`
4. Expiration: `90 days` (or custom)
5. Repository access: **Only select repositories** → Choose `mesh-data`
6. Permissions:
   - **Contents**: **Read and write**
   - Metadata: Read-only (automatic)
7. Click **"Generate token"**
8. **Copy the token** (you won't see it again!)

Example token: `github_pat_11AAAAAAA0ABcDeFgHiJkLmNoPqRsTuVwXyZ123456789`

### Step 9: Configure Worker Secrets

```bash
cd ../mesh-utility-tracker/worker
npm run secret:github
```

**Prompt:** `Enter a secret value:`  
**Action:** Paste your GitHub token and press Enter

**Verify:**
```bash
npx wrangler secret list
```

You should see: `GITHUB_TOKEN`

### Step 10: Update Worker Configuration

Edit `wrangler.toml`:

```toml
[vars]
GITHUB_REPO = "YOUR_USERNAME/mesh-data"  # ← Update this
GITHUB_BRANCH = "main"
ALLOWED_ORIGINS = "https://YOUR_USERNAME.github.io"  # ← Update this

[env.dev.vars]
GITHUB_REPO = "YOUR_USERNAME/mesh-data"  # ← Update this
ALLOWED_ORIGINS = "http://localhost:5173,http://localhost:4173"
```

## Part 3: Deployment

### Step 11: Deploy Worker

```bash
npm run deploy
```

**Output:**
```
✨ Successfully published your Worker!
URL: https://mesh-utility-worker.YOUR_SUBDOMAIN.workers.dev
```

**Save this URL!** You'll need it for the frontend configuration.

### Step 12: Test Production Worker

```bash
# Health check
curl https://mesh-utility-worker.YOUR_SUBDOMAIN.workers.dev/health

# Expected: {"status":"ok"}
```

## Part 4: Frontend Integration

### Step 13: Update Environment Variables

Create `.env.production` in the main project:

```bash
cd ../mesh-utility-tracker
cat > .env.production << EOF
VITE_WORKER_URL=https://mesh-utility-worker.YOUR_SUBDOMAIN.workers.dev
EOF
```

### Step 14: Test Upload Flow

1. Build and run frontend:
```bash
npm run build
npm run preview
```

2. Open browser to `http://localhost:4173/mesh-utility-tracker/`

3. Connect MeshCore device

4. Go to Settings → Enable data sharing

5. Perform a scan (map page)

6. Check worker logs:
```bash
cd worker
npx wrangler tail
```

You should see: `Successfully committed X scans to GitHub`

7. Verify GitHub commit:
```bash
cd ../mesh-data
git pull
ls scans/$(date +%Y-%m-%d)/
```

You should see: `batch-TIMESTAMP.json`

## Part 5: Monitoring and Maintenance

### View Worker Logs

```bash
cd worker
npx wrangler tail
```

### Query Database

```bash
# View scan statistics
npx wrangler d1 execute mesh-utility-db --command \
  "SELECT COUNT(*) as total, COUNT(DISTINCT radioId) as unique_radios FROM scans"

# View recent commits
npx wrangler d1 execute mesh-utility-db --command \
  "SELECT * FROM commits ORDER BY committedAt DESC LIMIT 5"

# View pending scans
npx wrangler d1 execute mesh-utility-db --command \
  "SELECT COUNT(*) as pending FROM scans WHERE committed = 0"
```

### Update Worker

```bash
cd worker
# Make changes to src/
npm run deploy
```

### Rotate GitHub Token

1. Create new token (Step 8)
2. Update secret:
```bash
npm run secret:github
# Paste new token
```
3. Revoke old token on GitHub

## Troubleshooting

### Error: "Invalid binding DB"
**Cause:** Database ID not set in wrangler.toml  
**Fix:** Complete Step 3 and update database_id

### Error: "GitHub API returned 401"
**Cause:** Invalid or expired GitHub token  
**Fix:** Create new token (Step 8) and update secret (Step 9)

### Error: "CORS policy blocked request"
**Cause:** Origin not in ALLOWED_ORIGINS  
**Fix:** Update ALLOWED_ORIGINS in wrangler.toml and redeploy

### No scans appearing in GitHub
**Cause:** Batch size not reached or timeout not elapsed  
**Check:**
```bash
# View pending scans
npx wrangler d1 execute mesh-utility-db --command \
  "SELECT COUNT(*) FROM scans WHERE committed = 0"
```

**Force commit:**
```bash
curl -X POST https://mesh-utility-worker.YOUR_SUBDOMAIN.workers.dev/flush
```

### Worker crashes on startup
**Check logs:**
```bash
npx wrangler tail
```

**Common issues:**
- Syntax error in src/
- Missing Durable Object migration
- Invalid environment variable

## Costs

### Cloudflare Free Tier
- **Workers**: 100,000 requests/day
- **D1**: 5 GB storage, 5 million rows read/day
- **Durable Objects**: 1 million requests/month

### GitHub Free Tier
- **API**: 5,000 requests/hour
- **Storage**: Unlimited public repositories
- **Actions**: 2,000 minutes/month

**Estimated Usage:**
- 100 users × 10 scans/day = 1,000 scans/day
- 1,000 / 20 (batch size) = 50 commits/day
- 50 commits × 6 API calls = 300 GitHub API calls/day
- **Well within free tiers!**

## Security Best Practices

1. **GitHub Token**
   - Use fine-grained tokens (not classic)
   - Minimum required permissions
   - Set expiration date
   - Rotate regularly (90 days)

2. **CORS**
   - Only allow your domains
   - Never use wildcard (*) in production

3. **Rate Limiting**
   - Consider adding rate limiting to /scans endpoint
   - Use Cloudflare's built-in rate limiting rules

4. **Data Validation**
   - Already implemented in worker
   - Validates GPS coordinates, radioId format, etc.

## Next Steps

1. **Monitor first 24 hours** - Check worker logs and GitHub commits
2. **Add analytics** - Track scan statistics in D1
3. **Create data visualization** - Build dashboard for mesh-data
4. **Set up alerts** - Email notifications for errors
5. **Document API** - OpenAPI spec for /scans endpoint

## Support

- Worker issues: Check [worker/README.md](../worker/README.md)
- Frontend issues: Check main repository issues
- Data deletion: GitHub issue with `data-deletion` label

---

**Congratulations!** 🎉 Your mesh utility worker is now deployed and committing scan data to GitHub.
