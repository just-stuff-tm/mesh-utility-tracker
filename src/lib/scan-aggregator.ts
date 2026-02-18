import { snapToHexGrid, getHexVertices, hexKey } from "@shared/grid";

export interface RawScan {
  observerId?: string;
  nodeId?: string;
  latitude: number;
  longitude: number;
  rssi: number;
  snr?: number;
  snrIn?: number;
  altitude?: number;
  timestamp?: string;
  receivedAt?: string;
  senderName?: string;
  receiverName?: string;
  radioId?: string;
}

export interface CoverageZone {
  id: string;
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  avgRssi: number | null;
  avgSnr: number | null;
  scanCount: number;
  lastScanned: Date;
  isDeadZone: boolean;
  polygon: [number, number][];
  radioId?: string;
}

export interface MeshNode {
  id: string;
  nodeId: string;
  name: string | null;
  hardwareType: string | null;
  lastSeen: Date;
  latitude: number | null;
  longitude: number | null;
}

export interface ScanResult {
  id: string;
  observerId: string;
  nodeId: string;
  rssi: number;
  snr: number;
  snrIn: number | null;
  latitude: number;
  longitude: number;
  altitude: number | null;
  timestamp: Date;
  senderName: string | null;
  receiverName: string | null;
  radioId: string | null;
}

/**
 * Aggregates raw scans into hexagonal coverage zones.
 * Uses "best signal wins" approach - keeps the strongest RSSI and SNR for each zone.
 */
export function aggregateScansToZones(scans: RawScan[]): CoverageZone[] {
  // Group by hex cell
  const hexMap = new Map<string, RawScan[]>();

  for (const scan of scans) {
    const key = hexKey(scan.latitude, scan.longitude);
    if (!hexMap.has(key)) {
      hexMap.set(key, []);
    }
    hexMap.get(key)!.push(scan);
  }

  // Aggregate each hex
  const zones: CoverageZone[] = [];

  for (const [key, cellScans] of Array.from(hexMap.entries())) {
    const { snapLat, snapLng } = snapToHexGrid(
      cellScans[0].latitude,
      cellScans[0].longitude
    );

    // Check if any scans in this hex found actual nodes
    const scansWithNodes = cellScans.filter((s: RawScan) => s.nodeId != null && s.nodeId !== "");
    const isDeadZone = scansWithNodes.length === 0;

    // Dead zones should not report synthetic signal metrics.
    const bestRssi = isDeadZone
      ? null
      : Math.max(...scansWithNodes.map((s: RawScan) => s.rssi));

    const snrScans = scansWithNodes.filter((s: RawScan) => s.snr != null);
    const bestSnr = isDeadZone
      ? null
      : snrScans.length > 0
        ? Math.max(...snrScans.map((s: RawScan) => s.snr!))
        : null;

    const timestamps = cellScans
      .map((s: RawScan) => s.receivedAt || s.timestamp)
      .filter((t): t is string => t != null)
      .map((t: string) => new Date(t));
    const lastScanned =
      timestamps.length > 0
        ? new Date(Math.max(...timestamps.map((d: Date) => d.getTime())))
        : new Date();

    zones.push({
      id: key,
      centerLat: snapLat,
      centerLng: snapLng,
      radiusMeters: 100,
      avgRssi: bestRssi,
      avgSnr: bestSnr,
      scanCount: cellScans.length,
      lastScanned,
      isDeadZone,
      polygon: getHexVertices(snapLat, snapLng),
      radioId: cellScans[0].radioId,
    });
  }

  return zones;
}

/**
 * Fetches scan history from Cloudflare Worker and aggregates into zones.
 */
