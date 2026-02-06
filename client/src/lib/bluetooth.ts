import { WebBleConnection, Constants } from "@liamcottle/meshcore.js";

export interface MeshContact {
  publicKey: Uint8Array;
  type: number;
  flags: number;
  outPathLen: number;
  advName: string;
  lastAdvert: number;
  advLat: number;
  advLon: number;
  lastMod: number;
}

export interface DeviceInfo {
  firmwareVer: number;
  firmwareBuildDate: string;
  manufacturerModel: string;
}

export interface SelfInfo {
  name: string;
  type: number;
  txPower: number;
  maxTxPower: number;
  publicKey: Uint8Array;
  advLat: number;
  advLon: number;
  radioFreq: number;
  radioBw: number;
  radioSf: number;
  radioCr: number;
}

export interface RxLogEntry {
  lastSnr: number;
  lastRssi: number;
  raw: Uint8Array;
}

export type MeshEventType =
  | "connected"
  | "disconnected"
  | "contact"
  | "advert"
  | "new_advert"
  | "device_info"
  | "self_info"
  | "battery"
  | "rx_log"
  | "contacts_loaded";

type EventHandler = (data?: any) => void;

let connection: any = null;
const eventHandlers: Map<MeshEventType, Set<EventHandler>> = new Map();

export function on(event: MeshEventType, handler: EventHandler) {
  if (!eventHandlers.has(event)) eventHandlers.set(event, new Set());
  eventHandlers.get(event)!.add(handler);
  return () => {
    eventHandlers.get(event)?.delete(handler);
  };
}

function emit(event: MeshEventType, data?: any) {
  eventHandlers.get(event)?.forEach((h) => h(data));
}

