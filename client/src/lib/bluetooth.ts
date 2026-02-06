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
  firmwareVersion: string;
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
      remoteLog("log", "DeviceInfo raw keys:", Object.keys(info).join(", "));
      remoteLog("log", "DeviceInfo:", JSON.stringify(info));

      let model = info.manufacturerModel || "";
      let fwVersion = "";
      if (model.includes("\0")) {
        const parts = model.split("\0").filter((s: string) => s.length > 0);
        model = parts[0] || "";
        fwVersion = parts.length > 1 ? parts[parts.length - 1] : "";
      }

      remoteLog("log", `DeviceInfo parsed: model="${model}" fwVer="${fwVersion}" build="${info.firmware_build_date}"`);
      emit("device_info", {
        firmwareVer: info.firmwareVer,
        firmwareBuildDate: info.firmware_build_date,
        manufacturerModel: model,
        firmwareVersion: fwVersion,
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

    const PUSH_CODE_NAMES: Record<number, string> = {
      0x00: "OK", 0x01: "ERROR", 0x02: "CONTACT_START", 0x03: "CONTACT", 0x04: "CONTACT_END",
      0x05: "SELF_INFO", 0x06: "MSG_SENT", 0x07: "CONTACT_MSG_RECV", 0x08: "CHANNEL_MSG_RECV",
      0x09: "CURRENT_TIME", 0x0A: "NO_MORE_MSGS", 0x0B: "CONTACT_URI", 0x0C: "BATTERY",
      0x0D: "DEVICE_INFO", 0x0E: "PRIVATE_KEY", 0x0F: "DISABLED", 0x12: "CHANNEL_INFO",
      0x18: "STATS", 0x32: "BINARY_REQ", 0x34: "SET_FLOOD_SCOPE",
      0x37: "SEND_CONTROL_DATA",
      0x80: "ADVERTISEMENT", 0x81: "PATH_UPDATE", 0x82: "ACK", 0x83: "MSGS_WAITING",
      0x84: "RAW_DATA", 0x85: "LOGIN_SUCCESS", 0x86: "LOGIN_FAILED", 0x87: "STATUS_RESPONSE",
      0x88: "LOG_DATA", 0x89: "TRACE_DATA", 0x8A: "NEW_ADVERT", 0x8B: "TELEMETRY_RESPONSE",
      0x8C: "BINARY_RESPONSE", 0x8D: "PATH_DISCOVERY_RESPONSE", 0x8E: "CONTROL_DATA",
      0x8F: "ADVERT_RESPONSE",
    };

    bleConnection.on("rx", (frame: Uint8Array) => {
      const hex = Array.from(frame).map(b => b.toString(16).padStart(2, "0")).join(" ");
      const code = frame.length > 0 ? frame[0] : -1;
      const codeName = PUSH_CODE_NAMES[code] || "UNKNOWN";
      const codeHex = code >= 0 ? `0x${code.toString(16).padStart(2, "0")}` : "?";
      let extra = "";
      if (code === 0x00) extra = " (OK)";
      else if (code === 0x01) extra = ` err=${frame.length > 1 ? frame[1] : "?"}`;
      else if (code === 0x0C) extra = ` battery=${frame.length > 1 ? frame[1] : "?"}%`;
      else if (code === 0x8E && frame.length >= 4) {
        const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
        extra = ` SNR=${view.getInt8(1)/4} RSSI=${view.getInt8(2)} pathLen=${frame[3]}`;
        if (frame.length > 4) extra += ` ctrl=0x${frame[4].toString(16).padStart(2, "0")}`;
      } else if (code === 0x8A && frame.length > 1) {
        extra = ` (NewAdvert)`;
      }
      remoteLog("log", `[BLE RX] ${codeName}(${codeHex}) len=${frame.length}${extra} | ${hex}`);
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

const PUSH_CODE_CONTROL_DATA = 0x8E;
const CONTROL_NODE_DISCOVER_RESP = 0x90;
const CMD_SEND_CONTROL_DATA = 55;
const CONTROL_NODE_DISCOVER_REQ = 0x80;

interface NodeDiscoverEntry {
  snr: number;
  rssi: number;
  snrIn: number;
  name: string;
  publicKeyPrefix: string;
}

function buildNodeDiscoverReq(filter: number): Uint8Array {
  const tag = Math.floor(Math.random() * 0xFFFFFFFF);
  const data = new Uint8Array(1 + 1 + 1 + 4);
  data[0] = CMD_SEND_CONTROL_DATA;
  data[1] = CONTROL_NODE_DISCOVER_REQ | 0x01;
  data[2] = filter;
  data[3] = tag & 0xFF;
  data[4] = (tag >> 8) & 0xFF;
  data[5] = (tag >> 16) & 0xFF;
  data[6] = (tag >> 24) & 0xFF;
  remoteLog("log", `node_discover cmd: ${Array.from(data).map(b => b.toString(16).padStart(2, "0")).join(" ")}, filter=${filter}, tag=${tag}`);
  return data;
}

function parseControlDataFrame(frame: Uint8Array): NodeDiscoverEntry | null {
  if (frame.length < 5 || frame[0] !== PUSH_CODE_CONTROL_DATA) return null;

  const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
  const snrRaw = view.getInt8(1);
  const snr = snrRaw / 4;
  const rssi = view.getInt8(2);
  const pathLen = frame[3];

  const payload = frame.slice(4);
  remoteLog("log", `ControlData raw: snr=${snr} rssi=${rssi} pathLen=${pathLen} payload(${payload.length}b)=${Array.from(payload).map(b => b.toString(16).padStart(2, "0")).join(" ")}`);

  if (payload.length < 1) {
    remoteLog("log", `ControlData: empty payload`);
    return null;
  }

  const payloadType = payload[0];
  if ((payloadType & 0xF0) !== CONTROL_NODE_DISCOVER_RESP) {
    remoteLog("log", `ControlData: payloadType=0x${payloadType.toString(16)}, not NODE_DISCOVER_RESP (0x9x)`);
    return null;
  }

  const nodeType = payloadType & 0x0F;
  let off = 1;

  if (payload.length < off + 5) {
    remoteLog("log", `ControlData: payload too short for SNR_in + tag`);
    return null;
  }

  const snrInView = new DataView(payload.buffer, payload.byteOffset + off, 1);
  const snrIn = snrInView.getInt8(0) / 4;
  off += 1;

  const tagBytes = payload.slice(off, off + 4);
  const tag = Array.from(tagBytes).map(b => b.toString(16).padStart(2, "0")).join("");
  off += 4;

  const pubkeyData = payload.slice(off);
  let publicKeyPrefix = "";
  let name = "";

  if (pubkeyData.length >= 8) {
    publicKeyPrefix = Array.from(pubkeyData.slice(0, 8)).map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  } else if (pubkeyData.length > 0) {
    publicKeyPrefix = Array.from(pubkeyData).map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  }
  if (pubkeyData.length > 32) {
    name = new TextDecoder().decode(pubkeyData.slice(32)).replace(/\0/g, "").trim();
  }

  remoteLog("log", `NodeDiscoverResp: snr=${snr} rssi=${rssi} snrIn=${snrIn} nodeType=${nodeType} tag=${tag} prefix=${publicKeyPrefix} name="${name}"`);

  return { snr, rssi, snrIn, name, publicKeyPrefix };
}

export async function discoverRepeaters(
  observerLat?: number,
  observerLon?: number,
  onStatus?: (status: string) => void,
  existingContacts?: MeshContact[],
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

    const discoveredNodes = new Map<string, { stats: RepeaterStats; name: string }>();
    const discoveredAdverts = new Map<string, MeshContact>();

    let rxFrameCount = 0;
    const onRawFrame = (frame: Uint8Array) => {
      rxFrameCount++;
      const code = frame.length > 0 ? frame[0] : -1;
      const hex = Array.from(frame).map(b => b.toString(16).padStart(2, "0")).join(" ");
      remoteLog("log", `[DISCOVER RX #${rxFrameCount}] code=0x${code.toString(16).padStart(2, "0")} len=${frame.length} hex=${hex}`);

      if (code === PUSH_CODE_CONTROL_DATA) {
        remoteLog("log", `[DISCOVER] Got CONTROL_DATA frame, parsing...`);
        const entry = parseControlDataFrame(frame);
        if (entry) {
          remoteLog("log", `[DISCOVER] Node "${entry.name}": RSSI=${entry.rssi} SNR=${entry.snr} SNR_in=${entry.snrIn} prefix=${entry.publicKeyPrefix}`);
          discoveredNodes.set(entry.publicKeyPrefix, {
            stats: { rssi: entry.rssi, snr: entry.snr },
            name: entry.name,
          });
        } else {
          remoteLog("warn", `[DISCOVER] Failed to parse CONTROL_DATA frame`);
        }
      }
    };

    const onNewAdvert = (data: any) => {
      const key = pubKeyPrefixHex(data.publicKey.slice(0, 8));
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

    remoteLog("log", `[DISCOVER] Registering rx listener and NewAdvert listener...`);
    connection.on("rx", onRawFrame);
    connection.on(Constants.PushCodes.NewAdvert, onNewAdvert);

    onStatus?.("broadcasting");
    remoteLog("log", `[DISCOVER] Sending node_discover request (CMD=${CMD_SEND_CONTROL_DATA}, CTRL=0x${(CONTROL_NODE_DISCOVER_REQ | 0x01).toString(16)})...`);
    const nodeDiscoverCmd = buildNodeDiscoverReq(0xFF);
    remoteLog("log", `[DISCOVER] sendToRadioFrame(${nodeDiscoverCmd.length} bytes): ${Array.from(nodeDiscoverCmd).map(b => b.toString(16).padStart(2, "0")).join(" ")}`);
    await connection.sendToRadioFrame(nodeDiscoverCmd);
    remoteLog("log", `[DISCOVER] Command sent successfully`);

    onStatus?.("waiting");
    remoteLog("log", "[DISCOVER] Waiting 40s for responses...");
    await new Promise((r) => setTimeout(r, 40000));

    connection.off("rx", onRawFrame);
    connection.off(Constants.PushCodes.NewAdvert, onNewAdvert);
    remoteLog("log", `[DISCOVER] Done. rxFrames=${rxFrameCount}, nodeDiscoverResponses=${discoveredNodes.size}, newAdverts=${discoveredAdverts.size}`);

    const contacts: MeshContact[] = [];
    const repeaters: RepeaterDiscoverResult[] = [];

    for (const [key, contact] of Array.from(discoveredAdverts.entries())) {
      contacts.push(contact);
      const nodeData = discoveredNodes.get(key);
      if (nodeData) {
        remoteLog("log", `"${contact.advName}": RSSI=${nodeData.stats.rssi} dBm, SNR=${nodeData.stats.snr} dB`);
        repeaters.push({ contact, stats: nodeData.stats });
        discoveredNodes.delete(key);
      } else {
        repeaters.push({ contact, stats: null });
      }
    }

    const contactsByPrefix = new Map<string, MeshContact>();
    if (existingContacts) {
      for (const c of existingContacts) {
        if (c.publicKey && c.publicKey.length >= 8) {
          const prefix8 = pubKeyPrefixHex(c.publicKey.slice(0, 8));
          contactsByPrefix.set(prefix8, c);
        }
      }
      remoteLog("log", `[DISCOVER] Built contact lookup with ${contactsByPrefix.size} entries from ${existingContacts.length} contacts`);
    }

    for (const [key, nodeData] of Array.from(discoveredNodes.entries())) {
      const matchedContact = contactsByPrefix.get(key);
      const resolvedName = nodeData.name || matchedContact?.advName || `Unknown (${key.substring(0, 8)})`;
      remoteLog("log", `node_discover response "${resolvedName}" (${key}) RSSI=${nodeData.stats.rssi} SNR=${nodeData.stats.snr}${matchedContact ? " — matched contact" : " — no matching contact"}`);

      if (matchedContact) {
        contacts.push(matchedContact);
        repeaters.push({ contact: matchedContact, stats: nodeData.stats });
      } else {
        const prefixBytes = new Uint8Array(32);
        const hexPairs = key.match(/.{1,2}/g) || [];
        hexPairs.forEach((hex, i) => { if (i < 32) prefixBytes[i] = parseInt(hex, 16); });

        const placeholder: MeshContact = {
          publicKey: prefixBytes,
          type: 0,
          flags: 0,
          outPathLen: 0,
          advName: resolvedName,
          lastAdvert: 0,
          advLat: 0,
          advLon: 0,
          lastMod: 0,
        };
        repeaters.push({ contact: placeholder, stats: nodeData.stats });
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
