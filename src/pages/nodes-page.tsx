import { useQuery } from "@tanstack/react-query";
import { Radio, Signal, Clock, MapPin, Search } from "lucide-react";
import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";
import { fetchRawScans, extractNodes, convertToScanResults, type MeshNode, type ScanResult } from "@/lib/scan-aggregator";

function getSignalColor(rssi: number): string {
  if (rssi >= -60) return "text-green-500";
  if (rssi >= -70) return "text-lime-500";
  if (rssi >= -80) return "text-yellow-500";
  if (rssi >= -90) return "text-orange-500";
  return "text-red-500";
}

export default function NodesPage() {
  const { t } = useI18n();

  const getTimeSince = (date: Date | string | null): string => {
    if (!date) return t("time.unknown");
    const d = typeof date === "string" ? new Date(date) : date;
    const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
    if (seconds < 60) return t("time.sAgo", { value: seconds });
    if (seconds < 3600) return t("time.mAgo", { value: Math.floor(seconds / 60) });
    if (seconds < 86400) return t("time.hAgo", { value: Math.floor(seconds / 3600) });
    return t("time.dAgo", { value: Math.floor(seconds / 86400) });
  };
  const [search, setSearch] = useState("");

  const workerUrl = import.meta.env.VITE_WORKER_URL || "http://127.0.0.1:8787";

  const { data: rawScans = [], isLoading: rawLoading } = useQuery({
    queryKey: ["raw-scans", workerUrl],
    queryFn: () => fetchRawScans(workerUrl),
    refetchInterval: 30000,
  });

  const nodes = useMemo(() => extractNodes(rawScans), [rawScans]);
  const allScans = useMemo(() => convertToScanResults(rawScans), [rawScans]);
  const latestScans = useMemo(() => {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return allScans.filter((s) => s.timestamp.getTime() > oneDayAgo);
  }, [allScans]);
  const nodesLoading = rawLoading;

  const scanMap = new Map<string, ScanResult>();
  latestScans.forEach((s) => {
    if (!scanMap.has(s.nodeId) || new Date(s.timestamp!) > new Date(scanMap.get(s.nodeId)!.timestamp!)) {
      scanMap.set(s.nodeId, s);
    }
  });

  const filtered = nodes.filter(
    (n) =>
      (n.name || "").toLowerCase().includes(search.toLowerCase()) ||
      n.nodeId.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-4 h-full overflow-y-auto">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">{t("nodes.meshNodes")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("nodes.allDiscovered")}
          </p>
        </div>
        <Badge variant="secondary">{nodes.length} {t("nav.nodes")}</Badge>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t("nodes.searchNodes")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          data-testid="input-search-nodes"
        />
      </div>

      {nodesLoading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-5 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2 mb-3" />
              <div className="grid grid-cols-3 gap-2">
                <Skeleton className="h-8" />
                <Skeleton className="h-8" />
                <Skeleton className="h-8" />
              </div>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center">
          <Radio className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">
            {search ? t("nodes.noMatch") : t("nodes.noNodesDiscovered")}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {t("nodes.connectAndScan")}
          </p>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((node) => {
            const scan = scanMap.get(node.nodeId);
            return (
              <Card
                key={node.id}
                className="p-4 hover-elevate"
                data-testid={`card-node-detail-${node.id}`}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <h3 className="text-sm font-semibold">
                      {node.name || t("nodes.unnamedNode")}
                    </h3>
                    <p className="text-xs text-muted-foreground font-mono">
                      {node.nodeId}
                    </p>
                    {node.hardwareType && (
                      <Badge variant="secondary" className="mt-1 text-xs">
                        {node.hardwareType}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {getTimeSince(node.lastSeen)}
                    </span>
                  </div>
                </div>

                {scan ? (
                  <div className="grid grid-cols-3 gap-2">
                    <Card className="p-2 text-center">
                      <Signal className={`h-3.5 w-3.5 mx-auto mb-0.5 ${getSignalColor(scan.rssi)}`} />
                      <p className="text-xs font-semibold">{scan.rssi}</p>
                      <p className="text-[10px] text-muted-foreground">dBm</p>
                    </Card>
                    <Card className="p-2 text-center">
                      <Radio className="h-3.5 w-3.5 mx-auto mb-0.5 text-muted-foreground" />
                      <p className="text-xs font-semibold">{scan.snr}</p>
                      <p className="text-[10px] text-muted-foreground">SNR dB</p>
                    </Card>
                    <Card className="p-2 text-center">
                      <MapPin className="h-3.5 w-3.5 mx-auto mb-0.5 text-muted-foreground" />
                      <p className="text-xs font-semibold">
                        {scan.latitude.toFixed(2)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Lat</p>
                    </Card>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">{t("nodes.noScanData")}</p>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
