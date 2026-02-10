# GitHub Pages Setup Guide

## Enable GitHub Pages for mesh-utility branch

Follow these steps to deploy your app to GitHub Pages:

### 1. Enable GitHub Actions for Pages

1. Go to your repository on GitHub
2. Click **Settings** (top right)
3. Scroll down to **Pages** (left sidebar under "Code and automation")
4. Under **Source**, select: **GitHub Actions**

That's it! Your site will now deploy automatically.

### 2. Verify Deployment

After pushing to `mesh-utility` branch:

1. Go to **Actions** tab in your repository
2. You should see "Deploy to GitHub Pages" workflow running
3. Wait for it to complete (usually 1-2 minutes)
4. Your site will be live at: `https://just-stuff-tm.github.io/mesh-utility-tracker/`

### 3. Check Deployment Status

In the Actions tab, you can:
- See build logs
- Check for errors
- Monitor deployment progress
- Re-run failed deployments

### 4. Manual Deployment Trigger

To manually trigger a deployment:

1. Go to **Actions** tab
2. Click **Deploy to GitHub Pages** workflow (left sidebar)
3. Click **Run workflow** button (right side)
4. Select `mesh-utility` branch
5. Click green **Run workflow** button

## Troubleshooting

### Workflow not running?

Make sure:
- GitHub Actions is enabled in Settings → Actions → General
- The workflow file exists: `.github/workflows/deploy.yml`
- You pushed to the `mesh-utility` branch

### Build fails?

Check the Actions logs for errors. Common issues:
- Missing dependencies (run `npm install` locally first)
- TypeScript errors (run `npm run check` locally)
- Build errors (run `npm run build` locally)

### Page not loading?

1. Check that the deployment completed successfully
2. Wait a few minutes for DNS propagation
3. Try clearing your browser cache
4. Check browser console for errors

### Need to change the base path?

If deploying to a different URL, update `vite.config.ts`:

```typescript
base: process.env.NODE_ENV === "production" ? "/your-repo-name/" : "/",
```

## App Features

Once deployed, the app provides:

- 📍 Real-time mesh network coverage mapping
- 📡 Bluetooth mesh radio integration
- 🗺️ Hexagonal coverage zones with signal strength
- 💾 Offline-first PWA with IndexedDB storage
- 📊 Signal analysis (RSSI/SNR metrics)
- 📱 Mobile-responsive design

## Local Development

To test locally before deploying:

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build production version
npm run build

# Preview production build
npm run preview
```

## Need Help?

- Check the [README.md](README.md) for more details
- Review the [GitHub Actions](https://github.com/just-stuff-tm/mesh-utility-tracker/actions) logs
- Open an issue if you encounter problems
