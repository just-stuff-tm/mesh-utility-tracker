import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Menu, DollarSign, Heart } from "lucide-react";
import { CoverageMap } from "@/components/coverage-map";
import { BluetoothPanel } from "@/components/bluetooth-panel";
import { ScanStats } from "@/components/scan-stats";
import { SettingsPanel } from "@/components/settings-panel";
import { NodeList } from "@/components/node-list";
import { MapHud } from "@/components/map-hud";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useBluetoothContext } from "@/lib/bluetooth-context";
import type { CoverageZone, MeshNode, ScanResult } from "@shared/schema";

export default function MapPage() {
  const { observerPosition, autoCenter, connected } = useBluetoothContext();
  const [selectedZone, setSelectedZone] = useState<CoverageZone | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

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

  const controlsContent = (
    <div className="space-y-4">
      <BluetoothPanel />
      <NodeList
        nodes={nodes}
        latestScans={latestScans}
        isLoading={nodesLoading}
      />
      <SettingsPanel />
    </div>
  );

  return (
    <div className="flex h-full">
      <div className="flex-1 relative">
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

        <a
          href="https://cash.app/$yuptm"
          target="_blank"
          rel="noopener noreferrer"
          className="absolute top-3 right-3 z-[1000] flex items-center gap-1.5 rounded-md bg-gradient-to-r from-emerald-500/15 to-green-500/15 backdrop-blur-sm border border-emerald-500/25 px-2.5 py-1.5 transition-all duration-200 hover:from-emerald-500/25 hover:to-green-500/25 hover:border-emerald-500/40 text-center"
          data-testid="link-support-floating"
        >
          <Heart className="h-3 w-3 text-emerald-500" />
          <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            Support
          </span>
        </a>

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