export function isBluetoothSupported(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

export function isConnected(): boolean {
  return connection !== null;
}

export function getConnection(): any {
  return connection;
}

export async function connectToRadio(): Promise<{
  success: boolean;
  deviceName: string | null;
  error?: string;
}> {
  if (!isBluetoothSupported()) {
    return { success: false, deviceName: null, error: "Web Bluetooth is not supported in this browser" };
  }

  try {
    const bleConnection = await WebBleConnection.open();
    if (!bleConnection) {
      return { success: false, deviceName: null, error: "No device selected" };
    }

    connection = bleConnection;
    const name = bleConnection.bleDevice?.name || "MeshCore Radio";

    bleConnection.on("disconnected", () => {
      connection = null;
      emit("disconnected");
    });

    bleConnection.on(Constants.ResponseCodes.Contact, (contact: any) => {
      emit("contact", contact);
    });

    bleConnection.on(Constants.PushCodes.Advert, (data: any) => {
      emit("advert", data);
    });

    bleConnection.on(Constants.PushCodes.NewAdvert, (data: any) => {
      emit("new_advert", data);
    });

    bleConnection.on(Constants.ResponseCodes.DeviceInfo, (info: any) => {
      emit("device_info", {
        firmwareVer: info.firmwareVer,
        firmwareBuildDate: info.firmware_build_date,
        manufacturerModel: info.manufacturerModel,
      } as DeviceInfo);
    });

    bleConnection.on(Constants.ResponseCodes.SelfInfo, (info: any) => {
      emit("self_info", {
        name: info.name,
        type: info.type,
        txPower: info.txPower,
        maxTxPower: info.maxTxPower,
        publicKey: info.publicKey,
        advLat: info.advLat,
        advLon: info.advLon,
        radioFreq: info.radioFreq,
        radioBw: info.radioBw,
        radioSf: info.radioSf,
        radioCr: info.radioCr,
      } as SelfInfo);
    });

    bleConnection.on(Constants.ResponseCodes.BatteryVoltage, (data: any) => {
      emit("battery", { milliVolts: data.batteryMilliVolts });
    });

    bleConnection.on(Constants.PushCodes.LogRxData, (data: any) => {
      emit("rx_log", {
        lastSnr: data.lastSnr,
        lastRssi: data.lastRssi,
        raw: data.raw,
      } as RxLogEntry);
    });

    emit("connected");
    return { success: true, deviceName: name };
  } catch (err: any) {
    return { success: false, deviceName: null, error: err.message || "Connection failed" };
  }
}

export async function disconnectRadio(): Promise<void> {
  if (connection) {
    try {
      await connection.close();
    } catch {}
    connection = null;
  }
}

export async function getContacts(): Promise<MeshContact[]> {
  if (!connection) return [];
  try {
    const contacts = await connection.getContacts();
    return contacts.map((c: any) => ({
      publicKey: c.publicKey,
      type: c.type,
      flags: c.flags,
      outPathLen: c.outPathLen,
      advName: c.advName,
      lastAdvert: c.lastAdvert,
      advLat: c.advLat,
      advLon: c.advLon,
      lastMod: c.lastMod,
    }));
  } catch {
    return [];
  }
}

export async function getSelfInfo(): Promise<SelfInfo | null> {
  if (!connection) return null;
  try {
    return await connection.getSelfInfo();
  } catch {
    return null;
  }
}

export async function getDeviceInfo(): Promise<DeviceInfo | null> {
  if (!connection) return null;
  try {
    return await connection.deviceQuery(Constants.SupportedCompanionProtocolVersion);
  } catch {
    return null;
  }
}

export async function getBatteryVoltage(): Promise<number | null> {
  if (!connection) return null;
  try {
    const result = await connection.getBatteryVoltage();
    return result?.batteryMilliVolts ?? null;
  } catch {
    return null;
  }
}

export async function sendSelfAdvert(type: "zero_hop" | "flood" = "zero_hop"): Promise<boolean> {
  if (!connection) return false;
  try {
    const advertType = type === "flood"
      ? Constants.SelfAdvertTypes.Flood
      : Constants.SelfAdvertTypes.ZeroHop;
    await connection.sendSelfAdvert(advertType);
    return true;
  } catch {
    return false;
  }
}

export async function setAdvertLatLon(lat: number, lon: number): Promise<boolean> {
  if (!connection) return false;
  try {
    const latInt = Math.round(lat * 1e6);
    const lonInt = Math.round(lon * 1e6);
    await connection.setAdvertLatLong(latInt, lonInt);
    return true;
  } catch {
    return false;
  }
}

export function contactLatLon(contact: MeshContact): { lat: number; lon: number } | null {
  if (contact.advLat === 0 && contact.advLon === 0) return null;
  return {
    lat: contact.advLat / 1e6,
    lon: contact.advLon / 1e6,
  };
}

export interface RepeaterNeighbour {
  publicKeyPrefix: Uint8Array;
  heardSecondsAgo: number;
  snr: number;
}

export interface RepeaterStats {
  battMilliVolts: number;
  noiseFloor: number;
  lastRssi: number;
  lastSnr: number;
  packetsRecv: number;
  packetsSent: number;
  totalAirTimeSecs: number;
  totalUpTimeSecs: number;
}

export interface RepeaterDiscoverResult {
  contact: MeshContact;
  stats: RepeaterStats | null;
  neighbours: RepeaterNeighbour[];
  totalNeighboursCount: number;
}

export interface DiscoverResult {
  contacts: MeshContact[];
  repeaters: RepeaterDiscoverResult[];
  timestamp: Date;
}

export async function discoverRepeaters(
  observerLat?: number,
  observerLon?: number,
): Promise<DiscoverResult | null> {
  if (!connection) return null;
  try {
    if (observerLat !== undefined && observerLon !== undefined) {
      const latInt = Math.round(observerLat * 1e6);
      const lonInt = Math.round(observerLon * 1e6);
      await connection.setAdvertLatLong(latInt, lonInt);
    }

    await connection.sendSelfAdvert(Constants.SelfAdvertTypes.Flood);
    await new Promise((r) => setTimeout(r, 5000));

    const rawContacts = await connection.getContacts();
    const contacts: MeshContact[] = rawContacts.map((c: any) => ({
      publicKey: c.publicKey,
      type: c.type,
      flags: c.flags,
      outPathLen: c.outPathLen,
      advName: c.advName,
      lastAdvert: c.lastAdvert,
      advLat: c.advLat,
      advLon: c.advLon,
      lastMod: c.lastMod,
    }));

    const repeaterContacts = contacts.filter(
      (c) => c.type === Constants.AdvType.Repeater,
    );

    const repeaters: RepeaterDiscoverResult[] = [];
    for (const repeater of repeaterContacts) {
      let stats: RepeaterStats | null = null;
      let neighbours: RepeaterNeighbour[] = [];
      let totalNeighboursCount = 0;

      try {
        const statusResult = await connection.getStatus(repeater.publicKey);
        stats = {
          battMilliVolts: statusResult.batt_milli_volts,
          noiseFloor: statusResult.noise_floor,
          lastRssi: statusResult.last_rssi,
          lastSnr: statusResult.last_snr,
          packetsRecv: statusResult.n_packets_recv,
          packetsSent: statusResult.n_packets_sent,
          totalAirTimeSecs: statusResult.total_air_time_secs,
          totalUpTimeSecs: statusResult.total_up_time_secs,
        };
      } catch {}

      try {
        const neighbourResult = await connection.getNeighbours(repeater.publicKey);
        neighbours = neighbourResult.neighbours.map((n: any) => ({
          publicKeyPrefix: n.publicKeyPrefix,
          heardSecondsAgo: n.heardSecondsAgo,
          snr: n.snr,
        }));
        totalNeighboursCount = neighbourResult.totalNeighboursCount;
      } catch {}

      repeaters.push({ contact: repeater, stats, neighbours, totalNeighboursCount });
    }

    return { contacts, repeaters, timestamp: new Date() };
  } catch {
    return null;
  }
}

export function publicKeyHex(key: Uint8Array): string {
  return Array.from(key.slice(0, 4))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}
