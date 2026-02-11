# Documentation

This folder contains comprehensive documentation for the Mesh Utility Tracker project.

## 📚 Documentation Files

### Deployment & Setup
- **[CLOUDFLARE_PAGES.md](CLOUDFLARE_PAGES.md)** - Complete guide for deploying to Cloudflare Pages
  - Quick deploy instructions
  - Custom domain setup
  - Known fixes and solutions reference (ground truth)
  - Environment variable configuration
  - Troubleshooting guide

- **[WORKER_SETUP.md](WORKER_SETUP.md)** - Cloudflare Worker deployment guide
  - D1 database setup
  - GitHub token configuration
  - Durable Objects setup
  - Testing and monitoring

- **[DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)** - Pre-deployment verification checklist

- **[QUICK_START_PAGES.md](QUICK_START_PAGES.md)** - Quick start guide for Cloudflare Pages

- **[DEVELOPMENT.md](DEVELOPMENT.md)** - Local development notes and tips

### Architecture & Design
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - System architecture documentation
  - Data pipeline flow
  - Component overview
  - API reference
  - Performance characteristics
  - Privacy and GDPR compliance

### Data Formats
- **[CSV_FORMAT.md](CSV_FORMAT.md)** - CSV data format specification for mesh scans

- **[DATA_REPO_README.md](DATA_REPO_README.md)** - Documentation for mesh-data GitHub repository structure

## 🔧 Quick Reference

### For Development
- Start with [ARCHITECTURE.md](ARCHITECTURE.md) to understand the system
- Use [CLOUDFLARE_PAGES.md](CLOUDFLARE_PAGES.md) for deployment fixes and troubleshooting

### For Deployment
1. [WORKER_SETUP.md](WORKER_SETUP.md) - Set up backend first
2. [CLOUDFLARE_PAGES.md](CLOUDFLARE_PAGES.md) - Deploy frontend
3. [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) - Verify everything works

### For Data Integration
- [CSV_FORMAT.md](CSV_FORMAT.md) - Understand scan data format
- [DATA_REPO_README.md](DATA_REPO_README.md) - Access public mesh data

## 📝 Note

These documentation files are not deployed to production. They're maintained in the repository for developers and contributors only.

For end-user documentation, see the in-app manual and help pages.
