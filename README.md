# Mesh Utility Tracker

Progressive Web App for Bluetooth mesh network coverage mapping with cloud data collection.

**Live App:** https://243f5d20.mesh-utility-tracker.pages.dev/ (Cloudflare Pages)  
**Backup:** https://just-stuff-tm.github.io/mesh-utility-tracker/ (GitHub Pages)

## Features

- 🗺️ **Real-time Coverage Mapping** - Visualize mesh network coverage on interactive maps
- 📡 **Bluetooth Integration** - Connect directly to MeshCore devices via Web Bluetooth
- 📊 **Node Discovery** - Track and analyze detected mesh nodes
- 💾 **Offline Support** - Full PWA with offline capabilities
- ☁️ **Cloud Backup** - Optional scan data upload to public GitHub repository
- 🔒 **Privacy First** - User-controlled data sharing with self-service deletion

## Quick Start

### Frontend Only

```bash
npm install
npm run dev     # Development server at localhost:5173
npm run build   # Build for production
npm run preview # Preview production build
```

### Full Stack Deployment

To deploy the complete application:

1. **Deploy to Cloudflare Pages** - See [docs/CLOUDFLARE_PAGES.md](docs/CLOUDFLARE_PAGES.md) **(Recommended)**
2. **Deploy Cloudflare Worker** - See [docs/WORKER_SETUP.md](docs/WORKER_SETUP.md)
3. **Create Data Repository** - Follow [docs/DEPLOYMENT_CHECKLIST.md](docs/DEPLOYMENT_CHECKLIST.md)

Alternatively, GitHub Actions auto-deploys to GitHub Pages on push to `mesh-utility` branch.

## Documentation

📁 **[docs/](docs/)** - All documentation files

- 📚 [Architecture Overview](docs/ARCHITECTURE.md) - System design and data flow
- ⚡ [Cloudflare Pages Deployment](docs/CLOUDFLARE_PAGES.md) - **Recommended hosting** (5 min setup)
- 🚀 [Worker Setup Guide](docs/WORKER_SETUP.md) - Backend deployment instructions
- ✅ [Deployment Checklist](docs/DEPLOYMENT_CHECKLIST.md) - Step-by-step backend setup
- 📊 [CSV Format Reference](docs/CSV_FORMAT.md) - Data structure and filtering examples
- 📦 [Worker README](worker/README.md) - Cloudflare Worker API documentation

## Technology Stack

### Frontend
- **React** 18 + TypeScript
- **Vite** 7.3 - Build tooling
- **Tailwind CSS** - Utility-first styling
- **Wouter** - Lightweight routing
- **Leaflet** - Interactive maps
- **shadcn/ui** - UI component library

### Backend (Optional)
- **Cloudflare Workers** - Serverless compute
- **D1 Database** - SQLite at the edge
- **Durable Objects** - Stateful batch processing
- **GitHub API** - Public data storage

## Project Structure

```
mesh-utility-tracker/
├── src/                    # Frontend source
│   ├── components/         # React components
│   ├── pages/              # Route pages
│   ├── lib/                # Core logic
│   └── types/              # TypeScript definitions
├── worker/                 # Cloudflare Worker
│   ├── src/
│   │   ├── index.ts        # Main worker
│   │   ├── github.ts       # GitHub API integration
│   │   └── batch.ts        # Durable Object batcher
│   ├── schema.sql          # D1 database schema
│   └── wrangler.toml       # Worker configuration
├── public/                 # Static assets
│   ├── sw.js               # Service worker
│   └── manifest.json       # PWA manifest
└── shared/                 # Shared utilities
    ├── grid.ts             # Hexagonal grid calculations
    └── schema.ts           # Data validation
```

## Data Pipeline

```
Client (PWA) 
  → Cloudflare Worker 
    → Durable Object (batching)
      → D1 Database (temp storage)
      → GitHub Repository (permanent storage)
```

**Batching Strategy:** 20 scans OR 5 minutes (whichever first)

**Data Format:** JSON files organized by date:
- `scans/2024-01-15/batch-1705334400000.json`
- `deletions/2024-01-15/!abcd1234.json`

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed explanation.

## Privacy & Data

- All data collection is **opt-in**
- Users can delete their data anytime via Settings
- Deletion requests processed within 24 hours
- All collected data is **public** (GitHub repository)
- No personal information stored
- GPS coordinates are user-provided only

**Data Repository:** https://github.com/just-stuff-tm/mesh-data

## Development

### Prerequisites
- Node.js 18+
- Modern browser with Web Bluetooth support

### Local Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Run with worker (optional)
cd worker
npm install
npm run dev  # Runs on port 8787
cd ..
VITE_WORKER_URL=http://127.0.0.1:8787 npm run dev
```

### Building

```bash
# Production build
npm run build

# Preview production build
npm run preview
```

### Testing

The app requires:
- HTTPS or localhost (for Web Bluetooth)
- MeshCore device with Bluetooth enabled
- Modern browser (Chrome/Edge recommended)

## Deployment

### Cloudflare Pages (Recommended)

**5-minute deployment** with optimal performance:
```bash
npm run deploy:pages
```

See [docs/CLOUDFLARE_PAGES.md](docs/CLOUDFLARE_PAGES.md) for complete guide.

**Benefits:**
- ✅ Co-located with Worker (lower latency)
- ✅ 300+ global CDN locations
- ✅ Simpler CORS setup
- ✅ Free SSL + custom domains
- ✅ Still 100% free

### GitHub Pages (Alternative)

Automatic deployment via GitHub Actions:
1. Push to `mesh-utility` branch
2. Actions builds and deploys to `gh-pages` branch
3. Available at: https://just-stuff-tm.github.io/mesh-utility-tracker/

### Cloudflare Worker (Backend)

See [docs/DEPLOYMENT_CHECKLIST.md](docs/DEPLOYMENT_CHECKLIST.md) for complete guide:
1. Create D1 database
2. Create GitHub data repository
3. Generate GitHub token
4. Configure worker secrets
5. Deploy: `cd worker && npm run deploy`

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Troubleshooting

### "Bluetooth not available"
- Use HTTPS or localhost
- Check browser compatibility
- Enable Bluetooth on device

### "Failed to fetch history"
- Worker not deployed or URL incorrect
- Check `VITE_WORKER_URL` in `.env.production`
- Verify CORS configuration in worker

### "GitHub Pages shows white screen"
- Hard refresh: Ctrl+Shift+R (Cmd+Shift+R on Mac)
- Unregister service worker in DevTools
- Clear browser cache

For more troubleshooting and known fixes, see [docs/CLOUDFLARE_PAGES.md](docs/CLOUDFLARE_PAGES.md#known-fixes--solutions-reference).

## License

MIT - See [LICENSE](LICENSE) file for details

## Support

- 🐛 **Bug Reports:** [GitHub Issues](https://github.com/just-stuff-tm/mesh-utility-tracker/issues)
- 💡 **Feature Requests:** [GitHub Issues](https://github.com/just-stuff-tm/mesh-utility-tracker/issues)
- 🗑️ **Data Deletion:** [Settings Page](https://243f5d20.mesh-utility-tracker.pages.dev/settings) or [GitHub Issue](https://github.com/just-stuff-tm/mesh-utility-tracker/issues/new?labels=data-deletion)

## Acknowledgments

- MeshCore protocol for the mesh networking
- shadcn for the beautiful UI components
- Cloudflare for free edge computing
- GitHub for free static hosting and data storage

