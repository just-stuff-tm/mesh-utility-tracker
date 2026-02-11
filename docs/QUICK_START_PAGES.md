# Quick Start: Deploy to Cloudflare Pages

## Ready to Deploy! 🚀

Your app is built and ready. Follow these 3 steps:

### Step 1: Login to Cloudflare

```powershell
wrangler login
```

This opens your browser to authenticate.

### Step 2: Deploy

```powershell
npm run deploy:pages
```

**First time?** You'll be asked:
- Create project? → Type `mesh-utility-tracker` and press Enter
- Production branch? → Press Enter (uses current branch)

### Step 3: Update Worker CORS

After deployment, copy your Pages URL (e.g., `https://mesh-utility-tracker.pages.dev`)

Then update the worker:

```powershell
cd worker
```

Edit `wrangler.toml` and change:
```toml
ALLOWED_ORIGINS = "https://mesh-utility-tracker.pages.dev"
```

Deploy worker update:
```powershell
npm run deploy
```

## Done! ✅

Visit your new site at: `https://mesh-utility-tracker.pages.dev`

## What Changed?

- ✅ Frontend now on Cloudflare Pages (faster global CDN)
- ✅ Same worker backend (Cloudflare Workers + D1)
- ✅ Same data storage (GitHub `mesh-data` repository)
- ✅ Simpler CORS (same infrastructure)
- ✅ Still 100% free!

## Next Steps

- 🔗 Add custom domain (optional) - See [CLOUDFLARE_PAGES.md](CLOUDFLARE_PAGES.md#custom-domain-setup-optional)
- 🔄 Enable auto-deploy from Git (optional) - See [CLOUDFLARE_PAGES.md](CLOUDFLARE_PAGES.md#auto-deployment-from-git-optional)
- 📊 Check analytics in Cloudflare Dashboard
- 🔙 Keep GitHub Pages as backup (still works!)

## Troubleshooting

**"wrangler: command not found"**
```powershell
npm install -g wrangler
```

**Build fails?**
```powershell
npm install
npm run build:pages
```

**Worker CORS errors?**
Make sure `ALLOWED_ORIGINS` in `worker/wrangler.toml` matches your Pages URL exactly.

---

Full documentation: [CLOUDFLARE_PAGES.md](CLOUDFLARE_PAGES.md)
