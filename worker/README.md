# Mesh Utility Worker

Cloudflare Worker for ingesting scan data, batching writes, and committing scan files to GitHub.

## What It Does
- Accepts scan batches from the client (`POST /scans`)
- Stores scans in D1 immediately
- Batches commits to GitHub (20 scans or 5 minutes)
- Appends committed rows into a single master CSV file (`scans.csv`)
- Serves scan history (`/history`, `/history/:day.ndjson`)
- Supports radio data deletion endpoint (`DELETE /delete/:radioId`)

## Setup

### 1. Install and authenticate

```bash
cd worker
npm install
npx wrangler login
```

### 2. Create and initialize D1

```bash
npm run db:create
npm run db:init
```

Update `wrangler.toml` with the returned `database_id`.

### 3. Configure GitHub token

Create a fine-grained token with repository `contents:write`, then:

```bash
npm run secret:github
```

### 4. Configure worker vars

In `wrangler.toml`:

```toml
[vars]
GITHUB_REPO = "owner/mesh-data"
GITHUB_BRANCH = "main"
ALLOWED_ORIGINS = "https://mesh-utility-tracker.pages.dev,http://localhost:5173"
```

### 5. Run locally or deploy

```bash
npm run dev
npm run deploy
```

## API

### `POST /scans`
Accepts an array of scan payloads.

Response example:

```json
{
  "success": true,
  "queued": 5,
  "message": "1 scans queued, 5 total pending"
}
```

### `GET /history`
Returns available scan days.

Example response:

```json
["2026-02-15", "2026-02-14"]
```

### `GET /history/:day.ndjson`
Returns newline-delimited scan rows for a day (`YYYY-MM-DD`).

### `DELETE /delete/:radioId`
Deletes scans for a radio in D1 and writes a deletion record to GitHub.

### `GET /health`
Health check.

## Batching Behavior
- Batch size trigger: 20 scans
- Time trigger: 5 minutes
- Commit output: append-only updates to `scans.csv`
- CSV columns: `row_id,radioId,timestamp,datetime_utc,latitude,longitude,altitude,nodeId,rssi,snr,hopLimit`

## Useful Commands

```bash
# pending scans
wrangler d1 execute mesh-utility-db --command "SELECT COUNT(*) FROM scans WHERE committed = 0"

# recent commits table rows
wrangler d1 execute mesh-utility-db --command "SELECT * FROM commits ORDER BY committedAt DESC LIMIT 10"
```

## Environment Variables

| Variable | Description |
|---|---|
| `GITHUB_TOKEN` | GitHub fine-grained token (secret) |
| `GITHUB_REPO` | Target repository (`owner/repo`) |
| `GITHUB_BRANCH` | Target branch |
| `ALLOWED_ORIGINS` | Comma-separated allowed origins |

## License
MIT

