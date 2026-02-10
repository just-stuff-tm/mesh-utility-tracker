import { useEffect, useRef, useState } from "react";
import { streamHistoryDay } from "@/lib/history-api";
import { RawScan } from "@/lib/scan-aggregator";
import {
  snapToHexGrid,
  hexKey,
  getHexVertices,
} from "@shared/grid";

interface HexCell {
  centerLat: number;
  centerLng: number;
  count: number;
  avgRssi: number;
  vertices: [number, number][];
}

export function useHistoryHexes(day: string | null) {
  const [hexes, setHexes] = useState<Map<string, HexCell>>(new Map());
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!day) return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setHexes(new Map());

    streamHistoryDay(
      day,
      (scan: RawScan) => {
        const key = hexKey(scan.latitude, scan.longitude);

        setHexes((prev) => {
          const next = new Map(prev);
          const existing = next.get(key);

          if (existing) {
            const newCount = existing.count + 1;
            existing.avgRssi =
              (existing.avgRssi * existing.count + scan.rssi) /
              newCount;
            existing.count = newCount;
          } else {
            const { snapLat, snapLng } = snapToHexGrid(
              scan.latitude,
              scan.longitude
            );

            next.set(key, {
              centerLat: snapLat,
              centerLng: snapLng,
              count: 1,
              avgRssi: scan.rssi,
              vertices: getHexVertices(snapLat, snapLng),
            });
          }

          return next;
        });
      },
      abortRef.current.signal
    );

    return () => abortRef.current?.abort();
  }, [day]);

  return Array.from(hexes.values());
}