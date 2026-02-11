# Cloudflare Pages Deployment Guide

This guide walks you through deploying the mesh-utility-tracker to Cloudflare Pages.

## ✅ Successfully Deployed

**Current Production Deployment:**
- **Frontend:** https://cb32b845.mesh-utility-tracker.pages.dev
- **Worker:** https://mesh-utility-worker.aaffiliate796.workers.dev
- **Status:** Live and operational (deployed February 10, 2026)
- **Build Size:** 872.66 kB (267.03 kB gzipped)

## Why Cloudflare Pages?

✅ **Co-located with Worker** - Frontend and backend on same infrastructure  
✅ **Better Performance** - 300+ global CDN locations  
✅ **Still Free** - Unlimited requests, 500 builds/month  
✅ **Simpler CORS** - No cross-domain complexity  
✅ **Custom Domains** - Free SSL with auto-renewal  

## Prerequisites

- Cloudflare account (same one used for Worker)
- Wrangler CLI installed: `npm install -g wrangler`
- Worker already deployed (see [WORKER_SETUP.md](WORKER_SETUP.md))

## Quick Deploy (5 minutes)

### 1. Login to Cloudflare

```powershell
wrangler login
```

### 2. Build the App

```powershell
npm install
npm run build:pages
```

This creates an optimized production build in the `dist/` folder.

### 3. Deploy to Cloudflare Pages

```powershell
npm run deploy:pages
```

Or manually:

```powershell
wrangler pages deploy dist --project-name=mesh-utility-tracker
```

**First deployment** will ask:
- ✓ Create project? → **Yes**
- Production branch → **Enter** (defaults to current branch)

### 4. Note Your Pages URL

After deployment completes, you'll see:

```
✨ Deployment complete!
URL: https://mesh-utility-tracker.pages.dev
```

### 5. Update Worker CORS Settings

Edit `worker/wrangler.toml`:

```toml
[vars]
ALLOWED_ORIGINS = "https://mesh-utility-tracker.pages.dev"
GITHUB_REPO = "just-stuff-tm/mesh-data"
GITHUB_BRANCH = "main"
```

Deploy the updated worker:

```powershell
cd worker
npm run deploy
```

### 6. Test the Deployment

Visit your Pages URL and verify:
- ✓ App loads correctly
- ✓ Maps display properly
- ✓ Settings page opens
- ✓ Bluetooth scanning works (if you have a device)
- ✓ Test scan upload works

## Custom Domain Setup (Optional)

### Add Your Domain

