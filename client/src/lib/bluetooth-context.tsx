import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import {
  connectToRadio,
  disconnectRadio,
  isBluetoothSupported,
  onMessage,
  sendNodeDiscover,
  isConnected as checkConnected,
} from "@/lib/bluetooth";
import { getCurrentPosition, watchPosition, clearWatch } from "@/lib/geolocation";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface BluetoothContextValue {
  connected: boolean;
  connecting: boolean;
  deviceName: string | null;
  error: string | null;
  supported: boolean;
  isScanning: boolean;
  scanInterval: number;
  lastScanTime: Date | null;
  messagesReceived: number;
  observerPosition: [number, number] | null;
  autoCenter: boolean;
  smartScanEnabled: boolean;
  smartScanDays: number;
  wakeLockActive: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  toggleScan: () => void;
  setScanInterval: (interval: number) => void;
  setAutoCenter: (v: boolean) => void;
  setSmartScanEnabled: (v: boolean) => void;
  setSmartScanDays: (v: number) => void;
}

const BluetoothContext = createContext<BluetoothContextValue | null>(null);

export function useBluetoothContext() {
  const ctx = useContext(BluetoothContext);
  if (!ctx) throw new Error("useBluetoothContext must be used within BluetoothProvider");
  return ctx;
}

export function BluetoothProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(() => checkConnected());
  const [connecting, setConnecting] = useState(false);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanInterval, setScanInterval] = useState(40);
  const [lastScanTime, setLastScanTime] = useState<Date | null>(null);
  const [messagesReceived, setMessagesReceived] = useState(0);
  const [observerPosition, setObserverPosition] = useState<[number, number] | null>(null);
  const [autoCenter, setAutoCenter] = useState(true);
  const [smartScanEnabled, setSmartScanEnabled] = useState(true);
  const [smartScanDays, setSmartScanDays] = useState(5);
  const [wakeLockActive, setWakeLockActive] = useState(false);

  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const positionRef = useRef<[number, number] | null>(null);

  useEffect(() => {
    positionRef.current = observerPosition;
  }, [observerPosition]);

  useEffect(() => {
    getCurrentPosition()
      .then((pos) => setObserverPosition([pos.latitude, pos.longitude]))
      .catch(() => {});

    const watchId = watchPosition(
      (pos) => setObserverPosition([pos.latitude, pos.longitude]),
      () => {}
    );
    return () => clearWatch(watchId);
  }, []);

  const submitScan = useCallback(async (data: string) => {
    try {
      const parsed = JSON.parse(data);
      const pos = positionRef.current;
      if (parsed.rssi !== undefined && parsed.snr !== undefined && pos) {
        await apiRequest("POST", "/api/scan-results", {
          observerId: "local-observer",
          nodeId: parsed.nodeId || parsed.from || "unknown",
          rssi: parsed.rssi,
          snr: parsed.snr,
          latitude: pos[0],
          longitude: pos[1],
          senderName: parsed.senderName || parsed.from || null,
          receiverName: parsed.receiverName || "Observer",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/coverage-zones"] });
        queryClient.invalidateQueries({ queryKey: ["/api/scan-results"] });
        queryClient.invalidateQueries({ queryKey: ["/api/nodes"] });
      }
    } catch {
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onMessage((data) => {
      if (data === "__DISCONNECTED__") {
        setConnected(false);
        setDeviceName(null);
        return;
      }
      setMessagesReceived((prev) => prev + 1);
      submitScan(data);
    });
    return unsubscribe;
  }, [submitScan]);

  useEffect(() => {
    if (!connected || !isScanning) return;
    const interval = setInterval(async () => {
      const sent = await sendNodeDiscover();
      if (sent) setLastScanTime(new Date());
    }, scanInterval * 1000);

    sendNodeDiscover().then((sent) => {
      if (sent) setLastScanTime(new Date());
    });

    return () => clearInterval(interval);
  }, [connected, isScanning, scanInterval]);

  const acquireWakeLock = useCallback(async () => {
    try {
      if ("wakeLock" in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
        setWakeLockActive(true);
        wakeLockRef.current!.addEventListener("release", () => {
          setWakeLockActive(false);
        });
      }
    } catch {
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
      } catch {}
      wakeLockRef.current = null;
      setWakeLockActive(false);
    }
  }, []);

  useEffect(() => {
    if (connected && isScanning) {
      acquireWakeLock();
    } else {
      releaseWakeLock();
    }
  }, [connected, isScanning, acquireWakeLock, releaseWakeLock]);

  useEffect(() => {
    if (!connected || !isScanning) return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible" && connected && isScanning) {
        acquireWakeLock();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [connected, isScanning, acquireWakeLock]);

  const connect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    const result = await connectToRadio();
    setConnecting(false);
    if (result.success) {
      setConnected(true);
      setDeviceName(result.deviceName);
    } else {
      setError(result.error || "Connection failed");
    }
  }, []);

  const disconnect = useCallback(async () => {
    await releaseWakeLock();
    await disconnectRadio();
    setConnected(false);
    setDeviceName(null);
    setIsScanning(false);
  }, [releaseWakeLock]);

  const toggleScan = useCallback(() => {
    setIsScanning((prev) => !prev);
  }, []);

  return (
    <BluetoothContext.Provider
      value={{
        connected,
        connecting,
        deviceName,
        error,
        supported: isBluetoothSupported(),
        isScanning,
        scanInterval,
        lastScanTime,
        messagesReceived,
        observerPosition,
        autoCenter,
        smartScanEnabled,
        smartScanDays,
        wakeLockActive,
        connect,
        disconnect,
        toggleScan,
        setScanInterval,
        setAutoCenter,
        setSmartScanEnabled,
        setSmartScanDays,
      }}
    >
      {children}
    </BluetoothContext.Provider>
  );
}
