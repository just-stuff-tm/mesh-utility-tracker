import { Activity, Signal, Radio, MapPin, TrendingUp, TrendingDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { CoverageZone, ScanResult, MeshNode } from "@shared/schema";

interface ScanStatsProps {
  coverageZones: CoverageZone[];
  totalScans: number;
  nodes: MeshNode[];
  isConnected: boolean;
}

export function ScanStats({ coverageZones, totalScans, nodes, isConnected }: ScanStatsProps) {
  const activeZones = coverageZones.filter((z) => !z.isDeadZone);
  const deadZones = coverageZones.filter((z) => z.isDeadZone);
  const avgRssi = activeZones.length > 0
    ? activeZones.reduce((sum, z) => sum + (z.avgRssi || 0), 0) / activeZones.length
    : 0;
  const avgSnr = activeZones.length > 0
    ? activeZones.reduce((sum, z) => sum + (z.avgSnr || 0), 0) / activeZones.length
    : 0;

  const stats = [
    {
      icon: Radio,
      label: "Nodes",
      value: nodes.length.toString(),
      sub: isConnected ? "Active" : "Offline",
    },
    {
      icon: MapPin,
      label: "Zones",
      value: activeZones.length.toString(),
      sub: `${deadZones.length} dead`,
    },
    {
      icon: Signal,
      label: "Avg RSSI",
      value: avgRssi ? `${avgRssi.toFixed(0)}` : "--",
      sub: "dBm",
    },
    {
      icon: Activity,
      label: "Avg SNR",
      value: avgSnr ? `${avgSnr.toFixed(1)}` : "--",
      sub: "dB",
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-2">
      {stats.map((stat) => (
        <Card key={stat.label} className="p-2.5 text-center">
          <stat.icon className="h-3.5 w-3.5 text-muted-foreground mx-auto mb-1" />
          <p className="text-lg font-semibold leading-none">{stat.value}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{stat.label}</p>
          <p className="text-[10px] text-muted-foreground">{stat.sub}</p>
        </Card>
      ))}
    </div>
  );
}