1. Go to [Cloudflare Pages Dashboard](https://dash.cloudflare.com/?to=/:account/pages)
2. Click your project → **Custom domains**
3. Click **Set up a custom domain**
4. Enter your domain (e.g., `mesh.example.com`)
5. Follow the DNS setup instructions

### Update Worker CORS

After adding custom domain, update `worker/wrangler.toml`:

```toml
[vars]
ALLOWED_ORIGINS = "https://mesh.example.com"
```

Then redeploy: `cd worker && npm run deploy`

## Auto-Deployment from Git (Optional)

Connect your GitHub repository for automatic deployments:

1. Go to **Pages** → Your project → **Settings**
2. Click **Git integration** → **Connect to Git**
3. Select your repository
4. Configure build settings:
   - **Build command:** `npm run build:pages`
   - **Build output directory:** `dist`
   - **Root directory:** `/` (leave empty)
5. Click **Save**

Now every push to your branch automatically deploys!

## Updating the App

### Manual Updates

```powershell
git pull
npm install  # If dependencies changed
npm run deploy:pages
```

### With Git Integration

Just push to your repository:

```powershell
git add .
git commit -m "Update feature"
git push
```

Cloudflare automatically builds and deploys!

## Environment Variables

To set environment variables for production:

1. Go to **Pages** → Your project → **Settings** → **Environment variables**
2. Add variables as needed:
   - `VITE_WORKER_URL` - Your worker URL
   - `VITE_MAPBOX_TOKEN` - Mapbox token (if using)

## Rollback to Previous Version

1. Go to **Pages** → Your project → **Deployments**
2. Find the version you want to restore
3. Click **⋯** → **Rollback to this deployment**

## Monitoring

View deployment logs and analytics:

- **Deployments:** https://dash.cloudflare.com/?to=/:account/pages/view/mesh-utility-tracker
- **Analytics:** Built-in Web Analytics (free, privacy-friendly)

## Troubleshooting

### Build Fails

Check the build log in Cloudflare dashboard. Common issues:
- Missing dependencies → Run `npm install` locally first
- TypeScript errors → Run `npm run check` locally
- Environment variables → Verify in Settings

### App Loads But API Fails

Check worker CORS settings:
```powershell
cd worker
npx wrangler tail  # Live log streaming
```

Visit your app and try an action. Check if CORS errors appear.

### Routes Don't Work (404 on Refresh)

Ensure `_redirects` file exists in project root:
```
/* /index.html 200
```

### Environment Variables Not Embedded

**Issue:** `VITE_WORKER_URL` not appearing in production build

**Solution:** Vite loads environment variables from both `.env` and `.env.production` files. If `.env` has a value, it may override `.env.production`. Ensure both files have the production worker URL:

```bash
# .env
VITE_WORKER_URL=https://mesh-utility-worker.aaffiliate796.workers.dev

# .env.production
VITE_WORKER_URL=https://mesh-utility-worker.aaffiliate796.workers.dev
```

Then rebuild: `npm run build`

### Dead Zone Classification Issue

**Issue:** Scans finding nodes incorrectly shown as dead zones

**Fixed:** Changed logic from RSSI threshold to node detection:
- Old: `isDeadZone = bestRssi < -100 dBm`  
- New: `isDeadZone = no nodes found in scan`

Weak signals (e.g., -118 dBm) now correctly show as "Poor" instead of dead zones.

## Known Fixes & Solutions Reference

This section documents critical fixes and design decisions made during development. These are **ground truth** for how the system should behave.

### 1. Dead Zone Data Isolation ✅

**Behavior:** Dead zones are stored locally only and NEVER uploaded to Cloudflare/GitHub.

**Why:** 
- Dead zones are device-specific and not useful for public mesh data
- Prevents pollution of GitHub mesh-data repository with non-data
- Reduces cloud storage and API usage

**Implementation:**
- Successful scans (with nodes) → Queue to worker → D1 → GitHub
- Failed scans (no nodes) → Mark as dead zone in IndexedDB only
- Code: `src/lib/bluetooth-context.tsx` lines 353-378

**Verification:** Worker has no dead zone endpoint, only `/scans` endpoint accepts data.

### 2. Dead Zone Protection Rules ✅

**Rule 1:** Dead zones never overwrite successful scan zones
- If a hex has successful scan data (scanCount > 0), a failed scan will NOT mark it as dead zone
- Prevents temporary outages from destroying good coverage data

**Rule 2:** Successful scans automatically clear dead zones
- When a successful scan occurs in a previously marked dead zone, it converts to active zone
- Sets `isDeadZone: false` and updates coverage metrics

**Implementation:**
- `src/lib/bluetooth-context.tsx` lines 398-424 (successful scan handling)
- `src/lib/bluetooth-context.tsx` lines 435-458 (dead zone creation with protection)

**Example:**
```typescript
// Before: Dead zone exists
{ isDeadZone: true, scanCount: 0, avgRssi: null }

// After: Successful scan
{ isDeadZone: false, scanCount: 1, avgRssi: -95 }
```

### 3. Offline Mode Sync Prevention ✅

**Behavior:** When offline mode is enabled, scans queue locally but do NOT sync to Cloudflare.

**Why:** Users may want to collect data without uploading (privacy, testing, offline fieldwork).

**Fix Applied:**
- Auto-upload timer checks `isOnline()` before attempting sync
- Manual sync throws error "Cannot sync while offline" when offline
- Sync Now button automatically disabled when offline

**Implementation:**
- `src/lib/bluetooth-context.tsx` line 703: `if (count > 0 && now - lastUploadTime >= intervalMs && isOnline())`
- `src/lib/bluetooth-context.tsx` lines 727-730: Manual sync validation
- `src/components/settings-panel.tsx` line 521: Button disabled state

**User Experience:** 
- Toggle offline → Scans continue scanning and queueing
- Toggle online → Queued scans automatically sync at next interval

### 4. Environment Variable Build Issues ✅

**Issue:** `VITE_WORKER_URL` showing as localhost in production builds

**Root Cause:** Vite loads both `.env` (default) and `.env.production` (production mode). If `.env` has a value, it can override `.env.production` depending on load order.

**Solution:** Both files must have production URLs:

```bash
# .env (default environment)
VITE_WORKER_URL=https://mesh-utility-worker.aaffiliate796.workers.dev

# .env.production (production build)
VITE_WORKER_URL=https://mesh-utility-worker.aaffiliate796.workers.dev
```

**Verification:** After build, search dist files for worker URL:
```powershell
grep -r "aaffiliate796" dist/
```

### 5. CORS Credentials Header ✅

**Issue:** Worker rejecting requests with "Access-Control-Allow-Credentials header value must be 'true'"

**Fix:** Added credentials header to worker CORS response:

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Credentials': 'true',  // ← Required
};
```

**Location:** `worker/src/index.ts` lines 40-45

### 6. Scan Upload Endpoint Fix ✅

**Issue:** POST requests to worker root `/` returning 404

**Fix:** Changed upload URL from `workerUrl` to `${workerUrl}/scans`

**Before:** `url: workerUrl` (posting to root)  
**After:** `url: ${workerUrl}/scans` (posting to correct endpoint)

**Location:** `src/lib/bluetooth-context.tsx` line 376

### 7. Scan Payload Format Fix ✅

**Issue:** Worker validation failing with "Invalid scan data"

**Root Cause:** Client sending flat object, worker expecting array with nested structure

**Before:**
```json
{
  "observerId": "local-observer",
  "nodeId": "!abc123",
  "rssi": -95,
  "snr": 5.2,
  "latitude": 40.7128,
  "longitude": -74.0060
}
```

**After:**
```json
[{
  "radioId": "local-observer",
  "timestamp": 1707599200000,
  "location": {
    "lat": 40.7128,
    "lon": -74.0060,
    "altitude": 50
  },
  "nodes": [{
    "nodeId": "!abc123",
    "rssi": -95,
    "snr": 5.2,
    "hopLimit": undefined
  }]
}]
```

**Location:** `src/lib/bluetooth-context.tsx` lines 356-370

**Worker Validation:** `worker/src/index.ts` line 64: `if (!Array.isArray(scans))`

### 8. PWA Manifest Icon Paths ✅

**Issue:** PWA icon 404 errors when deployed to Cloudflare Pages root

**Root Cause:** GitHub Pages subpath deployment used `/mesh-utility-tracker/` prefix, Cloudflare Pages uses root `/`

**Fix:** Changed manifest icon paths from subpath to root:
- Before: `/mesh-utility-tracker/app-icon-192.png`
- After: `/app-icon-192.png`

**Location:** `public/manifest.json`

**Related:** Vite config sets `base: "/"` for root deployment

### 9. Dead Zone Classification Logic ✅

**Issue:** Scans successfully finding nodes but marked as dead zones

**Root Cause:** Using RSSI threshold instead of node presence check

**Before:**
```typescript
const bestRssi = Math.max(...scans.map(s => s.rssi));
const isDeadZone = bestRssi < DEAD_ZONE_THRESHOLD; // -100 dBm
```

**After:**
```typescript
const scansWithNodes = cellScans.filter(s => s.nodeId != null && s.nodeId !== "");
const isDeadZone = scansWithNodes.length === 0;
```

**Location:** `src/lib/scan-aggregator.ts` lines 86-88

**Impact:** Weak but successful signals (e.g., -118 dBm) now correctly classified as "Poor" coverage instead of dead zones.

### 10. CORS Origin Updates Per Deployment

**Behavior:** Each Cloudflare Pages deployment gets unique preview URL requiring CORS update

**Current Process:**
1. Deploy frontend → Get URL (e.g., `243f5d20.mesh-utility-tracker.pages.dev`)
2. Update `worker/wrangler.toml` → `ALLOWED_ORIGINS = "https://243f5d20..."`
3. Deploy worker with new CORS settings

**Future Improvement Options:**
- Set up custom domain (stable URL, no updates needed)
- Use production branch deployment (stable URL without hash)
- Use wildcard CORS: `*.mesh-utility-tracker.pages.dev` (less secure)

**Note:** This is expected behavior until custom domain is configured.

## Cost Estimate

**Cloudflare Pages Free Tier:**
- ✅ Unlimited requests
- ✅ Unlimited bandwidth
- ✅ 500 builds/month
- ✅ 100 custom domains
- ✅ Built-in analytics

**This app stays FREE** unless you exceed 500 builds/month.

## Comparing Deployment Options

| Feature | GitHub Pages | Cloudflare Pages |
|---------|-------------|------------------|
| **CDN Locations** | ~10 | 300+ |
| **HTTPS** | ✓ | ✓ |
| **Custom Domain** | ✓ | ✓ (easier setup) |
| **Build Time** | ~2-5 min | ~1-2 min |
| **Co-located with Worker** | ✗ | ✓ |
| **CORS Complexity** | Higher | Lower |
| **Cost** | Free | Free |

## Next Steps

- ✅ Deploy worker updates as needed
- ✅ Set up custom domain (optional)
- ✅ Enable Git auto-deployment (optional)
- ✅ Monitor analytics in dashboard
- ✅ Keep GitHub Pages as backup (optional)

## Support

- 📖 [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- 💬 [Cloudflare Discord](https://discord.cloudflare.com/)
- 📚 [Worker Setup Guide](WORKER_SETUP.md)