export async function fetchAndAggregate(
  workerUrl: string,
  days?: string[]
): Promise<CoverageZone[]> {
  let targetDays = days;

  // If no days specified, fetch last 7 days
  if (!targetDays) {
    const resp = await fetch(`${workerUrl}/history`);
    if (!resp.ok) throw new Error("Failed to fetch history days");
    const allDays: string[] = await resp.json();
    targetDays = allDays; // Online mode: include all available D1 history days
  }

  // Fetch all days in parallel
  const scanArrays = await Promise.all(
    targetDays.map(async (day) => {
      try {
        const resp = await fetch(`${workerUrl}/history/${day}.ndjson`);
        if (!resp.ok) return [];
        
        const text = await resp.text();
        return text
          .split("\n")
          .filter(Boolean)
          .map((line) => JSON.parse(line) as RawScan);
      } catch {
        return [];
      }
    })
  );

  const allScans = scanArrays.flat();
  return aggregateScansToZones(allScans);
}

/**
 * Fetches raw scans from worker without aggregation.
 */
export async function fetchRawScans(
  workerUrl: string,
  days?: string[]
): Promise<RawScan[]> {
  let targetDays = days;

  if (!targetDays) {
    const resp = await fetch(`${workerUrl}/history`);
    if (!resp.ok) throw new Error("Failed to fetch history days");
    const allDays: string[] = await resp.json();
    targetDays = allDays; // Online mode: include all available D1 history days
  }

  const scanArrays = await Promise.all(
    targetDays.map(async (day) => {
      try {
        const resp = await fetch(`${workerUrl}/history/${day}.ndjson`);
        if (!resp.ok) return [];
        
        const text = await resp.text();
        return text
          .split("\n")
          .filter(Boolean)
          .map((line) => JSON.parse(line) as RawScan);
      } catch {
        return [];
      }
    })
  );

  return scanArrays.flat();
}

/**
 * Extracts unique mesh nodes from raw scans.
 */
export function extractNodes(scans: RawScan[]): MeshNode[] {
  const nodeMap = new Map<string, MeshNode>();

  for (const scan of scans) {
    if (!scan.nodeId) continue;

    const existing = nodeMap.get(scan.nodeId);
    const timestamp = new Date(scan.receivedAt || scan.timestamp || Date.now());

    // Prefer non-"Unknown" names over "Unknown" names
    const scanName = scan.senderName || null;
    const isUnknownName = scanName?.startsWith("Unknown (");
    
    if (!existing) {
      nodeMap.set(scan.nodeId, {
        id: scan.nodeId,
        nodeId: scan.nodeId,
        name: scanName,
        hardwareType: null,
        lastSeen: timestamp,
        latitude: scan.latitude || null,
        longitude: scan.longitude || null,
      });
    } else {
      // Update if timestamp is newer OR if we have a better name
      const existingIsUnknown = existing.name?.startsWith("Unknown (");
      const shouldUpdateName = scanName && !isUnknownName && (existingIsUnknown || !existing.name);
      
      if (timestamp > existing.lastSeen || shouldUpdateName) {
        nodeMap.set(scan.nodeId, {
          ...existing,
          name: shouldUpdateName ? scanName : existing.name,
          lastSeen: timestamp > existing.lastSeen ? timestamp : existing.lastSeen,
          latitude: scan.latitude || existing.latitude,
          longitude: scan.longitude || existing.longitude,
        });
      }
    }
  }

  return Array.from(nodeMap.values());
}

/**
 * Converts raw scans to ScanResult format.
 */
export function convertToScanResults(scans: RawScan[]): ScanResult[] {
  return scans.map((scan, idx) => ({
    id: `scan-${idx}`,
    observerId: scan.observerId || "unknown",
    nodeId: scan.nodeId || "unknown",
    rssi: scan.rssi,
    snr: scan.snr ?? 0,
    snrIn: scan.snrIn ?? null,
    latitude: scan.latitude,
    longitude: scan.longitude,
    altitude: scan.altitude ?? null,
    timestamp: new Date(scan.receivedAt || scan.timestamp || Date.now()),
    senderName: scan.senderName ?? null,
    receiverName: scan.receiverName ?? null,
    radioId: scan.radioId ?? null,
  }));
}
