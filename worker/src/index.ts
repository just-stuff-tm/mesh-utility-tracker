/**
 * Mesh Utility Cloudflare Worker
 * Handles scan data ingestion and commits to GitHub repository
 */

import { batchCommitToGitHub, getGitHubFileContent } from './github';
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
    name?: string;
    rssi: number;
    snr: number;
  }>;
}

const DEAD_ZONE_RSSI = -130;
const DEAD_ZONE_SNR = 0;
const MASTER_CSV_PATH = 'scans.csv';
const DELETE_CHALLENGE_PREFIX = 'mesh-delete-v1';
const DELETE_CHALLENGE_TTL_MS = 5 * 60 * 1000;
const DELETE_CHALLENGE_CLOCK_SKEW_MS = 30 * 1000;

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
        const ndjsonLines = scans.results.flatMap((row: any) => {
          let nodes: any[] = [];
          try {
            const parsed = JSON.parse(row.nodes);
            if (Array.isArray(parsed)) {
              nodes = parsed;
            }
          } catch {}

          if (nodes.length === 0) {
            return [
              JSON.stringify({
                radioId: row.radioId,
                timestamp: row.timestamp,
                latitude: row.latitude,
                longitude: row.longitude,
                altitude: row.altitude,
                nodeId: '',
                senderName: null,
                rssi: DEAD_ZONE_RSSI,
                snr: DEAD_ZONE_SNR,
                receivedAt: new Date(row.timestamp).toISOString(),
              }),
            ];
          }

          return nodes.map((node: any) =>
            JSON.stringify({
              radioId: row.radioId,
              timestamp: row.timestamp,
              latitude: row.latitude,
              longitude: row.longitude,
              altitude: row.altitude,
              nodeId: typeof node?.nodeId === 'string' ? node.nodeId : '',
              senderName: typeof node?.name === 'string' ? node.name : null,
              rssi: typeof node?.rssi === 'number' ? node.rssi : DEAD_ZONE_RSSI,
              snr: typeof node?.snr === 'number' ? node.snr : DEAD_ZONE_SNR,
              receivedAt: new Date(row.timestamp).toISOString(),
            })
          );
        });

        const ndjson = ndjsonLines.join('\n');

        return new Response(ndjson, {
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/x-ndjson',
          },
        });
      }

      // Request signed deletion challenge
      if (url.pathname === '/delete/challenge' && request.method === 'POST') {
        const body = await request.json() as { radioId?: string; publicKey?: string };
        const radioId = normalizeRadioId(body.radioId);
        const publicKey = normalizeHex(body.publicKey);

        if (!radioId || !isHex(publicKey, 64)) {
          return new Response(JSON.stringify({ error: 'radioId and publicKey are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const derivedRadioId = radioIdFromPublicKeyHex(publicKey);
        if (derivedRadioId !== radioId) {
          return new Response(JSON.stringify({ error: 'radioId does not match publicKey prefix' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const challenge = createDeleteChallenge(radioId);
        return new Response(JSON.stringify(challenge), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Delete user data after signed ownership verification
      if (url.pathname.startsWith('/delete/') && request.method === 'POST') {
        const radioId = normalizeRadioId(url.pathname.split('/')[2]);
        if (!radioId) {
          return new Response(JSON.stringify({ error: 'radioId required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const body = await request.json() as {
          publicKey?: string;
          challenge?: string;
          signature?: string;
        };

        const publicKey = normalizeHex(body.publicKey);
        const challenge = typeof body.challenge === 'string' ? body.challenge.trim() : '';
        const signature = normalizeHex(body.signature);

        if (!isHex(publicKey, 64) || !isHex(signature, 128) || challenge.length === 0) {
          return new Response(JSON.stringify({ error: 'publicKey, challenge, and signature are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const derivedRadioId = radioIdFromPublicKeyHex(publicKey);
        if (derivedRadioId !== radioId) {
          return new Response(JSON.stringify({ error: 'radioId ownership verification failed' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const parsedChallenge = parseDeleteChallenge(challenge);
        if (!parsedChallenge || parsedChallenge.radioId !== radioId) {
          return new Response(JSON.stringify({ error: 'invalid delete challenge' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const now = Date.now();
        if (
          parsedChallenge.expiresAt < now - DELETE_CHALLENGE_CLOCK_SKEW_MS ||
          parsedChallenge.expiresAt > now + DELETE_CHALLENGE_TTL_MS + DELETE_CHALLENGE_CLOCK_SKEW_MS
        ) {
          return new Response(JSON.stringify({ error: 'delete challenge expired' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const verified = await verifyDeleteSignature(
          hexToBytes(publicKey),
          new TextEncoder().encode(challenge),
          hexToBytes(signature)
        );
        if (!verified) {
          return new Response(JSON.stringify({ error: 'invalid signature for radio ownership proof' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        let pendingRemoved = 0;
        try {
          const batcherId = env.SCAN_BATCH.idFromName('global-batcher');
          const batcher = env.SCAN_BATCH.get(batcherId);
          const batchDeleteRes = await batcher.fetch(`${url.origin}/delete/${encodeURIComponent(radioId)}`, {
            method: 'POST',
          });
          if (batchDeleteRes.ok) {
            const batchDeleteJson = await batchDeleteRes.json() as { removed?: number };
            pendingRemoved = Number(batchDeleteJson.removed || 0);
          }
        } catch (error) {
          console.error('Failed to remove pending scans from batcher:', error);
        }

        const d1DeleteResult = await env.DB.prepare('DELETE FROM scans WHERE radioId = ?')
          .bind(radioId)
          .run();
        const d1Deleted = Number((d1DeleteResult as any)?.meta?.changes || 0);

        const csvUpdate = await removeRadioRowsFromMasterCsv(env, radioId);

        const deletionRecord = {
          radioId,
          publicKey,
          deletedAt: new Date().toISOString(),
          action: 'deletion',
          ownership: 'radio-signature-verified',
          challengeExpiresAt: parsedChallenge.expiresAt,
          d1Deleted,
          pendingRemoved,
          csvRowsRemoved: csvUpdate.removedRows,
        };

        const date = new Date().toISOString().split('T')[0];
        const files: Array<{ path: string; content: string }> = [
          {
            path: `deletions/${date}/${radioId}.json`,
            content: JSON.stringify(deletionRecord, null, 2),
          },
        ];

        if (csvUpdate.updatedContent) {
          files.push({
            path: MASTER_CSV_PATH,
            content: csvUpdate.updatedContent,
          });
        }

        await batchCommitToGitHub(
          env,
          files,
          `Delete data for radio ${radioId.substring(0, 8)} (${csvUpdate.removedRows} rows removed from ${MASTER_CSV_PATH})`
        );

        return new Response(
          JSON.stringify({
            success: true,
            radioId,
            d1Deleted,
            pendingRemoved,
            csvRowsRemoved: csvUpdate.removedRows,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
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

function normalizeRadioId(value: unknown): string {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

function normalizeHex(value: unknown): string {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

function isHex(value: string, expectedLength: number): boolean {
  return value.length === expectedLength && /^[0-9A-F]+$/.test(value);
}

function radioIdFromPublicKeyHex(publicKey: string): string {
  return normalizeHex(publicKey).slice(0, 8);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

function hexToBytes(hex: string): Uint8Array {
  const clean = normalizeHex(hex);
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    out[i / 2] = Number.parseInt(clean.slice(i, i + 2), 16);
  }
  return out;
}

function createDeleteChallenge(radioId: string): { challenge: string; expiresAt: number } {
  const nonceBytes = new Uint8Array(16);
  crypto.getRandomValues(nonceBytes);
  const nonce = bytesToHex(nonceBytes);
  const expiresAt = Date.now() + DELETE_CHALLENGE_TTL_MS;
  return {
    challenge: `${DELETE_CHALLENGE_PREFIX}:${radioId}:${nonce}:${expiresAt}`,
    expiresAt,
  };
}

function parseDeleteChallenge(challenge: string): { radioId: string; expiresAt: number } | null {
  const parts = challenge.split(':');
  if (parts.length !== 4) {
    return null;
  }

  const [prefix, radioId, nonce, expiresAtRaw] = parts;
  if (prefix !== DELETE_CHALLENGE_PREFIX) {
    return null;
  }

  const normalizedRadioId = normalizeRadioId(radioId);
  if (!isHex(normalizedRadioId, 8)) {
    return null;
  }

  if (!isHex(normalizeHex(nonce), 32)) {
    return null;
  }

  const expiresAt = Number.parseInt(expiresAtRaw, 10);
  if (!Number.isFinite(expiresAt)) {
    return null;
  }

  return { radioId: normalizedRadioId, expiresAt };
}

async function verifyDeleteSignature(
  publicKey: Uint8Array,
  message: Uint8Array,
  signature: Uint8Array
): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      publicKey,
      'Ed25519',
      false,
      ['verify']
    );
    return await crypto.subtle.verify('Ed25519', key, signature, message);
  } catch (error) {
    console.error('Failed to verify delete signature:', error);
    return false;
  }
}

async function removeRadioRowsFromMasterCsv(
  env: Env,
  radioId: string
): Promise<{ updatedContent: string | null; removedRows: number }> {
  const existingCsv = await getGitHubFileContent(env, MASTER_CSV_PATH);
  if (!existingCsv) {
    return { updatedContent: null, removedRows: 0 };
  }

  const normalizedCsv = existingCsv.replace(/\r\n/g, '\n').trimEnd();
  if (!normalizedCsv) {
    return { updatedContent: null, removedRows: 0 };
  }

  const lines = normalizedCsv.split('\n');
  const header = lines[0];
  const headerColumns = parseCsvLine(header);
  const radioIdIndex = headerColumns.indexOf('radioId');
  if (radioIdIndex === -1) {
    throw new Error(`Missing radioId column in ${MASTER_CSV_PATH}`);
  }

  const rowIdIndex = headerColumns.indexOf('row_id');
  const keptRows: string[] = [];
  let removedRows = 0;

  for (const line of lines.slice(1)) {
    if (line.trim().length === 0) {
      continue;
    }

    const columns = parseCsvLine(line);
    const rowRadioId = normalizeRadioId(columns[radioIdIndex] || '');
    if (rowRadioId === radioId) {
      removedRows++;
      continue;
    }

    keptRows.push(line);
  }

  if (removedRows === 0) {
    return { updatedContent: null, removedRows: 0 };
  }

  let outputRows = keptRows;
  if (rowIdIndex === 0) {
    outputRows = keptRows.map((line, index) => {
      const columns = parseCsvLine(line);
      columns[0] = String(index + 1);
      return toCsvLine(columns);
    });
  }

  return {
    updatedContent: `${header}\n${outputRows.join('\n')}\n`,
    removedRows,
  };
}

function parseCsvLine(line: string): string[] {
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

function toCsvLine(values: string[]): string {
  return values.map((value) => escapeCsvValue(value)).join(',');
}

function escapeCsvValue(value: string): string {
  const escaped = value.replace(/"/g, '""');
  if (/[",\n\r]/.test(escaped)) {
    return `"${escaped}"`;
  }
  return escaped;
}

// Export Durable Object class
export { ScanBatcher };
