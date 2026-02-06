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
  rssi: number;
  snr: number;
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

function pubKeyPrefixHex(prefix: Uint8Array): string {
  return Array.from(prefix).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function parseLppSensorData(data: Uint8Array): { rssi: number; snr: number } | null {
  try {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    let off = 0;
    let rssi: number | null = null;
    let snr: number | null = null;

    while (off < data.byteLength - 2) {
      const channel = data[off]; off += 1;
      const type = data[off]; off += 1;

      if (type === 0x02) {
        const val = view.getInt16(off, false) / 100;
        off += 2;
        if (channel === 1) rssi = val;
        else if (channel === 2) snr = val;
        remoteLog("log", `LPP ch=${channel} type=AnalogInput val=${val}`);
      } else if (type === 0x01) {
        off += 1;
        remoteLog("log", `LPP ch=${channel} type=DigitalInput val=${data[off - 1]}`);
      } else if (type === 0x03) {
        off += 2;
        remoteLog("log", `LPP ch=${channel} type=AnalogOutput`);
      } else if (type === 0x67) {
        off += 2;
        remoteLog("log", `LPP ch=${channel} type=Temperature`);
      } else if (type === 0x68) {
        off += 1;
        remoteLog("log", `LPP ch=${channel} type=Humidity`);
      } else if (type === 0x73) {
        off += 2;
        remoteLog("log", `LPP ch=${channel} type=Barometer`);
      } else {
        remoteLog("log", `LPP ch=${channel} type=0x${type.toString(16)} (unknown), stopping parse`);
        break;
      }
    }

    if (rssi === null && snr === null) {
      remoteLog("log", `LPP: no RSSI/SNR found, raw=${Array.from(data).map(b => b.toString(16).padStart(2, "0")).join(" ")}`);
      return null;
    }
    return { rssi: rssi ?? 0, snr: snr ?? 0 };
  } catch (err) {
    remoteLog("warn", "parseLppSensorData failed:", err);
    return null;
  }
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

    const telemetryResponses = new Map<string, { rssi: number; snr: number }>();
    const discoveredAdverts = new Map<string, MeshContact>();

    const onTelemetryResponse = (response: any) => {
      const key = pubKeyPrefixHex(response.pubKeyPrefix);
      remoteLog("log", `TelemetryResponse from prefix=${key}, LPP data length=${response.lppSensorData?.byteLength ?? 0}`);
      const parsed = parseLppSensorData(response.lppSensorData);
      if (parsed) {
        telemetryResponses.set(key, parsed);
        remoteLog("log", `Parsed signal: RSSI=${parsed.rssi} dBm, SNR=${parsed.snr} dB from ${key}`);
      }
    };

    const onNewAdvert = (data: any) => {
      const key = pubKeyPrefixHex(data.publicKey.slice(0, 6));
      remoteLog("log", `NewAdvert: "${data.advName}" type=${data.type} pathLen=${data.outPathLen} prefix=${key}`);
      discoveredAdverts.set(key, {
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

    connection.on(Constants.PushCodes.TelemetryResponse, onTelemetryResponse);
    connection.on(Constants.PushCodes.NewAdvert, onNewAdvert);

    onStatus?.("advertising");
    remoteLog("log", "Sending broadcast telemetry request (zero-hop discovery)...");
    const broadcastKey = new Uint8Array(32);
    broadcastKey[0] = 0xFF;
    broadcastKey[1] = 0xFF;
    await connection.sendCommandSendTelemetryReq(broadcastKey);

    onStatus?.("waiting");
    remoteLog("log", "Waiting 20s for telemetry + advert responses...");
    await new Promise((r) => setTimeout(r, 20000));

    connection.off(Constants.PushCodes.TelemetryResponse, onTelemetryResponse);
    connection.off(Constants.PushCodes.NewAdvert, onNewAdvert);
    remoteLog("log", `Collected ${telemetryResponses.size} TelemetryResponses, ${discoveredAdverts.size} NewAdverts`);

    const contacts: MeshContact[] = [];
    const repeaters: RepeaterDiscoverResult[] = [];

    for (const [key, contact] of Array.from(discoveredAdverts.entries())) {
      contacts.push(contact);
      const signalData = telemetryResponses.get(key);
      if (signalData) {
        remoteLog("log", `"${contact.advName}": RSSI=${signalData.rssi} dBm, SNR=${signalData.snr} dB`);
        repeaters.push({ contact, stats: { rssi: signalData.rssi, snr: signalData.snr } });
      } else {
        repeaters.push({ contact, stats: null });
      }
    }

    for (const [key, signalData] of Array.from(telemetryResponses.entries())) {
      if (!discoveredAdverts.has(key)) {
        remoteLog("log", `TelemetryResponse from ${key} (RSSI=${signalData.rssi}, SNR=${signalData.snr}) with no matching advert`);
        repeaters.push({
          contact: {
            publicKey: new Uint8Array(32),
            type: 0,
            flags: 0,
            outPathLen: 0,
            advName: `Unknown (${key.substring(0, 8)})`,
            lastAdvert: 0,
            advLat: 0,
            advLon: 0,
            lastMod: 0,
          },
          stats: { rssi: signalData.rssi, snr: signalData.snr },
        });
      }
    }

    remoteLog("log", "Discovery complete:", repeaters.length, "nodes found");
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
