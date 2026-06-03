import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import AppLayout from "@/components/layout/AppLayout";
import { GlassCard } from "@/components/ui/glass-card";
import { Skeleton } from "@/components/ui/skeleton";
import api, { resolveApiErrorMessage, unwrapApiData } from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import { motion } from "framer-motion";
import { BrainCircuit, Loader2, MapPin, Plus, Save, Trash2, CircleOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getCo2Metrology } from "@/lib/co2Metrology";

function normalizePositionRow(row, idx = 0) {
  if (!row || typeof row !== "object") return null;
  const id = row.id ?? row.positionId;
  if (id == null) return null;
  const fallbackLat = 36.8065 + idx * 0.0012;
  const fallbackLng = 10.1815 + idx * 0.0012;
  return {
    id: String(id),
    name: row.name ?? row.positionName ?? "Position",
    zone: row.zone ?? row.locationZone ?? "—",
    durationMinutes: Number(row.durationMinutes ?? row.duration_minutes ?? 30),
    isFinal: Boolean(row.isFinal ?? row.is_final),
    avgPpm: Number(row.avgCo2Ppm ?? row.avg_co2_ppm ?? 0),
    retentionRate: Number(row.retentionRate ?? row.retention_rate ?? 0),
    locationNote: row.locationNote ?? row.location_note ?? "",
    latitude: Number.isFinite(Number(row.latitude)) ? Number(row.latitude) : fallbackLat,
    longitude: Number.isFinite(Number(row.longitude)) ? Number(row.longitude) : fallbackLng,
  };
}

