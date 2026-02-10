# Mesh Utility Tracker - Migration Complete ✅

## Architecture Overview

This project has been migrated to a **serverless, database-free architecture** for zero infrastructure costs and infinite scalability.

### Key Components

1. **Cloudflare Worker** ([cloudflare/worker.ts](cloudflare/worker.ts))
   - Ingest-only endpoint (POST /)
   - Appends scan data to daily NDJSON files in GitHub
   - Serves history via read-through endpoints
   - **Scales to 1000+ weekly users** with retry logic & exponential backoff

2. **GitHub Repository** (Cold Storage)
   - Source of truth: `data/scans/YYYY-MM-DD.ndjson`
   - Full Git history for audit trail
   - Infinite free storage
   - No operational overhead

3. **Client-Side Aggregation** ([client/src/lib/scan-aggregator.ts](client/src/lib/scan-aggregator.ts))
   - Fetches NDJSON from worker
   - Computes hexagonal coverage zones using **exact preserved math**
   - No backend required for visualization

### What Was Removed

❌ Express server  
❌ PostgreSQL database  
❌ Drizzle ORM  
❌ Server-side routes  
❌ Paid hosting requirements  

### What Was Preserved

✅ **Hex grid math** - exact formulas in [shared/grid.ts](shared/grid.ts)  
✅ **UI behavior** - identical visual rendering  
✅ **Offline-first** - PWA + IndexedDB  
✅ **Core functionality** - coverage mapping, node discovery, signal analysis  

---

## Running the Project

### Prerequisites

- Node.js 18+
- GitHub personal access token with **repo** scope
- (Optional) Cloudflare account for production deployment

### Development Setup

#### 1. Install Dependencies

```bash
npm install
```

#### 2. Configure Cloudflare Worker

Create `cloudflare/.dev.vars`:

```env
GITHUB_TOKEN=ghp_your_token_here
```

Make sure your token has **repo** scope from https://github.com/settings/tokens

#### 3. Start Worker (Terminal 1)

```bash
npm run worker:dev
```

This starts the local worker at `http://127.0.0.1:8787`

#### 4. Start Client (Terminal 2)

```bash
npm run dev
```

Client runs at `http://localhost:5173` (default Vite port)

#### 5. Configure Worker URL

Create `client/.env.local`:

```env
VITE_WORKER_URL=http://127.0.0.1:8787
```

---

## Data Flow

### Write Path

```
Mobile/Web Client
  ↓ POST scan data
Cloudflare Worker
  ↓ Append to NDJSON
GitHub Contents API
  → data/scans/2026-02-10.ndjson
```

### Read Path

```
Client
  ↓ GET /history
Worker (pass-through)
  ↓ Fetch NDJSON files
GitHub Contents API
  ↓ Return raw scans
Client-Side Aggregator
  → Compute hex zones
  → Render coverage map
```

---

## Hex Grid Math (Critical - DO NOT CHANGE)

Located in [shared/grid.ts](shared/grid.ts):

```typescript
export const HEX_SIZE = 0.0007;
export const LNG_SCALE = 1.2;
export const ROW_SPACING = HEX_SIZE * 1.5;
export const COL_SPACING = HEX_SIZE * Math.sqrt(3) * LNG_SCALE;
```

These constants ensure **perfect pixel-aligned hex tiling** across the map. Any modification will break coverage zones.

---

## Scaling Characteristics

### Current Capacity (with GitHub Contents API)

- **1000 weekly users** ✅
- ~143 users/day average
- ~14,300 scans/day @ 100 scans/user
- ~2.8MB/day in NDJSON files

### Bottlenecks & Solutions

| Concern | Solution |
|---------|----------|
| Concurrent writes | Retry with exponential backoff (5 attempts) |
| File size growth | Daily rotation (automatic) |
| GitHub rate limits | 5000 requests/hour (sufficient for this scale) |
| Client processing | Efficient hex aggregation (O(n) complexity) |

### Future Scale (>1000 users)

