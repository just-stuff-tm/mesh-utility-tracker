import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertScanResultSchema, insertMeshNodeSchema, insertObserverSchema, insertCoverageZoneSchema } from "@shared/schema";
import { snapToHexGrid } from "@shared/grid";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.post("/api/remote-log", (req, res) => {
    const entries = req.body;
    if (Array.isArray(entries)) {
      for (const entry of entries) {
        const level = entry.level || "log";
        const msg = typeof entry.message === "string" ? entry.message : JSON.stringify(entry.message);
        console.log(`[remote-${level}] ${msg}`);
      }
    }
    res.json({ ok: true });
  });

  app.get("/api/nodes", async (_req, res) => {
    try {
      const nodes = await storage.getNodes();
      res.json(nodes);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/nodes", async (req, res) => {
    try {
      const parsed = insertMeshNodeSchema.parse(req.body);
      const node = await storage.upsertNode(parsed);
      res.json(node);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.get("/api/scan-results", async (_req, res) => {
    try {
      const scans = await storage.getScanResults();
      res.json(scans);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/scan-results/latest", async (_req, res) => {
    try {
      const scans = await storage.getLatestScanResults();
      res.json(scans);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/scan-results/zone", async (req, res) => {
    try {
      const lat = parseFloat(req.query.lat as string);
      const lng = parseFloat(req.query.lng as string);
      if (isNaN(lat) || isNaN(lng)) {
        return res.status(400).json({ message: "lat and lng query params required" });
      }
      const tolerance = 0.001;
      const scans = await storage.getScanResultsByZone(lat, lng, tolerance);
      res.json(scans);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/scan-results", async (req, res) => {
    try {
      const parsed = insertScanResultSchema.parse(req.body);
      const scan = await storage.createScanResult(parsed);

      await storage.upsertNode({
        nodeId: parsed.nodeId,
        name: parsed.senderName || null,
        hardwareType: null,
        latitude: null,
        longitude: null,
      });

      const { snapLat, snapLng } = snapToHexGrid(parsed.latitude, parsed.longitude);
      const existingZone = await storage.findNearbyZone(snapLat, snapLng, 40);
      if (existingZone) {
        const newCount = (existingZone.scanCount || 0) + 1;
        const newAvgRssi = ((existingZone.avgRssi || 0) * (existingZone.scanCount || 0) + parsed.rssi) / newCount;
        const newAvgSnr = ((existingZone.avgSnr || 0) * (existingZone.scanCount || 0) + parsed.snr) / newCount;
        await storage.updateCoverageZone(existingZone.id, {
          avgRssi: newAvgRssi,
          avgSnr: newAvgSnr,
          scanCount: newCount,
          isDeadZone: false,
          centerLat: existingZone.centerLat,
          centerLng: existingZone.centerLng,
          radioId: parsed.radioId || existingZone.radioId,
        });
      } else {
        await storage.createCoverageZone({
          centerLat: snapLat,
          centerLng: snapLng,
          radiusMeters: 80,
          avgRssi: parsed.rssi,
          avgSnr: parsed.snr,
          scanCount: 1,
          isDeadZone: false,
          polygon: null,
          radioId: parsed.radioId || null,
        });
      }

      const tolerance = 0.001;
      await storage.pruneZoneScanResults(snapLat, snapLng, tolerance, 5);

      res.json(scan);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.get("/api/coverage-zones", async (_req, res) => {
    try {
      const zones = await storage.getCoverageZones();
      res.json(zones);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/coverage-zones/dead", async (_req, res) => {
    try {
      const zones = await storage.getDeadZones();
      res.json(zones);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/coverage-zones/dead-zone", async (req, res) => {
    try {
      const { centerLat, centerLng, radioId } = req.body;
      if (typeof centerLat !== "number" || typeof centerLng !== "number") {
        return res.status(400).json({ message: "centerLat and centerLng are required" });
      }

      const { snapLat: sLat, snapLng: sLng } = snapToHexGrid(centerLat, centerLng);
      const existingZone = await storage.findNearbyZone(sLat, sLng, 40);
      if (existingZone) {
        const updated = await storage.updateCoverageZone(existingZone.id, {
          isDeadZone: true,
          avgRssi: null,
          avgSnr: null,
          scanCount: 0,
          centerLat: existingZone.centerLat,
          centerLng: existingZone.centerLng,
          radioId: radioId || existingZone.radioId,
        });
        return res.json(updated);
      }

      const zone = await storage.createCoverageZone({
        centerLat: sLat,
        centerLng: sLng,
        radiusMeters: 80,
        avgRssi: null,
        avgSnr: null,
        scanCount: 0,
        isDeadZone: true,
        polygon: null,
        radioId: radioId || null,
      });
      res.json(zone);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/coverage-zones/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteCoverageZone(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Zone not found" });
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/data/:radioId", async (req, res) => {
    try {
      const { radioId } = req.params;
      if (!radioId || radioId.length < 10) {
        return res.status(400).json({ message: "Valid radioId required" });
      }
      const result = await storage.deleteDataByRadioId(radioId);
      res.json({ success: true, deleted: result });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/observers", async (_req, res) => {
    try {
      const list = await storage.getObservers();
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/observers", async (req, res) => {
    try {
      const parsed = insertObserverSchema.parse(req.body);
      const observer = await storage.createObserver(parsed);
      res.json(observer);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  return httpServer;
}
