# Mesh Utility Data Pipeline Architecture

## Overview

The mesh utility tracker now includes a complete data pipeline for collecting, batching, and storing mesh network scans in a public GitHub repository.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                           Client Layer                           │
│  (React PWA - GitHub Pages: just-stuff-tm.github.io/mesh-...)  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ 1. POST /scans (batch upload)
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Cloudflare Worker                           │
│              mesh-utility-worker.workers.dev                     │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Main Worker                            │  │
│  │  • CORS validation                                        │  │
│  │  • Scan validation                                        │  │
│  │  • Route handling                                         │  │
│  └─────────────────┬────────────────────────────────────────┘  │
│                    │                                             │
│                    │ 2. Forward to Durable Object                │
│                    │                                             │
│                    ▼                                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              ScanBatcher (Durable Object)                  │  │
│  │  • Accumulates scans in memory                            │  │
│  │  • Triggers on: 20 scans OR 5 minutes                     │  │
│  │  • Persistent state across requests                       │  │
│  └─────────┬──────────────────────────┬─────────────────────┘  │
└────────────┼──────────────────────────┼────────────────────────┘
             │                          │
             │ 3. Store                 │ 4. Batch commit
             │    (immediate)           │    (on trigger)
             │                          │
             ▼                          ▼
┌────────────────────────┐   ┌────────────────────────────────────┐
│   D1 Database (SQL)    │   │         GitHub REST API            │
│                        │   │   (github.com/just-stuff-tm/       │
│  • Temporary storage   │   │              mesh-data)            │
│  • Query interface     │   │                                    │
│  • Deduplication       │   │  • Create blobs                    │
│  • Deletion tracking   │   │  • Create tree                     │
│                        │   │  • Create commit                   │
│  Tables:               │   │  • Update branch ref               │
│  - scans               │   │                                    │
│  - commits             │   │  Stored as:                        │
│                        │   │  scans/YYYY-MM-DD/batch-XXXXX.json│
└────────────────────────┘   └────────────────────────────────────┘
                                           │
                                           │ 5. Public access
                                           │
                                           ▼
                             ┌──────────────────────────────────┐
                             │     Data Consumers               │
                             │  • Researchers                   │
                             │  • Coverage analysis tools       │
                             │  • Network visualization         │
                             │  • Statistics dashboards         │
                             └──────────────────────────────────┘
```

## Data Flow

### 1. Scan Collection (Client → Worker)

**Endpoint:** `POST /scans`

**Request:**
```json
[
  {
    "radioId": "!abcd1234",
    "timestamp": 1705334400000,
    "location": {
      "lat": 37.7749,
      "lon": -122.4194,
      "altitude": 50
    },
    "nodes": [
      {
        "nodeId": "!def45678",
        "rssi": -85,
        "snr": 8.5,
        "hopLimit": 3
      }
    ]
  }
]
```

**Response:**
```json
{
  "success": true,
  "queued": 5,
  "message": "1 scans queued, 5 total pending"
}
```

**Important:** Only successful scans (with discovered nodes) are uploaded. Dead zones (failed scans with no nodes found) are stored locally in IndexedDB only and never synchronized to the cloud.

### 1a. Dead Zone Handling (Local Only)

**Dead zones are device-local only:**
- Scans that find no nodes are marked as dead zones
- Stored in browser IndexedDB, never uploaded to worker
- Never appear in D1 database or GitHub repository
- Useful for field mapping but not relevant for public mesh data

**Protection Rules:**
1. Dead zones never overwrite successful scan zones
2. Successful scans in dead zone areas automatically clear the dead zone flag
3. Dead zones are excluded from sync/upload operations

**Code Location:** `src/lib/bluetooth-context.tsx` lines 435-458

**Why:** Dead zones are device-specific, temporary, and would pollute public mesh data with non-data.

### 2. Batching (Durable Object)

**Strategy:** Whichever comes first
- **Size trigger:** 20 scans accumulated
- **Time trigger:** 5 minutes elapsed

**Benefits:**
- Reduces GitHub API calls (6 calls per commit vs 120 calls for 20 individual commits)
- Atomic commits (all-or-nothing)
- Persistent state (survives worker restarts)

### 3. D1 Storage

**Immediate storage:**
```sql
INSERT INTO scans (radioId, timestamp, latitude, longitude, altitude, nodes, committed)
VALUES ('!abcd1234', 1705334400000, 37.7749, -122.4194, 50, '[...]', 0)
```

**After GitHub commit:**
```sql
UPDATE scans SET committed = 1
WHERE radioId = '!abcd1234' AND timestamp = 1705334400000
```

**Query interface:**
- `GET /history` → List of available days
- `GET /history/2024-01-15.ndjson` → All scans for that day

### 4. GitHub Commit

**Batch commit strategy:**

1. **Create blobs** (parallel) - One per scan file
2. **Create tree** - Adds blobs to repository structure
3. **Create commit** - References tree and parent commit
4. **Update ref** - Moves branch pointer to new commit

**Commit structure:**
```
scans/
├── 2024-01-15/
│   ├── batch-1705334400000.csv   (20 scans - searchable in GitHub)
│   ├── batch-1705334400000.json  (20 scans - API format)
│   ├── batch-1705338000000.csv   (20 scans)
│   ├── batch-1705338000000.json  (20 scans)
│   ├── batch-1705341600000.csv   (15 scans)
│   └── batch-1705341600000.json  (15 scans)
└── 2024-01-16/
    ├── batch-1705420800000.csv   (20 scans)
    └── batch-1705420800000.json  (20 scans)