If you exceed GitHub API limits:
- Migrate to **Cloudflare R2** (S3-compatible, no egress fees)
- Add caching layer (Cloudflare KV or Durable Objects)
- Implement batch uploads (reduce API calls)

---

## Production Deployment

### Deploy Worker

```bash
cd cloudflare
wrangler login
wrangler secret put GITHUB_TOKEN
wrangler deploy
```

Your worker will be at: `https://mesh-ingest.YOUR-SUBDOMAIN.workers.dev`

### Update Client Config

```env
# client/.env.production
VITE_WORKER_URL=https://mesh-ingest.YOUR-SUBDOMAIN.workers.dev
```

### Deploy Client

Deploy `client/` to any static host:
- Vercel
- Netlify
- Cloudflare Pages
- GitHub Pages

---

## Environment Variables

### Worker (cloudflare/.dev.vars)

```env
GITHUB_TOKEN=ghp_xxxxx
```

### Worker (cloudflare/wrangler.toml)

```toml
[env.dev.vars]
GITHUB_OWNER  = "your-username"
GITHUB_REPO   = "mesh-utility-tracker"
GITHUB_BRANCH = "cloudflare-ingest"
```

### Client (client/.env.local)

```env
VITE_WORKER_URL=http://127.0.0.1:8787
```

---

## Testing the Migration

### 1. Test Data Ingestion

```powershell
curl -Method POST http://127.0.0.1:8787 `
  -ContentType "application/json" `
  -Body '{
    "observerId": "test-device",
    "latitude": 40.7128,
    "longitude": -74.0060,
    "rssi": -75,
    "snr": 8.5
  }'
```

Expected: `{"ok":true}`

### 2. Verify Data Storage

Check GitHub repo: `data/scans/YYYY-MM-DD.ndjson`

### 3. Test History Endpoint

```powershell
curl http://127.0.0.1:8787/history
```

Expected: `["2026-02-10"]`

### 4. Verify UI Rendering

1. Open client at `http://localhost:5173`
2. Connect Bluetooth radio (if available)
3. Map should render coverage hexes
4. Verify hex shapes match previous version

---

## Migration Checklist

✅ Hex grid math preserved  
✅ Worker retry logic for scale  
✅ Client-side NDJSON processor  
✅ All pages updated (map, history, nodes, settings)  
✅ CoverageMap using client aggregation  
✅ Type definitions centralized in scan-aggregator  
✅ Server & database code removed  
✅ package.json scripts updated  
✅ Environment config documented  

---

## Troubleshooting

### "GitHub read failed"

- Check `GITHUB_TOKEN` is set in `.dev.vars`
- Verify token has **repo** scope
- Confirm branch exists in repository

### "Cannot fetch history"

- Ensure worker is running (`npm run worker:dev`)
- Check `VITE_WORKER_URL` is correct
- Verify CORS headers (worker auto-handles this)

### "No coverage zones showing"

- Check browser console for fetch errors
- Verify NDJSON files exist in GitHub
- Inspect Network tab - look for `/history` requests

### Hex shapes don't align

- **DO NOT modify** `shared/grid.ts` constants
- Ensure `HEX_SIZE`, `LNG_SCALE` are unchanged
- Verify `snapToHexGrid()` function is intact

---

## Cost Analysis

| Component | Cost |
|-----------|------|
| Cloudflare Worker | 100K requests/day FREE |
| GitHub Storage | Unlimited FREE (public repo) |
| Outbound Traffic | FREE |
| Database | $0 (removed) |
| Server Hosting | $0 (removed) |
| **Total** | **$0/month** |

---

## Contributing

When making changes:

1. **Never modify** [shared/grid.ts](shared/grid.ts) without approval
2. Keep worker **append-only** (no state, no caching)
3. Keep spatial logic **client-side**
4. Test with real Bluetooth mesh radios when possible
5. Verify offline functionality (PWA)

---

## License

MIT - See LICENSE file

---

## Support

For issues:
1. Check [troubleshooting](#troubleshooting) section
2. Review CloudflareWorker logs: `wrangler tail`
3. Open GitHub issue with reproduction steps
