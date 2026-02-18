# Contributing to Mesh Utility Tracker

Thanks for contributing.

## Prerequisites

- Node.js 20+
- npm
- Git
- Chrome/Edge (for Web Bluetooth testing)

## Local Setup

1. Clone the repo:
```bash
git clone https://github.com/just-stuff-tm/mesh-utility-tracker.git
cd mesh-utility-tracker
```

2. Install frontend dependencies:
```bash
npm install
```

3. Start frontend dev server:
```bash
npm run dev
```

Optional local worker setup:

1. Install worker dependencies:
```bash
cd worker
npm install
```

2. Run worker locally:
```bash
npm run dev
```

3. Point frontend at local worker (from repo root):
```bash
echo "VITE_WORKER_URL=http://127.0.0.1:8787" > .env
npm run dev
```

## Project Structure

```text
src/        React frontend
worker/     Cloudflare Worker + Durable Object
shared/     Shared utilities (grid/math)
public/     Static assets + SPA redirects
```

## Required Checks Before Push

Frontend (repo root):
```bash
npm run check
npm run build
```

Worker:
```bash
cd worker
npm run check
```

These mirror CI in `.github/workflows/ci.yml`.

## Branch and Contribution Flow

External contributors:

1. Create a branch:
```bash
git checkout -b feature/short-name
```
2. Commit and push:
```bash
git add -A
git commit -m "feat: short description"
git push origin feature/short-name
```
3. Open a pull request.

Repo maintainers:

- You can push directly to your target branch (for example `mesh-utility`) after running required checks.

## Where to Make Changes

- Bluetooth/radio behavior:
  - `src/lib/bluetooth.ts`
  - `src/lib/bluetooth-context.tsx`
- Coverage aggregation and node extraction:
  - `src/lib/scan-aggregator.ts`
  - `src/components/coverage-map.tsx`
- Offline/local persistence:
  - `src/lib/offline-store.ts`
- Worker ingest/history/coverage:
  - `worker/src/index.ts`
  - `worker/src/batch.ts`

If you change API payload shape, update both frontend producer/consumer and worker parser in the same change.

## Style Guidelines

- Use TypeScript types; avoid `any` unless unavoidable.
- Keep changes minimal and focused.
- Preserve existing UI patterns unless intentionally redesigning.
- Prefer readable code over clever code.

## Testing Expectations

When relevant, verify:

- Scan flow with and without repeater responses.
- Dead-zone behavior (`nodes: []` => no signal metrics).
- Node list/history/map consistency.
- Offline queue and later sync.
- Mobile and desktop basic UI behavior.

## Need Help

- Issues: <https://github.com/just-stuff-tm/mesh-utility-tracker/issues>
- Discussions: <https://github.com/just-stuff-tm/mesh-utility-tracker/discussions>

## License

By contributing, you agree your contributions are licensed under MIT.
