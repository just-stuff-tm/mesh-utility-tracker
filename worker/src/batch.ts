/**
 * Scan Batcher - Durable Object for batching scan uploads
 * Accumulates scans and commits them to GitHub in batches to reduce API calls
 */

import { batchCommitToGitHub, getGitHubFileContent } from './github';

interface ScanPayload {
  radioId: string;
  timestamp: number;
  location: {
    lat: number;
    lon: number;
    altitude?: number;
  };
  nodes: Array<{
    nodeId: string;
    name?: string;
    rssi: number;
    snr: number;
  }>;
}

const DEAD_ZONE_RSSI = -130;
const DEAD_ZONE_SNR = 0;

const HEX_SIZE = 0.0007;
const LNG_SCALE = 1.2;
const ROW_SPACING = HEX_SIZE * 1.5;
const COL_SPACING = HEX_SIZE * Math.sqrt(3) * LNG_SCALE;

const MASTER_CSV_PATH = 'scans.csv';
const MASTER_CSV_HEADERS = [
  'row_id',
  'radioId',
  'timestamp',
  'datetime_utc',
  'latitude',
  'longitude',
  'altitude',
  'nodeId',
  'rssi',
  'snr',
];
// Legacy header compatibility for existing repositories that still include hopLimit.
const MASTER_CSV_HEADERS_WITH_HOP_LIMIT = [...MASTER_CSV_HEADERS, 'hopLimit'];
const LEGACY_CSV_HEADERS = MASTER_CSV_HEADERS.slice(1);
const LEGACY_CSV_HEADERS_WITH_HOP_LIMIT = MASTER_CSV_HEADERS_WITH_HOP_LIMIT.slice(1);
const MAX_MASTER_CSV_BYTES = 95 * 1024 * 1024;

