import { useState, useEffect } from "react";
import { Settings, Timer, MapPin, AlertTriangle, Trash2, Radar, Ruler, Wifi, WifiOff, Download, RefreshCw, MapPinned } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useBluetoothContext } from "@/lib/bluetooth-context";
import { publicKeyHex } from "@/lib/bluetooth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, isQueuedResponse, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { useOfflineStatus } from "@/lib/use-offline";

export function SettingsPanel() {
  const { toast } = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tileCacheCount, setTileCacheCount] = useState<number | null>(null);
  const [downloadingTiles, setDownloadingTiles] = useState(false);
  const { online, pendingSync, syncing, syncNow } = useOfflineStatus();
  const {
    scanInterval,
    setScanInterval,
    autoCenter,
    setAutoCenter,
    smartScanEnabled,
    setSmartScanEnabled,
    smartScanDays,
    setSmartScanDays,
    statsRadiusMiles,
    setStatsRadiusMiles,
    unitSystem,
    setUnitSystem,
    observerPosition,
    connected,
    selfInfo,
  } = useBluetoothContext();

  const deleteDataMutation = useMutation({
    mutationFn: async (radioId: string) => {
      const res = await apiRequest("DELETE", `/api/data/${radioId}`);
      if (isQueuedResponse(res)) {
        return { queued: true } as any;
      }
      return res.json();
    },
    onSuccess: (data) => {
      setConfirmDelete(false);
      if (data.queued) {
        toast({
          title: "Delete queued",
          description: "Data will be deleted when you're back online",
        });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/coverage-zones"] });
      queryClient.invalidateQueries({ queryKey: ["/api/scan-results"] });
      queryClient.invalidateQueries({ queryKey: ["/api/nodes"] });
      toast({
        title: "Data deleted",
        description: `Removed ${data.deleted.scanResults} scan results, ${data.deleted.coverageZones} coverage zones, and ${data.deleted.observers || 0} observer records`,
      });
    },
    onError: () => {
      toast({ title: "Failed to delete data", variant: "destructive" });
    },
  });

  const handleDeleteData = () => {
    if (!selfInfo?.publicKey) return;
    const radioId = publicKeyHex(selfInfo.publicKey);
    deleteDataMutation.mutate(radioId);
  };

  const markDeadZoneMutation = useMutation({
    mutationFn: async (data: { centerLat: number; centerLng: number }) => {
      const res = await apiRequest("POST", "/api/coverage-zones/dead-zone", data);
      if (isQueuedResponse(res)) {
        return { queued: true } as any;
      }
      return res.json();
    },
    onSuccess: (data) => {
      if (data.queued) {
        toast({ title: "Dead zone queued for sync when back online" });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/coverage-zones"] });
      toast({ title: "Dead zone marked at your current location" });
    },
  });

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "TILE_CACHE_SIZE") {
        setTileCacheCount(e.data.count);
      }
    };
    navigator.serviceWorker.addEventListener("message", handler);
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: "GET_TILE_CACHE_SIZE" });
    }
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, []);

  const handleMarkDeadZone = () => {
    if (!observerPosition) {
      toast({ title: "Location not available", variant: "destructive" });
      return;
    }
    markDeadZoneMutation.mutate({
      centerLat: observerPosition[0],
      centerLng: observerPosition[1],
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Settings className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Settings</span>
      </div>

      <Card className="p-3 space-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Timer className="h-3.5 w-3.5 text-muted-foreground" />
            <Label className="text-xs">Scan Interval: {scanInterval}s</Label>
          </div>
          <Slider
            value={[scanInterval]}
            onValueChange={([v]) => setScanInterval(v)}
            min={40}
            max={300}
            step={10}
            data-testid="slider-scan-interval"
          />
          <p className="text-xs text-muted-foreground">
            Minimum 40s between scans
          </p>
        </div>

        <Separator />

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
            <Label className="text-xs">Auto-center map</Label>
          </div>
          <Switch
            checked={autoCenter}
            onCheckedChange={setAutoCenter}
            data-testid="switch-auto-center"
          />
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Download className="h-3.5 w-3.5 text-muted-foreground" />
            <Label className="text-xs" data-testid="label-offline-tiles">Offline Map Tiles</Label>
          </div>
          <p className="text-xs text-muted-foreground">
            Map tiles are cached as you browse. Download tiles for your current area to use offline.
          </p>
          {tileCacheCount !== null && (
            <p className="text-xs text-muted-foreground">
              {tileCacheCount} tiles cached
            </p>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (!observerPosition) {
                toast({ title: "Location not available", variant: "destructive" });
                return;
              }
              if (!("serviceWorker" in navigator) || !navigator.serviceWorker.controller) {
                toast({ title: "Service worker not ready. Reload the app.", variant: "destructive" });
                return;
              }
              setDownloadingTiles(true);
              const [lat, lng] = observerPosition;
              const tileUrls: string[] = [];
              for (let z = 13; z <= 16; z++) {
                const n = Math.pow(2, z);
                const xCenter = Math.floor(((lng + 180) / 360) * n);
                const yCenter = Math.floor(
                  ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * n
                );
                const range = z <= 13 ? 4 : z <= 14 ? 6 : z <= 15 ? 8 : 10;
                for (let dx = -range; dx <= range; dx++) {
                  for (let dy = -range; dy <= range; dy++) {
                    const x = xCenter + dx;
                    const y = yCenter + dy;
                    if (x >= 0 && x < n && y >= 0 && y < n) {
                      const s = ["a", "b", "c", "d"][Math.abs(x + y) % 4];
                      tileUrls.push(`https://${s}.basemaps.cartocdn.com/dark_all/${z}/${x}/${y}.png`);
                    }
                  }
                }
              }
              const handler = (e: MessageEvent) => {
                if (e.data?.type === "PREFETCH_COMPLETE") {
                  setDownloadingTiles(false);
                  toast({
                    title: "Tiles downloaded",
                    description: `Cached ${e.data.count} new tiles (${e.data.total} total requested)`,
                  });
                  navigator.serviceWorker.removeEventListener("message", handler);
                  navigator.serviceWorker.controller?.postMessage({ type: "GET_TILE_CACHE_SIZE" });
                }
              };
              navigator.serviceWorker.addEventListener("message", handler);
              navigator.serviceWorker.controller.postMessage({ type: "PREFETCH_TILES", urls: tileUrls });
            }}
            disabled={downloadingTiles || !observerPosition}
            className="w-full"
            data-testid="button-download-tiles"
            data-no-close
          >
            {downloadingTiles ? (
              <>
                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                Downloading...
              </>
            ) : (
              <>
                <MapPinned className="h-3 w-3 mr-1" />
                Download Area Tiles
              </>
            )}
          </Button>
        </div>

        <Separator />

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Ruler className="h-3.5 w-3.5 text-muted-foreground" />
            <Label className="text-xs">Units</Label>
          </div>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={unitSystem === "imperial" ? "default" : "outline"}
              onClick={() => setUnitSystem("imperial")}
              className="text-[10px] px-2 h-7"
              data-testid="button-units-imperial"
              data-no-close
            >
              Imperial
            </Button>
            <Button
              size="sm"
              variant={unitSystem === "metric" ? "default" : "outline"}
              onClick={() => setUnitSystem("metric")}
              className="text-[10px] px-2 h-7"
              data-testid="button-units-metric"
              data-no-close
            >
              Metric
            </Button>
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Radar className="h-3.5 w-3.5 text-muted-foreground" />
            <Label className="text-xs">
              Stats Radius: {statsRadiusMiles === 0 ? "All Data" : unitSystem === "metric" ? `${Math.round(statsRadiusMiles * 1.60934)} km` : `${statsRadiusMiles} mi`}
            </Label>
          </div>
          <Slider
            value={[statsRadiusMiles]}
            onValueChange={([v]) => setStatsRadiusMiles(v)}
            min={0}
            max={50}
            step={1}
            data-testid="slider-stats-radius"
          />
          <p className="text-xs text-muted-foreground">
            {statsRadiusMiles === 0
              ? "Showing averages for all coverage data"
              : unitSystem === "metric"
                ? `Showing averages within ${Math.round(statsRadiusMiles * 1.60934)} km of your location`
                : `Showing averages within ${statsRadiusMiles} miles of your location`}
          </p>
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs">Smart Scanning</Label>
            <Switch
              checked={smartScanEnabled}
              onCheckedChange={setSmartScanEnabled}
              data-testid="switch-smart-scan"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Skip scanning in areas covered in the last {smartScanDays} days
          </p>
          {smartScanEnabled && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                Coverage freshness: {smartScanDays} days
              </Label>
              <Slider
                value={[smartScanDays]}
                onValueChange={([v]) => setSmartScanDays(v)}
                min={1}
                max={14}
                step={1}
                data-testid="slider-smart-scan-days"
              />
            </div>
          )}
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
            <Label className="text-xs">Dead Zones</Label>
          </div>
          <p className="text-xs text-muted-foreground">
            Mark current location as a dead zone. Dead zones always scan at the set interval.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={handleMarkDeadZone}
            className="w-full"
            data-testid="button-mark-dead-zone"
            data-no-close
          >
            <AlertTriangle className="h-3 w-3 mr-1" />
            Mark Dead Zone
          </Button>
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {online ? (
              <Wifi className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <WifiOff className="h-3.5 w-3.5 text-orange-500" />
            )}
            <Label className="text-xs">
              {online ? "Online" : "Offline Mode"}
            </Label>
          </div>
          <p className="text-xs text-muted-foreground">
            {online
              ? "Data syncs to the server in real time."
              : "Scans are saved locally and will sync when you're back online."}
          </p>
          {pendingSync > 0 && (
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-orange-500">
                {pendingSync} pending {pendingSync === 1 ? "item" : "items"} to sync
              </p>
              {online && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={syncNow}
                  disabled={syncing}
                  className="text-[10px]"
                  data-testid="button-sync-now"
                  data-no-close
                >
                  <RefreshCw className={`h-3 w-3 mr-1 ${syncing ? "animate-spin" : ""}`} />
                  {syncing ? "Syncing..." : "Sync Now"}
                </Button>
              )}
            </div>
          )}
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
            <Label className="text-xs">Delete My Data</Label>
          </div>
          {connected && selfInfo ? (
            <>
              <p className="text-xs text-muted-foreground">
                Delete all scan results and coverage zones recorded by <span className="font-medium text-foreground">{selfInfo.name}</span>
              </p>
              {!confirmDelete ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmDelete(true)}
                  className="w-full text-destructive border-destructive/30"
                  data-testid="button-delete-data"
                  data-no-close
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Delete My Data
                </Button>
              ) : (
                <div className="flex gap-2" data-no-close>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleDeleteData}
                    disabled={deleteDataMutation.isPending}
                    className="flex-1"
                    data-testid="button-confirm-delete"
                  >
                    {deleteDataMutation.isPending ? "Deleting..." : "Confirm Delete"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setConfirmDelete(false)}
                    className="flex-1"
                    data-testid="button-cancel-delete"
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              Connect to your radio to delete data recorded by that device
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
