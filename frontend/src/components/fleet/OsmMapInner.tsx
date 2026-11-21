"use client";

import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  CircleMarker,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import { HUB_LOCATION } from "@/lib/locations";
import "leaflet/dist/leaflet.css";

export type OsmMapUnit = {
  scooterId: string;
  scooterLabel: string;
  riderName: string | null;
  areaShort: string;
  lat: number;
  lng: number;
  healthScore: number;
  serviceDays: number;
  openIssues: number;
};

function markerColor(u: OsmMapUnit) {
  if (u.serviceDays <= 7) return "#c47a12";
  if (u.healthScore < 65) return "#c23b3b";
  return "#1f6b5c";
}

function bikeIcon(color: string, active: boolean) {
  return L.divIcon({
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: `<div style="
      width:28px;height:28px;border-radius:9999px;
      background:${color};border:2px solid #fff;
      box-shadow:0 1px 4px rgba(0,0,0,.35);
      display:grid;place-items:center;
      transform:${active ? "scale(1.15)" : "scale(1)"};
      color:#fff;font:700 10px/1 system-ui,sans-serif;
    ">●</div>`,
  });
}

function FitBounds({
  units,
  selectedId,
}: {
  units: OsmMapUnit[];
  selectedId: string | null;
}) {
  const map = useMap();

  useEffect(() => {
    const selected = units.find((u) => u.scooterId === selectedId);
    if (selected) {
      map.flyTo([selected.lat, selected.lng], Math.max(map.getZoom(), 13), {
        duration: 0.45,
      });
      return;
    }
    const pts: L.LatLngExpression[] = [
      [HUB_LOCATION.lat, HUB_LOCATION.lng],
      ...units.map((u) => [u.lat, u.lng] as [number, number]),
    ];
    if (pts.length === 1) {
      map.setView(pts[0], 12);
      return;
    }
    map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 13 });
  }, [map, units, selectedId]);

  return null;
}

export function OsmMapInner({
  units,
  selectedId,
  onSelect,
}: {
  units: OsmMapUnit[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <MapContainer
      center={[HUB_LOCATION.lat, HUB_LOCATION.lng]}
      zoom={12}
      className="h-full w-full"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds units={units} selectedId={selectedId} />

      <CircleMarker
        center={[HUB_LOCATION.lat, HUB_LOCATION.lng]}
        radius={9}
        pathOptions={{
          color: "#111827",
          fillColor: "#111827",
          fillOpacity: 1,
          weight: 2,
        }}
      >
        <Popup>
          <strong>{HUB_LOCATION.label}</strong>
        </Popup>
      </CircleMarker>

      {units.map((u) => {
        const color = markerColor(u);
        const active = selectedId === u.scooterId;
        return (
          <Marker
            key={u.scooterId}
            position={[u.lat, u.lng]}
            icon={bikeIcon(color, active)}
            eventHandlers={{
              click: () => onSelect(u.scooterId),
            }}
          >
            <Popup>
              <div style={{ minWidth: 140 }}>
                <strong>{u.scooterLabel}</strong>
                <br />
                {u.riderName ?? "No rider"} · {u.areaShort}
                <br />
                Condition {u.healthScore} · service {u.serviceDays}d
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
