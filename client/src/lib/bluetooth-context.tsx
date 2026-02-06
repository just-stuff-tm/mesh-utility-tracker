import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import {
  connectToRadio,
  disconnectRadio,
  isBluetoothSupported,
  isConnected as checkConnected,
  getContacts,
  getSelfInfo,
  getBatteryVoltage,
  discoverRepeaters,
  publicKeyHex,
  on,
  type MeshContact,
  type DeviceInfo,
  type SelfInfo,
} from "@/lib/bluetooth";
import { getCurrentPosition, watchPosition, clearWatch } from "@/lib/geolocation";
import { apiRequest, queryClient } from "@/lib/queryClient";

export type ScanStatus = "idle" | "advertising" | "waiting" | "querying" | "submitting" | "done" | "error";

export interface LastScanResult {
  contactsFound: number;
  repeatersFound: number;
  repeatersWithStats: number;
  scanResultsSubmitted: number;
  timestamp: Date;
  errorMessage?: string;
}

interface BluetoothContextValue {
  connected: boolean;
  connecting: boolean;
  deviceName: string | null;
  error: string | null;
  supported: boolean;
  isScanning: boolean;
  scanInterval: number;
  nextScanCountdown: number | null;
  lastScanTime: Date | null;
  messagesReceived: number;
  observerPosition: [number, number] | null;
  autoCenter: boolean;
  smartScanEnabled: boolean;
  smartScanDays: number;
  wakeLockActive: boolean;
  deviceInfo: DeviceInfo | null;
  selfInfo: SelfInfo | null;
  batteryMilliVolts: number | null;
  contacts: MeshContact[];
  scanStatus: ScanStatus;
  lastScanResult: LastScanResult | null;
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
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [selfInfo, setSelfInfo] = useState<SelfInfo | null>(null);
  const [batteryMilliVolts, setBatteryMilliVolts] = useState<number | null>(null);
  const [contacts, setContacts] = useState<MeshContact[]>([]);
  const [scanStatus, setScanStatus] = useState<ScanStatus>("idle");
  const [lastScanResult, setLastScanResult] = useState<LastScanResult | null>(null);
  const [nextScanCountdown, setNextScanCountdown] = useState<number | null>(null);

  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const positionRef = useRef<[number, number] | null>(null);
  const selfInfoRef = useRef<SelfInfo | null>(null);

  useEffect(() => {
    positionRef.current = observerPosition;
  }, [observerPosition]);

  useEffect(() => {
    selfInfoRef.current = selfInfo;
  }, [selfInfo]);

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

  useEffect(() => {
    const unsubs: (() => void)[] = [];

    unsubs.push(on("disconnected", () => {
      setConnected(false);
      setDeviceName(null);
      setDeviceInfo(null);
      setSelfInfo(null);
      setBatteryMilliVolts(null);
      setContacts([]);
      setIsScanning(false);
    }));

    unsubs.push(on("device_info", (info: DeviceInfo) => {
      setDeviceInfo(info);
    }));

    unsubs.push(on("self_info", (info: SelfInfo) => {
      setSelfInfo(info);
    }));

    unsubs.push(on("battery", (data: { milliVolts: number }) => {
      setBatteryMilliVolts(data.milliVolts);
    }));

    unsubs.push(on("new_advert", (advert: any) => {
      setMessagesReceived((prev) => prev + 1);
      submitContactAsNode(advert);
    }));

    unsubs.push(on("rx_log", (data: { lastSnr: number; lastRssi: number }) => {
      setMessagesReceived((prev) => prev + 1);
      submitRxLog(data);
    }));

    return () => unsubs.forEach((fn) => fn());
  }, []);

