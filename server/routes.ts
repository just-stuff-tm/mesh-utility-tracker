import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertScanResultSchema, insertMeshNodeSchema, insertObserverSchema, insertCoverageZoneSchema } from "@shared/schema";

const GRID_SIZE_DEG = 0.0012;

function snapToGrid(lat: number, lng: number): { snapLat: number; snapLng: number } {
  return {
    snapLat: Math.floor(lat / GRID_SIZE_DEG) * GRID_SIZE_DEG + GRID_SIZE_DEG / 2,
    snapLng: Math.floor(lng / GRID_SIZE_DEG) * GRID_SIZE_DEG + GRID_SIZE_DEG / 2,
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

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

      const { snapLat, snapLng } = snapToGrid(parsed.latitude, parsed.longitude);
      const existingZone = await storage.findNearbyZone(snapLat, snapLng, 80);
      if (existingZone) {
        const newCount = (existingZone.scanCount || 0) + 1;
        const newAvgRssi = ((existingZone.avgRssi || 0) * (existingZone.scanCount || 0) + parsed.rssi) / newCount;
        const newAvgSnr = ((existingZone.avgSnr || 0) * (existingZone.scanCount || 0) + parsed.snr) / newCount;
        await storage.updateCoverageZone(existingZone.id, {
          avgRssi: newAvgRssi,
          avgSnr: newAvgSnr,
          scanCount: newCount,
          centerLat: existingZone.centerLat,
          centerLng: existingZone.centerLng,
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
        });
      }

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
      const { centerLat, centerLng } = req.body;
      if (typeof centerLat !== "number" || typeof centerLng !== "number") {
        return res.status(400).json({ message: "centerLat and centerLng are required" });
      }

      const { snapLat: sLat, snapLng: sLng } = snapToGrid(centerLat, centerLng);
      const existingZone = await storage.findNearbyZone(sLat, sLng, 80);
      if (existingZone) {
        const updated = await storage.updateCoverageZone(existingZone.id, {
          isDeadZone: true,
          centerLat: existingZone.centerLat,
          centerLng: existingZone.centerLng,
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
