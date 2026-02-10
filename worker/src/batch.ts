/**
 * Scan Batcher - Durable Object for batching scan uploads
 * Accumulates scans and commits them to GitHub in batches to reduce API calls
 */

import { batchCommitToGitHub } from './github';
import { generateDataReadme } from './index-generator';

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
    rssi: number;
    snr: number;
    hopLimit?: number;
  }>;
}

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
      // Group scans by date
      const scansByDate = new Map<string, ScanPayload[]>();
      
      for (const scan of this.scans) {
        const date = new Date(scan.timestamp).toISOString().split('T')[0];
        if (!scansByDate.has(date)) {
          scansByDate.set(date, []);
        }
        scansByDate.get(date)!.push(scan);
      }

      // Create files for each date (both JSON and CSV)
      const files: { path: string; content: string }[] = [];
      
      for (const [date, scans] of Array.from(scansByDate.entries())) {
        const timestamp = Date.now();
        
        // JSON file for API consumption
        files.push({
          path: `scans/${date}/batch-${timestamp}.json`,
          content: JSON.stringify(scans, null, 2)
        });
        
        // CSV file for GitHub browsing and filtering
        const csvContent = this.convertToCSV(scans);
        files.push({
          path: `scans/${date}/batch-${timestamp}.csv`,
          content: csvContent
        });
      }

      // Generate index/README (optional, could be done periodically)
      // Uncomment to update README with each commit (adds overhead)
      // const readme = generateDataReadme([]);
      // files.push({ path: 'README.md', content: readme });

      // Commit to GitHub
      const env = {
        GITHUB_TOKEN: githubToken,
        GITHUB_REPO: githubRepo,
        GITHUB_BRANCH: githubBranch,
      };

      const uniqueRadios = new Set(this.scans.map(s => s.radioId)).size;
      await batchCommitToGitHub(
        env,
        files,
        `Add ${this.scans.length} scans from ${uniqueRadios} radios (JSON + CSV)`
      );

      console.log(`Successfully committed ${this.scans.length} scans to GitHub`);

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
            .bind('unknown', `Batch commit: ${this.scans.length} scans`, this.scans.length)
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
   * Convert scans to CSV format for GitHub searchability
   */
  private convertToCSV(scans: ScanPayload[]): string {
    const headers = [
      'radioId',
      'timestamp',
      'datetime_utc',
      'latitude',
      'longitude',
      'altitude',
      'nodeId',
      'rssi',
      'snr',
      'hopLimit'
    ];
    
    const rows: string[] = [headers.join(',')];
    
    for (const scan of scans) {
      for (const node of scan.nodes) {
        const row = [
          scan.radioId,
          scan.timestamp.toString(),
          new Date(scan.timestamp).toISOString(),
          scan.location.lat.toFixed(6),
          scan.location.lon.toFixed(6),
          scan.location.altitude?.toFixed(1) || '',
          node.nodeId,
          node.rssi.toString(),
          node.snr?.toString() || '',
          node.hopLimit?.toString() || ''
        ];
        rows.push(row.join(','));
      }
    }
    
    return rows.join('\n');
  }
}
