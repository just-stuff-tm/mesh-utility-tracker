# Contributing to Mesh Utility Tracker

Thank you for your interest in contributing! This guide will help you get started.

## Quick Start

### Prerequisites
- Node.js 18+
- Modern browser with Web Bluetooth support (Chrome/Edge recommended)
- Git

### Development Setup

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/just-stuff-tm/mesh-utility-tracker.git
   cd mesh-utility-tracker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create environment file**
   ```bash
   cp .env.example .env
   # Edit .env with your local settings (optional for frontend-only development)
   ```

4. **Start development server**
   ```bash
   npm run dev
   # Opens at http://localhost:5173
   ```

### Optional: Local Worker Development

To test with the backend worker locally:

1. **Navigate to worker directory**
   ```bash
   cd worker
   npm install
   ```

2. **Start local worker**
   ```bash
   npm run dev
   # Runs on http://127.0.0.1:8787
   ```

3. **Update frontend to use local worker**
   ```bash
   # In root directory
   echo "VITE_WORKER_URL=http://127.0.0.1:8787" > .env
   npm run dev
   ```

## Project Structure

```
mesh-utility-tracker/
├── src/                    # React frontend
│   ├── components/         # UI components
│   │   └── ui/            # shadcn/ui components
│   ├── pages/             # Route pages
│   ├── lib/               # Core logic
│   │   ├── bluetooth.ts   # MeshCore integration
│   │   ├── offline-store.ts # IndexedDB
│   │   └── scan-aggregator.ts # Coverage calculation
│   └── types/             # TypeScript definitions
├── worker/                # Cloudflare Worker backend
│   └── src/
│       ├── index.ts       # Main worker entry
│       ├── github.ts      # GitHub API integration
│       └── batch.ts       # Durable Object batcher
├── shared/                # Shared utilities
│   ├── grid.ts           # Hexagonal grid math
│   └── schema.ts         # Data validation
└── public/               # Static assets
    ├── sw.js            # Service worker
    └── manifest.json    # PWA manifest
```

## Development Workflow

### 1. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
```

### 2. Make Your Changes

- Write clean, readable code
- Follow existing code style
- Use TypeScript types
- Test your changes in a browser

### 3. Test Your Changes

**Frontend Testing:**
- Test with actual MeshCore device (if available)
- Test offline mode behavior
- Test on different screen sizes
- Check browser console for errors

**Worker Testing:**
- Use `wrangler tail` to monitor logs
- Test API endpoints with curl/Postman
- Verify data formatting

### 4. Commit Your Changes

```bash
git add .
git commit -m "Brief description of changes"
```

**Commit Message Format:**
- `feat: Add new feature`
- `fix: Fix bug description`
- `docs: Update documentation`
- `refactor: Code refactoring`
- `style: Code style changes`
- `test: Add tests`

### 5. Push and Create Pull Request

```bash
git push origin feature/your-feature-name
```

Then create a pull request on GitHub with:
- Clear description of changes
- Why the change is needed
- How to test it
- Screenshots (if UI changes)

## Code Style Guidelines

### TypeScript/React
- Use functional components with hooks
- Prefer const over let
- Use meaningful variable names
- Add comments for complex logic
- Export types from component files

### Example Component Structure
```tsx
import { useState } from "react";

interface MyComponentProps {
  title: string;
  onAction?: () => void;
}

export function MyComponent({ title, onAction }: MyComponentProps) {
  const [state, setState] = useState<boolean>(false);
  
  return (
    <div>
      <h2>{title}</h2>
      {/* Component JSX */}
    </div>
  );
}
```

### CSS/Tailwind
- Use Tailwind utility classes
- Keep custom CSS minimal
- Use shadcn/ui components when possible
- Follow mobile-first responsive design

## Key Technologies

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Wouter** - Routing
- **Leaflet** - Maps
- **shadcn/ui** - Component library
- **Dexie.js** - IndexedDB wrapper

### Backend
- **Cloudflare Workers** - Edge compute
- **D1** - SQLite database
- **Durable Objects** - Stateful processing
- **GitHub API** - Data storage

## Common Development Tasks

### Adding a New UI Component

1. Create component in `src/components/`
2. Import and use in relevant page
3. Add to exports if reusable

### Modifying Bluetooth Integration

See `src/lib/bluetooth.ts` and `src/lib/bluetooth-context.tsx`
- Device connection logic
- Scan processing
- Data aggregation

### Changing Data Upload Format

1. Update `src/lib/bluetooth-context.tsx` (frontend)
2. Update `worker/src/index.ts` (backend)
3. Update `shared/schema.ts` (validation)
4. Test end-to-end flow

### Adding New Map Features

1. Modify `src/components/coverage-map.tsx`
2. Update `src/lib/scan-aggregator.ts` for data processing
3. Update `shared/grid.ts` for grid calculations

## Testing with MeshCore Devices

### Supported Devices
- Seeed Wio Tracker L1 (primary test device)
- Any device running MeshCore firmware

### Testing Checklist
- [ ] Device connects via Web Bluetooth
- [ ] Scans detect nearby nodes
- [ ] Signal strength (RSSI/SNR) displays correctly
- [ ] GPS coordinates captured
- [ ] Offline mode works without network
- [ ] Data uploads after network restored
- [ ] Coverage map updates in real-time

## Troubleshooting Development Issues

### "Module not found" errors
```bash
rm -rf node_modules package-lock.json
npm install
```

### Vite build errors
```bash
npm run build
# Check output for specific errors
```

### Worker deployment issues
```bash
cd worker
npx wrangler login
npm run deploy
```

### Bluetooth connection fails
- Use HTTPS or localhost only
- Check browser compatibility
- Ensure device is in pairing mode
- Check browser console for errors

## Need Help?

- 💬 **Questions:** [GitHub Discussions](https://github.com/just-stuff-tm/mesh-utility-tracker/discussions)
- 🐛 **Bug Reports:** [GitHub Issues](https://github.com/just-stuff-tm/mesh-utility-tracker/issues)
- 📖 **Documentation:** See deployment docs in repository (local only)


## License

By contributing, you agree that your contributions will be licensed under the MIT License.
