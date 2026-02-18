import { QueryClient, QueryFunction } from "@tanstack/react-query";
import {
  getTableForEndpoint,
  saveCollectionToLocal,
  getLocalCollection,
  getLocalOnlyEntries,
  getLocalDeadZones,
  getLocalLatestScans,
  enqueueMutation,
  isOnline,
} from "./offline-store";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  if (!isOnline() && method !== "GET") {
    await enqueueMutation({
      url,
      method,
      payload: data || null,
      createdAt: Date.now(),
      retries: 0,
    });
    const queuedResponse = new Response(JSON.stringify({ queued: true }), {
      status: 202,
      statusText: "Queued for sync",
      headers: { "Content-Type": "application/json" },
    });
    return queuedResponse;
  }

  try {
    const res = await fetch(url, {
      method,
      headers: data ? { "Content-Type": "application/json" } : {},
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });

    await throwIfResNotOk(res);
    return res;
  } catch (err) {
    if (method !== "GET") {
      await enqueueMutation({
        url,
        method,
        payload: data || null,
        createdAt: Date.now(),
        retries: 0,
      });
      return new Response(JSON.stringify({ queued: true }), {
        status: 202,
        statusText: "Queued for sync",
        headers: { "Content-Type": "application/json" },
      });
    }
    throw err;
  }
}

export function isQueuedResponse(res: Response): boolean {
  return res.status === 202;
}

async function getOfflineData(endpoint: string): Promise<unknown | null> {
  const base = endpoint.split("?")[0];
  if (base === "/api/coverage-zones/dead") {
    return getLocalDeadZones();
  }
  if (base === "/api/scan-results/latest") {
    return getLocalLatestScans();
  }
  const tableName = getTableForEndpoint(endpoint);
  if (tableName) {
    return getLocalCollection(tableName);
  }
  return null;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const endpoint = queryKey.join("/") as string;

    if (!isOnline()) {
      const offlineData = await getOfflineData(endpoint);
      if (offlineData !== null) {
        return offlineData as never;
      }
    }

    try {
      const res = await fetch(endpoint, {
        credentials: "include",
      });

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }

      await throwIfResNotOk(res);
      const json = await res.json();

      const tableName = getTableForEndpoint(endpoint);
      if (tableName && Array.isArray(json)) {
        saveCollectionToLocal(tableName, json).catch(() => {});

        try {
          const localEntries = await getLocalOnlyEntries(tableName);
          if (localEntries.length > 0) {
            return [...json, ...localEntries];
          }
        } catch {}
      }

      return json;
    } catch (err) {
      const offlineData = await getOfflineData(endpoint);
      if (offlineData !== null) {
        return offlineData as never;
      }
      throw err;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
