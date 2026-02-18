import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { Activity, Signal, Clock, MapPin, Radio, Mountain, Map, Filter, Search, X, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useBluetoothContext } from "@/lib/bluetooth-context";
import { useI18n } from "@/lib/i18n";
import { snapToHexGrid, hexKey } from "@shared/grid";
import { fetchRawScans, convertToScanResults, type ScanResult, type RawScan } from "@/lib/scan-aggregator";
import { db, type LocalScanResult } from "@/lib/offline-store";
import { useOfflineStatus } from "@/lib/use-offline";

function formatAltitude(meters: number | null, units: "imperial" | "metric"): string | null {
  if (meters == null) return null;
  if (units === "imperial") return `${Math.round(meters * 3.28084)} ft`;
  return `${Math.round(meters)} m`;
}

export default function HistoryPage() {
  const { t } = useI18n();
  const [, navigate] = useLocation();
  const { online, forceOffline } = useOfflineStatus();
  const searchString = useSearch();
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedHex, setSelectedHex] = useState<{ lat: number; lng: number } | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [nodeSearch, setNodeSearch] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const formatTime = (date: string | Date | null): string => {
    if (!date) return t("time.unknown");
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleString();
  };
  const { unitSystem } = useBluetoothContext();

  function getSignalBadge(rssi: number): { label: string; variant: "default" | "secondary" | "destructive" } {
    if (rssi >= -70) return { label: t("coverage.excellent"), variant: "default" };
    if (rssi >= -80) return { label: t("nodes.veryGood"), variant: "default" };
    if (rssi >= -90) return { label: t("coverage.good"), variant: "secondary" };
    if (rssi >= -100) return { label: t("coverage.fair"), variant: "secondary" };
    if (rssi >= -110) return { label: t("coverage.poor"), variant: "destructive" };
    return { label: t("nodes.veryWeak"), variant: "destructive" };
  }

  function handleViewOnMap(scan: ScanResult) {
    const { snapLat, snapLng } = snapToHexGrid(scan.latitude, scan.longitude);
    navigate(`/?lat=${snapLat}&lng=${snapLng}`);
  }

  const workerUrl = import.meta.env.VITE_WORKER_URL || "http://127.0.0.1:8787";

  const { data: rawScans = [], isLoading: rawLoading } = useQuery({
    queryKey: ["raw-scans", workerUrl, online, forceOffline],
    queryFn: async (): Promise<RawScan[]> => {
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

      try {
        const workerScans = await fetchRawScans(workerUrl);
        return [...workerScans, ...localRawScans];
      } catch (err) {
        return localRawScans;
      }
    },
    refetchInterval: 30000,
  });

  const scans = useMemo(() => convertToScanResults(rawScans), [rawScans]);
  const isLoading = rawLoading;

  interface NodeEntry { nodeId: string; name: string; count: number }

  const nodes = useMemo((): NodeEntry[] => {
    const nodeMap: Record<string, NodeEntry> = {};
    for (const scan of scans) {
      if (!scan.nodeId) continue;
      const existing = nodeMap[scan.nodeId];
      if (existing) {
        existing.count++;
        // Prefer non-"Unknown" names
        if (scan.senderName && !scan.senderName.startsWith("Unknown (")) {
          existing.name = scan.senderName;
        }
      } else {
        nodeMap[scan.nodeId] = {
          nodeId: scan.nodeId,
          name: scan.senderName || scan.nodeId,
          count: 1,
        };
      }
    }
    // Sort by count descending (most scanned first), then alphabetically
    return Object.values(nodeMap).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name);
    });
  }, [scans]);

  const filteredNodes = nodes.filter(
    (n) =>
      n.name.toLowerCase().includes(nodeSearch.toLowerCase()) ||
      n.nodeId.toLowerCase().includes(nodeSearch.toLowerCase())
  );

  const filtered = useMemo(() => {
    let results = scans;
    if (selectedNode) {
      results = results.filter((s) => s.nodeId === selectedNode);
    }
    if (selectedHex) {
      const targetKey = hexKey(selectedHex.lat, selectedHex.lng);
      results = results.filter((s) => hexKey(s.latitude, s.longitude) === targetKey);
    }
    return [...results].sort(
      (a, b) => new Date(b.timestamp!).getTime() - new Date(a.timestamp!).getTime()
    );
  }, [scans, selectedNode, selectedHex]);

  const selectedNodeName = selectedNode
    ? nodes.find((n) => n.nodeId === selectedNode)?.name || selectedNode
    : null;

  const hexCoordsDisplay = selectedHex
    ? `${selectedHex.lat.toFixed(4)}, ${selectedHex.lng.toFixed(4)}`
    : null;

  // Handle URL query params for pre-filtering
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const nodeId = params.get("nodeId");
    const hexLat = params.get("hexLat");
    const hexLng = params.get("hexLng");
    
    if (nodeId && nodeId !== selectedNode) {
      setSelectedNode(nodeId);
      setSelectedHex(null);
    } else if (hexLat && hexLng) {
      const lat = parseFloat(hexLat);
      const lng = parseFloat(hexLng);
      if (!isNaN(lat) && !isNaN(lng)) {
        setSelectedHex({ lat, lng });
        setSelectedNode(null);
      }
    }
    
    // Clear URL param after applying
    if ((nodeId || (hexLat && hexLng)) && window.history.replaceState) {
      window.history.replaceState(null, "", "/history");
    }
  }, [searchString]);

  useEffect(() => {
    if (filterOpen) {
      setNodeSearch("");
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [filterOpen]);

  useEffect(() => {
    if (!filterOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [filterOpen]);

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">{t("history.scanHistory")}</h1>
          <p className="text-sm text-muted-foreground">
            {selectedNodeName
              ? `${t("coverage.showingNode", { name: selectedNodeName })}`
              : hexCoordsDisplay
              ? `Showing scans in hex: ${hexCoordsDisplay}`
              : t("history.allRecorded")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" data-testid="text-scan-count">
            {filtered.length} {t("history.scans")}
          </Badge>
          <div className="relative" ref={dropdownRef}>
            <Button
              size="icon"
              variant={selectedNode || selectedHex ? "default" : "secondary"}
              onClick={() => setFilterOpen(!filterOpen)}
              data-testid="button-node-filter-toggle"
              className="toggle-elevate"
            >
              <Filter className="h-4 w-4" />
            </Button>
            {filterOpen && (
              <Card
                className="absolute right-0 top-full mt-1 p-2 flex flex-col w-[240px] max-w-[calc(100vw-32px)] z-50"
                style={{ maxHeight: "min(380px, 50vh)" }}
              >
                <div className="flex items-center justify-between mb-1.5 px-1 shrink-0 gap-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    {t("coverage.filterByNode")}
                  </p>
                  {(selectedNode || selectedHex) && (
                    <button
                      onClick={() => {
                        setSelectedNode(null);
                        setSelectedHex(null);
                        setFilterOpen(false);
                      }}
                      className="text-xs text-muted-foreground hover-elevate rounded-md px-2 py-1 flex items-center gap-1"
                      data-testid="button-clear-node-filter"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <div className="relative mb-1.5 shrink-0">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={nodeSearch}
                    onChange={(e) => setNodeSearch(e.target.value)}
                    placeholder={t("coverage.searchNodes")}
                    className="w-full bg-muted/50 border border-border rounded-md text-sm pl-7 pr-2 py-1.5 outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/60"
                    data-testid="input-search-nodes"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                  />
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: "touch" }}>
                  <div className="space-y-0.5 pr-1">
                    {!nodeSearch && (
                      <button
                        className={`w-full text-left text-sm px-2 py-2.5 rounded-md transition-colors ${
                          !selectedNode ? "bg-muted font-medium" : "hover-elevate"
                        }`}
                        onClick={() => {
                          setSelectedNode(null);
                          setFilterOpen(false);
                        }}
                        data-testid="button-filter-all-nodes"
                      >
                        {t("coverage.allNodes")}
                      </button>
                    )}
                    {filteredNodes.map((node) => (
                      <button
                        key={node.nodeId}
                        className={`w-full text-left text-sm px-2 py-2.5 rounded-md truncate transition-colors flex items-center justify-between gap-2 ${
                          selectedNode === node.nodeId ? "bg-muted font-medium" : "hover-elevate"
                        }`}
                        onClick={() => {
                          setSelectedNode(node.nodeId);
                          setFilterOpen(false);
                        }}
                        data-testid={`button-filter-node-${node.nodeId}`}
                      >
                        <span className="truncate">{node.name}</span>
                        <Badge variant="secondary" className="text-[10px] shrink-0">
                          {node.count}
                        </Badge>
                      </button>
                    ))}
                    {filteredNodes.length === 0 && nodeSearch && (
                      <p className="text-xs text-muted-foreground px-2 py-2 text-center">
                        No results
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i} className="p-4">
              <div className="flex gap-4">
                <Skeleton className="h-10 w-10 rounded-md" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center">
          <Activity className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">{t("history.noResults")}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {t("history.resultsAfterScan")}
          </p>
        </Card>
      ) : (
        <ScrollArea className="h-[calc(100vh-180px)]">
          <div className="space-y-2 pr-2">
            {filtered.map((scan) => {
              const quality = getSignalBadge(scan.rssi);
              return (
                <Card
                  key={scan.id}
                  className="p-3 hover-elevate cursor-pointer"
                  data-testid={`card-scan-${scan.id}`}
                  onClick={() => handleViewOnMap(scan)}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                      <Signal className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium truncate">
                          {scan.senderName || scan.nodeId}
                        </span>
                        <Badge variant={quality.variant} className="text-xs">
                          {quality.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                        <User className="h-3 w-3 shrink-0" />
                        <span className="truncate" data-testid={`text-observer-${scan.id}`}>
                          {scan.receiverName || scan.observerId || "Unknown"}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 mt-1.5 text-xs">
                        <div className="flex items-center gap-1">
                          <Signal className="h-3 w-3 text-muted-foreground" />
                          <span>{scan.rssi} dBm</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Radio className="h-3 w-3 text-muted-foreground" />
                          <span>SNR {scan.snr} dB</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          <span>{scan.latitude.toFixed(4)}, {scan.longitude.toFixed(4)}</span>
                        </div>
                        {scan.altitude != null && (
                          <div className="flex items-center gap-1" data-testid={`text-altitude-${scan.id}`}>
                            <Mountain className="h-3 w-3 text-muted-foreground" />
                            <span>{formatAltitude(scan.altitude, unitSystem)}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span>{formatTime(scan.timestamp)}</span>
                        </div>
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="shrink-0 mt-1"
                      title={t("coverage.viewOnMap")}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewOnMap(scan);
                      }}
                      data-testid={`button-view-map-${scan.id}`}
                    >
                      <Map className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
