# Mesh Utility - LoRa MeshCore Radio Manager

## Overview

Mesh Utility is a full-stack web application designed for managing LoRa MeshCore mesh radios. It enables users to connect to radios via Web Bluetooth, discover mesh network nodes, and visualize RF coverage data (RSSI/SNR) on an interactive map. The application displays coverage zones using a hex grid overlay, tracks scan history, and identifies dead zones within the mesh network. Its primary purpose is to provide a comprehensive tool for analyzing and optimizing LoRa mesh network performance and coverage.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (React + Vite)
The frontend is built with React 18, TypeScript, and Vite, utilizing Wouter for routing and TanStack React Query for state management. The UI is designed with shadcn/ui (new-york style) and Tailwind CSS. Interactive maps are rendered using Leaflet via react-leaflet, featuring a hex grid overlay for coverage visualization. Web Bluetooth API is used for radio connectivity, and the browser's Geolocation API tracks observer position. The layout is sidebar-based, and path aliases simplify module imports. It also supports PWA features, including offline-first capabilities with a service worker and IndexedDB for local data storage, and provides a compatibility dialog for unsupported browsers.

### Internationalization (i18n)
The app uses a custom i18n system in `client/src/lib/i18n.tsx` with I18nProvider context wrapping the app. Supports 8 languages: EN, ES, FR, DE, PT, ZH, JA, KO. Translation keys are organized by component area (nav, settings, bluetooth, hud, coverage, nodes, history, stats, privacy, compat, toast, offline, header, mapPage, notFound). Language preference stored in localStorage as "mesh-language" with auto-detection of browser language. All UI components use `useI18n()` hook to access the `t()` translation function. The Manual page keeps technical content in English, only UI chrome is translated. A language picker dropdown is available in the Settings panel.

### Backend (Express + Node.js)
The backend uses Express.js and Node.js with TypeScript, providing a RESTful JSON API. Key functionalities include CRUD operations for mesh nodes, scan results, coverage zones, and observer devices. It implements a precise hex grid system for coverage mapping, ensuring perfect tiling without gaps. The server-side handles grid snapping and dead zone identification.

### Database (PostgreSQL + Drizzle ORM)
Drizzle ORM with a PostgreSQL dialect manages the database. The schema is shared between client and server, defining tables for users, observers, mesh nodes, scan results, and coverage zones. Zod schemas generated from Drizzle schemas provide runtime validation. The database stores detailed scan data including altitude and uses upsert logic for nodes.

### Storage Layer
An interface-based storage layer (`IStorage`) with a `DatabaseStorage` implementation handles all data operations, including specialized queries for nearby zones, latest scans, and dead zones.

### Build System
The project uses `tsx` for development with Vite middleware for HMR and a custom build script for production, bundling client assets and the server.

## External Dependencies

### Required Services
- **PostgreSQL**: The primary database for all data persistence.

### Key NPM Packages
- **drizzle-orm / drizzle-kit**: ORM and migration tooling for PostgreSQL.
- **express**: HTTP server framework.
- **pg**: PostgreSQL client driver.
- **leaflet / react-leaflet**: Interactive map rendering.
- **@tanstack/react-query**: Async state management.
- **wouter**: Client-side routing.
- **zod / drizzle-zod**: Runtime validation.
- **shadcn/ui components**: Radix-based UI components.

### Browser APIs Used
- **Web Bluetooth API**: For connecting to MeshCore radios (UART service UUID: `6e400001-b5a3-f393-e0a9-e50e24dcca9e`).
- **Geolocation API**: For tracking observer position.
- **localStorage**: For persisting theme and settings.
- **Web Share API**: For sharing the app on mobile.
- **Wake Lock API**: To prevent screen sleep during active scanning.

### External CDN Resources
- **Google Fonts**: DM Sans, Fira Code, Geist Mono, Architects Daughter.
- **Leaflet tile images**: Default marker icons from cdnjs.cloudflare.com.
- **Map tiles**: CartoDB dark tiles for the map base layer.