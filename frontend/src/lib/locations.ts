/**
 * Location model for the hub map demo.
 *
 * Real product path: phone / IoT GPS last-ping.
 * This prototype places each rider in their usual delivery zone
 * (from tracked shift history) around Indiranagar Hub.
 * Matching still uses usage patterns (day km + swap gap), not map distance.
 */

export type MapPoint = {
  lat: number;
  lng: number;
};

export const HUB_LOCATION: MapPoint & { label: string } = {
  label: "Indiranagar Hub",
  lat: 12.9784,
  lng: 77.6408,
};

/** Soft zone centroids around the hub - keyed by rider.usualArea */
export const AREA_LOCATIONS: Record<string, MapPoint & { short: string }> = {
  "Koramangala / HSR": {
    short: "Koramangala",
    lat: 12.9352,
    lng: 77.6245,
  },
  "Whitefield side": {
    short: "Whitefield",
    lat: 12.9698,
    lng: 77.75,
  },
  "HSR / BTM": {
    short: "HSR",
    lat: 12.9116,
    lng: 77.6473,
  },
  "Central / MG Road": {
    short: "MG Road",
    lat: 12.9758,
    lng: 77.6055,
  },
  "Indiranagar (new)": {
    short: "Indiranagar",
    lat: 12.9784,
    lng: 77.6408,
  },
  "Airport feeder belt": {
    short: "Airport",
    lat: 13.1989,
    lng: 77.7068,
  },
};

export function resolveAreaLocation(
  usualArea: string,
): MapPoint & { short: string } {
  return (
    AREA_LOCATIONS[usualArea] ?? {
      short: usualArea,
      lat: HUB_LOCATION.lat,
      lng: HUB_LOCATION.lng,
    }
  );
}

/** Small lat/lng jitter so two riders in same zone don’t stack */
export function jitterLatLng(id: string, lat: number, lng: number): MapPoint {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  const dLat = (((Math.abs(h) % 7) - 3) * 0.0022);
  const dLng = (((Math.abs(h >> 3) % 7) - 3) * 0.0022);
  return { lat: lat + dLat, lng: lng + dLng };
}
