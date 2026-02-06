import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Menu } from "lucide-react";
import { CoverageMap } from "@/components/coverage-map";
import { BluetoothPanel } from "@/components/bluetooth-panel";
import { ScanStats } from "@/components/scan-stats";
import { SettingsPanel } from "@/components/settings-panel";
import { NodeList } from "@/components/node-list";
import { MapHud } from "@/components/map-hud";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useBluetoothContext } from "@/lib/bluetooth-context";
import { publicKeyHex } from "@/lib/bluetooth";
import type { CoverageZone, MeshNode, ScanResult } from "@shared/schema";

export default function MapPage() {
  const { observerPosition, autoCenter, connected, selfInfo } = useBluetoothContext();
  const [selectedZone, setSelectedZone] = useState<CoverageZone | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

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

  const myScans = useMemo(() => {
    if (!radioId) return [];
    return latestScans.filter((s) => s.radioId === radioId);
  }, [latestScans, radioId]);

  const myNodes = useMemo(() => {
    if (!radioId) return [];
    const myNodeIds = new Set(myScans.map((s) => s.nodeId));
    return nodes.filter((n) => myNodeIds.has(n.nodeId));
  }, [nodes, myScans, radioId]);

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
          coverageZones={coverageZones}
          observerPosition={observerPosition}
          autoCenter={autoCenter}
          selectedZone={selectedZone}
          onZoneClick={(zone) => {
            setSelectedZone(zone);
            setSheetOpen(false);
          }}
        />

        <div className="absolute top-3 left-12 lg:left-3 z-[1000] max-w-[240px]">
          <MapHud />
        </div>

        <div className="absolute top-3 left-3 z-[1000] lg:hidden">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button size="icon" variant="secondary" data-testid="button-mobile-controls">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-[300px] p-0"
              onInteractOutside={() => setSheetOpen(false)}
            >
              <SheetHeader className="p-3 border-b border-border">
                <SheetTitle className="text-sm">Controls</SheetTitle>
              </SheetHeader>
              <ScrollArea className="h-[calc(100vh-60px)]">
                <div
                  className="p-3 pb-8"
                  onClick={(e) => {
                    const target = e.target as HTMLElement;
                    const isSlider = target.closest("[role='slider']") || target.closest("[data-orientation]");
                    const isSwitch = target.closest("[role='switch']");
                    const isConnectBtn = target.closest("[data-testid='button-connect-bluetooth']");
                    if (isConnectBtn) return;
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
