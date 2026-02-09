import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { Settings, Filter, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { CoverageMap } from "@/components/coverage-map";
import { BluetoothPanel } from "@/components/bluetooth-panel";
import { ScanStats } from "@/components/scan-stats";
import { SettingsPanel } from "@/components/settings-panel";
import { NodeList } from "@/components/node-list";
import { MapHud } from "@/components/map-hud";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useBluetoothContext } from "@/lib/bluetooth-context";
import { publicKeyHex } from "@/lib/bluetooth";
import { snapToHexGrid } from "@shared/grid";
import type { CoverageZone, MeshNode, ScanResult } from "@shared/schema";

export default function MapPage() {
  const { t } = useI18n();
  const { toast } = useToast();
  const { observerPosition, autoCenter, setAutoCenter, connected, selfInfo, statsRadiusMiles, unitSystem } = useBluetoothContext();
  const [selectedZone, setSelectedZone] = useState<CoverageZone | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [filterNodeId, setFilterNodeId] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [flyToTarget, setFlyToTarget] = useState<{ lat: number; lng: number } | null>(null);

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

  const { data: coverageZones = [] } = useQuery<CoverageZone[]>({
    queryKey: ["/api/coverage-zones"],
    refetchInterval: 30000,
  });

  const { data: nodes = [], isLoading: nodesLoading } = useQuery<MeshNode[]>({
    queryKey: ["/api/nodes"],
    refetchInterval: 15000,
  });

  const { data: latestScans = [] } = useQuery<ScanResult[]>({
    queryKey: ["/api/scan-results", "latest"],
    refetchInterval: 15000,
  });

  const { data: allScans = [] } = useQuery<ScanResult[]>({
    queryKey: ["/api/scan-results"],
    refetchInterval: 30000,
  });

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
    const nodeIds = new Set<string>();
    for (const scan of allScans) {
      nodeIds.add(scan.nodeId);
    }
    return Array.from(nodeIds).map((id) => {
      const node = nodes.find((n) => n.nodeId === id);
      const displayName = node?.name && !node.name.startsWith("Unknown (") ? node.name : id;
      return { nodeId: id, name: displayName };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [allScans, nodes]);

  const filteredZones = useMemo(() => {
    if (!filterNodeId) return coverageZones;
    return coverageZones.filter((zone) => {
      const key = `${zone.centerLat.toFixed(6)},${zone.centerLng.toFixed(6)}`;
      const nodeSet = zoneNodeMap.get(key);
      return nodeSet?.has(filterNodeId);
    });
  }, [coverageZones, filterNodeId, zoneNodeMap]);

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

        <div className="absolute top-14 left-12 lg:left-3 z-[1000]">
          <NodeFilter
            nodes={filterableNodes}
            selectedNodeId={filterNodeId}
            onSelect={setFilterNodeId}
            open={filterOpen}
            onToggle={() => setFilterOpen(!filterOpen)}
          />
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

interface NodeFilterProps {
  nodes: { nodeId: string; name: string }[];
  selectedNodeId: string | null;
  onSelect: (nodeId: string | null) => void;
  open: boolean;
  onToggle: () => void;
}

function NodeFilter({ nodes, selectedNodeId, onSelect, open, onToggle }: NodeFilterProps) {
  const { t } = useI18n();
  const selectedName = selectedNodeId
    ? nodes.find((n) => n.nodeId === selectedNodeId)?.name || selectedNodeId
    : null;

  if (nodes.length === 0) return null;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <Button
          size="icon"
          variant={selectedNodeId ? "default" : "secondary"}
          onClick={onToggle}
          data-testid="button-node-filter-toggle"
          className="toggle-elevate"
        >
          <Filter className="h-4 w-4" />
        </Button>
        {selectedNodeId && !open && (
          <div className="flex items-center gap-1">
            <Badge variant="secondary" className="text-xs">
              {t("coverage.showingNode", { name: selectedName || "" })}
            </Badge>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onSelect(null)}
              data-testid="button-clear-node-filter"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {open && (
        <Card className="p-2 max-w-[200px] max-h-[300px] overflow-hidden">
          <p className="text-xs font-medium text-muted-foreground mb-1.5 px-1">
            {t("coverage.filterByNode")}
          </p>
          <ScrollArea className="max-h-[260px]">
            <div className="space-y-0.5">
              <button
                className={`w-full text-left text-xs px-2 py-1.5 rounded-md transition-colors ${
                  !selectedNodeId ? "bg-muted font-medium" : "hover-elevate"
                }`}
                onClick={() => { onSelect(null); onToggle(); }}
                data-testid="button-filter-all-nodes"
              >
                {t("coverage.allNodes")}
              </button>
              {nodes.map((node) => (
                <button
                  key={node.nodeId}
                  className={`w-full text-left text-xs px-2 py-1.5 rounded-md truncate transition-colors ${
                    selectedNodeId === node.nodeId ? "bg-muted font-medium" : "hover-elevate"
                  }`}
                  onClick={() => { onSelect(node.nodeId); onToggle(); }}
                  data-testid={`button-filter-node-${node.nodeId}`}
                >
                  {node.name}
                </button>
              ))}
            </div>
          </ScrollArea>
        </Card>
      )}
    </div>
  );
}
