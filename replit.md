# Mesh Utility - LoRa MeshCore Radio Manager

## Overview

Mesh Utility is a full-stack web application for managing LoRa MeshCore mesh radios. It allows users to connect to radios via Web Bluetooth, discover mesh network nodes, and visualize RF coverage data (RSSI/SNR) on an interactive map. The app displays coverage zones as a hex grid overlay, tracks scan history, and identifies dead zones in the mesh network.

Key features:
- **Bluetooth connectivity** to MeshCore radios using Web Bluetooth API
- **Interactive coverage map** with Leaflet showing RSSI/SNR heatmap grid
- **Node discovery and management** for mesh network devices
- **Scan history tracking** with signal quality metrics
- **Geolocation-based coverage mapping** that snaps readings to a grid
- **Dark/light theme** support with persistent preferences

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (React + Vite)
- **Framework**: React 18 with TypeScript, bundled by Vite
- **Routing**: Wouter (lightweight client-side router) with 4 pages: Map, Nodes, History, Settings
- **State/Data**: TanStack React Query for server state management with periodic refetching
- **UI Library**: shadcn/ui (new-york style) built on Radix UI primitives with Tailwind CSS
- **Map**: Leaflet via react-leaflet for coverage visualization with hex grid overlay
- **Bluetooth**: Custom Web Bluetooth API wrapper (`client/src/lib/bluetooth.ts`) connecting to MeshCore UART service UUIDs
- **Geolocation**: Browser Geolocation API wrapper for observer position tracking
- **Layout**: Sidebar-based layout using shadcn sidebar component with collapsible navigation
- **Path aliases**: `@/` maps to `client/src/`, `@shared/` maps to `shared/`, `@assets/` maps to `attached_assets/`

### Backend (Express + Node.js)
- **Framework**: Express.js running on Node.js with TypeScript (via tsx)
- **Entry point**: `server/index.ts` creates HTTP server, registers routes, seeds database
- **API pattern**: RESTful JSON API under `/api/` prefix
- **Key endpoints**:
  - `GET/POST /api/nodes` - Mesh node CRUD
  - `GET/POST /api/scan-results` - Scan result recording and retrieval
  - `GET /api/scan-results/latest` - Latest scan per node
  - `GET/POST /api/coverage-zones` - Coverage zone management with grid snapping
  - `GET /api/coverage-zones/dead` - Dead zone identification
  - `GET/POST /api/observers` - Observer device management
- **Grid system**: Coverage data snaps to a 0.0012° grid (`GRID_SIZE_DEG`) with center offset (`floor + GRID_SIZE_DEG/2`) for consistent zone aggregation. Grid snapping is performed server-side in routes.ts; frontend renders hexagons directly from stored grid-snapped coordinates.
- **Dev mode**: Vite dev server middleware with HMR; Production: static file serving from `dist/public`

### Database (PostgreSQL + Drizzle ORM)
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema location**: `shared/schema.ts` (shared between client and server)
- **Schema push**: `npm run db:push` using drizzle-kit
- **Connection**: `pg` Pool using `DATABASE_URL` environment variable
- **Tables**:
  - `users` - Basic auth (id, username, password)
  - `observers` - Observer devices with location, scan interval, active status
  - `mesh_nodes` - Discovered mesh nodes with hardware type, coordinates
  - `scan_results` - Individual scan readings (nodeId, RSSI, SNR, observer location, timestamp)
  - `coverage_zones` - Aggregated grid zones with avg RSSI/SNR, scan count, dead zone flag
- **Validation**: Zod schemas generated from Drizzle schemas via `drizzle-zod`
- **Seeding**: `server/seed.ts` populates sample nodes, scan results, and coverage zones on first run

### Storage Layer
- **Pattern**: Interface-based storage (`IStorage`) with `DatabaseStorage` implementation in `server/storage.ts`
- **Operations**: CRUD for all entities plus specialized queries (nearby zones, latest scans, dead zones)
- **Upsert logic**: Nodes are upserted by `nodeId` to avoid duplicates

### Build System
- **Dev**: `tsx server/index.ts` with Vite middleware for HMR
- **Build**: Custom `script/build.ts` that runs Vite build for client and esbuild for server
- **Output**: `dist/public/` for client assets, `dist/index.cjs` for server bundle
- **Server bundling**: Allowlisted dependencies are bundled to reduce cold start syscalls

## External Dependencies

### Required Services
- **PostgreSQL**: Primary database, connected via `DATABASE_URL` environment variable. Required for all data persistence.

### Key NPM Packages
- **drizzle-orm / drizzle-kit**: ORM and migration tooling for PostgreSQL
- **express**: HTTP server framework
- **pg**: PostgreSQL client driver
- **connect-pg-simple**: PostgreSQL session store (available but sessions not fully implemented)
- **leaflet / react-leaflet**: Interactive map rendering
- **@tanstack/react-query**: Async state management
- **wouter**: Client-side routing
- **zod / drizzle-zod**: Runtime validation
- **shadcn/ui components**: Full suite of Radix-based UI components

### Browser APIs Used
- **Web Bluetooth API**: Connects to MeshCore radios (UART service UUID: `6e400001-b5a3-f393-e0a9-e50e24dcca9e`)
- **Geolocation API**: Tracks observer position for coverage mapping
- **localStorage**: Persists theme and settings preferences

### External CDN Resources
- **Google Fonts**: DM Sans, Fira Code, Geist Mono, Architects Daughter
- **Leaflet tile images**: Default marker icons from cdnjs.cloudflare.com
- **Map tiles**: CartoDB dark tiles (dark_all) for map base layer

## Recent Changes
- **2026-02-06**: Fixed grid-snapping alignment — backend snapToGrid uses `floor + GRID_SIZE_DEG/2` centering; frontend now renders hexagons directly from stored coordinates instead of re-snapping
- **2026-02-06**: Fixed findNearbyZone() query — added upper bounds (lte) to bounding box query preventing incorrect zone aggregation with far-away zones
- **2026-02-06**: Re-seeded database with grid-snapped coverage zone coordinates; reduced zone radiusMeters from 100 to 80 for tighter grid alignment
- **2026-02-06**: Removed unused Rectangle import from coverage-map.tsx