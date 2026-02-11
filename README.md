# Mesh Utility Tracker

Progressive Web App for Bluetooth mesh network coverage mapping with cloud data collection.

**Live App:** https://243f5d20.mesh-utility-tracker.pages.dev/ (Cloudflare Pages) https://mesh-utility.com coming soon!

## Features

- 🗺️ **Real-time Coverage Mapping** - Visualize mesh network coverage on interactive maps
- 📡 **Bluetooth Integration** - Connect directly to MeshCore devices via Web Bluetooth
- 📊 **Node Discovery** - Track and analyze detected mesh nodes
- 💾 **Offline Support** - Full PWA with offline capabilities
- ☁️ **Cloud Backup** - Optional scan data upload to public GitHub repository
- 🔒 **Privacy First** - User-controlled data sharing with self-service deletion


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
mesh-utility-tracker/tree/mesh-utility/
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

**Batching Strategy:** 20 scans OR 5 minutes (whichever first)

**Data Format:** JSON files organized by date:
- `scans/2024-01-15/batch-1705334400000.json`
- `deletions/2024-01-15/!abcd1234.json`

## Privacy & Data

- All data collection is **opt-in**
- Users can delete their data anytime via Settings
- Deletion requests processed within 24 hours
- All collected data is **public** (GitHub repository)
- No personal information stored
- GPS coordinates are user-provided only

**Data Repository:** https://github.com/just-stuff-tm/mesh-data


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


## License

MIT - See [LICENSE](LICENSE) file for details

## Support

- 🐛 **Bug Reports:** [GitHub Issues](https://github.com/just-stuff-tm/mesh-utility-tracker/issues)
- 💡 **Feature Requests:** [GitHub Issues](https://github.com/just-stuff-tm/mesh-utility-tracker/issues)
- 🗑️ **Data Deletion:** [Settings Page](https://243f5d20.mesh-utility-tracker.pages.dev/settings) or [GitHub Issue](https://github.com/just-stuff-tm/mesh-data/issues/new?labels=data-deletion)

## Acknowledgments

- MeshCore protocol for the mesh networking
- shadcn for the beautiful UI components
- Cloudflare for free edge computing
- GitHub for free static hosting and data storage

