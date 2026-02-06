import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Menu } from "lucide-react";
import { CoverageMap } from "@/components/coverage-map";
import { BluetoothPanel } from "@/components/bluetooth-panel";
import { ScanStats } from "@/components/scan-stats";
import { SettingsPanel } from "@/components/settings-panel";
import { NodeList } from "@/components/node-list";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getCurrentPosition, watchPosition, clearWatch } from "@/lib/geolocation";
import type { CoverageZone, MeshNode, ScanResult } from "@shared/schema";

export default function MapPage() {
  const { toast } = useToast();
  const [observerPosition, setObserverPosition] = useState<[number, number] | null>(null);
  const [autoCenter, setAutoCenter] = useState(true);
  const [scanInterval, setScanInterval] = useState(40);
  const [isScanning, setIsScanning] = useState(false);
  const [smartScanEnabled, setSmartScanEnabled] = useState(true);
  const [smartScanDays, setSmartScanDays] = useState(5);
  const [selectedZone, setSelectedZone] = useState<CoverageZone | null>(null);
  const [isConnected, setIsConnected] = useState(false);

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

  const submitScanMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/scan-results", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coverage-zones"] });
      queryClient.invalidateQueries({ queryKey: ["/api/scan-results"] });
      queryClient.invalidateQueries({ queryKey: ["/api/nodes"] });
    },
  });

  const markDeadZoneMutation = useMutation({
    mutationFn: async (data: { centerLat: number; centerLng: number }) => {
      const res = await apiRequest("POST", "/api/coverage-zones/dead-zone", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coverage-zones"] });
      toast({ title: "Dead zone marked at your current location" });
    },
  });

  useEffect(() => {
    getCurrentPosition()
      .then((pos) => setObserverPosition([pos.latitude, pos.longitude]))
      .catch(() => {});

    const watchId = watchPosition(
      (pos) => setObserverPosition([pos.latitude, pos.longitude]),
      () => {}
    );
    return () => clearWatch(watchId);
  }, []);

  const handleNodeDiscovered = useCallback(
    (data: string) => {
      try {
        const parsed = JSON.parse(data);
        if (parsed.rssi !== undefined && parsed.snr !== undefined && observerPosition) {
          submitScanMutation.mutate({
            observerId: "local-observer",
            nodeId: parsed.nodeId || parsed.from || "unknown",
            rssi: parsed.rssi,
            snr: parsed.snr,
            latitude: observerPosition[0],
            longitude: observerPosition[1],
            senderName: parsed.senderName || parsed.from || null,
            receiverName: parsed.receiverName || "Observer",
          });
        }
      } catch {
        // not JSON
      }
    },
    [observerPosition, submitScanMutation]
  );

  const handleConnectionChange = useCallback((connected: boolean, deviceName: string | null) => {
    setIsConnected(connected);
    if (connected) {
      toast({ title: `Connected to ${deviceName || "radio"}` });
    }
  }, [toast]);

  const handleMarkDeadZone = useCallback(() => {
    if (!observerPosition) {
      toast({ title: "Location not available", variant: "destructive" });
      return;
    }
    markDeadZoneMutation.mutate({
      centerLat: observerPosition[0],
      centerLng: observerPosition[1],
    });
  }, [observerPosition, markDeadZoneMutation, toast]);

  const controlsContent = (
    <div className="space-y-4">
      <BluetoothPanel
        onNodeDiscovered={handleNodeDiscovered}
        onConnectionChange={handleConnectionChange}
        scanInterval={scanInterval}
        isScanning={isScanning}
        onScanToggle={() => setIsScanning((prev) => !prev)}
      />
      <NodeList
        nodes={nodes}
        latestScans={latestScans}
        isLoading={nodesLoading}
      />
      <SettingsPanel
        scanInterval={scanInterval}
        onScanIntervalChange={setScanInterval}
        autoCenter={autoCenter}
        onAutoCenterChange={setAutoCenter}
        smartScanEnabled={smartScanEnabled}
        onSmartScanChange={setSmartScanEnabled}
        smartScanDays={smartScanDays}
        onSmartScanDaysChange={setSmartScanDays}
        onMarkDeadZone={handleMarkDeadZone}
      />
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
          onZoneClick={setSelectedZone}
        />

        <div className="absolute top-3 left-3 z-[1000] lg:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button size="icon" variant="secondary" data-testid="button-mobile-controls">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[300px] p-0">
              <SheetHeader className="p-3 border-b border-border">
                <SheetTitle className="text-sm">Controls</SheetTitle>
              </SheetHeader>
              <ScrollArea className="h-[calc(100vh-60px)]">
                <div className="p-3">
                  {controlsContent}
                </div>
              </ScrollArea>
            </SheetContent>
          </Sheet>
        </div>

        <div className="absolute bottom-3 left-3 right-3 z-[1000]">
          <ScanStats
            coverageZones={coverageZones}
            totalScans={latestScans.length}
            nodes={nodes}
            isConnected={isConnected}
          />
        </div>
      </div>

      <div className="w-[300px] border-l border-border bg-background overflow-y-auto p-3 hidden lg:block">
        {controlsContent}
      </div>
    </div>
  );
}