export class ScanBatcher {
  private state: DurableObjectState;
  private env: any;
  private scans: ScanPayload[] = [];
  private batchSize = 20; // Commit every 20 scans
  private batchTimeout = 5 * 60 * 1000; // Or every 5 minutes
  private timeoutId: number | null = null;

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.env = env;
    this.init();
  }

  async init() {
    // Load pending scans from storage
    const stored = await this.state.storage.get<ScanPayload[]>('pending_scans');
    if (stored) {
      this.scans = stored;
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'POST') {
      const newScans: ScanPayload[] = await request.json();
      
      // Store in D1 database immediately
      const db = this.env.DB;
      if (db) {
        try {
          for (const scan of newScans) {
            await db.prepare(`
              INSERT INTO scans (radioId, timestamp, latitude, longitude, altitude, nodes, committed)
              VALUES (?, ?, ?, ?, ?, ?, 0)
            `)
              .bind(
                scan.radioId,
                scan.timestamp,
                scan.location.lat,
                scan.location.lon,
                scan.location.altitude || null,
                JSON.stringify(scan.nodes)
              )
              .run();
          }
        } catch (error) {
          console.error('Failed to store scans in D1:', error);
          // Continue with batching even if D1 storage fails
        }
      }
      
      // Add to batch
      this.scans.push(...newScans);

      // Save to storage
      await this.state.storage.put('pending_scans', this.scans);

      // Check if we should commit
      if (this.scans.length >= this.batchSize) {
        await this.commitBatch(request.headers);
      } else {
        // Set timeout for batch commit
        this.scheduleCommit(request.headers);
      }

      return new Response(
        JSON.stringify({
          success: true,
          queued: this.scans.length,
          message: `${newScans.length} scans queued, ${this.scans.length} total pending`,
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (url.pathname === '/flush' && request.method === 'POST') {
      // Force commit current batch
      await this.commitBatch(request.headers);
      return new Response(
        JSON.stringify({ success: true, message: 'Batch committed' }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (url.pathname === '/status') {
      return new Response(
        JSON.stringify({
          pending: this.scans.length,
          batchSize: this.batchSize,
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response('Not Found', { status: 404 });
  }

  private scheduleCommit(headers: Headers) {
    if (this.timeoutId !== null) {
      return; // Already scheduled
    }

    // @ts-ignore - Durable Objects support setTimeout
    this.timeoutId = setTimeout(async () => {
      await this.commitBatch(headers);
      this.timeoutId = null;
    }, this.batchTimeout);
  }

  private async commitBatch(headers: Headers) {
    if (this.scans.length === 0) {
      return;
    }

    const githubToken = headers.get('X-GitHub-Token');
    const githubRepo = headers.get('X-GitHub-Repo');
    const githubBranch = headers.get('X-GitHub-Branch') || 'main';

    if (!githubToken || !githubRepo) {
      console.error('Missing GitHub credentials');
      return;
    }

    try {
      const env = {
        GITHUB_TOKEN: githubToken,
        GITHUB_REPO: githubRepo,
        GITHUB_BRANCH: githubBranch,
      };

      const scansToCommit = [...this.scans].sort((a, b) => a.timestamp - b.timestamp);
      const uniqueRadios = new Set(scansToCommit.map((scan) => scan.radioId)).size;
      let rowsAppended = 0;

      const maxAttempts = 3;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const existingCsv = await getGitHubFileContent(env, MASTER_CSV_PATH);
          const updatedCsv = this.buildUpdatedMasterCsv(existingCsv, scansToCommit);
          rowsAppended = updatedCsv.rowsAdded;
          const csvSizeBytes = new TextEncoder().encode(updatedCsv.content).length;

          if (csvSizeBytes > MAX_MASTER_CSV_BYTES) {
            throw new Error(
              `${MASTER_CSV_PATH} exceeded ${(MAX_MASTER_CSV_BYTES / (1024 * 1024)).toFixed(0)}MB; rotate to yearly/monthly CSV before appending more rows`
            );
          }

          await batchCommitToGitHub(
            env,
            [{ path: MASTER_CSV_PATH, content: updatedCsv.content }],
            `Append ${rowsAppended} rows from ${scansToCommit.length} scans (${uniqueRadios} radios) to ${MASTER_CSV_PATH}`
          );
          break;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const shouldRetry = message.includes('Failed to update ref') && attempt < maxAttempts;
          if (!shouldRetry) {
            throw error;
          }
          console.warn(
            `Retrying GitHub commit after branch ref moved (attempt ${attempt}/${maxAttempts})`
          );
        }
      }

      console.log(
        `Successfully committed ${scansToCommit.length} scans to GitHub (${rowsAppended} rows appended to ${MASTER_CSV_PATH})`
      );

      // Mark scans as committed in D1
      const db = this.env.DB;
      if (db) {
        try {
          for (const scan of this.scans) {
            await db.prepare(`
              UPDATE scans SET committed = 1
              WHERE radioId = ? AND timestamp = ?
            `)
              .bind(scan.radioId, scan.timestamp)
              .run();
          }

          // Log commit to commits table
          await db.prepare(`
            INSERT INTO commits (commitSha, commitMessage, scanCount)
            VALUES (?, ?, ?)
          `)
            .bind(
              'unknown',
              `Batch commit: ${this.scans.length} scans, ${rowsAppended} rows appended to ${MASTER_CSV_PATH}`,
              this.scans.length
            )
            .run();
        } catch (error) {
          console.error('Failed to update D1 after GitHub commit:', error);
        }
      }

      // Clear batch
      this.scans = [];
      await this.state.storage.delete('pending_scans');

      // Clear timeout
      if (this.timeoutId !== null) {
        clearTimeout(this.timeoutId);
        this.timeoutId = null;
      }
    } catch (error) {
      console.error('Failed to commit batch to GitHub:', error);
      // Keep scans in storage for retry
    }
  }

  /**
   * Build updated CSV content by appending rows to the master CSV.
   * Migrates legacy header format (without row_id) on first write.
   */
  private buildUpdatedMasterCsv(
    existingContent: string | null,
    scans: ScanPayload[]
  ): { content: string; rowsAdded: number } {
    const successfulHexes = this.collectSuccessfulScanHexes(scans);
    const existingRows = this.normalizeExistingRows(existingContent, successfulHexes);
    const nextRowId = existingRows.length + 1;

    const newRows = this.convertToCSVRows(scans, nextRowId, successfulHexes);
    const allRows = [...existingRows, ...newRows];

    return {
      content: `${MASTER_CSV_HEADERS.join(',')}\n${allRows.join('\n')}\n`,
      rowsAdded: newRows.length,
    };
  }

  private convertToCSVRows(
    scans: ScanPayload[],
    startRowId: number,
    successfulHexes: Set<string>
  ): string[] {
    const rows: string[] = [];
    let rowId = startRowId;

    for (const scan of scans) {
      const scanHexKey = this.hexKey(scan.location.lat, scan.location.lon);
      const hasDetectedNodes = scan.nodes.length > 0;

      // If the same batch contains successful scans in this hex, skip dead-zone rows for that hex.
      if (!hasDetectedNodes) {
        if (successfulHexes.has(scanHexKey)) {
          continue;
        }

        rows.push(
          this.toCsvLine([
            rowId++,
            scan.radioId,
            scan.timestamp,
            new Date(scan.timestamp).toISOString(),
            scan.location.lat.toFixed(6),
            scan.location.lon.toFixed(6),
            scan.location.altitude != null ? scan.location.altitude.toFixed(1) : '',
            '',
            DEAD_ZONE_RSSI,
            DEAD_ZONE_SNR,
          ])
        );
        continue;
      }

      for (const node of scan.nodes) {
        rows.push(
          this.toCsvLine([
            rowId++,
            scan.radioId,
            scan.timestamp,
            new Date(scan.timestamp).toISOString(),
            scan.location.lat.toFixed(6),
            scan.location.lon.toFixed(6),
            scan.location.altitude != null ? scan.location.altitude.toFixed(1) : '',
            node.nodeId,
            node.rssi,
            node.snr,
          ])
        );
      }
    }

    return rows;
  }

  private normalizeExistingRows(existingContent: string | null, successfulHexes: Set<string>): string[] {
    const csv = existingContent ? existingContent.replace(/\r\n/g, '\n').trimEnd() : '';
    if (!csv) {
      return [];
    }

    const lines = csv.split('\n');
    const header = lines[0] ?? '';
    const dataLines = lines.slice(1).filter((line) => line.trim().length > 0);

    const headerText = header.trim();
    const rows: string[] = [];

    for (let index = 0; index < dataLines.length; index++) {
      const line = dataLines[index];
      const values = this.parseCsvLine(line);
      const row = this.normalizeCsvRow(headerText, values, index + 1);
      if (row) {
        rows.push(row);
      }
    }

    let filtered = rows;
    if (successfulHexes.size > 0) {
      filtered = rows.filter((line) => {
        const values = this.parseCsvLine(line);
        const nodeId = values[7] ?? '';
        if (nodeId.trim().length > 0) {
          return true;
        }

        const lat = Number.parseFloat(values[4] ?? '');
        const lon = Number.parseFloat(values[5] ?? '');
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
          return true;
        }

        return !successfulHexes.has(this.hexKey(lat, lon));
      });
    }

    // Keep row_id dense and stable after dead-zone cleanup.
    return filtered.map((line, index) => {
      const values = this.parseCsvLine(line);
      values[0] = String(index + 1);
      return this.toCsvLine(values.slice(0, MASTER_CSV_HEADERS.length));
    });
  }

  private normalizeCsvRow(header: string, values: string[], legacyRowId: number): string | null {
    if (header === MASTER_CSV_HEADERS.join(',')) {
      if (values.length < MASTER_CSV_HEADERS.length) {
        return null;
      }
      return this.toCsvLine(values.slice(0, MASTER_CSV_HEADERS.length));
    }

    if (header === MASTER_CSV_HEADERS_WITH_HOP_LIMIT.join(',')) {
      if (values.length < MASTER_CSV_HEADERS_WITH_HOP_LIMIT.length) {
        return null;
      }
      return this.toCsvLine(values.slice(0, MASTER_CSV_HEADERS.length));
    }

    if (header === LEGACY_CSV_HEADERS.join(',')) {
      if (values.length < LEGACY_CSV_HEADERS.length) {
        return null;
      }
      return this.toCsvLine([String(legacyRowId), ...values.slice(0, LEGACY_CSV_HEADERS.length)]);
    }

    if (header === LEGACY_CSV_HEADERS_WITH_HOP_LIMIT.join(',')) {
      if (values.length < LEGACY_CSV_HEADERS_WITH_HOP_LIMIT.length) {
        return null;
      }
      return this.toCsvLine([String(legacyRowId), ...values.slice(0, LEGACY_CSV_HEADERS.length)]);
    }

    throw new Error(`Unexpected CSV header in ${MASTER_CSV_PATH}`);
  }

  private collectSuccessfulScanHexes(scans: ScanPayload[]): Set<string> {
    const hexes = new Set<string>();
    for (const scan of scans) {
      if (scan.nodes.length > 0) {
        hexes.add(this.hexKey(scan.location.lat, scan.location.lon));
      }
    }
    return hexes;
  }

  private snapToHexGrid(lat: number, lon: number): { snapLat: number; snapLon: number } {
    const row = Math.round(lat / ROW_SPACING);
    const isOddRow = Math.abs(row) % 2 === 1;
    const offset = isOddRow ? COL_SPACING / 2 : 0;
    const col = Math.round((lon - offset) / COL_SPACING);
    return {
      snapLat: row * ROW_SPACING,
      snapLon: col * COL_SPACING + offset,
    };
  }

  private hexKey(lat: number, lon: number): string {
    const { snapLat, snapLon } = this.snapToHexGrid(lat, lon);
    return `${snapLat.toFixed(6)}:${snapLon.toFixed(6)}`;
  }

  private parseCsvLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        const nextChar = line[i + 1];
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++;
          continue;
        }
        inQuotes = !inQuotes;
        continue;
      }

      if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
        continue;
      }

      current += char;
    }

    values.push(current);
    return values;
  }

  private toCsvLine(values: Array<string | number>): string {
    return values.map((value) => this.escapeCsvValue(String(value))).join(',');
  }

  private escapeCsvValue(value: string): string {
    const escaped = value.replace(/"/g, '""');
    if (/[",\n\r]/.test(escaped)) {
      return `"${escaped}"`;
    }
    return escaped;
  }
}
