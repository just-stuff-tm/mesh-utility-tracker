import { Radio, Signal, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { MeshNode, ScanResult } from "@shared/schema";

interface NodeListProps {
  nodes: MeshNode[];
  latestScans: ScanResult[];
  isLoading: boolean;
}

function getSignalQuality(rssi: number): { label: string; variant: "default" | "secondary" | "destructive" } {
  if (rssi >= -70) return { label: "Excellent", variant: "default" };
  if (rssi >= -80) return { label: "Very Good", variant: "default" };
  if (rssi >= -90) return { label: "Good", variant: "secondary" };
  if (rssi >= -100) return { label: "Fair", variant: "secondary" };
  if (rssi >= -110) return { label: "Poor", variant: "destructive" };
  return { label: "Very Weak", variant: "destructive" };
}

function getTimeSince(date: Date | string | null): string {
  if (!date) return "Unknown";
  const d = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function NodeList({ nodes, latestScans, isLoading }: NodeListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Discovered Nodes</span>
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
          <span className="text-sm font-medium">Discovered Nodes</span>
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
                No nodes discovered yet. Connect a radio and start scanning.
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
