# Mesh Utility Tracker

Progressive Web App for mapping MeshCore LoRa coverage with optional cloud ingestion.

<p align="center">
  <a href="https://mesh-utility.org/"><b>Live App</b></a>
</p>

## Community and Support

[![Discord](https://img.shields.io/badge/Discord-Join%20Server-5865F2?logo=discord&logoColor=white)](https://discord.gg/Xyhjz7CtuW)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-Support-FFDD00?logo=buymeacoffee&logoColor=black)](https://www.buymeacoffee.com/Just_Stuff_TM)

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
