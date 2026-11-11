export interface Position {
  lat: number;
  lng: number;
  accuracy: number;
}

/** Great-circle distance in metres (haversine). */
export function distanceM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;
}

function toPosition(p: GeolocationPosition): Position {
  return { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy };
}

function geoErrorMessage(err: GeolocationPositionError): string {
  if (err.code === err.PERMISSION_DENIED) return 'Location permission was denied. Allow location for this site in your browser settings.';
  if (err.code === err.TIMEOUT) return 'Getting your location took too long. Try again outdoors or near a window.';
  return 'Your location is not available right now.';
}

export function getPosition(): Promise<Position> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('This browser does not support location.'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve(toPosition(p)),
      (e) => reject(new Error(geoErrorMessage(e))),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 },
    );
  });
}

/** Watches the position; returns a function that stops watching. */
export function watchPosition(onPos: (p: Position) => void, onError: (msg: string) => void): () => void {
  if (!navigator.geolocation) {
    onError('This browser does not support location.');
    return () => {};
  }
  const id = navigator.geolocation.watchPosition(
    (p) => onPos(toPosition(p)),
    (e) => onError(geoErrorMessage(e)),
    { enableHighAccuracy: true, timeout: 30000, maximumAge: 5000 },
  );
  return () => navigator.geolocation.clearWatch(id);
}

export function mapsLink(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
