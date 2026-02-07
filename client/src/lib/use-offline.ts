import { useState, useEffect, useCallback } from "react";
import { drainOutbox, getOutboxCount, isOnline, db } from "./offline-store";
import { queryClient } from "./queryClient";

export function useOfflineStatus() {
  const [online, setOnline] = useState(isOnline());
  const [pendingSync, setPendingSync] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refreshPendingCount = useCallback(async () => {
    const count = await getOutboxCount();
    setPendingSync(count);
  }, []);

  const syncNow = useCallback(async () => {
    if (!isOnline() || syncing) return;
    setSyncing(true);
    try {
      const result = await drainOutbox();
      await refreshPendingCount();
      if (result.synced > 0) {
        await db.nodes.where("id").startsWith("local-").delete();
        await db.scanResults.where("id").startsWith("local-").delete();
        await db.coverageZones.where("id").startsWith("local-").delete();

        queryClient.invalidateQueries({ queryKey: ["/api/coverage-zones"] });
        queryClient.invalidateQueries({ queryKey: ["/api/scan-results"] });
        queryClient.invalidateQueries({ queryKey: ["/api/nodes"] });
        queryClient.invalidateQueries({ queryKey: ["/api/scan-results/latest"] });
      }
    } finally {
      setSyncing(false);
    }
  }, [syncing, refreshPendingCount]);

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      syncNow();
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

  return { online, pendingSync, syncing, syncNow, refreshPendingCount };
}
