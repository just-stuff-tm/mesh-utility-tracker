# Mesh Utility Tracker

Progressive Web App for mapping MeshCore LoRa coverage with optional cloud ingestion.

- Live app: `https://mesh-utility.org/`
- Public data repo: `https://github.com/just-stuff-tm/mesh-data`

## Features

- Real-time coverage map and node discovery
- Web Bluetooth integration for MeshCore devices
- Offline-first storage and map usage
- Optional Cloudflare Worker ingestion
- Privacy controls and signed deletion flow

## Tech Stack

- Frontend: React, TypeScript, Vite, Tailwind, Leaflet
- Backend (optional): Cloudflare Workers, D1, Durable Objects, GitHub API

## Project Structure

```text
src/        Frontend app
worker/     Cloudflare Worker backend
shared/     Shared utilities and schema
public/     Static assets
```

## Data and Privacy

- Data sharing is opt-in.
- Dead-zone scans (`nodes: []`) are persisted in D1 and returned by history/coverage APIs.
- Dead-zone scans are not committed to `mesh-data` `scans.csv`.
- Deletion requests can be initiated from Settings.

## Contributing

See `CONTRIBUTING.md`.

## License

MIT (`LICENSE`).
