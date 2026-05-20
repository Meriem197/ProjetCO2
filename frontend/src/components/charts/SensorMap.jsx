import { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import L from "leaflet";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";
// Fix Leaflet marker assets sous Vite
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });
const colorFor = (ppm) => {
    const s = ppm < 600 ? "good" : ppm < 1000 ? "warning" : "critical";
    return s === "good"
        ? "hsl(152 65% 42%)"
        : s === "warning"
            ? "hsl(35 95% 52%)"
            : "hsl(0 78% 55%)";
};
export default function SensorMap({ sensors = [], height = 420 }) {
    useEffect(() => {
        // forcer recalcul taille leaflet après mount
        window.dispatchEvent(new Event("resize"));
    }, []);
    if (!Array.isArray(sensors) || sensors.length === 0) {
        return (<div style={{ height }} className="flex items-center justify-center rounded-2xl border border-border/60 bg-card text-sm text-muted-foreground">
        Aucune position capteur disponible en base de donnees.
      </div>);
    }
    const first = sensors.find((s) => Number.isFinite(Number(s.lat)) && Number.isFinite(Number(s.lng)));
    const center = first ? [Number(first.lat), Number(first.lng)] : [36.8065, 10.1815];
    return (<div style={{ height }} className="overflow-hidden rounded-2xl border border-border/60 shadow-soft">
      <MapContainer center={center} zoom={13} scrollWheelZoom={false}>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
        {sensors
            .filter((s) => Number.isFinite(Number(s.lat)) && Number.isFinite(Number(s.lng)))
            .map((s) => (<CircleMarker key={s.id} center={[Number(s.lat), Number(s.lng)]} radius={12} pathOptions={{
                color: colorFor(s.ppm),
                fillColor: colorFor(s.ppm),
                fillOpacity: 0.7,
                weight: 2,
            }}>
            <Popup>
              <div className="text-xs">
                <p className="font-semibold">{s.name}</p>
                <p className="text-muted-foreground">{s.zone} · {s.id}</p>
                <p className="mt-1 text-base font-bold" style={{ color: colorFor(s.ppm) }}>
                  {s.ppm} ppm
                </p>
              </div>
            </Popup>
          </CircleMarker>))}
      </MapContainer>
    </div>);
}
