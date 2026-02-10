
# CLAUDE.md — Mesh Utility Tracker (AUTHORITATIVE)

## READ THIS FIRST — NON-NEGOTIABLE CONSTRAINTS

This project has **already completed** a migration away from a traditional backend.
Your role is to **preserve behavior**, not redesign.

If any instruction below conflicts with a proposed change → **STOP**.

Mental model (fixed):

GitHub = append-only event log  
Cloudflare Worker = stateless ingest + read proxy  
Browser = compute engine  

This is **mapping software**, not a CRUD app.

---

## 1. Baseline Reference (Critical)

**Authoritative functional reference:**
- GitHub repo: `just-stuff-tm/mesh-utility-tracker`
- Branch: `replit-baseline`

If behavior is ever unclear:
👉 **Compare against `replit-baseline`**
👉 Preserve UX, visuals, math, and offline behavior  
👉 Differences are allowed **only in how data travels**, not what the user sees

DO NOT “improve” behavior unless explicitly instructed.

---

## 2. Current Architecture (DO NOT REPLACE)

### 2.1 Ingestion Layer — Cloudflare Worker

Single-purpose worker.

Allowed:
- `POST /` — ingest scan payloads
- Append scan records to GitHub:

data/scans/YYYY-MM-DD.ndjson

Rules:
- Append-only
- Stateless
- No DB, no cache, no aggregation
- Secrets via:
- `.dev.vars` (local, gitignored)
- Wrangler secrets (production)

Forbidden:
- Databases
- KV
- Durable Objects
- Queues
- Cron jobs

---

### 2.2 Storage Layer — GitHub (Cold Storage)

GitHub repo acts as:
- Immutable event log
- Audit trail
- Infinite free storage

Rules:
- Never rewrite past days
- Never delete scans
- Never change file format
- Each line = one scan (NDJSON)

---

### 2.3 Read Layer — Worker Passthrough

Worker exposes:

- `GET /history`
- Returns list of available dates
- `GET /history/:day`
- Parsed JSON array
- `GET /history/:day.ndjson`
- Raw stream

Worker performs **NO aggregation**.

---

## 3. Aggregation & Spatial Logic (CLIENT-SIDE ONLY)

All spatial computation runs **only in the browser**.

### Canonical Grid Math (DO NOT CHANGE)

File: `shared/grid.ts`

```ts
export const HEX_SIZE = 0.0007;
export const LNG_SCALE = 1.2;
export const ROW_SPACING = HEX_SIZE * 1.5;
export const COL_SPACING = HEX_SIZE * Math.sqrt(3) * LNG_SCALE;

export function snapToHexGrid(lat: number, lng: number) {
const row = Math.round(lat / ROW_SPACING);
const isOddRow = Math.abs(row) % 2 === 1;
const offset = isOddRow ? COL_SPACING / 2 : 0;
const col = Math.round((lng - offset) / COL_SPACING);
return {
  snapLat: row * ROW_SPACING,
  snapLng: col * COL_SPACING + offset,
};
}

export function getHexVertices(centerLat: number, centerLng: number) {
const vertices: [number, number][] = [];
for (let i = 0; i < 6; i++) {
  const angleDeg = 60 * i - 30;
  const angleRad = (Math.PI / 180) * angleDeg;
  vertices.push([
    centerLat + HEX_SIZE * Math.sin(angleRad),
    centerLng + HEX_SIZE * LNG_SCALE * Math.cos(angleRad),
  ]);
}
return vertices;
}

⚠️ These values are pixel-aligned with Leaflet tiles
⚠️ Any change breaks visual continuity and invalidates historical data
⚠️ Treat this file as immutable


---

4. UI / Visualization Expectations

CoverageMap Requirements

CoverageMap must receive:

coverageZones[] = {
  centerLat: number
  centerLng: number
  avgRssi: number | null
  avgSnr: number | null
  scanCount: number
  isDeadZone: boolean
}

Rendering rules:

Hex polygons via getHexVertices

Color thresholds unchanged

Popups unchanged

No visible regressions tolerated


Aggregation now happens in:

client/src/lib/scan-aggregator.ts



---

5. Offline-First Behavior (MUST REMAIN)

Required:

IndexedDB stores scans locally

App usable with no network

Sync occurs opportunistically when online

UI renders local data even without history fetch


Forbidden:

Blocking UI on network availability

Removing local storage



---

6. Explicitly Removed (DO NOT REINTRODUCE)

Never add back:

server/

Express

PostgreSQL / SQLite / Drizzle

ORM schemas or migrations

Server-side aggregation

REST APIs for zones / nodes

Background jobs


If you see these → remove them.


---

7. Static Delivery & Updates (IMPORTANT)

How Users Get the App

This is a static Vite React app.

Distribution options (all valid):

Cloudflare Pages

GitHub Pages

Netlify

Vercel

Local install (PWA)


Initial load:

User loads static HTML/JS bundle

Service Worker installs

App becomes offline-capable


Updates:

New static build deployed

Service Worker updates on refresh

No backend migration required


The app is entirely static after load.


---

8. Scaling Assumptions (LOCKED)

Target:

~1000 weekly users


Already validated:

GitHub API limits sufficient

Worker retry logic handles contention

Daily NDJSON rotation prevents growth issues


Do NOT prematurely optimize.

Future (>10k users):

Would migrate storage to R2

NOT in scope now



---

9. What You MAY Change

Allowed:

Client-side utilities

Aggregation performance improvements

NDJSON streaming improvements

Error handling

Retry logic

UX polish

Read-only worker endpoints



---

10. What You MAY NOT Change

Forbidden:

Grid math

Storage format

Server-side aggregation

Paid infrastructure

Historical data interpretation



---

11. Verification Checklist (REQUIRED)

Before any change is accepted, confirm:

[ ] Hex positions unchanged vs replit-baseline

[ ] Old NDJSON files still parse

[ ] Offline works

[ ] Worker only appends

[ ] No server code exists

[ ] No database dependencies exist

[ ] Cost remains $0/month

[ ] UI matches baseline behavior


If any check fails → revert.


---

Definition of Done

✔ Same visuals
✔ Same math
✔ Same UX
✔ Zero backend
✔ Zero database
✔ Zero monthly cost
✔ Long-term historical compatibility

This project values stability, determinism, and longevity over novelty.

---