  const submitContactAsNode = useCallback(async (advert: any) => {
    try {
      const name = advert.advName || "Unknown";
      const nodeId = publicKeyHex(advert.publicKey);

      await apiRequest("POST", "/api/nodes", {
        nodeId,
        name,
        latitude: null,
        longitude: null,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/nodes"] });
    } catch {}
  }, []);

  const submitRxLog = useCallback(async (data: { lastSnr: number; lastRssi: number }) => {
    const pos = positionRef.current;
    if (!pos) return;

    try {
      await apiRequest("POST", "/api/scan-results", {
        observerId: "local-observer",
        nodeId: "mesh-rx",
        rssi: data.lastRssi,
        snr: data.lastSnr,
        latitude: pos[0],
        longitude: pos[1],
        senderName: null,
        receiverName: selfInfoRef.current?.name || "Observer",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/coverage-zones"] });
      queryClient.invalidateQueries({ queryKey: ["/api/scan-results"] });
    } catch {}
  }, []);

  const runDiscoverRepeaters = useCallback(async () => {
    const pos = positionRef.current;
    setScanStatus("advertising");

    try {
      const result = await discoverRepeaters(pos?.[0], pos?.[1], (status) => {
        setScanStatus(status as ScanStatus);
      });
      if (!result) {
        setScanStatus("error");
        setLastScanResult({
          contactsFound: 0,
          repeatersFound: 0,
          repeatersWithStats: 0,
          scanResultsSubmitted: 0,
          timestamp: new Date(),
          errorMessage: "No radio connection or scan failed",
        });
        return;
      }

      setContacts(result.contacts);
      setLastScanTime(result.timestamp);

      setScanStatus("submitting");

      let scanResultsSubmitted = 0;

      if (pos) {
        for (const rep of result.repeaters) {
          if (!rep.stats) continue;

          const nodeId = publicKeyHex(rep.contact.publicKey);
          const repeaterName = rep.contact.advName || nodeId;

          try {
            await apiRequest("POST", "/api/nodes", {
              nodeId,
              name: repeaterName,
              latitude: null,
              longitude: null,
            });
          } catch {}

          try {
            await apiRequest("POST", "/api/scan-results", {
              observerId: "local-observer",
              nodeId,
              rssi: rep.stats.lastRssi,
              snr: rep.stats.lastSnr,
              latitude: pos[0],
              longitude: pos[1],
              senderName: repeaterName,
              receiverName: selfInfoRef.current?.name || "Observer",
            });
            scanResultsSubmitted++;
          } catch {}
        }

        const repeatersWithStats = result.repeaters.filter((r) => r.stats !== null).length;
        if (repeatersWithStats === 0) {
          try {
            await apiRequest("POST", "/api/coverage-zones/dead-zone", {
              centerLat: pos[0],
              centerLng: pos[1],
            });
          } catch {}
        }
      }

      const scanResult: LastScanResult = {
        contactsFound: result.contacts.length,
        repeatersFound: result.repeaters.length,
        repeatersWithStats: result.repeaters.filter((r) => r.stats !== null).length,
        scanResultsSubmitted,
        timestamp: result.timestamp,
      };
      setLastScanResult(scanResult);
      setScanStatus("done");

      queryClient.invalidateQueries({ queryKey: ["/api/nodes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/coverage-zones"] });
      queryClient.invalidateQueries({ queryKey: ["/api/scan-results"] });
    } catch (err: any) {
      setScanStatus("error");
      setLastScanResult({
        contactsFound: 0,
        repeatersFound: 0,
        repeatersWithStats: 0,
        scanResultsSubmitted: 0,
        timestamp: new Date(),
        errorMessage: err?.message || "Scan failed unexpectedly",
      });
    }
  }, []);

  useEffect(() => {
    if (!connected || !isScanning) {
      setNextScanCountdown(null);
      return;
    }

    runDiscoverRepeaters();
    setNextScanCountdown(scanInterval);
    const scanTimer = setInterval(() => {
      runDiscoverRepeaters();
      setNextScanCountdown(scanInterval);
    }, scanInterval * 1000);
    const tickTimer = setInterval(() => {
      setNextScanCountdown((prev) => (prev !== null && prev > 0 ? prev - 1 : prev));
    }, 1000);
    return () => {
      clearInterval(scanTimer);
      clearInterval(tickTimer);
    };
  }, [connected, isScanning, scanInterval, runDiscoverRepeaters]);

  const acquireWakeLock = useCallback(async () => {
    try {
      if ("wakeLock" in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
        setWakeLockActive(true);
        wakeLockRef.current!.addEventListener("release", () => {
          setWakeLockActive(false);
        });
      }
    } catch {}
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

  const connectHandler = useCallback(async () => {
    setConnecting(true);
    setError(null);
    const result = await connectToRadio();
    setConnecting(false);
    if (result.success) {
      setConnected(true);
      setDeviceName(result.deviceName);

      try {
        const info = await getSelfInfo();
        if (info) setSelfInfo(info as any);

        const battery = await getBatteryVoltage();
        if (battery !== null) setBatteryMilliVolts(battery);

        const contactList = await getContacts();
        setContacts(contactList);
      } catch (err) {
        console.error("[mesh] Post-connect queries failed:", err);
      }
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
    setDeviceInfo(null);
    setSelfInfo(null);
    setBatteryMilliVolts(null);
    setContacts([]);
    setScanStatus("idle");
    setLastScanResult(null);
  }, [releaseWakeLock]);

  const toggleScan = useCallback(() => {
    setIsScanning((prev) => {
      if (prev) {
        setScanStatus("idle");
      }
      return !prev;
    });
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
        nextScanCountdown,
        lastScanTime,
        messagesReceived,
        observerPosition,
        autoCenter,
        smartScanEnabled,
        smartScanDays,
        wakeLockActive,
        deviceInfo,
        selfInfo,
        batteryMilliVolts,
        contacts,
        scanStatus,
        lastScanResult,
        connect: connectHandler,
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
