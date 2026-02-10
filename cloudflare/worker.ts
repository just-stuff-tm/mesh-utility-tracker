export interface Env {
  GITHUB_TOKEN: string;
  GITHUB_OWNER: string;
  GITHUB_REPO: string;
  GITHUB_BRANCH: string;
}

const BASE_PATH = "data/scans";

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    // ---------------- WRITE (INGEST) ----------------
    if (req.method === "POST" && path === "/") {
      return ingestScan(req, env);
    }

    // ---------------- READ (HISTORY) ----------------

    // List days
    if (req.method === "GET" && path === "/history") {
      return listHistoryDays(env);
    }

    // Fetch by day
    const match = path.match(/^\/history\/(\d{4}-\d{2}-\d{2})(\.ndjson)?$/);
    if (req.method === "GET" && match) {
      const day = match[1];
      const raw = Boolean(match[2]);
      return fetchHistoryDay(env, day, raw);
    }

    return new Response("Not found", { status: 404 });
  },
};

// ================== INGEST ==================

async function ingestScan(req: Request, env: Env): Promise<Response> {
  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  console.log('[Worker] Received scan:', JSON.stringify(payload));

  if (
    typeof payload !== "object" ||
    typeof payload.latitude !== "number" ||
    typeof payload.longitude !== "number" ||
    typeof payload.rssi !== "number"
  ) {
    return json({ error: "Invalid scan payload" }, 400);
  }

  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const filePath = `${BASE_PATH}/${day}.ndjson`;

  const line = JSON.stringify({ ...payload, receivedAt: now.toISOString() }) + "\n";

  // Retry up to 5 times for concurrent write conflicts
  const MAX_RETRIES = 5;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      // Read existing
      const getResp = await fetch(`${ghUrl(env, filePath)}?ref=${env.GITHUB_BRANCH}`, {
        headers: ghHeaders(env),
      });

      let sha: string | undefined;
      let content = "";

      if (getResp.status === 200) {
        const data = await getResp.json();
        sha = data.sha;
        content = atob(data.content.replace(/\n/g, ""));
      } else if (getResp.status !== 404) {
        const errorText = await getResp.text();
        return json(
          {
            error: "GitHub read failed",
            status: getResp.status,
            details: errorText,
          },
          502
        );
      }

      // Append & write
      const putResp = await fetch(ghUrl(env, filePath), {
        method: "PUT",
        headers: ghHeaders(env),
        body: JSON.stringify({
          message: `append scan ${now.toISOString()}`,
          content: btoa(content + line),
          sha,
          branch: env.GITHUB_BRANCH,
        }),
      });

      if (putResp.ok) {
        return json({ ok: true });
      }

      // 409 Conflict = concurrent write, retry
      if (putResp.status === 409 && attempt < MAX_RETRIES - 1) {
        await sleep(100 * Math.pow(2, attempt)); // Exponential backoff
        continue;
      }

      // Other error
      const err = await putResp.text();
      return json({ error: "GitHub write failed", details: err }, 502);
    } catch (err) {
      if (attempt === MAX_RETRIES - 1) {
        return json({ error: "Network error", details: String(err) }, 502);
      }
      await sleep(100 * Math.pow(2, attempt));
    }
  }

  return json({ error: "Max retries exceeded" }, 502);
}

// ================== HISTORY ==================

async function listHistoryDays(env: Env): Promise<Response> {
  const resp = await fetch(
    `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${BASE_PATH}?ref=${env.GITHUB_BRANCH}`,
    { headers: ghHeaders(env) }
  );

  if (!resp.ok) {
    return json({ error: "GitHub list failed" }, 502);
  }

  const files = await resp.json();
  const days = files
    .filter((f: any) => f.name.endsWith(".ndjson"))
    .map((f: any) => f.name.replace(".ndjson", ""))
    .sort();

  return json(days);
}

async function fetchHistoryDay(env: Env, day: string, raw: boolean): Promise<Response> {
  const path = `${BASE_PATH}/${day}.ndjson`;

  const resp = await fetch(`${ghUrl(env, path)}?ref=${env.GITHUB_BRANCH}`, {
    headers: ghHeaders(env),
  });

  if (!resp.ok) {
    return json({ error: "Not found" }, 404);
  }

  const file = await resp.json();
  const text = atob(file.content.replace(/\n/g, ""));

  if (raw) {
    return new Response(text, {
      headers: { 
        "Content-Type": "application/x-ndjson",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  const parsed = text
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  return json(parsed);
}

// ================== HELPERS ==================

function ghUrl(env: Env, path: string) {
  return `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${path}`;
}

function ghHeaders(env: Env) {
  return {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "mesh-history-worker",
  };
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}