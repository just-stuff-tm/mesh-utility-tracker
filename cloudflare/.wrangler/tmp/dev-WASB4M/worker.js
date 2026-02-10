var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker.ts
var BASE_PATH = "data/scans";
var worker_default = {
  async fetch(req, env) {
    const url = new URL(req.url);
    const path = url.pathname;
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      });
    }
    if (req.method === "POST" && path === "/") {
      return ingestScan(req, env);
    }
    if (req.method === "GET" && path === "/history") {
      return listHistoryDays(env);
    }
    const match = path.match(/^\/history\/(\d{4}-\d{2}-\d{2})(\.ndjson)?$/);
    if (req.method === "GET" && match) {
      const day = match[1];
      const raw = Boolean(match[2]);
      return fetchHistoryDay(env, day, raw);
    }
    return new Response("Not found", { status: 404 });
  }
};
async function ingestScan(req, env) {
  let payload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  console.log("[Worker] Received scan:", JSON.stringify(payload));
  if (typeof payload !== "object" || typeof payload.latitude !== "number" || typeof payload.longitude !== "number" || typeof payload.rssi !== "number") {
    return json({ error: "Invalid scan payload" }, 400);
  }
  const now = /* @__PURE__ */ new Date();
  const day = now.toISOString().slice(0, 10);
  const filePath = `${BASE_PATH}/${day}.ndjson`;
  const line = JSON.stringify({ ...payload, receivedAt: now.toISOString() }) + "\n";
  const MAX_RETRIES = 5;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const getResp = await fetch(`${ghUrl(env, filePath)}?ref=${env.GITHUB_BRANCH}`, {
        headers: ghHeaders(env)
      });
      let sha;
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
            details: errorText
          },
          502
        );
      }
      const putResp = await fetch(ghUrl(env, filePath), {
        method: "PUT",
        headers: ghHeaders(env),
        body: JSON.stringify({
          message: `append scan ${now.toISOString()}`,
          content: btoa(content + line),
          sha,
          branch: env.GITHUB_BRANCH
        })
      });
      if (putResp.ok) {
        return json({ ok: true });
      }
      if (putResp.status === 409 && attempt < MAX_RETRIES - 1) {
        await sleep(100 * Math.pow(2, attempt));
        continue;
      }
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
__name(ingestScan, "ingestScan");
async function listHistoryDays(env) {
  const resp = await fetch(
    `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${BASE_PATH}?ref=${env.GITHUB_BRANCH}`,
    { headers: ghHeaders(env) }
  );
  if (!resp.ok) {
    return json({ error: "GitHub list failed" }, 502);
  }
  const files = await resp.json();
  const days = files.filter((f) => f.name.endsWith(".ndjson")).map((f) => f.name.replace(".ndjson", "")).sort();
  return json(days);
}
__name(listHistoryDays, "listHistoryDays");
async function fetchHistoryDay(env, day, raw) {
  const path = `${BASE_PATH}/${day}.ndjson`;
  const resp = await fetch(`${ghUrl(env, path)}?ref=${env.GITHUB_BRANCH}`, {
    headers: ghHeaders(env)
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
        "Access-Control-Allow-Headers": "Content-Type"
      }
    });
  }
  const parsed = text.split("\n").filter(Boolean).map((line) => JSON.parse(line));
  return json(parsed);
}
__name(fetchHistoryDay, "fetchHistoryDay");
function ghUrl(env, path) {
  return `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${path}`;
}
__name(ghUrl, "ghUrl");
function ghHeaders(env) {
  return {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "mesh-history-worker"
  };
}
__name(ghHeaders, "ghHeaders");
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}
__name(json, "json");
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
__name(sleep, "sleep");

// ../../../Users/relio/AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../Users/relio/AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-XcmXte/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// ../../../Users/relio/AppData/Roaming/npm/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-XcmXte/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=worker.js.map
