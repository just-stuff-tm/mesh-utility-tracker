import { snapToHexGrid } from "../shared/grid";

export interface Env {}

export default {
  async fetch(request: Request, _env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Health check
    if (request.method === "GET" && url.pathname === "/") {
      return json({ ok: true });
    }

    // Scan ingest
    if (request.method === "POST" && url.pathname === "/api/scan-results") {
      try {
        const body = await request.json();

        // Minimal validation (do not be strict yet)
        if (
          typeof body.latitude !== "number" ||
          typeof body.longitude !== "number"
        ) {
          return json({ error: "latitude and longitude required" }, 400);
        }

        const { snapLat, snapLng } = snapToHexGrid(
          body.latitude,
          body.longitude
        );

        const scan = {
          ts: Date.now(),

          // canonical snapped coords
          lat: snapLat,
          lng: snapLng,

          // raw coords for debugging
          rawLat: body.latitude,
          rawLng: body.longitude,

          rssi: body.rssi ?? null,
          snr: body.snr ?? null,

          observer: body.observerId ?? null,
          node: body.nodeId ?? null,
          radio: body.radioId ?? null,
        };

        // For now: just echo normalized scan
        return json({ ok: true, scan }, 201);
      } catch (err: any) {
        return json(
          {
            error: "Invalid JSON",
            message: err?.message ?? null,
          },
          400
        );
      }
    }

    return new Response("Not found", { status: 404 });
  },
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}