// Links zu Karten-Apps für die Anfahrt zu einem Ort. Reine Logik: es wird nichts gesendet; die Adresse
// öffnet sich erst, wenn die Person den Link antippt (dann kennt der Anbieter das Ziel).
export interface RoutePoint {
  lat: number;
  lng: number;
}

export interface RouteLinks {
  apple: string;
  google: string;
}

const valid = (p: RoutePoint) =>
  Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;

/** Ziel als Koordinate; Start ist der aktuelle Standort der Person (die Karten-App nimmt ihn selbst). `null` bei ungültiger Position. */
export function routeLinks(p: RoutePoint): RouteLinks | null {
  if (!valid(p)) return null;
  const c = `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
  return {
    apple: `https://maps.apple.com/?daddr=${c}&dirflg=d`,
    google: `https://www.google.com/maps/dir/?api=1&destination=${c}&travelmode=driving`,
  };
}
