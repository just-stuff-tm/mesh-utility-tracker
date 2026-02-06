const MESHCORE_SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const MESHCORE_TX_CHAR_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
const MESHCORE_RX_CHAR_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";

export interface BluetoothState {
  isConnected: boolean;
  isConnecting: boolean;
  deviceName: string | null;
  error: string | null;
}

export type MessageHandler = (data: string) => void;

let device: BluetoothDevice | null = null;
let txCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
let rxCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
let messageHandlers: MessageHandler[] = [];

export function onMessage(handler: MessageHandler) {
  messageHandlers.push(handler);
  return () => {
    messageHandlers = messageHandlers.filter((h) => h !== handler);
  };
}

function notifyHandlers(data: string) {
  messageHandlers.forEach((h) => h(data));
}

export function isBluetoothSupported(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
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
    device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [MESHCORE_SERVICE_UUID] }],
      optionalServices: [MESHCORE_SERVICE_UUID],
    });

    if (!device.gatt) {
      return { success: false, deviceName: null, error: "GATT not available" };
    }

    const server = await device.gatt.connect();
    const service = await server.getPrimaryService(MESHCORE_SERVICE_UUID);

    txCharacteristic = await service.getCharacteristic(MESHCORE_TX_CHAR_UUID);
    rxCharacteristic = await service.getCharacteristic(MESHCORE_RX_CHAR_UUID);

    await rxCharacteristic.startNotifications();
    rxCharacteristic.addEventListener("characteristicvaluechanged", (event: any) => {
      const value = event.target.value;
      const decoder = new TextDecoder();
      const text = decoder.decode(value);
      notifyHandlers(text);
    });

    device.addEventListener("gattserverdisconnected", () => {
      notifyHandlers("__DISCONNECTED__");
    });

    return { success: true, deviceName: device.name || "Unknown Device" };
  } catch (err: any) {
    return { success: false, deviceName: null, error: err.message || "Connection failed" };
  }
}

export async function disconnectRadio(): Promise<void> {
  if (device?.gatt?.connected) {
    device.gatt.disconnect();
  }
  device = null;
  txCharacteristic = null;
  rxCharacteristic = null;
}

export async function sendCommand(command: string): Promise<boolean> {
  if (!txCharacteristic) return false;

  try {
    const encoder = new TextEncoder();
    await txCharacteristic.writeValue(encoder.encode(command + "\n"));
    return true;
  } catch {
    return false;
  }
}

export async function sendNodeDiscover(): Promise<boolean> {
  return sendCommand("node_discover");
}

export function isConnected(): boolean {
  return device?.gatt?.connected ?? false;
}
