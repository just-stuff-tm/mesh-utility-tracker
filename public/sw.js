const CACHE_NAME = "mesh-utility-v2-worker";
const TILE_CACHE = "map-tiles-v2";
const CDN_CACHE = "cdn-assets-v2";
const API_CACHE = "api-cache-v2";

let tileCachingEnabled = true;

const BASE_PATH = "/mesh-utility-tracker/";

const APP_SHELL_URLS = [
  BASE_PATH,
  BASE_PATH + "manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== TILE_CACHE && key !== CDN_CACHE && key !== API_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

function isTileRequest(url) {
  return (
    url.hostname.includes("basemaps.cartocdn.com") ||
    url.hostname.includes("tile.openstreetmap.org") ||
    url.hostname.includes("arcgisonline.com")
  );
}

function isCdnRequest(url) {
  return (
    url.hostname.includes("cdnjs.cloudflare.com") ||
    url.hostname.includes("fonts.googleapis.com") ||
    url.hostname.includes("fonts.gstatic.com")
  );
}

function isApiGet(url, request) {
  return url.pathname.startsWith("/api/") && request.method === "GET";
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (isTileRequest(url)) {
    if (tileCachingEnabled) {
      event.respondWith(
        caches.open(TILE_CACHE).then(async (cache) => {
          const cached = await cache.match(event.request);
          if (cached) return cached;
          try {
            const response = await fetch(event.request);
            if (response.ok || response.status === 0) {
              cache.put(event.request, response.clone());
            }
            return response;
          } catch {
            return new Response("", { status: 408 });
          }
        })
      );
    } else {
      event.respondWith(
        caches.open(TILE_CACHE).then(async (cache) => {
          const cached = await cache.match(event.request);
          if (cached) return cached;
          return fetch(event.request).catch(() => new Response("", { status: 408 }));
        })
      );
    }
    return;
  }

  if (isCdnRequest(url)) {
    event.respondWith(
      caches.open(CDN_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        try {
          const response = await fetch(event.request);
          if (response.ok || response.status === 0) {
            cache.put(event.request, response.clone());
          }
          return response;
        } catch {
          return new Response("", { status: 408 });
        }
      })
    );
    return;
  }

  if (isApiGet(url, event.request)) {
    event.respondWith(
      caches.open(API_CACHE).then(async (cache) => {
        try {
          const response = await fetch(event.request);
          if (response.ok) {
            cache.put(event.request, response.clone());
          }
          return response;
        } catch {
          const cached = await cache.match(event.request);
          if (cached) return cached;
          return new Response(JSON.stringify({ offline: true, message: "No cached data" }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          });
        }
      })
    );
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match("/").then((r) => r || new Response("Offline", { status: 503 }))
      )
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);
      if (cached) return cached;
      try {
        const response = await fetch(event.request);
        if (response.ok && event.request.method === "GET") {
          cache.put(event.request, response.clone());
        }
        return response;
      } catch {
        return new Response("", { status: 408 });
      }
    })
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (event.data && event.data.type === "PREFETCH_TILES") {
    const { urls } = event.data;
    if (Array.isArray(urls)) {
      caches.open(TILE_CACHE).then(async (cache) => {
        let count = 0;
        for (const tileUrl of urls) {
          try {
            const existing = await cache.match(tileUrl);
            if (!existing) {
              const resp = await fetch(tileUrl);
              if (resp.ok || resp.status === 0) {
                await cache.put(tileUrl, resp);
                count++;
              }
            }
          } catch {}
        }
        const clients = await self.clients.matchAll();
        for (const client of clients) {
          client.postMessage({ type: "PREFETCH_COMPLETE", count, total: urls.length });
        }
      });
    }
  }

  if (event.data && event.data.type === "SET_TILE_CACHING") {
    tileCachingEnabled = !!event.data.enabled;
  }

  if (event.data && event.data.type === "CLEAR_TILE_CACHE") {
    caches.delete(TILE_CACHE).then(() => {
      self.clients.matchAll().then((clients) => {
        for (const client of clients) {
          client.postMessage({ type: "TILE_CACHE_SIZE", count: 0 });
        }
      });
    });
  }

  if (event.data && event.data.type === "GET_TILE_CACHE_SIZE") {
    caches.open(TILE_CACHE).then(async (cache) => {
      const keys = await cache.keys();
      const clients = await self.clients.matchAll();
      for (const client of clients) {
        client.postMessage({ type: "TILE_CACHE_SIZE", count: keys.length });
      }
    });
  }
});
