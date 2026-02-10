# Mesh Utility Worker

Cloudflare Worker that handles mesh scan data ingestion and commits batched data to GitHub.

## Features

- **Data Ingestion**: Accepts scan data from mesh utility clients
- **Batching**: Groups scans before committing (20 scans or 5 minutes)
- **GitHub Integration**: Commits scan data to separate data repository
- **CORS Support**: Configured for GitHub Pages and localhost
- **D1 Storage**: Temporary storage with automatic cleanup
- **Durable Objects**: Reliable batch processing

## Setup

### 1. Install Dependencies

```bash
cd worker
npm install
```

### 2. Create D1 Database

```bash
npm run db:create
```

Copy the `database_id` from the output and update it in `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "mesh-utility-db"
database_id = "your-database-id-here"
```

### 3. Initialize Database Schema

```bash
npm run db:init
```

### 4. Create GitHub Token

1. Go to https://github.com/settings/tokens?type=beta
2. Click "Generate new token" (Fine-grained token)
3. Set repository access to `just-stuff-tm/mesh-data`
4. Grant permissions:
   - **Contents**: Read and Write
   - **Metadata**: Read-only (automatic)
5. Generate token and copy it

### 5. Set GitHub Token Secret

```bash
npm run secret:github
# Paste your token when prompted
```

### 6. Create Data Repository

Create a new repository at `just-stuff-tm/mesh-data` with:

```
mesh-data/
├── scans/
│   ├── 2024-01-15/
│   │   ├── batch-1705334400000.csv   ⭐ Searchable in GitHub
│   │   ├── batch-1705334400000.json
│   │   ├── batch-1705338000000.csv
│   │   └── batch-1705338000000.json
│   └── 2024-01-16/
│       ├── batch-1705420800000.csv
│       └── batch-1705420800000.json
├── deletions/
│   └── 2024-01-15/
│       └── !abcd1234.json
└── README.md
```

**CSV Format:** Each CSV file contains these columns:
- `radioId,timestamp,datetime_utc,latitude,longitude,altitude,nodeId,rssi,snr,hopLimit`

CSV files enable:
- GitHub's built-in table viewer and search
- Easy filtering by radio ID, signal strength, location
- Command-line processing (grep/awk/cut)
- Direct import to spreadsheets

## Development

### Local Development

```bash
npm run dev
```

Worker will be available at `http://127.0.0.1:8787`

### Deploy to Production

```bash
npm run deploy
```

## API Endpoints

### POST /scans

Upload scan data. Accepts array of scan payloads.

**Request Body:**
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

### GET /history?radioId=!abcd1234

Retrieve scan history for a radio.

**Response:**
```json
[
  {
    "id": 1,
    "radioId": "!abcd1234",
    "timestamp": 1705334400000,
    "latitude": 37.7749,
    "longitude": -122.4194,
    "nodes": "[{...}]",
    "committed": 1
  }
]
```

### DELETE /delete/:radioId

Delete all data for a specific radio ID.

**Response:**
```json
{
  "success": true
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "ok"
}
```

## Batching Logic

- **Batch Size**: 20 scans (configurable in `batch.ts`)
- **Batch Timeout**: 5 minutes (configurable in `batch.ts`)
- **Commit Strategy**: Whichever comes first

Scans are grouped by date in the GitHub repository:
- `scans/YYYY-MM-DD/batch-<timestamp>.json`

## Database Queries

Query the D1 database:

```bash
# View pending scans
wrangler d1 execute mesh-utility-db --command "SELECT COUNT(*) FROM scans WHERE committed = 0"

# View commit history
wrangler d1 execute mesh-utility-db --command "SELECT * FROM commits ORDER BY committedAt DESC LIMIT 10"

# Delete test data
wrangler d1 execute mesh-utility-db --command "DELETE FROM scans WHERE radioId = '!test1234'"
```

## Troubleshooting

### "Invalid binding" error
- Ensure `database_id` is set in `wrangler.toml`
- Run `npm run db:create` to create the database

### GitHub API rate limits
- Fine-grained tokens have higher limits
- Batch commits reduce API calls significantly

### CORS errors
- Update `ALLOWED_ORIGINS` in `wrangler.toml`
- Redeploy worker after changes

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `GITHUB_TOKEN` | GitHub fine-grained token (secret) | `ghp_xxxx` |
| `GITHUB_REPO` | Target repository | `just-stuff-tm/mesh-data` |
| `GITHUB_BRANCH` | Target branch | `main` |
| `ALLOWED_ORIGINS` | CORS origins (comma-separated) | `https://example.com` |

## Architecture

```
Client --> Worker (POST /scans) --> Durable Object (Batcher)
                                         |
                                         v
                                    D1 Database (temp storage)
                                         |
                                         v (batch ready)
                                    GitHub API (batch commit)
```

## License

MIT