```

**Why CSV + JSON?**
- CSV: Searchable/filterable in GitHub web UI, easy grep/awk
- JSON: Programmatic API access, preserves nested structures

### 5. Data Retrieval

**Client fetches history:**
```typescript
// Get available days
const days = await fetch(`${workerUrl}/history`).then(r => r.json());
// ["2024-01-15", "2024-01-16"]

// Fetch specific day
const scans = await fetch(`${workerUrl}/history/2024-01-15.ndjson`)
  .then(r => r.text())
  .then(text => text.split('\n').filter(Boolean).map(JSON.parse));
```

**NDJSON format:** (Newline-Delimited JSON)
```
{"radioId":"!abcd1234","timestamp":1705334400000,...}
{"radioId":"!abcd1234","timestamp":1705334460000,...}
{"radioId":"!def45678","timestamp":1705334520000,...}
```

## Components

### Worker (`worker/src/index.ts`)
- CORS enforcement
- Request routing
- Scan validation
- Durable Object coordination

### Batcher (`worker/src/batch.ts`)
- Accumulates scans in Durable Object state
- Triggers batch commits
- Stores in D1 immediately
- Updates D1 after GitHub commit

### GitHub API (`worker/src/github.ts`)
- `commitToGitHub()` - Single file commit
- `batchCommitToGitHub()` - Multiple files in one commit
- Rate limit friendly (uses tree API)

### Database (`worker/schema.sql`)
```sql
scans
├── id (PRIMARY KEY)
├── radioId (TEXT, INDEXED)
├── timestamp (INTEGER, INDEXED)
├── latitude (REAL)
├── longitude (REAL)
├── altitude (REAL)
├── nodes (TEXT JSON)
├── committed (INTEGER 0/1, INDEXED)
└── createdAt (INTEGER)

