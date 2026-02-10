export const HEX_SIZE = 0.0007;
export const LNG_SCALE = 1.2;
export const ROW_SPACING = HEX_SIZE * 1.5;
export const COL_SPACING = HEX_SIZE * Math.sqrt(3) * LNG_SCALE;

export function snapToHexGrid(lat: number, lng: number): { snapLat: number; snapLng: number } {
  const row = Math.round(lat / ROW_SPACING);
  const isOddRow = Math.abs(row) % 2 === 1;
  const offset = isOddRow ? COL_SPACING / 2 : 0;
  const col = Math.round((lng - offset) / COL_SPACING);
  return {
    snapLat: row * ROW_SPACING,
    snapLng: col * COL_SPACING + offset,
  };
}

export function getHexVertices(centerLat: number, centerLng: number): [number, number][] {
  const vertices: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const angleDeg = 60 * i - 30;
    const angleRad = (Math.PI / 180) * angleDeg;
    vertices.push([
      centerLat + HEX_SIZE * Math.sin(angleRad),
      centerLng + HEX_SIZE * LNG_SCALE * Math.cos(angleRad),
    ]);
  }
  return vertices;
}

export function hexKey(lat: number, lng: number): string {
  const { snapLat, snapLng } = snapToHexGrid(lat, lng);
  return `${snapLat.toFixed(6)}:${snapLng.toFixed(6)}`;
}