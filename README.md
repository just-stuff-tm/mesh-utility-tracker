# Mesh Utility Tracker

Progressive Web App for mapping MeshCore LoRa coverage with optional cloud ingestion.

Live app: https://mesh-utility-tracker.pages.dev/

## Features
- Real-time coverage map and node discovery
- Web Bluetooth integration for MeshCore devices
- Offline-first storage and map usage
- Optional cloud upload through Cloudflare Worker
- Privacy controls and deletion request flow from Settings

## Tech Stack
- Frontend: React 18, TypeScript, Vite, Tailwind CSS, Leaflet, Wouter
- Optional backend: Cloudflare Workers, D1, Durable Objects, GitHub API

## Quick Start

```bash
npm install
npm run dev
```

Open: `http://localhost:5173`

## Optional Worker Development

```bash
cd worker
npm install
npm run dev
```

Worker local URL: `http://127.0.0.1:8787`

Set frontend worker URL locally:

```bash
# project root
$env:VITE_WORKER_URL="http://127.0.0.1:8787"
npm run dev
```

## Scripts

### Root
- `npm run dev`: start frontend dev server
- `npm run build`: production build
- `npm run preview`: preview production build
- `npm run check`: TypeScript check
- `npm run deploy:pages`: build and deploy to Cloudflare Pages

### Worker (`worker/`)
- `npm run dev`: run worker locally
- `npm run deploy`: deploy worker
- `npm run db:create`: create D1 database
- `npm run db:init`: initialize schema
- `npm run secret:github`: set GitHub token secret

## Project Structure

```text
src/        frontend app
worker/     Cloudflare Worker backend
shared/     shared utilities and schema
public/     static assets
```

## Data and Privacy
- Data sharing is opt-in.
- Dead zones (failed/no-node scans) remain local and are not uploaded.
- Public mesh data repository: https://github.com/just-stuff-tm/mesh-data
- Deletion requests can be initiated from the Settings page.

## Contributing
See `CONTRIBUTING.md`.

## License
MIT. See `LICENSE`.

