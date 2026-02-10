import { useMemo } from "react";
import { Activity, Signal, Radio, MapPin } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";
import type { CoverageZone, ScanResult, MeshNode } from "@/lib/scan-aggregator";
import type { UnitSystem } from "@/lib/bluetooth-context";

function distanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface ScanStatsProps {
  coverageZones: CoverageZone[];
  totalScans: number;
  nodes: MeshNode[];
  isConnected: boolean;
  observerPosition: [number, number] | null;
  statsRadiusMiles: number;
  unitSystem: UnitSystem;
}

export function ScanStats({ coverageZones, totalScans, nodes, isConnected, observerPosition, statsRadiusMiles, unitSystem }: ScanStatsProps) {
  const { t } = useI18n();
  const filteredZones = useMemo(() => {
    if (statsRadiusMiles === 0 || !observerPosition) return coverageZones;
    return coverageZones.filter((z) => {
      const d = distanceMiles(observerPosition[0], observerPosition[1], z.centerLat, z.centerLng);
      return d <= statsRadiusMiles;
    });
  }, [coverageZones, observerPosition, statsRadiusMiles]);

  const activeZones = filteredZones.filter((z) => !z.isDeadZone);
  const deadZones = filteredZones.filter((z) => z.isDeadZone);
  const avgRssi = activeZones.length > 0
    ? activeZones.reduce((sum, z) => sum + (z.avgRssi || 0), 0) / activeZones.length
    : 0;
  const avgSnr = activeZones.length > 0
    ? activeZones.reduce((sum, z) => sum + (z.avgSnr || 0), 0) / activeZones.length
    : 0;

  const stats = [
    {
      icon: Radio,
      label: t("stats.nodes"),
      value: nodes.length.toString(),
      sub: isConnected ? t("stats.active") : t("bluetooth.offline"),
    },
    {
      icon: MapPin,
      label: t("stats.zones"),
      value: activeZones.length.toString(),
      sub: `${deadZones.length} ${t("stats.dead")}`,
    },
    {
      icon: Signal,
      label: t("stats.avgRssi"),
      value: avgRssi ? `${avgRssi.toFixed(0)}` : "--",
      sub: "dBm",
    },
    {
      icon: Activity,
      label: t("stats.avgSnr"),
      value: avgSnr ? `${avgSnr.toFixed(1)}` : "--",
      sub: "dB",
    },
  ];

  const radiusLabel = statsRadiusMiles > 0 && observerPosition
    ? unitSystem === "metric"
      ? t("stats.within", { value: `${Math.round(statsRadiusMiles * 1.60934)} km` })
      : t("stats.within", { value: `${statsRadiusMiles} mi` })
    : null;

  return (
    <div className="space-y-1">
      {radiusLabel && (
        <p className="text-[10px] text-muted-foreground text-center" data-testid="text-stats-radius-label">{radiusLabel}</p>
      )}
      <div className="grid grid-cols-4 gap-2">
        {stats.map((stat) => (
          <Card key={stat.label} className="p-2.5 text-center">
            <stat.icon className="h-3.5 w-3.5 text-muted-foreground mx-auto mb-1" />
            <p className="text-lg font-semibold leading-none" data-testid={`text-stat-${stat.label.toLowerCase().replace(/\s/g, "-")}`}>{stat.value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{stat.label}</p>
            <p className="text-[10px] text-muted-foreground">{stat.sub}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
