/**
 * Mesh Utility Cloudflare Worker
 * Handles scan data ingestion and commits to GitHub repository
 */

import { commitToGitHub, CommitData } from './github';
import { ScanBatcher } from './batch';

export interface Env {
  DB: D1Database;
  GITHUB_TOKEN: string;
  GITHUB_REPO: string; // Format: "owner/repo"
  GITHUB_BRANCH: string;
  ALLOWED_ORIGINS: string;
  SCAN_BATCH: DurableObjectNamespace;
}

export interface ScanPayload {
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    
    // CORS handling
    const allowedOrigins = env.ALLOWED_ORIGINS.split(',');
    const corsHeaders = {
      'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Credentials': 'true',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Health check
      if (url.pathname === '/health') {
        return new Response(JSON.stringify({ status: 'ok' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Upload scan data
      if (url.pathname === '/scans' && request.method === 'POST') {
        const scans: ScanPayload[] = await request.json();
        
        // Validate scan data
        if (!Array.isArray(scans) || scans.length === 0) {
          return new Response(JSON.stringify({ error: 'Invalid scan data' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Get or create batcher instance
        const batcherId = env.SCAN_BATCH.idFromName('global-batcher');
        const batcher = env.SCAN_BATCH.get(batcherId);
        
        // Add scans to batch
        const batchResponse = await batcher.fetch(request.url, {
          method: 'POST',
          body: JSON.stringify(scans),
          headers: {
            'Content-Type': 'application/json',
            'X-GitHub-Token': env.GITHUB_TOKEN,
            'X-GitHub-Repo': env.GITHUB_REPO,
            'X-GitHub-Branch': env.GITHUB_BRANCH || 'main',
          },
        });

        return new Response(await batchResponse.text(), {
          status: batchResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // List available history days
      if (url.pathname === '/history' && request.method === 'GET') {
        // Get distinct dates from scans
        const result = await env.DB.prepare(`
          SELECT DISTINCT date(timestamp / 1000, 'unixepoch') as day
          FROM scans
          ORDER BY day DESC
        `).all();

        const days = result.results.map((row: any) => row.day);

        return new Response(JSON.stringify(days), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Fetch scans for a specific day (NDJSON format)
      if (url.pathname.startsWith('/history/') && request.method === 'GET') {
        const day = url.pathname.split('/')[2].replace('.ndjson', '');
        
        // Validate date format (YYYY-MM-DD)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
          return new Response(JSON.stringify({ error: 'Invalid date format' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Calculate Unix timestamps for the day range
        const dayStart = new Date(day + 'T00:00:00Z').getTime();
        const dayEnd = new Date(day + 'T23:59:59Z').getTime();

        const scans = await env.DB.prepare(`
          SELECT radioId, timestamp, latitude, longitude, altitude, nodes
          FROM scans
          WHERE timestamp >= ? AND timestamp <= ?
          ORDER BY timestamp ASC
        `)
          .bind(dayStart, dayEnd)
          .all();

        // Convert to NDJSON format
        const ndjson = scans.results
          .map((row: any) => {
            const nodes = JSON.parse(row.nodes);
            return nodes.map((node: any) => JSON.stringify({
              radioId: row.radioId,
              timestamp: row.timestamp,
              latitude: row.latitude,
              longitude: row.longitude,
              altitude: row.altitude,
              nodeId: node.nodeId,
              rssi: node.rssi,
              snr: node.snr,
              hopLimit: node.hopLimit,
              receivedAt: new Date(row.timestamp).toISOString(),
            })).join('\n');
          })
          .filter(Boolean)
          .join('\n');

        return new Response(ndjson, {
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/x-ndjson',
          },
        });
      }

      // Delete user data
      if (url.pathname.startsWith('/delete/') && request.method === 'DELETE') {
        const radioId = url.pathname.split('/')[2];
        if (!radioId) {
          return new Response(JSON.stringify({ error: 'radioId required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Delete from D1
        await env.DB.prepare('DELETE FROM scans WHERE radioId = ?')
          .bind(radioId)
          .run();

        // Commit deletion record to GitHub
        const deletionRecord = {
          radioId,
          deletedAt: new Date().toISOString(),
          action: 'deletion',
        };

        const date = new Date().toISOString().split('T')[0];
        await commitToGitHub(env, {
          path: `deletions/${date}/${radioId}.json`,
          content: JSON.stringify(deletionRecord, null, 2),
          message: `Delete data for radio ${radioId.substring(0, 8)}`,
        });

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders });
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(
        JSON.stringify({ error: error instanceof Error ? error.message : 'Internal Server Error' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  },
};

// Export Durable Object class
export { ScanBatcher };
