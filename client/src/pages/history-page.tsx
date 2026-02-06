import { useQuery } from "@tanstack/react-query";
import { Activity, Signal, Clock, MapPin, Radio } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ScanResult } from "@shared/schema";

function getSignalBadge(rssi: number): { label: string; variant: "default" | "secondary" | "destructive" } {
  if (rssi >= -70) return { label: "Strong", variant: "default" };
  if (rssi >= -90) return { label: "Medium", variant: "secondary" };
  return { label: "Weak", variant: "destructive" };
}

function formatTime(date: string | Date | null): string {
  if (!date) return "Unknown";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString();
}

export default function HistoryPage() {
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
          <h1 className="text-xl font-semibold">Scan History</h1>
          <p className="text-sm text-muted-foreground">
            All recorded scan results
          </p>
        </div>
        <Badge variant="secondary">{scans.length} scans</Badge>
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
          <p className="text-muted-foreground">No scan results yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Scan results will appear here after connecting and scanning
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
                          Node: {scan.nodeId}
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
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span>{formatTime(scan.timestamp)}</span>
                        </div>
                      </div>
                      {(scan.senderName || scan.receiverName) && (
                        <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                          {scan.senderName && <span>Sender: {scan.senderName}</span>}
                          {scan.receiverName && <span>Receiver: {scan.receiverName}</span>}
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
