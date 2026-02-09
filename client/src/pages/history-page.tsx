import { useQuery } from "@tanstack/react-query";
import { Activity, Signal, Clock, MapPin, Radio, Mountain } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useBluetoothContext } from "@/lib/bluetooth-context";
import { useI18n } from "@/lib/i18n";
import type { ScanResult } from "@shared/schema";

function formatAltitude(meters: number | null, units: "imperial" | "metric"): string | null {
  if (meters == null) return null;
  if (units === "imperial") return `${Math.round(meters * 3.28084)} ft`;
  return `${Math.round(meters)} m`;
}

export default function HistoryPage() {
  const { t } = useI18n();

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
  const { data: scans = [], isLoading } = useQuery<ScanResult[]>({
    queryKey: ["/api/scan-results"],
  });

  const sorted = [...scans].sort(
    (a, b) => new Date(b.timestamp!).getTime() - new Date(a.timestamp!).getTime()
  );

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">{t("history.scanHistory")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("history.allRecorded")}
          </p>
        </div>
        <Badge variant="secondary">{scans.length} {t("history.scans")}</Badge>
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
      ) : sorted.length === 0 ? (
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
            {sorted.map((scan) => {
              const quality = getSignalBadge(scan.rssi);
              return (
                <Card
                  key={scan.id}
                  className="p-3 hover-elevate"
                  data-testid={`card-scan-${scan.id}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                      <Signal className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium truncate">
                          {t("history.node")}: {scan.nodeId}
                        </span>
                        <Badge variant={quality.variant} className="text-xs">
                          {quality.label}
                        </Badge>
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
                      {(scan.senderName || scan.receiverName) && (
                        <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                          {scan.senderName && <span>{t("history.sender")}: {scan.senderName}</span>}
                          {scan.receiverName && <span>{t("history.observer")}: {scan.receiverName}</span>}
                        </div>
                      )}
                    </div>
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
