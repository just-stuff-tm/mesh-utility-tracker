import Dexie, { type Table } from "dexie";

export interface LocalNode {
  id: string;
  nodeId: string;
  name: string | null;
  hardwareType: string | null;
  lastSeen: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface LocalScanResult {
  id: string;
  observerId: string;
  nodeId: string;
  rssi: number;
  snr: number;
  latitude: number;
  longitude: number;
  altitude: number | null;
  timestamp: string | null;
  senderName: string | null;
  receiverName: string | null;
  radioId: string | null;
}

export interface LocalCoverageZone {
  id: string;
  centerLat: number;
  centerLng: number;
  radiusMeters: number | null;
  avgRssi: number | null;
  avgSnr: number | null;
  scanCount: number | null;
  lastScanned: string | null;
  isDeadZone: boolean | null;
  polygon: unknown;
  radioId: string | null;
}

export interface LocalObserver {
  id: string;
  name: string;
  deviceId: string | null;
  latitude: number | null;
  longitude: number | null;
  lastSeen: string | null;
  isActive: boolean | null;
  scanInterval: number | null;
}

export interface OutboxEntry {
  id?: number;
  url: string;
  method: string;
  payload: unknown;
  createdAt: number;
  retries: number;
}

class MeshDB extends Dexie {
  nodes!: Table<LocalNode, string>;
  scanResults!: Table<LocalScanResult, string>;
  coverageZones!: Table<LocalCoverageZone, string>;
  observers!: Table<LocalObserver, string>;
  outbox!: Table<OutboxEntry, number>;

  constructor() {
    super("meshUtilityDB");
    this.version(1).stores({
      nodes: "id, nodeId",
      scanResults: "id, nodeId, observerId, timestamp",
      coverageZones: "id, [centerLat+centerLng], isDeadZone",
      observers: "id, deviceId",
      outbox: "++id, createdAt",
    });
  }
}

export const db = new MeshDB();

const ENDPOINT_TABLE_MAP: Record<string, string> = {
  "/api/nodes": "nodes",
  "/api/scan-results": "scanResults",
  "/api/scan-results/latest": "scanResults",
  "/api/coverage-zones": "coverageZones",
  "/api/coverage-zones/dead": "coverageZones",
  "/api/observers": "observers",
};

export function getTableForEndpoint(url: string): string | null {
  const base = url.split("?")[0];
  return ENDPOINT_TABLE_MAP[base] || null;
}

export async function saveCollectionToLocal(tableName: string, data: unknown[]) {
  const table = (db as any)[tableName] as Table | undefined;
  if (!table || !Array.isArray(data)) return;
  await table.bulkPut(data.map((item: any) => ({
    ...item,
    lastSeen: item.lastSeen ? String(item.lastSeen) : null,
    timestamp: item.timestamp ? String(item.timestamp) : null,
    lastScanned: item.lastScanned ? String(item.lastScanned) : null,
  })));
}

export async function getLocalCollection(tableName: string): Promise<unknown[]> {
  const table = (db as any)[tableName] as Table | undefined;
  if (!table) return [];
  return table.toArray();
}

export async function getLocalOnlyEntries(tableName: string): Promise<unknown[]> {
  const table = (db as any)[tableName] as Table | undefined;
  if (!table) return [];
  return table.filter((item: any) => typeof item.id === "string" && item.id.startsWith("local-")).toArray();
}

export async function getLocalDeadZones(): Promise<LocalCoverageZone[]> {
  return db.coverageZones.filter((z) => z.isDeadZone === true).toArray();
}

export async function getLocalLatestScans(): Promise<LocalScanResult[]> {
  const all = await db.scanResults.orderBy("timestamp").reverse().toArray();
  const seen = new Set<string>();
  const latest: LocalScanResult[] = [];
  for (const scan of all) {
    if (!seen.has(scan.nodeId)) {
      seen.add(scan.nodeId);
      latest.push(scan);
    }
  }
  return latest;
}

export async function enqueueMutation(entry: Omit<OutboxEntry, "id">) {
  await db.outbox.add(entry);
}

export async function getOutboxCount(): Promise<number> {
  return db.outbox.count();
}

const MAX_OUTBOX_RETRIES = 5;

export async function drainOutbox(): Promise<{ synced: number; failed: number }> {
  const entries = await db.outbox.orderBy("createdAt").toArray();
  let synced = 0;
  let failed = 0;

  for (const entry of entries) {
    if (entry.retries >= MAX_OUTBOX_RETRIES) {
      await db.outbox.delete(entry.id!);
      failed++;
      continue;
    }
    try {
      const res = await fetch(entry.url, {
        method: entry.method,
        headers: entry.payload ? { "Content-Type": "application/json" } : {},
        body: entry.payload ? JSON.stringify(entry.payload) : undefined,
        credentials: "include",
      });
      if (res.ok) {
        await db.outbox.delete(entry.id!);
        synced++;
      } else if (res.status >= 400 && res.status < 500) {
        await db.outbox.delete(entry.id!);
        failed++;
      } else {
        const updated = { ...entry, retries: entry.retries + 1 };
        await db.outbox.put(updated);
        failed++;
      }
    } catch {
      const updated = { ...entry, retries: entry.retries + 1 };
      await db.outbox.put(updated);
      failed++;
    }
  }

  return { synced, failed };
}

export function isOnline(): boolean {
  return navigator.onLine;
}

export function generateLocalId(): string {
  return "local-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
}
