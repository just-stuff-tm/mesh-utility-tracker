import { db } from "./db";
import { meshNodes, scanResults, coverageZones } from "@shared/schema";

const GRID_SIZE_DEG = 0.0012;

function snapToGrid(lat: number, lng: number) {
  return {
    snapLat: Math.floor(lat / GRID_SIZE_DEG) * GRID_SIZE_DEG + GRID_SIZE_DEG / 2,
    snapLng: Math.floor(lng / GRID_SIZE_DEG) * GRID_SIZE_DEG + GRID_SIZE_DEG / 2,
  };
}

export async function seedDatabase() {
  const existingNodes = await db.select().from(meshNodes).limit(1);
  if (existingNodes.length > 0) return;

  console.log("Seeding database with example data...");

  const sampleNodes = [
    { nodeId: "MC-A1B2C3", name: "Hilltop Relay", hardwareType: "T-Beam v1.1", latitude: 37.7795, longitude: -122.4150 },
    { nodeId: "MC-D4E5F6", name: "Valley Base", hardwareType: "Heltec V3", latitude: 37.7720, longitude: -122.4180 },
    { nodeId: "MC-789ABC", name: "Bridge Node", hardwareType: "T-Echo", latitude: 37.7765, longitude: -122.4120 },
    { nodeId: "MC-DEF012", name: "Park Repeater", hardwareType: "RAK WisBlock", latitude: 37.7700, longitude: -122.4200 },
    { nodeId: "MC-345678", name: "Rooftop Hub", hardwareType: "T-Beam v1.1", latitude: 37.7810, longitude: -122.4090 },
  ];

  await db.insert(meshNodes).values(sampleNodes);

  const rawZones = [
    { lat: 37.7795, lng: -122.4150, rssi: -48, snr: 14.8, count: 42 },
    { lat: 37.7783, lng: -122.4150, rssi: -55, snr: 12.5, count: 24 },
    { lat: 37.7795, lng: -122.4138, rssi: -52, snr: 13.1, count: 30 },
    { lat: 37.7783, lng: -122.4138, rssi: -58, snr: 11.2, count: 20 },
    { lat: 37.7771, lng: -122.4150, rssi: -63, snr: 10.1, count: 31 },
    { lat: 37.7771, lng: -122.4162, rssi: -68, snr: 9.0, count: 22 },
    { lat: 37.7759, lng: -122.4150, rssi: -72, snr: 8.2, count: 18 },
    { lat: 37.7759, lng: -122.4138, rssi: -65, snr: 10.5, count: 26 },
    { lat: 37.7747, lng: -122.4150, rssi: -78, snr: 6.5, count: 15 },
    { lat: 37.7747, lng: -122.4162, rssi: -82, snr: 5.1, count: 12 },
    { lat: 37.7807, lng: -122.4114, rssi: -45, snr: 15.4, count: 38 },
    { lat: 37.7807, lng: -122.4126, rssi: -51, snr: 13.8, count: 34 },
    { lat: 37.7819, lng: -122.4114, rssi: -56, snr: 12.0, count: 28 },
    { lat: 37.7735, lng: -122.4174, rssi: -84, snr: 4.3, count: 10 },
    { lat: 37.7735, lng: -122.4186, rssi: -88, snr: 3.2, count: 8 },
    { lat: 37.7723, lng: -122.4186, rssi: -91, snr: 2.4, count: 6 },
    { lat: 37.7723, lng: -122.4198, rssi: -95, snr: 1.2, count: 5, dead: true },
    { lat: 37.7711, lng: -122.4198, rssi: -97, snr: 0.8, count: 3, dead: true },
    { lat: 37.7807, lng: -122.4102, rssi: -59, snr: 11.5, count: 22 },
    { lat: 37.7819, lng: -122.4102, rssi: -62, snr: 10.8, count: 19 },
  ];

  const sampleZones = rawZones.map((z) => {
    const { snapLat, snapLng } = snapToGrid(z.lat, z.lng);
    return {
      centerLat: snapLat,
      centerLng: snapLng,
      radiusMeters: 80,
      avgRssi: z.rssi,
      avgSnr: z.snr,
      scanCount: z.count,
      isDeadZone: !!(z as any).dead,
      polygon: null,
    };
  });

  await db.insert(coverageZones).values(sampleZones);

  const sampleScans = [
    { observerId: "demo-observer", nodeId: "MC-A1B2C3", rssi: -52, snr: 13.2, latitude: 37.7790, longitude: -122.4145, senderName: "Hilltop Relay", receiverName: "Observer" },
    { observerId: "demo-observer", nodeId: "MC-D4E5F6", rssi: -71, snr: 8.5, latitude: 37.7725, longitude: -122.4175, senderName: "Valley Base", receiverName: "Observer" },
    { observerId: "demo-observer", nodeId: "MC-789ABC", rssi: -64, snr: 10.3, latitude: 37.7760, longitude: -122.4115, senderName: "Bridge Node", receiverName: "Observer" },
    { observerId: "demo-observer", nodeId: "MC-DEF012", rssi: -86, snr: 3.8, latitude: 37.7705, longitude: -122.4195, senderName: "Park Repeater", receiverName: "Observer" },
    { observerId: "demo-observer", nodeId: "MC-345678", rssi: -45, snr: 15.1, latitude: 37.7815, longitude: -122.4085, senderName: "Rooftop Hub", receiverName: "Observer" },
    { observerId: "demo-observer", nodeId: "MC-A1B2C3", rssi: -58, snr: 11.8, latitude: 37.7788, longitude: -122.4152, senderName: "Hilltop Relay", receiverName: "Observer" },
    { observerId: "demo-observer", nodeId: "MC-789ABC", rssi: -67, snr: 9.4, latitude: 37.7768, longitude: -122.4118, senderName: "Bridge Node", receiverName: "Observer" },
  ];

  await db.insert(scanResults).values(sampleScans);

  console.log("Database seeded successfully with grid-snapped coverage zones.");
}
