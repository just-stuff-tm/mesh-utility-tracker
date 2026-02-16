import { useState, useEffect, useCallback, useRef } from "react";
import { drainOutbox, getOutboxCount, isOnline, db, getForceOffline, setForceOffline, initForceOffline } from "./offline-store";
import { queryClient } from "./queryClient";

initForceOffline();

export function useOfflineStatus() {
  const [online, setOnline] = useState(isOnline());
  const [forced, setForced] = useState(getForceOffline());
  const [pendingSync, setPendingSync] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);

  const refreshPendingCount = useCallback(async () => {
    const count = await getOutboxCount();
    setPendingSync(count);
  }, []);

  const syncNow = useCallback(async () => {
    if (!isOnline() || syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      const result = await drainOutbox();
      await refreshPendingCount();
      if (result.synced > 0) {
        await db.nodes.where("id").startsWith("local-").delete();
        await db.scanResults.where("id").startsWith("local-").delete();
      }
      // Query invalidation removed - using IndexedDB and Worker directly
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [refreshPendingCount]);

  const toggleForceOffline = useCallback((value: boolean) => {
    setForceOffline(value);
    setForced(value);
    setOnline(!value && navigator.onLine);
    if (!value && navigator.onLine) {
      syncNow();
    }
  }, [syncNow]);

  useEffect(() => {
    const handleOnline = () => {
      setOnline(isOnline());
      if (isOnline()) syncNow();
    };
    const handleOffline = () => setOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    refreshPendingCount();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [syncNow, refreshPendingCount]);

  return { online, pendingSync, syncing, syncNow, refreshPendingCount, forceOffline: forced, toggleForceOffline };
}
