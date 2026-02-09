import { Radio, Signal, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useI18n } from "@/lib/i18n";
import type { MeshNode, ScanResult } from "@shared/schema";

interface NodeListProps {
  nodes: MeshNode[];
  latestScans: ScanResult[];
  isLoading: boolean;
}

export function NodeList({ nodes, latestScans, isLoading }: NodeListProps) {
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

  const getSignalQuality = (rssi: number) => {
    if (rssi >= -70) return { label: t("coverage.excellent"), variant: "default" as const };
    if (rssi >= -80) return { label: t("nodes.veryGood"), variant: "default" as const };
    if (rssi >= -90) return { label: t("coverage.good"), variant: "secondary" as const };
    if (rssi >= -100) return { label: t("coverage.fair"), variant: "secondary" as const };
    if (rssi >= -110) return { label: t("coverage.poor"), variant: "destructive" as const };
    return { label: t("nodes.veryWeak"), variant: "destructive" as const };
  };
  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{t("nodes.discoveredNodes")}</span>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-3 animate-pulse">
              <div className="h-4 bg-muted rounded w-3/4 mb-2" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const scanMap = new Map<string, ScanResult>();
  latestScans.forEach((s) => {
    if (!scanMap.has(s.nodeId) || new Date(s.timestamp!) > new Date(scanMap.get(s.nodeId)!.timestamp!)) {
      scanMap.set(s.nodeId, s);
    }
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{t("nodes.discoveredNodes")}</span>
        </div>
        <Badge variant="secondary" className="text-xs">
          {nodes.length}
        </Badge>
      </div>

      <ScrollArea className="h-[280px]">
        <div className="space-y-2 pr-2">
          {nodes.length === 0 ? (
            <Card className="p-4">
              <p className="text-sm text-muted-foreground text-center">
                {t("nodes.noNodesYet")}
              </p>
            </Card>
          ) : (
            nodes.map((node) => {
              const scan = scanMap.get(node.nodeId);
              const quality = scan ? getSignalQuality(scan.rssi) : null;
              return (
                <Card
                  key={node.id}
                  className="p-3 hover-elevate cursor-default"
                  data-testid={`card-node-${node.id}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">
                          {node.name || node.nodeId}
                        </p>
                        {quality && (
                          <Badge variant={quality.variant} className="text-xs shrink-0">
                            {quality.label}
                          </Badge>
                        )}
                      </div>
                      {node.hardwareType && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {node.hardwareType}
                        </p>
                      )}
                    </div>
                  </div>

                  {scan && (
                    <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                      <div className="flex items-center gap-1">
                        <Signal className="h-3 w-3 text-muted-foreground" />
                        <span>{scan.rssi} dBm</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">SNR </span>
                        <span>{scan.snr} dB</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span>{getTimeSince(scan.timestamp)}</span>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
