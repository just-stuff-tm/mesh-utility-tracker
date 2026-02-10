# Mesh Utility Tracker - Static Deployment

This branch is configured for static deployment to GitHub Pages.

## 🚀 Quick Deploy

This repository is configured to automatically deploy to GitHub Pages when you push to the `mesh-utility` branch.

### Prerequisites

1. Enable GitHub Pages in your repository settings:
   - Go to: Repository → Settings → Pages
   - Source: GitHub Actions
   - The site will be available at: `https://[username].github.io/mesh-utility-tracker/`

### Deployment

Deployment happens automatically:
- Push to `mesh-utility` branch triggers the build
- GitHub Actions builds the Vite app
- Deploys to GitHub Pages
- Available at your GitHub Pages URL

### Manual Deployment

You can also trigger deployment manually:
1. Go to Actions tab in GitHub
2. Select "Deploy to GitHub Pages" workflow
3. Click "Run workflow"

## 📦 Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## ✨ Features

- ✅ Static PWA deployment
- ✅ Offline-first with service worker
- ✅ IndexedDB for local data storage
- ✅ Bluetooth mesh radio integration
- ✅ Coverage mapping with hexagonal zones
- ✅ Real-time signal analysis

## 🗂️ Project Structure

```
mesh-utility-tracker/
├── src/                # React application source
├── public/             # Static assets
├── shared/             # Shared utilities (hex grid math)
├── .github/workflows/  # GitHub Actions deployment
├── index.html          # Entry point
└── vite.config.ts      # Vite configuration
```

## 🔧 Configuration

The app is configured to work on GitHub Pages with:
- Base path: `/mesh-utility-tracker/`
- Build output: `dist/`
- Service worker enabled
- Offline support

## 📱 Usage

Once deployed, open the app in a modern browser:
1. Allow location access (for mapping)
2. Connect Bluetooth mesh radio (optional)
3. View real-time coverage map
4. Analyze signal strength (RSSI/SNR)
5. Track mesh nodes

## 🔐 Privacy

All data is stored locally in your browser:
- No backend server
- No external data collection
- IndexedDB for offline storage
- Service worker for PWA functionality

## 📄 License

MIT