commits
├── id (PRIMARY KEY)
├── commitSha (TEXT)
├── commitMessage (TEXT)
├── scanCount (INTEGER)
└── committedAt (INTEGER)
```

## Configuration

### Environment Variables

| Variable | Where | Description |
|----------|-------|-------------|
| `GITHUB_TOKEN` | Worker secret | Fine-grained PAT with contents:write |
| `GITHUB_REPO` | wrangler.toml | `owner/repo` format |
| `GITHUB_BRANCH` | wrangler.toml | Target branch (e.g., `main`) |
| `ALLOWED_ORIGINS` | wrangler.toml | Comma-separated CORS origins |
| `VITE_WORKER_URL` | Client .env | Worker endpoint URL |

### Bindings

| Binding | Type | Description |
|---------|------|-------------|
| `DB` | D1Database | SQL database for temporary storage |
| `SCAN_BATCH` | DurableObjectNamespace | Batcher instance coordinator |

## API Reference

### POST /scans
Upload scan data for batching

**Auth:** None (public)  
**Rate limit:** 100 req/min per IP (Cloudflare Workers default)

### GET /history
List available scan days

**Response:** `["2024-01-15", "2024-01-16"]`

### GET /history/:day.ndjson
Fetch scans for specific day

**Format:** Newline-Delimited JSON  
**Max size:** ~10 MB per day

### DELETE /delete/:radioId
Delete all data for a radio

**Effect:**
- Removes from D1 database
- Creates deletion record in GitHub

### GET /health
Health check

**Response:** `{"status":"ok"}`

## Performance Characteristics

### Latency
- POST /scans: ~50-100ms (D1 write + queue)
- GET /history: ~20-50ms (D1 query)
- GET /history/:day.ndjson: ~100-500ms (depends on scan count)

### Throughput
- **Writes:** ~10,000 scans/second (D1 limit)
- **Reads:** ~50,000 requests/second (worker limit)
- **GitHub commits:** 1 per 5 minutes max (batch trigger)

### Storage
- **D1:** ~1 KB per scan → 1 GB = 1M scans
- **GitHub:** ~500 bytes per scan (NDJSON) → 1 GB = 2M scans

### Costs (Free Tier)
- Cloudflare: Free up to 100K req/day
- GitHub: Free (public repos, unlimited storage)
- **Total: $0/month** for typical usage

## Privacy & GDPR Compliance

### Data Minimization
- Only mesh network metadata collected
- No personal information stored
- GPS coordinates are user-provided
- **Dead zones stored locally only** - Never uploaded to cloud
- Only successful scans (with node discoveries) are shared publicly

### Right to Deletion
- Self-service deletion via Settings
- Deletion within 24 hours
- Deletion record in GitHub for transparency

### Transparency
- All data public by default
- Open-source implementation
- GitHub provides audit trail

### Local-Only Data
The following data is stored in browser IndexedDB and never synchronized:
- **Dead zones** - Areas where no nodes were discovered
- **Failed scan attempts** - Scans that timeout or error
- **Cached coverage zones** - Temporary aggregated view

This ensures device-specific or incomplete data doesn't pollute the public mesh dataset.

## Monitoring

### Worker Logs
```bash
cd worker
npx wrangler tail
```

### Database Queries
```bash
# Pending scans
wrangler d1 execute mesh-utility-db --command \
  "SELECT COUNT(*) FROM scans WHERE committed = 0"

# Scan statistics
wrangler d1 execute mesh-utility-db --command \
  "SELECT 
    COUNT(*) as total_scans,
    COUNT(DISTINCT radioId) as unique_radios,
    MIN(timestamp) as first_scan,
    MAX(timestamp) as last_scan
  FROM scans"
```

### GitHub Stats
```bash
cd ../mesh-data
git log --oneline | head -10
git log --pretty=format:"%h %s" --since="1 day ago"
```

## Disaster Recovery

### Worker Failure
- Durable Object persists state
- Pending scans in DO storage
- Auto-retry on worker restart

### D1 Database Loss
- GitHub is source of truth
- Can rebuild D1 from GitHub data
- No data loss

### GitHub API Outage
- Scans accumulate in Durable Object
- Auto-commit when API recovers
- Max 1000 scans in queue (configurable)

### Data Corruption
- Append-only GitHub history
- Can revert to previous commit
- D1 can be rebuilt

## Future Enhancements

1. **Analytics Dashboard**
   - Real-time scan statistics
   - Coverage heatmaps
   - Node discovery trends

2. **Data Export**
   - CSV/GeoJSON export
   - API for bulk download
   - Filtered queries

3. **Advanced Batching**
   - Per-user batching
   - Geographic clustering
   - Time-based aggregation

4. **Caching Layer**
   - Cloudflare R2 for popular queries
   - CDN for NDJSON files
   - Redis for hot data

## Troubleshooting

See [WORKER_SETUP.md](WORKER_SETUP.md) for detailed troubleshooting guide.

## License

MIT - See project root LICENSE file
