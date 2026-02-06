import { WebBleConnection, Constants } from "@liamcottle/meshcore.js";

const remoteLogBuffer: { level: string; message: string }[] = [];
let remoteLogTimer: ReturnType<typeof setTimeout> | null = null;

function remoteLog(level: string, ...args: any[]) {
  const message = args.map(a => {
    if (a instanceof Uint8Array) return Array.from(a.slice(0, 8)).map(b => b.toString(16).padStart(2, "0")).join("");
    if (typeof a === "object" && a !== null) {
      try { return JSON.stringify(a); } catch { return String(a); }
    }
    return String(a);
  }).join(" ");

  if (level === "error" || level === "warn") {
    console.error(`[mesh] ${message}`);
  } else {
    console.log(`[mesh] ${message}`);
  }

  remoteLogBuffer.push({ level, message: `[mesh] ${message}` });

  if (!remoteLogTimer) {
    remoteLogTimer = setTimeout(() => {
      const entries = remoteLogBuffer.splice(0);
      remoteLogTimer = null;
      fetch("/api/remote-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entries),
      }).catch(() => {});
    }, 500);
  }
}

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

    const name = bleConnection.bleDevice?.name || "MeshCore Radio";

    bleConnection.on("disconnected", () => {
      remoteLog("log", "BLE disconnected");
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
      remoteLog("log", "NewAdvert received:", data?.advName);
      emit("new_advert", data);
    });

    bleConnection.on(Constants.ResponseCodes.DeviceInfo, (info: any) => {
      remoteLog("log", "DeviceInfo:", info?.manufacturerModel, "fw:", info?.firmwareVer);
      emit("device_info", {
        firmwareVer: info.firmwareVer,
        firmwareBuildDate: info.firmware_build_date,
        manufacturerModel: info.manufacturerModel,
      } as DeviceInfo);
    });

    bleConnection.on(Constants.ResponseCodes.SelfInfo, (info: any) => {
      remoteLog("log", "SelfInfo:", info?.name, "type:", info?.type);
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

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("BLE connection timed out waiting for radio handshake"));
      }, 10000);

      bleConnection.on("connected", () => {
        clearTimeout(timeout);
        remoteLog("log", "Radio handshake complete, connection ready");
        resolve();
      });
    });

    connection = bleConnection;
    emit("connected");
    return { success: true, deviceName: name };
  } catch (err: any) {
    remoteLog("error", "connectToRadio error:", err?.message || err);
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
    remoteLog("log", "getContacts returned", contacts.length, "contacts");
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
  } catch (err) {
    remoteLog("error", "getContacts error:", err);
    return [];
  }
}

export async function getSelfInfo(): Promise<SelfInfo | null> {
  if (!connection) return null;
  try {
    const info = await connection.getSelfInfo();
    remoteLog("log", "getSelfInfo:", info?.name);
    return info;
  } catch (err) {
    remoteLog("error", "getSelfInfo error:", err);
    return null;
  }
}

export async function getDeviceInfo(): Promise<DeviceInfo | null> {
  if (!connection) return null;
  try {
    const info = await connection.deviceQuery(Constants.SupportedCompanionProtocolVersion);
    remoteLog("log", "getDeviceInfo:", info?.manufacturerModel);
    return info;
  } catch (err) {
    remoteLog("error", "getDeviceInfo error:", err);
    return null;
  }
}

export async function getBatteryVoltage(): Promise<number | null> {
  if (!connection) return null;
  try {
    const result = await connection.getBatteryVoltage();
    remoteLog("log", "getBatteryVoltage:", result?.batteryMilliVolts, "mV");
    return result?.batteryMilliVolts ?? null;
  } catch (err) {
    remoteLog("error", "getBatteryVoltage error:", err);
    return null;
  }
}

