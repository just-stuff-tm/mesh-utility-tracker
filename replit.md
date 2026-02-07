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
- **Hex grid system**: Uses proper honeycomb tiling math from `shared/grid.ts`. HEX_SIZE=0.0007° radius, ROW_SPACING=1.5*HEX_SIZE, COL_SPACING=√3*HEX_SIZE*LNG_SCALE(1.2), odd rows offset by COL_SPACING/2. Grid snapping done server-side; frontend renders hexagons from stored coordinates using shared getHexVertices(). Hexagons tile perfectly with no gaps or overlaps.
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
- **2026-02-06**: Replaced rectangular grid with proper honeycomb hex tiling — shared/grid.ts holds constants (HEX_SIZE, ROW_SPACING, COL_SPACING) and functions (snapToHexGrid, getHexVertices) used by both frontend and backend. Odd rows offset for perfect tiling with no gaps or overlaps.
- **2026-02-06**: Added map layer switcher (Dark/Standard/Satellite) using Leaflet LayersControl with themed CSS
- **2026-02-06**: Fixed mobile z-index: Sheet z-[2000] above Leaflet map (z-1000); moved LayersControl to topright; RSSI legend at top-14
- **2026-02-06**: Lifted Bluetooth state to global BluetoothContext provider — BLE connection, scanning, geolocation, and settings persist across all page navigations. Added Wake Lock API to prevent screen sleep during active scanning.
- **2026-02-06**: Fixed BLE method call: `sendSelfAdvert()` → `sendAdvert()` (correct meshcore.js API)
- **2026-02-06**: Fixed unsigned 32-bit longitude conversion with `toSigned32()` — MeshCore reads advLon as UInt32LE, negative longitudes wrap around and need conversion
- **2026-02-06**: Only zero-hop repeaters (pathLen===0, directly connected) are queried for status; multi-hop and unreachable repeaters are skipped to avoid timeout delays
- **2026-02-06**: Coverage mapping uses observer position only — scan results record where the observer is standing, not repeater advertised coordinates. Node records no longer store repeater lat/lon.
- **2026-02-06**: Added remote logging system — browser console logs batched to `/api/remote-log` endpoint for server-side debugging of BLE interactions on mobile devices
- **2026-02-06**: Added MapHud overlay on map — shows connected radio name, battery, scan countdown/status, last scan result, and scan on/off toggle button
- **2026-02-06**: Node discovery uses flood self-advert + `getNeighbours()` binary request — sends flood advert to announce presence, collects `NewAdvert` (0x8A) push events during 20s window to discover nearby nodes, then queries each repeater via `getNeighbours()` (CMD_SEND_BINARY_REQ with GetNeighbours 0x06) for SNR data. No admin login required (status requests are admin-only).
- **2026-02-06**: Scan history limited to 5 per hex zone — after each scan result insert, prunes oldest results beyond 5 per grid cell to save database space. Zone popup query also limited to 5.
- **2026-02-06**: Fixed settings panel scrolling — desktop sidebar uses ScrollArea; mobile sheet uses controlled open/close state so it slides back properly.
- **2026-02-06**: RSSI legend collapsible — starts collapsed showing just color dots, expands on tap to show full signal strength ranges.
- **2026-02-06**: Recalibrated RSSI scale — Good now covers -80 to -90 dBm, Fair -90 to -100, Poor -100 to -110, Very Weak < -110. Better suited for LoRa long-range signals.
- **2026-02-06**: Added floating "Support" tab at top-right of map view linking to CashApp ($yuptm).
- **2026-02-06**: Mobile slide-out sheet auto-closes after tapping action buttons (Connect, Scan, etc.) but stays open for sliders and toggles.
- **2026-02-06**: Added PWA manifest (manifest.json) and apple-touch-icon for installable app experience on all platforms.
- **2026-02-06**: Added CompatibilityDialog — shows on first load if Web Bluetooth is unavailable (e.g. Safari, Firefox). Guides iOS users to Bluefy, Android/desktop users to Chrome/Edge, and explains PWA installation. Dismisses for 7 days via localStorage. Skips dialog if already in PWA standalone mode, Bluefy, or a browser with Web Bluetooth support.
- **2026-02-06**: Added checkConnectionAlive() — probes radio with battery query (5s timeout) on visibility change to detect stale BLE connections after iOS backgrounding.
- **2026-02-07**: Added Privacy Policy page at /privacy — covers data collection, usage, permissions, storage/deletion, local storage, third-party services, and contact info. Linked from sidebar footer.
- **2026-02-07**: Improved name resolution — scan results now look up existing node names from the database when discovery doesn't return a name, preventing "Unknown (...)" labels.
- **2026-02-07**: Dead zone protection — POST /api/coverage-zones/dead-zone no longer overwrites zones that have successful scan data (scanCount > 0).
- **2026-02-07**: Added Stats Radius setting — slider (0–50 miles) in settings panel filters bottom HUD averages (RSSI, SNR, zones, dead zones) to only include coverage data within the specified mileage from observer position. 0 = all data. Persisted via localStorage.