import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const observers = pgTable("observers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  deviceId: text("device_id"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  lastSeen: timestamp("last_seen").defaultNow(),
  isActive: boolean("is_active").default(true),
  scanInterval: integer("scan_interval").default(40),
});

export const insertObserverSchema = createInsertSchema(observers).omit({ id: true, lastSeen: true });
export type InsertObserver = z.infer<typeof insertObserverSchema>;
export type Observer = typeof observers.$inferSelect;

export const meshNodes = pgTable("mesh_nodes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nodeId: text("node_id").notNull(),
  name: text("name"),
  hardwareType: text("hardware_type"),
  lastSeen: timestamp("last_seen").defaultNow(),
  latitude: real("latitude"),
  longitude: real("longitude"),
});

export const insertMeshNodeSchema = createInsertSchema(meshNodes).omit({ id: true, lastSeen: true });
export type InsertMeshNode = z.infer<typeof insertMeshNodeSchema>;
export type MeshNode = typeof meshNodes.$inferSelect;

export const scanResults = pgTable("scan_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  observerId: varchar("observer_id").notNull(),
  nodeId: text("node_id").notNull(),
  rssi: real("rssi").notNull(),
  snr: real("snr").notNull(),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  altitude: real("altitude"),
  timestamp: timestamp("timestamp").defaultNow(),
  senderName: text("sender_name"),
  receiverName: text("receiver_name"),
  radioId: text("radio_id"),
});

export const insertScanResultSchema = createInsertSchema(scanResults).omit({ id: true, timestamp: true });
export type InsertScanResult = z.infer<typeof insertScanResultSchema>;
export type ScanResult = typeof scanResults.$inferSelect;

export const coverageZones = pgTable("coverage_zones", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  centerLat: real("center_lat").notNull(),
  centerLng: real("center_lng").notNull(),
  radiusMeters: real("radius_meters").default(100),
  avgRssi: real("avg_rssi"),
  avgSnr: real("avg_snr"),
  scanCount: integer("scan_count").default(0),
  lastScanned: timestamp("last_scanned").defaultNow(),
  isDeadZone: boolean("is_dead_zone").default(false),
  polygon: jsonb("polygon"),
  radioId: text("radio_id"),
});

export const insertCoverageZoneSchema = createInsertSchema(coverageZones).omit({ id: true, lastScanned: true });
export type InsertCoverageZone = z.infer<typeof insertCoverageZoneSchema>;
export type CoverageZone = typeof coverageZones.$inferSelect;
