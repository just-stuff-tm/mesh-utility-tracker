import { useState, useEffect } from "react";
import { Settings, Timer, AlertTriangle, Trash2, Radar, Ruler, Wifi, WifiOff, Download, RefreshCw, MapPinned, Radio, Globe } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBluetoothContext } from "@/lib/bluetooth-context";
import { publicKeyHex, signWithRadio } from "@/lib/bluetooth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, isQueuedResponse, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { useOfflineStatus } from "@/lib/use-offline";
import { db } from "@/lib/offline-store";
import { usePrivacyContext } from "@/App";
import { useI18n, LANGUAGES, type Language } from "@/lib/i18n";

export function SettingsPanel() {
  const { toast } = useToast();
  const { t, language, setLanguage } = useI18n();
  const { requireAcceptance } = usePrivacyContext();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tileCacheCount, setTileCacheCount] = useState<number | null>(null);
  const [downloadingTiles, setDownloadingTiles] = useState(false);
  const [tileCachingEnabled, setTileCachingEnabled] = useState(() => {
    const stored = localStorage.getItem("mesh-tile-caching");
    return stored === null ? false : stored === "true";
  });
  const { online, pendingSync, syncing, syncNow, forceOffline, toggleForceOffline } = useOfflineStatus();
  const {
    scanInterval,
    setScanInterval,
    updateRadioPosition,
    setUpdateRadioPosition,
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
    uploadBatchInterval,
    setUploadBatchInterval,
    queuedScansCount,
    lastUploadTime,
    manualSync,
  } = useBluetoothContext();

  const workerUrl = import.meta.env.VITE_WORKER_URL || "http://127.0.0.1:8787";

  const bytesToHex = (bytes: Uint8Array): string =>
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();

  const deleteDataMutation = useMutation({
    mutationFn: async ({ radioId, publicKey }: { radioId: string; publicKey: string }) => {
      const challengeRes = await fetch(`${workerUrl}/delete/challenge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ radioId, publicKey }),
      });

      if (!challengeRes.ok) {
        const text = await challengeRes.text();
        throw new Error(text || "Failed to request delete challenge");
      }

      const challengeData = await challengeRes.json() as { challenge: string; expiresAt: number };
      if (!challengeData?.challenge) {
        throw new Error("Delete challenge missing from server");
      }

      const signature = await signWithRadio(new TextEncoder().encode(challengeData.challenge));
      if (!signature) {
        throw new Error("Radio could not sign delete challenge");
      }

      const verifyRes = await fetch(`${workerUrl}/delete/${encodeURIComponent(radioId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicKey,
          challenge: challengeData.challenge,
          signature: bytesToHex(signature),
        }),
      });

      if (!verifyRes.ok) {
        const text = await verifyRes.text();
        throw new Error(text || "Delete verification failed");
      }

      return await verifyRes.json() as {
        success: boolean;
        d1Deleted: number;
        pendingRemoved: number;
        csvRowsRemoved: number;
      };
    },
    onSuccess: async (_, vars) => {
      await db.scanResults.where("radioId").equals(vars.radioId).delete();
      await db.coverageZones.where("radioId").equals(vars.radioId).delete();

      const outboxEntries = await db.outbox.toArray();
      for (const entry of outboxEntries) {
        const payload = entry.payload as any;
        if (
          Array.isArray(payload) &&
          payload.some((scan) => scan?.radioId === vars.radioId)
        ) {
          await db.outbox.delete(entry.id!);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["raw-scans"] });
      toast({ title: t("toast.dataDeleted") });
      setConfirmDelete(false);
    },
    onError: (err: any) => {
      toast({
        title: t("toast.deleteFailed"),
        description: err?.message || undefined,
        variant: "destructive",
      });
    },
  });

  const handleDeleteData = () => {
    if (!selfInfo?.publicKey) return;
    if (!online) {
      toast({
        title: t("toast.deleteFailed"),
        description: t("settings.noNetworkDesc"),
        variant: "destructive",
      });
      return;
    }
    const radioId = publicKeyHex(selfInfo.publicKey);
    const fullPublicKey = bytesToHex(selfInfo.publicKey);
    deleteDataMutation.mutate({ radioId, publicKey: fullPublicKey });
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
        toast({ title: t("toast.deadZoneQueued") });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/coverage-zones"] });
      toast({ title: t("toast.deadZoneMarked") });
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
      navigator.serviceWorker.controller.postMessage({ type: "SET_TILE_CACHING", enabled: tileCachingEnabled });
    }
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, []);

  const handleTileCachingToggle = (enabled: boolean) => {
    setTileCachingEnabled(enabled);
    localStorage.setItem("mesh-tile-caching", String(enabled));
    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: "SET_TILE_CACHING", enabled });
    }
  };

  const handleClearTileCache = () => {
    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: "CLEAR_TILE_CACHE" });
      toast({ title: t("toast.tileCacheCleared") });
    }
  };

  const handleMarkDeadZone = () => {
    if (!observerPosition) {
      toast({ title: t("settings.locationNotAvail"), variant: "destructive" });
      return;
    }
    markDeadZoneMutation.mutate({
      centerLat: observerPosition[0],
      centerLng: observerPosition[1],
    });
  };

  const statsRadiusValue = statsRadiusMiles === 0
    ? t("settings.statsRadiusAll")
    : unitSystem === "metric"
      ? `${Math.round(statsRadiusMiles * 1.60934)} km`
      : `${statsRadiusMiles} mi`;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Settings className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">{t("settings.title")}</span>
      </div>

      <Card className="p-3 space-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Timer className="h-3.5 w-3.5 text-muted-foreground" />
            <Label className="text-xs">{t("settings.scanInterval", { value: scanInterval })}</Label>
          </div>
          <Slider
            value={[scanInterval]}
            onValueChange={([v]) => setScanInterval(v)}
            min={20}
            max={300}
            step={10}
            data-testid="slider-scan-interval"
          />
          <p className="text-xs text-muted-foreground">
            {t("settings.scanIntervalMin")}
          </p>
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs">{t("settings.smartScanning")}</Label>
            <Switch
              checked={smartScanEnabled}
              onCheckedChange={setSmartScanEnabled}
              data-testid="switch-smart-scan"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {t("settings.smartScanDesc", { days: smartScanDays })}
          </p>
          {smartScanEnabled && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                {t("settings.coverageFreshness", { days: smartScanDays })}
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
          <p className="text-xs text-muted-foreground">
            {smartScanEnabled
              ? t("settings.smartScanOnHelp", { days: smartScanDays })
              : t("settings.smartScanOffHelp")}
          </p>
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Radio className="h-3.5 w-3.5 text-muted-foreground" />
              <Label className="text-xs">{t("settings.updateRadioPos")}</Label>
            </div>
            <Switch
              checked={updateRadioPosition}
              onCheckedChange={setUpdateRadioPosition}
              data-testid="switch-update-radio-position"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {updateRadioPosition
              ? t("settings.updateRadioPosOn")
              : t("settings.updateRadioPosOff")}
          </p>
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Download className="h-3.5 w-3.5 text-muted-foreground" />
              <Label className="text-xs" data-testid="label-offline-tiles">{t("settings.offlineMapTiles")}</Label>
            </div>
            <Switch
              checked={tileCachingEnabled}
              onCheckedChange={handleTileCachingToggle}
              data-testid="switch-tile-caching"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {tileCachingEnabled
              ? t("settings.tileCachingOn")
              : t("settings.tileCachingOff")}
          </p>
          {tileCacheCount !== null && (
            <p className="text-xs text-muted-foreground">
              {t("settings.tilesCached", { count: tileCacheCount })}
            </p>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (!observerPosition) {
                toast({ title: t("settings.locationNotAvail"), variant: "destructive" });
                return;
              }
              if (!("serviceWorker" in navigator) || !navigator.serviceWorker.controller) {
                toast({ title: t("settings.swNotReady"), variant: "destructive" });
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
                    title: t("toast.tilesDownloaded"),
                    description: `Cached ${e.data.count} new tiles (${e.data.total} total requested)`,
                  });
                  navigator.serviceWorker.removeEventListener("message", handler);
                  navigator.serviceWorker.controller?.postMessage({ type: "GET_TILE_CACHE_SIZE" });
                }
              };
              navigator.serviceWorker.addEventListener("message", handler);
              navigator.serviceWorker.controller.postMessage({ type: "PREFETCH_TILES", urls: tileUrls });
            }}
            disabled={downloadingTiles || !observerPosition || !tileCachingEnabled}
            className="w-full"
            data-testid="button-download-tiles"
            data-no-close
          >
            {downloadingTiles ? (
              <>
                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                {t("settings.downloading")}
              </>
            ) : (
              <>
                <MapPinned className="h-3 w-3 mr-1" />
                {t("settings.downloadAreaTiles")}
              </>
            )}
          </Button>
          {tileCacheCount !== null && tileCacheCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleClearTileCache}
              className="w-full text-destructive border-destructive/30"
              data-testid="button-clear-tile-cache"
              data-no-close
            >
              <Trash2 className="h-3 w-3 mr-1" />
              {t("settings.clearTileCache")}
            </Button>
          )}
        </div>

        <Separator />

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Ruler className="h-3.5 w-3.5 text-muted-foreground" />
            <Label className="text-xs">{t("settings.units")}</Label>
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
              {t("settings.imperial")}
            </Button>
            <Button
              size="sm"
              variant={unitSystem === "metric" ? "default" : "outline"}
              onClick={() => setUnitSystem("metric")}
              className="text-[10px] px-2 h-7"
              data-testid="button-units-metric"
              data-no-close
            >
              {t("settings.metric")}
            </Button>
          </div>
        </div>

        <Separator />

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Globe className="h-3.5 w-3.5 text-muted-foreground" />
            <Label className="text-xs">{t("settings.language")}</Label>
          </div>
          <Select value={language} onValueChange={(v) => setLanguage(v as Language)}>
            <SelectTrigger className="w-[130px] h-8 text-xs" data-testid="select-language" data-no-close>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(LANGUAGES).map(([code, name]) => (
                <SelectItem key={code} value={code} data-testid={`option-lang-${code}`}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Radar className="h-3.5 w-3.5 text-muted-foreground" />
            <Label className="text-xs">
              {t("settings.statsRadius", { value: statsRadiusValue })}
            </Label>
          </div>
          <Slider
            value={[statsRadiusMiles]}
            onValueChange={([v]) => setStatsRadiusMiles(v)}
            min={0}
            max={1000}
            step={5}
            data-testid="slider-stats-radius"
          />
          <p className="text-xs text-muted-foreground">
            {statsRadiusMiles === 0
              ? t("settings.statsRadiusAllDesc")
              : t("settings.statsRadiusDesc", {
                  value: unitSystem === "metric"
                    ? `${Math.round(statsRadiusMiles * 1.60934)} km`
                    : `${statsRadiusMiles} miles`
                })}
          </p>
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
            <Label className="text-xs">{t("settings.deadZones")}</Label>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("settings.deadZoneDesc")}
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
            {t("settings.markDeadZone")}
          </Button>
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {online ? (
                <Wifi className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <WifiOff className="h-3.5 w-3.5 text-orange-500" />
              )}
              <Label className="text-xs">
                {online ? t("settings.onlineMode") : t("settings.offlineMode")}
              </Label>
            </div>
            <Switch
              checked={!forceOffline}
              onCheckedChange={(checked) => {
                if (checked) {
                  const allowed = requireAcceptance(() => {
                    toggleForceOffline(false);
                  });
                  if (allowed) {
                    toggleForceOffline(false);
                  }
                } else {
                  toggleForceOffline(true);
                }
              }}
              data-testid="switch-online-offline"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {forceOffline
              ? t("settings.forceOfflineDesc")
              : online
                ? t("settings.onlineDesc")
                : t("settings.noNetworkDesc")}
          </p>
          {pendingSync > 0 && (
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-orange-500">
                {t("settings.pendingItems", { count: pendingSync, items: pendingSync === 1 ? t("settings.item") : t("settings.items") })}
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
                  {syncing ? t("settings.syncing") : t("settings.syncNow")}
                </Button>
              )}
            </div>
          )}
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
            <Label className="text-xs">Upload Interval: {uploadBatchInterval} min</Label>
          </div>
          <Slider
            value={[uploadBatchInterval]}
            onValueChange={([v]) => setUploadBatchInterval(v)}
            min={5}
            max={60}
            step={5}
            data-testid="slider-upload-interval"
          />
          <p className="text-xs text-muted-foreground">
            {queuedScansCount} scans queued • Next upload in {Math.max(0, Math.ceil((uploadBatchInterval * 60 * 1000 - (Date.now() - lastUploadTime)) / 60000))} min
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              try {
                await manualSync();
                toast({ title: "Scans uploaded successfully" });
              } catch (err: any) {
                toast({ title: err.message || "Sync failed", variant: "destructive" });
              }
            }}
            disabled={queuedScansCount === 0 || !online}
            className="w-full"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-2" />
            Sync Now ({queuedScansCount})
          </Button>
        </div>

        <Separator />

        <div className="space-y-2">
          <Label className="text-xs">Clear Local Data</Label>
          <Button
            size="sm"
            variant="destructive"
            onClick={async () => {
              if (!confirm("Clear all locally cached scans and zones? This cannot be undone and only affects data on this device.")) return;
              try {
                await db.scanResults.clear();
                await db.coverageZones.clear();
                await db.outbox.clear();
                toast({ title: "Local cache cleared successfully" });
              } catch (err) {
                toast({ title: "Failed to clear cache", variant: "destructive" });
              }
            }}
            className="w-full"
          >
            <Trash2 className="h-3.5 w-3.5 mr-2" />
            Clear Scan Cache
          </Button>
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
            <Label className="text-xs">{t("settings.deleteMyData")}</Label>
          </div>
          {connected && selfInfo ? (
            <>
              <p className="text-xs text-muted-foreground">
                {t("settings.deleteDesc")} <span className="font-medium text-foreground">{selfInfo.name}</span>
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
                  {t("settings.deleteData")}
                </Button>
              ) : (
                <div className="flex gap-2" data-no-close>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleDeleteData}
                    disabled={deleteDataMutation.isPending || !online}
                    className="flex-1"
                    data-testid="button-confirm-delete"
                  >
                    {deleteDataMutation.isPending ? t("settings.deleting") : t("settings.confirmDelete")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setConfirmDelete(false)}
                    className="flex-1"
                    data-testid="button-cancel-delete"
                  >
                    {t("settings.cancel")}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              {t("settings.connectToDelete")}
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