export async function sendSelfAdvert(type: "zero_hop" | "flood" = "zero_hop"): Promise<boolean> {
  if (!connection) return false;
  try {
    const advertType = type === "flood"
      ? Constants.SelfAdvertTypes.Flood
      : Constants.SelfAdvertTypes.ZeroHop;
    await connection.sendAdvert(advertType);
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

function toSigned32(val: number): number {
  if (val >= 0x80000000) return val - 0x100000000;
  return val;
}

export function contactLatLon(contact: MeshContact): { lat: number; lon: number } | null {
  if (contact.advLat === 0 && contact.advLon === 0) return null;
  return {
    lat: toSigned32(contact.advLat) / 1e6,
    lon: toSigned32(contact.advLon) / 1e6,
  };
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
}

export interface DiscoverResult {
  contacts: MeshContact[];
  repeaters: RepeaterDiscoverResult[];
  timestamp: Date;
}

export async function discoverRepeaters(
  observerLat?: number,
  observerLon?: number,
  onStatus?: (status: string) => void,
): Promise<DiscoverResult | null> {
  if (!connection) {
    remoteLog("warn", "discoverRepeaters: no connection");
    return null;
  }
  try {
    if (observerLat !== undefined && observerLon !== undefined) {
      const latInt = Math.round(observerLat * 1e6);
      const lonInt = Math.round(observerLon * 1e6);
      remoteLog("log", "Setting advert position:", observerLat, observerLon);
      await connection.setAdvertLatLong(latInt, lonInt);
    }

    const discoveredAdverts: MeshContact[] = [];
    const onNewAdvert = (data: any) => {
      remoteLog("log", `NewAdvert received during scan: "${data.advName}" type=${data.type} pathLen=${data.outPathLen}`);
      discoveredAdverts.push({
        publicKey: data.publicKey,
        type: data.type,
        flags: data.flags,
        outPathLen: data.outPathLen,
        advName: data.advName,
        lastAdvert: data.lastAdvert,
        advLat: data.advLat,
        advLon: data.advLon,
        lastMod: data.lastMod,
      });
    };

    connection.on(Constants.PushCodes.NewAdvert, onNewAdvert);

    onStatus?.("advertising");
    remoteLog("log", "Sending zero-hop advert...");
    await connection.sendAdvert(Constants.SelfAdvertTypes.ZeroHop);
    onStatus?.("waiting");
    remoteLog("log", "Waiting 20s for responses...");
    await new Promise((r) => setTimeout(r, 20000));

    connection.off(Constants.PushCodes.NewAdvert, onNewAdvert);

    remoteLog("log", `Collected ${discoveredAdverts.length} NewAdvert events during scan window`);

    const contactMap = new Map<string, MeshContact>();
    for (const adv of discoveredAdverts) {
      const key = publicKeyHex(adv.publicKey);
      contactMap.set(key, adv);
    }
    const contacts = Array.from(contactMap.values());

    for (const c of contacts) {
      remoteLog("log", `Discovered: "${c.advName}" type=${c.type} flags=${c.flags} pathLen=${c.outPathLen}`);
    }

    const repeaterContacts = contacts.filter(
      (c) => c.type === Constants.AdvType.Repeater,
    );
    remoteLog("log", "Found", repeaterContacts.length, "repeaters out of", contacts.length, "discovered contacts");

    onStatus?.("querying");
    const repeaters: RepeaterDiscoverResult[] = [];
    const zeroHop = repeaterContacts.filter((c) => c.outPathLen === 0);
    const skipped = repeaterContacts.filter((c) => c.outPathLen !== 0);
    remoteLog("log", `Repeaters: ${zeroHop.length} zero-hop (direct), ${skipped.length} multi-hop/unreachable (skipped)`);

    for (const repeater of zeroHop) {
      try {
        remoteLog("log", "Querying status for zero-hop repeater:", repeater.advName || publicKeyHex(repeater.publicKey));
        const statusResult = await connection.getStatus(repeater.publicKey);
        remoteLog("log", "Status result:", statusResult.last_rssi, "dBm,", statusResult.last_snr, "dB SNR");
        const stats: RepeaterStats = {
          battMilliVolts: statusResult.batt_milli_volts,
          noiseFloor: statusResult.noise_floor,
          lastRssi: statusResult.last_rssi,
          lastSnr: statusResult.last_snr,
          packetsRecv: statusResult.n_packets_recv,
          packetsSent: statusResult.n_packets_sent,
          totalAirTimeSecs: statusResult.total_air_time_secs,
          totalUpTimeSecs: statusResult.total_up_time_secs,
        };
        repeaters.push({ contact: repeater, stats });
      } catch (err) {
        remoteLog("warn", "getStatus failed for", repeater.advName || publicKeyHex(repeater.publicKey), err);
      }
    }

    remoteLog("log", "Discovery complete:", repeaters.length, "repeaters responded with stats");
    return { contacts, repeaters, timestamp: new Date() };
  } catch (err: any) {
    remoteLog("error", "discoverRepeaters error:", err?.message || err);
    return null;
  }
}

export function publicKeyHex(key: Uint8Array): string {
  return Array.from(key.slice(0, 4))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}
