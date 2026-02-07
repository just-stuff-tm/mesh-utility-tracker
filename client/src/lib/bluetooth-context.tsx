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
  checkConnectionAlive,
  remoteLog,
  on,
  type MeshContact,
  type DeviceInfo,
  type SelfInfo,
} from "@/lib/bluetooth";
import { getCurrentPosition, watchPosition, clearWatch, fetchElevation } from "@/lib/geolocation";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { db, generateLocalId, isOnline } from "@/lib/offline-store";
import { snapToHexGrid } from "@shared/grid";

export type ScanStatus = "idle" | "advertising" | "waiting" | "querying" | "submitting" | "done" | "error";
export type UnitSystem = "imperial" | "metric";

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
  statsRadiusMiles: number;
  unitSystem: UnitSystem;
  altitudeMeters: number | null;
  wakeLockActive: boolean;
  deviceInfo: DeviceInfo | null;
  selfInfo: SelfInfo | null;
  batteryMilliVolts: number | null;
  lastRadioName: string | null;
  showReconnect: boolean;
  contacts: MeshContact[];
  scanStatus: ScanStatus;
  lastScanResult: LastScanResult | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  toggleScan: () => void;
  forceScan: () => void;
  dismissReconnect: () => void;
  setScanInterval: (interval: number) => void;
  setAutoCenter: (v: boolean) => void;
  setSmartScanEnabled: (v: boolean) => void;
  setSmartScanDays: (v: number) => void;
  setStatsRadiusMiles: (v: number) => void;
  setUnitSystem: (v: UnitSystem) => void;
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
  const [statsRadiusMiles, setStatsRadiusMiles] = useState(() => {
    try {
      const stored = localStorage.getItem("mesh_stats_radius");
      return stored ? parseInt(stored, 10) : 0;
    } catch { return 0; }
  });
  const [unitSystem, setUnitSystem] = useState<UnitSystem>(() => {
    try {
      const stored = localStorage.getItem("mesh_unit_system");
      return (stored === "metric" ? "metric" : "imperial") as UnitSystem;
    } catch { return "imperial" as UnitSystem; }
  });
  const [altitudeMeters, setAltitudeMeters] = useState<number | null>(null);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [selfInfo, setSelfInfo] = useState<SelfInfo | null>(null);
  const [batteryMilliVolts, setBatteryMilliVolts] = useState<number | null>(null);
  const [contacts, setContacts] = useState<MeshContact[]>([]);
  const [scanStatus, setScanStatus] = useState<ScanStatus>("idle");
  const [lastScanResult, setLastScanResult] = useState<LastScanResult | null>(null);
  const [nextScanCountdown, setNextScanCountdown] = useState<number | null>(null);
  const [lastRadioName] = useState<string | null>(() => {
    try { return localStorage.getItem("mesh_last_radio"); } catch { return null; }
  });
  const [showReconnect, setShowReconnect] = useState(() => {
    try { return !!localStorage.getItem("mesh_last_radio"); } catch { return false; }
  });

  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const positionRef = useRef<[number, number] | null>(null);
  const selfInfoRef = useRef<SelfInfo | null>(null);
  const contactsRef = useRef<MeshContact[]>([]);
  const smartScanEnabledRef = useRef(smartScanEnabled);
  const smartScanDaysRef = useRef(smartScanDays);
  const altitudeRef = useRef<number | null>(null);

  useEffect(() => {
    positionRef.current = observerPosition;
  }, [observerPosition]);

  useEffect(() => {
    selfInfoRef.current = selfInfo;
  }, [selfInfo]);

  useEffect(() => {
    contactsRef.current = contacts;
  }, [contacts]);

  useEffect(() => {
    smartScanEnabledRef.current = smartScanEnabled;
  }, [smartScanEnabled]);

  useEffect(() => {
    smartScanDaysRef.current = smartScanDays;
  }, [smartScanDays]);

  useEffect(() => {
    altitudeRef.current = altitudeMeters;
  }, [altitudeMeters]);

  const lastElevationFetch = useRef<string | null>(null);

  useEffect(() => {
    const handlePosition = (pos: { latitude: number; longitude: number; altitude: number | null }) => {
      setObserverPosition([pos.latitude, pos.longitude]);
      if (pos.altitude !== null) {
        setAltitudeMeters(pos.altitude);
      } else {
        const key = `${pos.latitude.toFixed(3)},${pos.longitude.toFixed(3)}`;
        if (lastElevationFetch.current !== key) {
          lastElevationFetch.current = key;
          fetchElevation(pos.latitude, pos.longitude).then((elev) => {
            if (elev !== null) setAltitudeMeters(elev);
          });
        }
      }
    };

    getCurrentPosition()
      .then(handlePosition)
      .catch(() => {});

    const watchId = watchPosition(handlePosition, () => {});
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

    unsubs.push(on("new_advert", () => {
      setMessagesReceived((prev) => prev + 1);
    }));

    unsubs.push(on("rx_log", () => {
      setMessagesReceived((prev) => prev + 1);
    }));

    return () => unsubs.forEach((fn) => fn());
  }, []);


  const checkSmartScanSkip = useCallback((): boolean => {
    if (!smartScanEnabledRef.current) return false;
    const pos = positionRef.current;
    if (!pos) return false;

    try {
      const { snapLat, snapLng } = snapToHexGrid(pos[0], pos[1]);
      const cachedZones = queryClient.getQueryData<any[]>(["/api/coverage-zones"]);
      if (!cachedZones) return false;
      const freshnessMs = smartScanDaysRef.current * 24 * 60 * 60 * 1000;
      const now = Date.now();
      const tolerance = 0.00005;

      for (const z of cachedZones) {
        if (
          Math.abs(z.centerLat - snapLat) < tolerance &&
          Math.abs(z.centerLng - snapLng) < tolerance
        ) {
          if (z.isDeadZone) return false;
          if (z.lastScanned && now - new Date(z.lastScanned).getTime() < freshnessMs) {
            return true;
          }
        }
      }
    } catch {}
    return false;
  }, []);

  const runDiscoverRepeaters = useCallback(async () => {
    const pos = positionRef.current;
    setScanStatus("advertising");

    try {
      const result = await discoverRepeaters(pos?.[0], pos?.[1], (status) => {
        setScanStatus(status as ScanStatus);
      }, contactsRef.current);
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

      const pk = selfInfoRef.current?.publicKey;
      let radioId: string | null = null;
      if (pk && pk.length >= 4) {
        radioId = publicKeyHex(pk);
      }
      remoteLog("log", `[SUBMIT] radioId=${radioId}, publicKey type=${pk ? typeof pk : "null"}, length=${pk?.length ?? 0}, selfInfo exists=${!!selfInfoRef.current}`);

      let existingNodes: Array<{ nodeId: string; name: string | null }> = [];
      try {
        const res = await fetch("/api/nodes");
        if (res.ok) existingNodes = await res.json();
      } catch {
        try {
          const local = await db.nodes.toArray();
          existingNodes = local.map((n) => ({ nodeId: n.nodeId, name: n.name }));
        } catch {}
      }
      const nodeNameMap = new Map<string, string>();
      for (const n of existingNodes) {
        if (n.name) nodeNameMap.set(n.nodeId, n.name);
      }

      if (pos) {
        for (const rep of result.repeaters) {
          if (!rep.stats) continue;

          const nodeId = publicKeyHex(rep.contact.publicKey);
          const advName = rep.contact.advName || "";
          const isUnknown = !advName || advName.startsWith("Unknown (");
          const repeaterName = isUnknown
            ? (nodeNameMap.get(nodeId) || advName || nodeId)
            : advName;

          const nodeData = {
            nodeId,
            name: repeaterName,
            latitude: null as number | null,
            longitude: null as number | null,
          };

          try {
            await apiRequest("POST", "/api/nodes", nodeData);
          } catch {}

          if (!isOnline()) {
            try {
              const existing = await db.nodes.where("nodeId").equals(nodeId).first();
              await db.nodes.put({
                id: existing?.id || generateLocalId(),
                nodeId,
                name: repeaterName,
                hardwareType: existing?.hardwareType || null,
                lastSeen: new Date().toISOString(),
                latitude: null,
                longitude: null,
              });
            } catch {}
          }

          const scanData = {
            observerId: radioId || "local-observer",
            nodeId,
            rssi: rep.stats.rssi,
            snr: rep.stats.snr,
            latitude: pos[0],
            longitude: pos[1],
            altitude: altitudeRef.current,
            senderName: repeaterName,
            receiverName: selfInfoRef.current?.name || "Observer",
            radioId,
          };

          try {
            await apiRequest("POST", "/api/scan-results", scanData);
            scanResultsSubmitted++;
          } catch {}

          if (!isOnline()) {
            try {
              const scanId = generateLocalId();
              await db.scanResults.put({
                id: scanId,
                ...scanData,
                timestamp: new Date().toISOString(),
              });

              const { snapLat, snapLng } = snapToHexGrid(pos[0], pos[1]);
              const existing = await db.coverageZones
                .filter((z) => Math.abs(z.centerLat - snapLat) < 0.0001 && Math.abs(z.centerLng - snapLng) < 0.0001)
                .first();
              if (existing) {
                const newCount = (existing.scanCount || 0) + 1;
                const newAvgRssi = ((existing.avgRssi || 0) * (existing.scanCount || 0) + rep.stats.rssi) / newCount;
                const newAvgSnr = ((existing.avgSnr || 0) * (existing.scanCount || 0) + rep.stats.snr) / newCount;
                await db.coverageZones.put({
                  ...existing,
                  avgRssi: newAvgRssi,
                  avgSnr: newAvgSnr,
                  scanCount: newCount,
                  isDeadZone: false,
                  lastScanned: new Date().toISOString(),
                });
              } else {
                await db.coverageZones.put({
                  id: generateLocalId(),
                  centerLat: snapLat,
                  centerLng: snapLng,
                  radiusMeters: 80,
                  avgRssi: rep.stats.rssi,
                  avgSnr: rep.stats.snr,
                  scanCount: 1,
                  lastScanned: new Date().toISOString(),
                  isDeadZone: false,
                  polygon: null,
                  radioId,
                });
              }
              scanResultsSubmitted++;
            } catch {}
          }
        }

        if (result.repeaters.length === 0) {
          try {
            await apiRequest("POST", "/api/coverage-zones/dead-zone", {
              centerLat: pos[0],
              centerLng: pos[1],
              radioId,
            });
          } catch {}

          if (!isOnline()) {
            try {
              const { snapLat, snapLng } = snapToHexGrid(pos[0], pos[1]);
              const existing = await db.coverageZones
                .filter((z) => Math.abs(z.centerLat - snapLat) < 0.0001 && Math.abs(z.centerLng - snapLng) < 0.0001)
                .first();
              if (!existing || (existing.scanCount === 0 || existing.isDeadZone)) {
                await db.coverageZones.put({
                  id: existing?.id || generateLocalId(),
                  centerLat: snapLat,
                  centerLng: snapLng,
                  radiusMeters: 80,
                  avgRssi: null,
                  avgSnr: null,
                  scanCount: 0,
                  lastScanned: new Date().toISOString(),
                  isDeadZone: true,
                  polygon: null,
                  radioId,
                });
              }
            } catch {}
          }
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

    const runAutoScan = () => {
      const skip = checkSmartScanSkip();
      if (skip) {
        setScanStatus("done");
        setLastScanResult((prev) => prev ? { ...prev, errorMessage: "Smart scan: area recently covered, skipped" } : {
          contactsFound: 0, repeatersFound: 0, repeatersWithStats: 0,
          scanResultsSubmitted: 0, timestamp: new Date(),
          errorMessage: "Smart scan: area recently covered, skipped",
        });
      } else {
        runDiscoverRepeaters();
      }
      setNextScanCountdown(scanInterval);
    };

    runAutoScan();
    const scanTimer = setInterval(runAutoScan, scanInterval * 1000);
    const tickTimer = setInterval(() => {
      setNextScanCountdown((prev) => (prev !== null && prev > 0 ? prev - 1 : prev));
    }, 1000);
    return () => {
      clearInterval(scanTimer);
      clearInterval(tickTimer);
    };
  }, [connected, isScanning, scanInterval, runDiscoverRepeaters, checkSmartScanSkip]);

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
    if (!connected) return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible" && connected) {
        if (isScanning) acquireWakeLock();

        const alive = await checkConnectionAlive();
        if (!alive) {
          setConnected(false);
          setDeviceName(null);
          setDeviceInfo(null);
          setSelfInfo(null);
          setBatteryMilliVolts(null);
          setContacts([]);
          setIsScanning(false);
          setScanStatus("idle");
          setShowReconnect(true);
          setError("Radio disconnected while app was in background");
        } else {
          const battery = await getBatteryVoltage();
          if (battery !== null) setBatteryMilliVolts(battery);
        }
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
      setShowReconnect(false);
      try { localStorage.setItem("mesh_last_radio", result.deviceName || "Radio"); } catch {}

      try {
        const info = await getSelfInfo();
        if (info) {
          const rid = info.publicKey?.length >= 4 ? publicKeyHex(info.publicKey) : null;
          remoteLog("log", `[CONNECT] selfInfo.publicKey: type=${typeof info.publicKey}, isUint8=${info.publicKey instanceof Uint8Array}, length=${info.publicKey?.length}, hex=${rid}`);
          setSelfInfo(info as any);

          if (rid) {
            try {
              await apiRequest("POST", "/api/observers", {
                name: info.name || result.deviceName || "Observer",
                deviceId: rid,
              });
            } catch {}
          }
        }

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

  const forceScan = useCallback(() => {
    if (!connected) return;
    const isActive = scanStatus !== "idle" && scanStatus !== "done" && scanStatus !== "error";
    if (isActive) return;
    runDiscoverRepeaters();
    setNextScanCountdown(scanInterval);
  }, [connected, scanStatus, scanInterval, runDiscoverRepeaters]);

  const dismissReconnect = useCallback(() => {
    setShowReconnect(false);
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
        statsRadiusMiles,
        unitSystem,
        altitudeMeters,
        wakeLockActive,
        deviceInfo,
        selfInfo,
        batteryMilliVolts,
        contacts,
        scanStatus,
        lastScanResult,
        lastRadioName,
        showReconnect,
        connect: connectHandler,
        disconnect,
        toggleScan,
        forceScan,
        dismissReconnect,
        setScanInterval,
        setAutoCenter,
        setSmartScanEnabled,
        setSmartScanDays,
        setStatsRadiusMiles: (v: number) => {
          setStatsRadiusMiles(v);
          try { localStorage.setItem("mesh_stats_radius", String(v)); } catch {}
        },
        setUnitSystem: (v: UnitSystem) => {
          setUnitSystem(v);
          try { localStorage.setItem("mesh_unit_system", v); } catch {}
        },
      }}
    >
      {children}
    </BluetoothContext.Provider>
  );
}