function markerIcon(color) {
  return L.divIcon({
    className: "",
    html: `<div style="width:16px;height:16px;border-radius:999px;background:${color};border:2px solid #0f172a;box-shadow:0 0 0 4px ${color}30;"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

export default function IAPlacement() {
  const { t } = useTranslation();
  const { user, hasRole } = useAuth();
  const role = String(user?.role || "").toUpperCase();
  const canOperate = hasRole("ADMIN", "TECHNICIAN");
  const isClient = role === "CLIENT";
  const accessLabel =
    role === "ADMIN" ? t("placement.access_admin") : role === "TECHNICIAN" ? t("placement.access_tech") : t("placement.access_client");

  const [form, setForm] = useState({ name: "", zone: "", durationMinutes: 30 });
  const [positions, setPositions] = useState([]);
  const [loadingPositions, setLoadingPositions] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [selectedId, setSelectedId] = useState(null);
  const [savingNote, setSavingNote] = useState(false);
  const selected = useMemo(() => positions.find((p) => p.id === selectedId) || positions[0] || null, [positions, selectedId]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoadingPositions(true);
        const res = await api.get("/positioning/positions");
        const rows = unwrapApiData(res.data);
        if (!mounted) return;
        const normalized = Array.isArray(rows) ? rows.map((item, idx) => normalizePositionRow(item, idx)).filter(Boolean) : [];
        setPositions(normalized);
        if (normalized[0]) setSelectedId(String(normalized[0].id));
        setError("");
      } catch (e) {
        if (!mounted) return;
        setError(resolveApiErrorMessage(e, t("placement.load_error")));
      } finally {
        if (mounted) setLoadingPositions(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [t]);

  const addPosition = async () => {
    setError("");
    const name = form.name.trim();
    const zone = form.zone.trim();
    const durationMinutes = Number(form.durationMinutes);
    if (!name || !zone || !Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      setError(t("placement.add_error"));
      return;
    }

    try {
      setSaving(true);
      const fallbackCenter = positions[0] || {};
      const res = await api.post("/positioning/positions", {
        name,
        zone,
        durationMinutes,
        latitude: fallbackCenter.latitude ?? 36.8065,
        longitude: fallbackCenter.longitude ?? 10.1815,
      });
      const created = normalizePositionRow(unwrapApiData(res.data), positions.length + 1);
      if (created) {
        setPositions((prev) => [created, ...prev]);
        setSelectedId(created.id);
      }
      setForm({ name: "", zone: "", durationMinutes: 30 });
    } catch (e) {
      setError(resolveApiErrorMessage(e, t("placement.add_error")));
    } finally {
      setSaving(false);
    }
  };

  const removePosition = async (id) => {
    try {
      await api.delete(`/positioning/positions/${encodeURIComponent(id)}`);
      setPositions((prev) => prev.filter((p) => String(p.id) !== String(id)));
      setSelectedId((prev) => (String(prev) === String(id) ? null : prev));
    } catch (_e) {
      // non bloquant
    }
  };

  const saveNote = async () => {
    if (!canOperate || !selected) return;
    try {
      setSavingNote(true);
      await api.patch(`/positioning/positions/${encodeURIComponent(selected.id)}`, {
        locationNote: selected.locationNote,
        latitude: selected.latitude,
        longitude: selected.longitude,
      });
    } catch (e) {
      setError(resolveApiErrorMessage(e, t("placement.compare_error")));
    } finally {
      setSavingNote(false);
    }
  };

  const avgPpm = selected?.avgPpm || 0;
  const tone = getCo2Metrology(avgPpm);
  const qualityLabel = tone.label;
  const retention = selected?.retentionRate || Math.max(55, Math.min(98, Math.round(100 - Math.max(0, avgPpm - 500) / 12)));

  return (
    <AppLayout title={t("placement.title")} subtitle={t("placement.subtitle")}>
      <div className="grid gap-3 lg:grid-cols-[350px_1fr]">
        <GlassCard className="p-4 lg:sticky lg:top-[92px] h-fit">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            <h2 className="ui-section-title">{t("placement.panel_title")}</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{t("placement.panel_desc")}</p>

          <div className="mt-3 ui-grid-compact">
            <div>
              <label className="ui-label">{t("placement.name_label")}</label>
              <input
                className="ui-pill"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder={t("placement.name_placeholder")}
                disabled={!canOperate}
              />
            </div>
            <div>
              <label className="ui-label">{t("placement.zone_label")}</label>
              <input
                className="ui-pill"
                value={form.zone}
                onChange={(e) => setForm((p) => ({ ...p, zone: e.target.value }))}
                placeholder={t("placement.zone_placeholder")}
                disabled={!canOperate}
              />
            </div>
            <div className="grid grid-cols-[1fr_110px] gap-2">
              <div>
                <label className="ui-label">{t("placement.duration_label")}</label>
                <input
                  className="ui-pill ui-pill--mono"
                  type="number"
                  min={5}
                  max={240}
                  value={form.durationMinutes}
                  onChange={(e) => setForm((p) => ({ ...p, durationMinutes: Number(e.target.value) }))}
                  disabled={!canOperate}
                />
              </div>
              <div className="flex items-end">
                <button onClick={addPosition} disabled={!canOperate || saving} className="ui-ghost ui-ghost--primary w-full" type="button">
                  <Plus className="h-4 w-4" /> {t("placement.add")}
                </button>
              </div>
            </div>

            {isClient && (
              <div className="rounded-2xl border border-border/60 bg-background/30 p-3 text-xs text-muted-foreground">
                {t("placement.client_readonly")}
              </div>
            )}

            {error && <div className="text-xs text-status-critical">{error}</div>}

            <div className="pt-1 flex items-center justify-between gap-2">
              <span className="ui-badge text-muted-foreground">{positions.length} points d'audit</span>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("placement.positions_title")}
              </div>
              <span className="text-[11px] text-muted-foreground">{positions.length}</span>
            </div>

            <div className="mt-2 space-y-2">
              {loadingPositions && <div className="text-xs text-muted-foreground">{t("placement.loading")}</div>}
              {!loadingPositions && positions.length === 0 && (
                <div className="rounded-2xl border border-border/60 bg-background/30 p-3 text-xs text-muted-foreground">
                  {t("placement.empty")}
                </div>
              )}

              {positions.map((p) => {
                const selectedRow = String(selectedId) === String(p.id);
                return (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`rounded-2xl border px-3 py-2 ${selectedRow ? "border-primary/50 bg-primary/10" : "border-border/60 bg-background/30"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <label className="flex items-start gap-2 cursor-pointer select-none" onClick={() => setSelectedId(String(p.id))}>
                        <div className="min-w-0">
                          <div className="text-sm font-bold truncate">{p.name}</div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            {p.zone} · {p.durationMinutes} min
                          </div>
                        </div>
                      </label>
                      {canOperate && (
                        <button
                          onClick={() => removePosition(p.id)}
                          className="ui-ghost ui-ghost--critical px-3 py-1.5"
                          type="button"
                          title={t("placement.remove")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </GlassCard>

        <div className="grid gap-3">
          <GlassCard className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <BrainCircuit className="h-4 w-4 text-primary" />
                  <h1 className="ui-section-title">{t("placement.analytics_title")}</h1>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{t("placement.analytics_desc")}</p>
              </div>
              <span className="ui-badge text-muted-foreground">
                {accessLabel}
              </span>
            </div>
          </GlassCard>

          <GlassCard className="p-4">
            {!loadingPositions && positions.length === 0 && (
              <div className="flex h-[420px] flex-col items-center justify-center text-muted-foreground">
                <CircleOff className="h-8 w-8" />
                <p className="mt-2 text-sm">Aucun audit spatial disponible.</p>
              </div>
            )}
            {loadingPositions && <Skeleton className="h-[420px] w-full rounded-xl" />}
            {!loadingPositions && positions.length > 0 && (
              <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
                <div className="h-[420px] rounded-xl border border-slate-800 overflow-hidden">
                  <MapContainer center={[selected?.latitude ?? 36.8065, selected?.longitude ?? 10.1815]} zoom={13} style={{ height: "100%", width: "100%" }}>
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    />
                    {positions.map((p) => {
                      const pTone = getCo2Metrology(p.avgPpm || 0);
                      return (
                        <Marker key={p.id} position={[p.latitude, p.longitude]} icon={markerIcon(pTone.markerColor)} eventHandlers={{ click: () => setSelectedId(p.id) }}>
                          <Popup>
                            <p className="font-semibold">{p.name}</p>
                            <p className="text-xs">{p.zone} · {p.avgPpm || "N/A"} ppm</p>
                          </Popup>
                        </Marker>
                      );
                    })}
                  </MapContainer>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4">
                  {!selected ? (
                    <p className="text-sm text-muted-foreground">Sélectionnez une session.</p>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold">{selected.name}</h3>
                        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${tone.badgeClass}`}>{qualityLabel}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{selected.zone}</p>

                      <div className="mt-4 grid gap-2 text-sm">
                        <div className="flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2">
                          <span>Durée de l'audit</span><span className="font-semibold">{selected.durationMinutes} min</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2">
                          <span>Qualité de l'air</span><span className="font-semibold">{qualityLabel}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2">
                          <span>Taux de rétention</span><span className="font-semibold">{retention}%</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2">
                          <span>CO₂ moyen</span><span className="font-semibold">{avgPpm || "N/A"} ppm</span>
                        </div>
                      </div>

                      <div className="mt-4">
                        <label className="ui-label">Note descriptive de l'emplacement</label>
                        <textarea
                          className="ui-pill w-full min-h-[110px] resize-y"
                          value={selected.locationNote || ""}
                          onChange={(e) =>
                            setPositions((prev) =>
                              prev.map((p) => (p.id === selected.id ? { ...p, locationNote: e.target.value } : p))
                            )
                          }
                          placeholder="Ex: zone proche d'une entrée d'air, circulation forte à 14h."
                          disabled={!canOperate}
                        />
                        <button onClick={saveNote} disabled={!canOperate || savingNote} className="ui-ghost ui-ghost--primary mt-2 w-full" type="button">
                          {savingNote ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Sauvegarder la note
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </GlassCard>
        </div>
      </div>
    </AppLayout>
  );
}
