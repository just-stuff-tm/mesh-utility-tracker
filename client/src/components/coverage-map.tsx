import { useEffect } from "react";
import { MapContainer, TileLayer, Popup, Marker, Polygon, useMap, LayersControl } from "react-leaflet";
import L from "leaflet";
import type { CoverageZone } from "@shared/schema";
import { getHexVertices } from "@shared/grid";

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

interface RssiStyle {
  fill: string;
  border: string;
  fillOpacity: number;
  label: string;
  level: number;
}

function getRssiStyle(rssi: number): RssiStyle {
  if (rssi >= -50) return { fill: "#22c55e", border: "#16a34a", fillOpacity: 0.55, label: "Excellent", level: 5 };
  if (rssi >= -60) return { fill: "#4ade80", border: "#22c55e", fillOpacity: 0.50, label: "Very Good", level: 4 };
  if (rssi >= -70) return { fill: "#84cc16", border: "#65a30d", fillOpacity: 0.45, label: "Good", level: 3 };
  if (rssi >= -80) return { fill: "#facc15", border: "#eab308", fillOpacity: 0.42, label: "Fair", level: 2 };
  if (rssi >= -90) return { fill: "#f97316", border: "#ea580c", fillOpacity: 0.42, label: "Poor", level: 1 };
  return { fill: "#ef4444", border: "#dc2626", fillOpacity: 0.45, label: "Very Weak", level: 0 };
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
                <p className="font-semibold">Observer (You)</p>
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

          const style = getRssiStyle(zone.avgRssi || -100);

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

      <div className="absolute top-14 right-3 z-[1000]">
        <div className="bg-background/90 dark:bg-card/90 backdrop-blur-sm rounded-md p-2.5 text-xs space-y-1.5 border border-border">
          <p className="font-semibold text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
            RSSI Signal Strength
          </p>
          {[
            { color: "#22c55e", label: "Excellent", range: "> -50 dBm" },
            { color: "#4ade80", label: "Very Good", range: "-50 to -60" },
            { color: "#84cc16", label: "Good", range: "-60 to -70" },
            { color: "#facc15", label: "Fair", range: "-70 to -80" },
            { color: "#f97316", label: "Poor", range: "-80 to -90" },
            { color: "#ef4444", label: "Very Weak", range: "< -90 dBm" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <div
                className="w-4 h-3 rounded-sm"
                style={{ background: item.color, opacity: 0.7 }}
              />
              <span className="flex-1">{item.label}</span>
              <span className="text-muted-foreground text-[10px]">{item.range}</span>
            </div>
          ))}
          <div className="flex items-center gap-2 mt-1.5 pt-1.5 border-t border-border">
            <div
              className="w-4 h-3 rounded-sm border border-dashed"
              style={{ borderColor: "#ef4444", background: "rgba(239,68,68,0.15)" }}
            />
            <span>Dead Zone</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ZonePopup({ zone }: { zone: CoverageZone }) {
  const style = zone.isDeadZone ? null : getRssiStyle(zone.avgRssi || -100);
  return (
    <div className="min-w-[200px] text-sm space-y-2.5">
      <div className="flex items-center gap-2">
        {style && (
          <div
            className="w-3 h-3 rounded-sm shrink-0"
            style={{ background: style.fill }}
          />
        )}
        <p className="font-semibold text-base">
          {zone.isDeadZone ? "Dead Zone" : `${style?.label} Coverage`}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <span className="text-gray-500">RSSI</span>
        <span className="font-semibold">{zone.avgRssi?.toFixed(1) ?? "N/A"} dBm</span>
        <span className="text-gray-500">SNR</span>
        <span className="font-semibold">{zone.avgSnr?.toFixed(1) ?? "N/A"} dB</span>
        <span className="text-gray-500">Scan Count</span>
        <span className="font-semibold">{zone.scanCount ?? 0}</span>
        <span className="text-gray-500">Last Scan</span>
        <span className="font-medium">
          {zone.lastScanned ? new Date(zone.lastScanned).toLocaleDateString() : "Never"}
        </span>
        <span className="text-gray-500">Grid Cell</span>
        <span className="font-mono text-[10px]">
          {zone.centerLat.toFixed(4)}, {zone.centerLng.toFixed(4)}
        </span>
      </div>
    </div>
  );
}
