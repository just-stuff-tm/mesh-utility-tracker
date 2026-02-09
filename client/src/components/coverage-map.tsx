import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Popup, Marker, Polygon, useMap, LayersControl } from "react-leaflet";
import L from "leaflet";
import { ChevronLeft, ChevronRight, Mountain } from "lucide-react";
import type { CoverageZone, ScanResult } from "@shared/schema";
import { getHexVertices } from "@shared/grid";
import { useBluetoothContext } from "@/lib/bluetooth-context";
import { useI18n } from "@/lib/i18n";

import "leaflet/dist/leaflet.css";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const observerIcon = new L.DivIcon({
  className: "observer-marker",
  html: `<div style="
    width: 22px; height: 22px;
    background: linear-gradient(135deg, #3b82f6, #1d4ed8);
    border: 3px solid white;
    border-radius: 50%;
    box-shadow: 0 0 12px rgba(59, 130, 246, 0.7), 0 0 24px rgba(59, 130, 246, 0.3);
  "></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

interface SignalStyle {
  fill: string;
  border: string;
  fillOpacity: number;
  label: string;
  level: number;
}

function getRssiLevel(rssi: number): number {
  if (rssi > -90) return 5;
  if (rssi > -100) return 4;
  if (rssi > -110) return 3;
  if (rssi > -115) return 2;
  if (rssi > -120) return 1;
  return 0;
}

function getSnrLevel(snr: number): number {
  if (snr > 10) return 5;
  if (snr > 0) return 4;
  if (snr > -7) return 3;
  if (snr > -13) return 2;
  return 0;
}

const SIGNAL_STYLES: Record<number, SignalStyle> = {
  5: { fill: "#22c55e", border: "#16a34a", fillOpacity: 0.55, label: "coverage.excellent", level: 5 },
  4: { fill: "#4ade80", border: "#22c55e", fillOpacity: 0.50, label: "coverage.good", level: 4 },
  3: { fill: "#facc15", border: "#eab308", fillOpacity: 0.45, label: "coverage.fair", level: 3 },
  2: { fill: "#f97316", border: "#ea580c", fillOpacity: 0.42, label: "coverage.marginal", level: 2 },
  1: { fill: "#ef4444", border: "#dc2626", fillOpacity: 0.42, label: "coverage.poor", level: 1 },
  0: { fill: "#991b1b", border: "#7f1d1d", fillOpacity: 0.45, label: "coverage.deadZone", level: 0 },
};

const NOISY_STYLE: SignalStyle = {
  fill: "#a855f7", border: "#7c3aed", fillOpacity: 0.45, label: "coverage.noisy", level: -1,
};

function getSignalStyle(rssi: number | null, snr: number | null): SignalStyle {
  if (rssi === null && snr === null) return SIGNAL_STYLES[0];

  const rssiLvl = rssi !== null ? getRssiLevel(rssi) : null;
  const snrLvl = snr !== null ? getSnrLevel(snr) : null;

  if (rssi !== null && rssiLvl !== null && rssiLvl >= 2 && snrLvl !== null && snrLvl <= 0) {
    return NOISY_STYLE;
  }

  const effectiveRssi = rssiLvl ?? 3;
  const effectiveSnr = snrLvl ?? 3;
  const combined = Math.max(1, Math.min(effectiveRssi, effectiveSnr));
  return SIGNAL_STYLES[combined] ?? SIGNAL_STYLES[1];
}

function MapAutoUpdater({ center, autoCenter }: { center: [number, number] | null; autoCenter: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (autoCenter && center) {
      map.setView(center, map.getZoom(), { animate: true });
    }
  }, [center, autoCenter, map]);
  return null;
}

const MAP_LAYERS = {
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    label: "Dark",
  },
  standard: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    label: "Standard",
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    label: "Satellite",
  },
} as const;

const legendItems = [
  { color: "#22c55e", label: "coverage.excellent", range: "RSSI > -90, SNR > 10" },
  { color: "#4ade80", label: "coverage.good", range: "RSSI > -100, SNR > 0" },
  { color: "#facc15", label: "coverage.fair", range: "RSSI > -110, SNR > -7" },
  { color: "#f97316", label: "coverage.marginal", range: "RSSI > -115, SNR > -13" },
  { color: "#ef4444", label: "coverage.poor", range: "coverage.weakSignal" },
  { color: "#991b1b", label: "coverage.deadZone", range: "coverage.noResponse" },
  { color: "#a855f7", label: "coverage.noisy", range: "coverage.goodSignalBadSnr" },
];

interface CoverageMapProps {
  coverageZones: CoverageZone[];
  observerPosition: [number, number] | null;
  autoCenter: boolean;
  selectedZone: CoverageZone | null;
  onZoneClick: (zone: CoverageZone) => void;
}

export function CoverageMap({
  coverageZones,
  observerPosition,
  autoCenter,
  selectedZone,
  onZoneClick,
}: CoverageMapProps) {
  const { t } = useI18n();
  const defaultCenter: [number, number] = observerPosition || [37.7749, -122.4194];

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={defaultCenter}
        zoom={15}
        className="w-full h-full"
        style={{ background: "hsl(210, 5%, 10%)" }}
        zoomControl={false}
      >
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name={MAP_LAYERS.dark.label}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
              url={MAP_LAYERS.dark.url}
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name={MAP_LAYERS.standard.label}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url={MAP_LAYERS.standard.url}
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name={MAP_LAYERS.satellite.label}>
            <TileLayer
              attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
              url={MAP_LAYERS.satellite.url}
              maxZoom={19}
            />
          </LayersControl.BaseLayer>
        </LayersControl>

        <MapAutoUpdater center={observerPosition} autoCenter={autoCenter} />

        {observerPosition && (
          <Marker position={observerPosition} icon={observerIcon}>
            <Popup>
              <div className="text-sm">
                <p className="font-semibold">{t("coverage.observer")}</p>
                <p className="text-xs text-gray-500">
                  {observerPosition[0].toFixed(5)}, {observerPosition[1].toFixed(5)}
                </p>
              </div>
            </Popup>
          </Marker>
        )}

        {coverageZones.map((zone) => {
          const hexVerts = getHexVertices(zone.centerLat, zone.centerLng);

          if (zone.isDeadZone) {
            return (
              <Polygon
                key={zone.id}
                positions={hexVerts}
                pathOptions={{
                  fillColor: "#ef4444",
                  fillOpacity: 0.15,
                  color: "#ef4444",
                  weight: 1,
                  dashArray: "6 4",
                }}
                eventHandlers={{ click: () => onZoneClick(zone) }}
              >
                <Popup>
                  <ZonePopup zone={zone} />
                </Popup>
              </Polygon>
            );
          }

          const style = getSignalStyle(zone.avgRssi, zone.avgSnr);

          return (
            <Polygon
              key={zone.id}
              positions={hexVerts}
              pathOptions={{
                fillColor: style.fill,
                fillOpacity: style.fillOpacity,
                color: style.border,
                weight: 1,
              }}
              eventHandlers={{ click: () => onZoneClick(zone) }}
            >
              <Popup>
                <ZonePopup zone={zone} />
              </Popup>
            </Polygon>
          );
        })}
      </MapContainer>

      <RssiLegend />
    </div>
  );
}

function RssiLegend() {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="absolute top-1/2 -translate-y-1/2 right-3 z-[1000]">
      <div className="bg-background/90 dark:bg-card/90 backdrop-blur-sm rounded-md border border-border">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex flex-col items-center gap-1.5 w-full px-1.5 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold"
          data-testid="button-rssi-legend-toggle"
        >
          {!expanded && (
            <div className="flex flex-col gap-1 items-center">
              {legendItems.map((item) => (
                <div
                  key={item.label}
                  className="w-2.5 h-2.5 rounded-sm"
                  style={{ background: item.color, opacity: 0.7 }}
                />
              ))}
            </div>
          )}
          {expanded ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>
        {expanded && (
          <div className="px-2 pb-2 space-y-1 text-[11px]">
            {legendItems.map((item) => (
              <div key={item.label} className="flex items-center gap-1.5">
                <div
                  className="w-3 h-2.5 rounded-sm"
                  style={{ background: item.color, opacity: 0.7 }}
                />
                <span className="flex-1">{t(item.label)}</span>
                <span className="text-muted-foreground text-[9px]">{item.range.startsWith("coverage.") ? t(item.range) : item.range}</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5 pt-1 border-t border-border">
              <div
                className="w-3 h-2.5 rounded-sm border border-dashed"
                style={{ borderColor: "#ef4444", background: "rgba(239,68,68,0.15)" }}
              />
              <span>{t("coverage.deadZone")}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ZonePopup({ zone }: { zone: CoverageZone }) {
  const { t } = useI18n();
  const { unitSystem } = useBluetoothContext();
  const style = zone.isDeadZone ? null : getSignalStyle(zone.avgRssi, zone.avgSnr);
  const [scans, setScans] = useState<ScanResult[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (zone.isDeadZone) { setLoaded(true); return; }
    fetch(`/api/scan-results/zone?lat=${zone.centerLat}&lng=${zone.centerLng}`)
      .then((r) => r.json())
      .then((data) => { setScans(data); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, [zone.centerLat, zone.centerLng, zone.isDeadZone]);

  const observers = zone.isDeadZone ? [] : Array.from(new Set(scans.map((s) => s.receiverName).filter(Boolean)));
  const repeaterMap = new Map<string, string>();
  if (!zone.isDeadZone) {
    scans.forEach((s) => { if (!repeaterMap.has(s.nodeId)) repeaterMap.set(s.nodeId, s.senderName || s.nodeId); });
  }
  const repeaters = Array.from(repeaterMap.entries());

  return (
    <div className="min-w-[220px] text-sm space-y-2.5">
      <div className="flex items-center gap-2">
        {style && (
          <div
            className="w-3 h-3 rounded-sm shrink-0"
            style={{ background: style.fill }}
          />
        )}
        <p className="font-semibold text-base">
          {zone.isDeadZone ? t("coverage.deadZone") : `${style ? t(style.label) : ""} ${t("coverage.coverage")}`}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <span className="text-gray-500">RSSI</span>
        <span className="font-semibold">{zone.avgRssi?.toFixed(1) ?? "N/A"} dBm</span>
        <span className="text-gray-500">SNR</span>
        <span className="font-semibold">{zone.avgSnr?.toFixed(1) ?? "N/A"} dB</span>
        <span className="text-gray-500">{t("coverage.scanCount")}</span>
        <span className="font-semibold">{zone.scanCount ?? 0}</span>
        <span className="text-gray-500">{t("coverage.lastScanned")}</span>
        <span className="font-medium">
          {zone.lastScanned ? new Date(zone.lastScanned).toLocaleDateString() : "Never"}
        </span>
        <span className="text-gray-500">{t("coverage.gridCell")}</span>
        <span className="font-mono text-[10px]">
          {zone.centerLat.toFixed(4)}, {zone.centerLng.toFixed(4)}
        </span>
        {loaded && (() => {
          const scansWithAlt = scans
            .filter((s) => s.altitude != null)
            .sort((a, b) => new Date(b.timestamp!).getTime() - new Date(a.timestamp!).getTime());
          if (scansWithAlt.length === 0) return null;
          const latest = scansWithAlt[0].altitude!;
          const formatted = unitSystem === "imperial"
            ? `${Math.round(latest * 3.28084)} ft`
            : `${Math.round(latest)} m`;
          return (
            <>
              <span className="text-gray-500">{t("coverage.altitude")}</span>
              <span className="font-semibold">{formatted} ASL</span>
            </>
          );
        })()}
      </div>
      {loaded && scans.length > 0 && (
        <div className="border-t border-gray-200 pt-2 space-y-1.5">
          {observers.length > 0 && (
            <div className="text-xs">
              <span className="text-gray-500 font-medium">{t("coverage.observerLabel")}</span>
              <p className="font-semibold">{observers.join(", ")}</p>
            </div>
          )}
          {repeaters.length > 0 && (
            <div className="text-xs">
              <span className="text-gray-500 font-medium">{t("coverage.repeatersObserved")}</span>
              {repeaters.map(([nodeId, name]) => {
                const latest = scans.find((s) => s.nodeId === nodeId);
                return (
                  <div key={nodeId} className="flex items-center justify-between gap-2 mt-0.5">
                    <span className="font-semibold truncate">{name}</span>
                    {latest && (
                      <span className="text-gray-400 whitespace-nowrap">
                        {latest.rssi?.toFixed(0)} dBm / {latest.snr?.toFixed(1)} dB
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
