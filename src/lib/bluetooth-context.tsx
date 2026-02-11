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
import { db, generateLocalId, isOnline, enqueueMutation, drainOutbox, getOutboxCount } from "@/lib/offline-store";
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
  updateRadioPosition: boolean;
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
  uploadBatchInterval: number;
  queuedScansCount: number;
  lastUploadTime: number;
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
  setUpdateRadioPosition: (v: boolean) => void;
  setUploadBatchInterval: (v: number) => void;
  manualSync: () => Promise<{ synced: number; failed: number }>;
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
  const [updateRadioPosition, setUpdateRadioPosition] = useState(() => {
    try {
      const stored = localStorage.getItem("mesh_update_radio_position");
      return stored === "true";
    } catch { return false; }
  });
  const updateRadioPositionRef = useRef(updateRadioPosition);
  const [uploadBatchInterval, setUploadBatchIntervalState] = useState(() => {
    try {
      const stored = localStorage.getItem("mesh_upload_batch_interval");
      return stored ? parseInt(stored, 10) : 10; // default 10 minutes
    } catch { return 10; }
  });
  const [queuedScansCount, setQueuedScansCount] = useState(0);
  const [lastUploadTime, setLastUploadTime] = useState<number>(0);
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
  const scanTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const runAutoScanRef = useRef<(() => void) | null>(null);
  const lastSnapRef = useRef<string | null>(null);

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
    updateRadioPositionRef.current = updateRadioPosition;
  }, [updateRadioPosition]);

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


  const checkIsInDeadZone = useCallback(async (): Promise<boolean> => {
    const pos = positionRef.current;
    if (!pos) return false;

    const { snapLat, snapLng } = snapToHexGrid(pos[0], pos[1]);

    try {
      // Check if current hex has any dead zone markers in IndexedDB
      const deadZones = await db.coverageZones
        .where("isDeadZone")
        .equals(1)
        .toArray();

      // Check if any dead zone matches current hex
      const inDeadZone = deadZones.some((zone) => {
        return Math.abs(zone.centerLat - snapLat) < 0.000001 && 
               Math.abs(zone.centerLng - snapLng) < 0.000001;
      });

      return inDeadZone;
    } catch (err) {
      console.error("[DeadZone] Failed to check dead zones:", err);
      return false;
    }
  }, []);

  const checkSmartScanSkip = useCallback(async (): Promise<boolean> => {
    if (!smartScanEnabledRef.current) return false;
    
    const pos = positionRef.current;
    if (!pos) return false;

    const { snapLat, snapLng } = snapToHexGrid(pos[0], pos[1]);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - smartScanDaysRef.current);
    const cutoffTimestamp = cutoffDate.toISOString();

    try {
      // Check if any scans exist in this hex within the freshness window
      const recentScans = await db.scanResults
        .where("timestamp")
        .above(cutoffTimestamp)
        .toArray();

      // Filter to scans in the current hex
      const hexScans = recentScans.filter((scan) => {
        const { snapLat: scanLat, snapLng: scanLng } = snapToHexGrid(scan.latitude, scan.longitude);
        return Math.abs(scanLat - snapLat) < 0.000001 && Math.abs(scanLng - snapLng) < 0.000001;
      });

      return hexScans.length > 0;
    } catch (err) {
      console.error("[SmartScan] Failed to check recent scans:", err);
      return false;
    }
  }, []);

  const runDiscoverRepeaters = useCallback(async () => {
    const pos = positionRef.current;
    setScanStatus("advertising");

    try {
      const shouldUpdatePosition = updateRadioPositionRef.current;
      const result = await discoverRepeaters(
        shouldUpdatePosition ? pos?.[0] : undefined,
        shouldUpdatePosition ? pos?.[1] : undefined,
        (status) => {
          setScanStatus(status as ScanStatus);
        },
        contactsRef.current,
      );
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

      // Get node names from IndexedDB
      let existingNodes: Array<{ nodeId: string; name: string | null }> = [];
      try {
        const local = await db.nodes.toArray();
        existingNodes = local.map((n) => ({ nodeId: n.nodeId, name: n.name }));
      } catch {}
      const nodeNameMap = new Map<string, string>();
      for (const n of existingNodes) {
        if (n.name) nodeNameMap.set(n.nodeId, n.name);
      }

      if (pos) {
        for (const rep of result.repeaters) {
          if (!rep.stats) continue;

          const nodeId = publicKeyHex(rep.contact.publicKey);
          const advName = rep.contact.advName || "";
          const advIsReal = advName && !advName.startsWith("Unknown (");
          const existingName = nodeNameMap.get(nodeId);
          const existingIsReal = existingName && !existingName.startsWith("Unknown (");
          const nodeName = advIsReal ? advName : (existingIsReal ? existingName : null);
          const displayName = nodeName || `Unknown (${nodeId})`;

          if (!isOnline()) {
            try {
              const existing = await db.nodes.where("nodeId").equals(nodeId).first();
              await db.nodes.put({
                id: existing?.id || generateLocalId(),
                nodeId,
                name: nodeName || existing?.name || null,
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
            snrIn: rep.stats.snrIn,
            latitude: pos[0],
            longitude: pos[1],
            altitude: altitudeRef.current,
            senderName: displayName,
            receiverName: selfInfoRef.current?.name || "Observer",
            radioId,
          };

          // Queue scan for batch upload to worker/GitHub
          // NOTE: Only successful scans (with discovered nodes) are uploaded
          // Dead zones are stored locally only and never synced to cloud
          try {
            const workerUrl = import.meta.env.VITE_WORKER_URL || "http://127.0.0.1:8787";
            const workerPayload = [{
              radioId: radioId || "local-observer",
              timestamp: Date.now(),
              location: {
                lat: pos[0],
                lon: pos[1],
                altitude: altitudeRef.current || undefined,
              },
              nodes: [{
                nodeId,
                rssi: rep.stats.rssi,
                snr: rep.stats.snr,
                hopLimit: rep.stats.hopLimit,
              }],
            }];
            console.log('[Bluetooth] Queuing scan for batch upload:', workerPayload);
            await enqueueMutation({
              url: `${workerUrl}/scans`,
              method: "POST",
              payload: workerPayload,
              createdAt: Date.now(),
              retries: 0,
            });
            console.log('[Bluetooth] Scan queued successfully');
            scanResultsSubmitted++;
            setQueuedScansCount(prev => prev + 1);
          } catch (err) {
            console.error('[Bluetooth] Error queuing scan:', err);
          }

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
                // Update existing zone with successful scan
                // This automatically converts dead zones to active zones
                const newCount = (existing.scanCount || 0) + 1;
                const newAvgRssi = ((existing.avgRssi || 0) * (existing.scanCount || 0) + rep.stats.rssi) / newCount;
                const newAvgSnr = ((existing.avgSnr || 0) * (existing.scanCount || 0) + rep.stats.snr) / newCount;
                await db.coverageZones.put({
                  ...existing,
                  avgRssi: newAvgRssi,
                  avgSnr: newAvgSnr,
                  scanCount: newCount,
                  isDeadZone: false, // Clear dead zone flag on successful scan
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
          // Dead zone - scan data already sent with 0 repeaters

          if (!isOnline()) {
            try {
              const { snapLat, snapLng } = snapToHexGrid(pos[0], pos[1]);
              const existing = await db.coverageZones
                .filter((z) => Math.abs(z.centerLat - snapLat) < 0.0001 && Math.abs(z.centerLng - snapLng) < 0.0001)
                .first();
              
              // Only mark as dead zone if:
              // 1. No existing zone, OR
              // 2. Existing zone is already a dead zone
              // Never overwrite successful scan zones
              if (!existing || existing.isDeadZone) {
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

      // Query invalidation removed - using IndexedDB and Worker directly now
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
      scanTimerRef.current = null;
      runAutoScanRef.current = null;
      lastSnapRef.current = null;
      return;
    }

    const runAutoScan = async () => {
      const pos = positionRef.current;
      if (pos) {
        const { snapLat, snapLng } = snapToHexGrid(pos[0], pos[1]);
        lastSnapRef.current = `${snapLat},${snapLng}`;
      }
      const skip = await checkSmartScanSkip();
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

    runAutoScanRef.current = runAutoScan;
    runAutoScan();
    const scanTimer = setInterval(runAutoScan, scanInterval * 1000);
    scanTimerRef.current = scanTimer;
    const tickTimer = setInterval(() => {
      setNextScanCountdown((prev) => (prev !== null && prev > 0 ? prev - 1 : prev));
    }, 1000);
    return () => {
      clearInterval(scanTimer);
      clearInterval(tickTimer);
      scanTimerRef.current = null;
      runAutoScanRef.current = null;
    };
  }, [connected, isScanning, scanInterval, runDiscoverRepeaters, checkSmartScanSkip]);

  useEffect(() => {
    if (!connected || !isScanning || !observerPosition) return;
    const { snapLat, snapLng } = snapToHexGrid(observerPosition[0], observerPosition[1]);
    const currentSnap = `${snapLat},${snapLng}`;
    
    if (smartScanEnabled && lastSnapRef.current && currentSnap !== lastSnapRef.current) {
      checkIsInDeadZone().then((isDeadZone) => {
        if (isDeadZone) {
          lastSnapRef.current = currentSnap;
          if (scanTimerRef.current) {
            clearInterval(scanTimerRef.current);
          }
          runAutoScanRef.current?.();
          scanTimerRef.current = setInterval(() => {
            runAutoScanRef.current?.();
          }, scanInterval * 1000);
        }
      });
    }
  }, [connected, isScanning, observerPosition, scanInterval, smartScanEnabled, checkIsInDeadZone]);

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
            const observerName = info.name || result.deviceName || "Observer";
            // Observer info is now sent with each scan, no separate registration needed

            try {
              const localScans = await db.scanResults
                .where("observerId")
                .equals(rid)
                .toArray();
              const stale = localScans.filter(
                (s) => s.receiverName && s.receiverName !== observerName
              );
              if (stale.length > 0) {
                await db.scanResults.bulkPut(
                  stale.map((s) => ({ ...s, receiverName: observerName }))
                );
              }
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

  // Batch upload timer - uploads queued scans at configured interval
  useEffect(() => {
    if (!connected) return;
    
    const intervalMs = uploadBatchInterval * 60 * 1000;
    const checkTimer = setInterval(async () => {
      const now = Date.now();
      const count = await getOutboxCount();
      setQueuedScansCount(count);
      
      // Upload if interval has passed, we have queued scans, and we're online
      if (count > 0 && now - lastUploadTime >= intervalMs && isOnline()) {
        console.log(`[Bluetooth] Auto-uploading ${count} queued scans`);
        try {
          const result = await drainOutbox();
          if (result.synced > 0) {
            const newCount = await getOutboxCount();
            setQueuedScansCount(newCount);
            setLastUploadTime(now);
            console.log(`[Bluetooth] Uploaded ${result.synced} scans, ${newCount} remaining`);
          }
        } catch (err) {
          console.error('[Bluetooth] Auto-upload failed:', err);
        }
      }
    }, 60000); // Check every minute
    
    return () => clearInterval(checkTimer);
  }, [connected, uploadBatchInterval, lastUploadTime]);

  const setUploadBatchInterval = useCallback((v: number) => {
    setUploadBatchIntervalState(v);
    try { localStorage.setItem("mesh_upload_batch_interval", String(v)); } catch {}
  }, []);

  const manualSync = useCallback(async () => {
    if (!isOnline()) {
      throw new Error("Cannot sync while offline");
    }
    const now = Date.now();
    if (now - lastUploadTime < 5 * 60 * 1000) {
      throw new Error("Please wait 5 minutes between syncs");
    }
    const result = await drainOutbox();
    if (result.synced > 0) {
      const count = await getOutboxCount();
      setQueuedScansCount(count);
      setLastUploadTime(now);
    }
    return result;
  }, [lastUploadTime]);

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
        updateRadioPosition,
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
        setUpdateRadioPosition: (v: boolean) => {
          setUpdateRadioPosition(v);
          try { localStorage.setItem("mesh_update_radio_position", String(v)); } catch {}
        },        uploadBatchInterval,
        queuedScansCount,
        lastUploadTime,
        setUploadBatchInterval,
        manualSync,      }}
    >
      {children}
    </BluetoothContext.Provider>
  );
}
