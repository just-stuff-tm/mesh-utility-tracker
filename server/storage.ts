import { eq, ne, desc, and, or, gte, lte, sql } from "drizzle-orm";
import { db } from "./db";
import {
  users, observers, meshNodes, scanResults, coverageZones,
  type User, type InsertUser,
  type Observer, type InsertObserver,
  type MeshNode, type InsertMeshNode,
  type ScanResult, type InsertScanResult,
  type CoverageZone, type InsertCoverageZone,
} from "@shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getObservers(): Promise<Observer[]>;
  getObserver(id: string): Promise<Observer | undefined>;
  getObserverByDeviceId(deviceId: string): Promise<Observer | undefined>;
  createObserver(observer: InsertObserver): Promise<Observer>;
  updateObserver(id: string, data: Partial<InsertObserver>): Promise<Observer | undefined>;
  upsertObserver(observer: InsertObserver): Promise<Observer>;

  getNodes(): Promise<MeshNode[]>;
  getNode(nodeId: string): Promise<MeshNode | undefined>;
  upsertNode(node: InsertMeshNode): Promise<MeshNode>;

  getScanResults(): Promise<ScanResult[]>;
  getLatestScanResults(): Promise<ScanResult[]>;
  getScanResultsByZone(lat: number, lng: number, tolerance: number): Promise<ScanResult[]>;
  createScanResult(scan: InsertScanResult): Promise<ScanResult>;
  pruneZoneScanResults(lat: number, lng: number, tolerance: number, maxPerZone: number): Promise<number>;

  getCoverageZones(): Promise<CoverageZone[]>;
  getDeadZones(): Promise<CoverageZone[]>;
  getCoverageZone(id: string): Promise<CoverageZone | undefined>;
  createCoverageZone(zone: InsertCoverageZone): Promise<CoverageZone>;
  updateCoverageZone(id: string, data: Partial<InsertCoverageZone>): Promise<CoverageZone | undefined>;
  deleteCoverageZone(id: string): Promise<boolean>;
  findNearbyZone(lat: number, lng: number, radiusMeters: number): Promise<CoverageZone | undefined>;
  deleteDataByRadioId(radioId: string): Promise<{ scanResults: number; coverageZones: number; observers: number }>;
  clearDeadZonesNear(lat: number, lng: number, excludeId?: string): Promise<number>;
  getActiveObserverCount(hoursAgo?: number): Promise<number>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getObservers(): Promise<Observer[]> {
    return db.select().from(observers);
  }

  async getObserver(id: string): Promise<Observer | undefined> {
    const [observer] = await db.select().from(observers).where(eq(observers.id, id));
    return observer;
  }

  async getObserverByDeviceId(deviceId: string): Promise<Observer | undefined> {
    const [observer] = await db.select().from(observers).where(eq(observers.deviceId, deviceId));
    return observer;
  }

  async createObserver(observer: InsertObserver): Promise<Observer> {
    const [result] = await db.insert(observers).values(observer).returning();
    return result;
  }

  async updateObserver(id: string, data: Partial<InsertObserver>): Promise<Observer | undefined> {
    const [result] = await db.update(observers).set(data).where(eq(observers.id, id)).returning();
    return result;
  }

  async upsertObserver(observer: InsertObserver): Promise<Observer> {
    if (observer.deviceId) {
      const existing = await this.getObserverByDeviceId(observer.deviceId);
      if (existing) {
        const [result] = await db.update(observers)
          .set({ name: observer.name, lastSeen: new Date(), latitude: observer.latitude, longitude: observer.longitude })
          .where(eq(observers.id, existing.id))
          .returning();
        return result;
      }
    }
    const [result] = await db.insert(observers).values(observer).returning();
    return result;
  }

  async getNodes(): Promise<MeshNode[]> {
    return db.select().from(meshNodes).orderBy(desc(meshNodes.lastSeen));
  }

  async getNode(nodeId: string): Promise<MeshNode | undefined> {
    const [node] = await db.select().from(meshNodes).where(eq(meshNodes.nodeId, nodeId));
    return node;
  }

  async upsertNode(node: InsertMeshNode): Promise<MeshNode> {
    const existing = await this.getNode(node.nodeId);
    if (existing) {
      const [updated] = await db.update(meshNodes)
        .set({ ...node, lastSeen: new Date() })
        .where(eq(meshNodes.nodeId, node.nodeId))
        .returning();
      return updated;
    }
    const [created] = await db.insert(meshNodes).values(node).returning();
    return created;
  }

  async getScanResults(): Promise<ScanResult[]> {
    return db.select().from(scanResults).orderBy(desc(scanResults.timestamp)).limit(500);
  }

  async getLatestScanResults(): Promise<ScanResult[]> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return db.select().from(scanResults)
      .where(gte(scanResults.timestamp, oneDayAgo))
      .orderBy(desc(scanResults.timestamp));
  }

  async getScanResultsByZone(lat: number, lng: number, tolerance: number): Promise<ScanResult[]> {
    return db.select().from(scanResults)
      .where(and(
        gte(scanResults.latitude, lat - tolerance),
        lte(scanResults.latitude, lat + tolerance),
        gte(scanResults.longitude, lng - tolerance),
        lte(scanResults.longitude, lng + tolerance),
      ))
      .orderBy(desc(scanResults.timestamp))
      .limit(5);
  }

  async createScanResult(scan: InsertScanResult): Promise<ScanResult> {
    const [result] = await db.insert(scanResults).values(scan).returning();
    return result;
  }

  async pruneZoneScanResults(lat: number, lng: number, tolerance: number, maxPerZone: number): Promise<number> {
    const zoneScans = await db.select({ id: scanResults.id })
      .from(scanResults)
      .where(and(
        gte(scanResults.latitude, lat - tolerance),
        lte(scanResults.latitude, lat + tolerance),
        gte(scanResults.longitude, lng - tolerance),
        lte(scanResults.longitude, lng + tolerance),
      ))
      .orderBy(desc(scanResults.timestamp));

    if (zoneScans.length <= maxPerZone) return 0;

    const idsToDelete = zoneScans.slice(maxPerZone).map(s => s.id);
    let deleted = 0;
    for (const id of idsToDelete) {
      const result = await db.delete(scanResults).where(eq(scanResults.id, id)).returning();
      deleted += result.length;
    }
    return deleted;
  }

  async getCoverageZones(): Promise<CoverageZone[]> {
    return db.select().from(coverageZones);
  }

  async getDeadZones(): Promise<CoverageZone[]> {
    return db.select().from(coverageZones).where(eq(coverageZones.isDeadZone, true));
  }

  async getCoverageZone(id: string): Promise<CoverageZone | undefined> {
    const [zone] = await db.select().from(coverageZones).where(eq(coverageZones.id, id));
    return zone;
  }

  async createCoverageZone(zone: InsertCoverageZone): Promise<CoverageZone> {
    const [result] = await db.insert(coverageZones).values(zone).returning();
    return result;
  }

  async updateCoverageZone(id: string, data: Partial<InsertCoverageZone>): Promise<CoverageZone | undefined> {
    const [result] = await db.update(coverageZones)
      .set({ ...data, lastScanned: new Date() })
      .where(eq(coverageZones.id, id))
      .returning();
    return result;
  }

  async deleteCoverageZone(id: string): Promise<boolean> {
    const result = await db.delete(coverageZones).where(eq(coverageZones.id, id)).returning();
    return result.length > 0;
  }

  async deleteDataByRadioId(radioId: string): Promise<{ scanResults: number; coverageZones: number; observers: number }> {
    const deletedScans = await db.delete(scanResults)
      .where(or(eq(scanResults.radioId, radioId), eq(scanResults.observerId, radioId)))
      .returning();
    const deletedZones = await db.delete(coverageZones)
      .where(eq(coverageZones.radioId, radioId))
      .returning();
    const deletedObservers = await db.delete(observers)
      .where(eq(observers.deviceId, radioId))
      .returning();
    return { scanResults: deletedScans.length, coverageZones: deletedZones.length, observers: deletedObservers.length };
  }

  async findNearbyZone(lat: number, lng: number, radiusMeters: number): Promise<CoverageZone | undefined> {
    const degreeRadius = radiusMeters / 111320;
    const zones = await db.select().from(coverageZones)
      .where(
        and(
          gte(coverageZones.centerLat, lat - degreeRadius),
          lte(coverageZones.centerLat, lat + degreeRadius),
          gte(coverageZones.centerLng, lng - degreeRadius),
          lte(coverageZones.centerLng, lng + degreeRadius),
        )
      );

    return zones.find((z) => {
      const dist = haversineDistance(lat, lng, z.centerLat, z.centerLng);
      return dist <= radiusMeters;
    });
  }

  async clearDeadZonesNear(snapLat: number, snapLng: number, excludeId?: string): Promise<number> {
    const tolerance = 0.0001;
    const conditions = [
      eq(coverageZones.isDeadZone, true),
      gte(coverageZones.centerLat, snapLat - tolerance),
      lte(coverageZones.centerLat, snapLat + tolerance),
      gte(coverageZones.centerLng, snapLng - tolerance),
      lte(coverageZones.centerLng, snapLng + tolerance),
    ];
    if (excludeId) {
      conditions.push(ne(coverageZones.id, excludeId));
    }
    const result = await db.delete(coverageZones)
      .where(and(...conditions))
      .returning();
    return result.length;
  }

  async getActiveObserverCount(hoursAgo: number = 24): Promise<number> {
    const cutoff = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
    const result = await db
      .select({ count: sql<number>`COUNT(DISTINCT ${scanResults.radioId})` })
      .from(scanResults)
      .where(and(
        gte(scanResults.timestamp, cutoff),
        sql`${scanResults.radioId} IS NOT NULL`
      ));
    return Number(result[0]?.count ?? 0);
  }
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export const storage = new DatabaseStorage();
