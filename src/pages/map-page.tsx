import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter";
import L from "leaflet";
import { Settings } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { CoverageMap } from "@/components/coverage-map";
import { BluetoothPanel } from "@/components/bluetooth-panel";
import { ScanStats } from "@/components/scan-stats";
import { SettingsPanel } from "@/components/settings-panel";
import { NodeList } from "@/components/node-list";
import { MapHud } from "@/components/map-hud";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useBluetoothContext } from "@/lib/bluetooth-context";
import { publicKeyHex } from "@/lib/bluetooth";
import { snapToHexGrid } from "@shared/grid";
import {
  fetchRawScans,
  extractNodes,
  convertToScanResults,
  aggregateScansToZones,
  type CoverageZone,
  type MeshNode,
  type ScanResult,
  type RawScan,
} from "@/lib/scan-aggregator";
import { db, type LocalScanResult } from "@/lib/offline-store";
import { useOfflineStatus } from "@/lib/use-offline";

export default function MapPage() {
  const { t } = useI18n();
  const { toast } = useToast();
  const { observerPosition, autoCenter, setAutoCenter, connected, selfInfo, statsRadiusMiles, unitSystem } = useBluetoothContext();
  const { online, forceOffline } = useOfflineStatus();
  const [selectedZone, setSelectedZone] = useState<CoverageZone | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [filterNodeId, setFilterNodeId] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [flyToTarget, setFlyToTarget] = useState<{ lat: number; lng: number } | null>(null);
  const [fitBoundsTarget, setFitBoundsTarget] = useState<L.LatLngBoundsExpression | null>(null);

  const searchString = useSearch();
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const lat = parseFloat(params.get("lat") || "");
    const lng = parseFloat(params.get("lng") || "");
    if (!isNaN(lat) && !isNaN(lng)) {
      setFlyToTarget({ lat, lng });
      if (autoCenter) {
        setAutoCenter(false);
        toast({
          title: t("toast.autoCenterOff"),
          description: t("toast.autoCenterOffDesc"),
        });
      }
      if (window.history.replaceState) {
        window.history.replaceState(null, "", "/");
      }
    }
  }, [searchString]);

  const radioId = selfInfo?.publicKey ? publicKeyHex(selfInfo.publicKey) : null;

  // Cloudflare Worker URL - configurable via env or default to localhost
  const workerUrl = import.meta.env.VITE_WORKER_URL || "http://127.0.0.1:8787";

  // Fetch raw scans from Worker and IndexedDB
  const { data: rawScans = [] } = useQuery({
    queryKey: ["raw-scans", workerUrl, online, forceOffline],
    queryFn: async (): Promise<RawScan[]> => {
      // Fetch from IndexedDB
      const localScans = await db.scanResults.toArray();
      const localRawScans: RawScan[] = localScans.map((scan: LocalScanResult) => ({
        observerId: scan.observerId,
        nodeId: scan.nodeId,
        latitude: scan.latitude,
        longitude: scan.longitude,
        rssi: scan.rssi,
        snr: scan.snr,
        snrIn: scan.snrIn ?? undefined,
        altitude: scan.altitude ?? undefined,
        timestamp: scan.timestamp ?? undefined,
        senderName: scan.senderName ?? undefined,
        receiverName: scan.receiverName ?? undefined,
        radioId: scan.radioId ?? undefined,
      }));

      // Try to fetch from Worker
      try {
        const workerScans = await fetchRawScans(workerUrl);
        // Merge: deduplicate by id if present, otherwise combine all
        const combined = [...workerScans, ...localRawScans];
        return combined;
      } catch (err) {
        console.log("[Map] Worker offline, using local scans only:", localRawScans.length);
        return localRawScans;
      }
    },
    refetchInterval: 30000,
    staleTime: 10000,
  });

  // Derive coverage zones, nodes, and scan results from raw data
  const coverageZones = useMemo(() => aggregateScansToZones(rawScans), [rawScans]);
  const nodes = useMemo(() => extractNodes(rawScans), [rawScans]);
  const allScans = useMemo(() => convertToScanResults(rawScans), [rawScans]);
  const latestScans = useMemo(() => {
    // Get scans from last 24 hours
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return allScans.filter((s) => s.timestamp.getTime() > oneDayAgo);
  }, [allScans]);
  
  const nodesLoading = false;

  const myScans = useMemo(() => {
    if (!radioId) return [];
    return latestScans.filter((s) => s.radioId === radioId);
  }, [latestScans, radioId]);

  const myNodes = useMemo(() => {
    if (!radioId) return [];
    const myNodeIds = new Set(myScans.map((s) => s.nodeId));
    return nodes.filter((n) => myNodeIds.has(n.nodeId));
  }, [nodes, myScans, radioId]);

  const zoneNodeMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const scan of allScans) {
      const { snapLat, snapLng } = snapToHexGrid(scan.latitude, scan.longitude);
      const key = `${snapLat.toFixed(6)},${snapLng.toFixed(6)}`;
      if (!map.has(key)) map.set(key, new Set());
      map.get(key)!.add(scan.nodeId);
    }
    return map;
  }, [allScans]);

  const filterableNodes = useMemo(() => {
    // Build node list with scan counts for sorting
    const nodeMap = new Map<string, { nodeId: string; name: string; count: number }>();
    
    for (const scan of allScans) {
      const existing = nodeMap.get(scan.nodeId);
      if (existing) {
        existing.count++;
        // Prefer non-"Unknown" names
        if (scan.senderName && !scan.senderName.startsWith("Unknown (")) {
          existing.name = scan.senderName;
        }
      } else {
        // Use node name from extractNodes if available, otherwise scan name
        const node = nodes.find((n) => n.nodeId === scan.nodeId);
        const nodeName = node?.name && !node.name.startsWith("Unknown (") ? node.name : null;
        const scanName = scan.senderName && !scan.senderName.startsWith("Unknown (") ? scan.senderName : null;
        
        nodeMap.set(scan.nodeId, {
          nodeId: scan.nodeId,
          name: nodeName || scanName || scan.nodeId,
          count: 1,
        });
      }
    }
    
    // Sort by count descending (most scanned first), then alphabetically
    return Array.from(nodeMap.values()).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name);
    });
  }, [allScans, nodes]);

  const filteredZones = useMemo(() => {
    if (!filterNodeId) return coverageZones;
    return coverageZones.filter((zone) => {
      const key = `${zone.centerLat.toFixed(6)},${zone.centerLng.toFixed(6)}`;
      const nodeSet = zoneNodeMap.get(key);
      return nodeSet?.has(filterNodeId);
    });
  }, [coverageZones, filterNodeId, zoneNodeMap]);

  const handleFilterSelect = useCallback((nodeId: string | null) => {
    setFilterNodeId(nodeId);
    if (nodeId) {
      const zones = coverageZones.filter((zone) => {
        const key = `${zone.centerLat.toFixed(6)},${zone.centerLng.toFixed(6)}`;
        const nodeSet = zoneNodeMap.get(key);
        return nodeSet?.has(nodeId);
      });
      if (zones.length > 0) {
        const lats = zones.map((z) => z.centerLat);
        const lngs = zones.map((z) => z.centerLng);
        const bounds: L.LatLngBoundsExpression = [
          [Math.min(...lats) - 0.001, Math.min(...lngs) - 0.001],
          [Math.max(...lats) + 0.001, Math.max(...lngs) + 0.001],
        ];
        if (autoCenter) {
          setAutoCenter(false);
          toast({
            title: t("toast.autoCenterOff"),
            description: t("toast.autoCenterOffDesc"),
          });
        }
        setFitBoundsTarget(bounds);
      }
    } else {
      setFitBoundsTarget(null);
    }
  }, [coverageZones, zoneNodeMap, autoCenter, setAutoCenter, toast, t]);

  const controlsContent = (
    <div className="space-y-4">
      <BluetoothPanel />
      <NodeList
        nodes={myNodes}
        latestScans={myScans}
        isLoading={nodesLoading}
      />
      <SettingsPanel />
    </div>
  );

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 relative min-h-0">
        <CoverageMap
          coverageZones={filteredZones}
          observerPosition={observerPosition}
          autoCenter={autoCenter}
          selectedZone={selectedZone}
          filterNodes={filterableNodes}
          filterNodeId={filterNodeId}
          onFilterSelect={handleFilterSelect}
          filterOpen={filterOpen}
          onFilterToggle={() => setFilterOpen(!filterOpen)}
          fitBoundsTarget={fitBoundsTarget}
          allScans={allScans}
          nodes={nodes}
          onZoneClick={(zone) => {
            setSelectedZone(zone);
            setSheetOpen(false);
            if (autoCenter) {
              setAutoCenter(false);
              toast({
                title: t("toast.autoCenterOff"),
                description: t("toast.autoCenterOffDesc"),
              });
            }
          }}
          flyToTarget={flyToTarget}
        />

        <div className="absolute top-3 left-12 lg:left-3 z-[1000] max-w-[240px]">
          <MapHud />
        </div>

        <div className="absolute top-3 left-3 z-[1000] lg:hidden">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button size="icon" variant="secondary" data-testid="button-mobile-controls">
                <Settings className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-[300px] p-0"
              onInteractOutside={() => setSheetOpen(false)}
            >
              <SheetHeader className="p-3 border-b border-border">
                <SheetTitle className="text-sm">{t("mapPage.settings")}</SheetTitle>
              </SheetHeader>
              <ScrollArea className="h-[calc(100vh-60px)]">
                <div
                  className="p-3 pb-8"
                  onClick={(e) => {
                    const target = e.target as HTMLElement;
                    const isSlider = target.closest("[role='slider']") || target.closest("[data-orientation]");
                    const isSwitch = target.closest("[role='switch']");
                    const isConnectBtn = target.closest("[data-testid='button-connect-bluetooth']");
                    const isNoClose = target.closest("[data-no-close]");
                    if (isConnectBtn || isNoClose) return;
                    if (!connected) return;
                    if (!isSlider && !isSwitch && (target.closest("button") || target.closest("a"))) {
                      setTimeout(() => setSheetOpen(false), 300);
                    }
                  }}
                >
                  {controlsContent}
                </div>
              </ScrollArea>
            </SheetContent>
          </Sheet>
        </div>


        <div className="absolute bottom-3 left-3 z-[1001] max-w-[400px]">
          <ScanStats
            coverageZones={coverageZones}
            totalScans={latestScans.length}
            nodes={nodes}
            isConnected={connected}
            observerPosition={observerPosition}
            statsRadiusMiles={statsRadiusMiles}
            unitSystem={unitSystem}
          />
        </div>
      </div>
      <div className="w-[300px] border-l border-border bg-background hidden lg:flex flex-col">
        <ScrollArea className="flex-1">
          <div className="p-3 pb-8">
            {controlsContent}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

