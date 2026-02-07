export interface Position {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number | null;
}

export function getCurrentPosition(): Promise<Position> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          altitude: pos.coords.altitude,
        });
      },
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

export function watchPosition(
  callback: (pos: Position) => void,
  errorCallback?: (err: GeolocationPositionError) => void
): number | null {
  if (!navigator.geolocation) return null;
  return navigator.geolocation.watchPosition(
    (pos) => {
      callback({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        altitude: pos.coords.altitude,
      });
    },
    errorCallback,
    { enableHighAccuracy: true }
  );
}

export function clearWatch(id: number | null) {
  if (id !== null) {
    navigator.geolocation.clearWatch(id);
  }
}

export async function fetchElevation(lat: number, lng: number): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.elevation && Array.isArray(data.elevation) && data.elevation.length > 0) {
      return data.elevation[0];
    }
    return null;
  } catch {
    return null;
  }
}

export function calculateDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
