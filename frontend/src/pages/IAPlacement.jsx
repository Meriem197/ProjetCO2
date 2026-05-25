import { useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { GlassCard } from "@/components/ui/glass-card";
import api, { resolveApiErrorMessage, unwrapApiData } from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import { motion } from "framer-motion";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BrainCircuit, MapPin, Plus, Trash2, Wand2, CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";

function normalizePositionRow(row) {
  if (!row || typeof row !== "object") return null;
  const id = row.id ?? row.positionId;
  if (id == null) return null;
  return {
    id: String(id),
    name: row.name ?? row.positionName ?? "Position",
    zone: row.zone ?? row.locationZone ?? "—",
    durationMinutes: Number(row.durationMinutes ?? row.duration_minutes ?? 30),
    isFinal: Boolean(row.isFinal ?? row.is_final),
  };
}

function normalizeComparePayload(payload) {
  const rawPositions = Array.isArray(payload?.positions) ? payload.positions : [];
  const positions = rawPositions.map((p) => {
    const metrics = p?.metrics || {};
    return {
      id: String(p?.id ?? ""),
      name: p?.name ?? "Position",
      zone: p?.zone ?? "—",
      durationMinutes: Number(p?.durationMinutes ?? p?.duration_minutes ?? 30),
      metrics: {
        co2Capture: Number(metrics.co2Capture ?? metrics.co2_capture ?? 0),
        stability: Number(metrics.stability ?? 0),
        interference: Number(metrics.interference ?? 0),
        score: Number(metrics.score ?? 0),
        confidence: Number(metrics.confidence ?? 0),
      },
    };
  });

  const recommendedId = payload?.recommended?.id != null ? String(payload.recommended.id) : null;
  const recommendedFromList = positions.find((p) => String(p.id) === recommendedId) || null;
  const recommended = payload?.recommended
    ? {
        id: recommendedId,
        name: payload.recommended.name ?? recommendedFromList?.name ?? "—",
        confidence: Number(payload.recommended.confidence ?? recommendedFromList?.metrics?.confidence ?? 0),
        score: Number(payload.recommended.score ?? recommendedFromList?.metrics?.score ?? 0),
      }
    : null;

  return { positions, recommended };
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

  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState("");
  const [compareResult, setCompareResult] = useState(null);

  const selectedCount = selectedIds.size;

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoadingPositions(true);
        const res = await api.get("/positioning/positions");
        const rows = unwrapApiData(res.data);
        if (!mounted) return;
        setPositions(Array.isArray(rows) ? rows.map(normalizePositionRow).filter(Boolean) : []);
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

  const chartRows = useMemo(() => {
    const items = compareResult?.positions || [];
    return items.map((p) => ({
      position: String(p.name || p.id).slice(0, 16),
      co2Capture: Math.round(Number(p.metrics?.co2Capture ?? 0)),
      stability: Math.round(Number(p.metrics?.stability ?? 0)),
      interference: Math.round(Number(p.metrics?.interference ?? 0)),
      score: Math.round(Number(p.metrics?.score ?? 0)),
    }));
  }, [compareResult]);

  const addPosition = async () => {
    setError("");
    setCompareError("");
    const name = form.name.trim();
    const zone = form.zone.trim();
    const durationMinutes = Number(form.durationMinutes);
    if (!name || !zone || !Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      setError(t("placement.add_error"));
      return;
    }

    try {
      setSaving(true);
      const res = await api.post("/positioning/positions", { name, zone, durationMinutes });
      const created = normalizePositionRow(unwrapApiData(res.data));
      if (created) setPositions((prev) => [created, ...prev]);
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
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(String(id));
        return next;
      });
    } catch (_e) {
      // non bloquant
    }
  };

  const toggleSelected = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const key = String(id);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const runCompare = async () => {
    setCompareError("");
    setCompareResult(null);
    if (!canOperate) return;
    if (selectedIds.size < 2) {
      setCompareError(t("placement.select_compare"));
      return;
    }
    try {
      setCompareLoading(true);
      const ids = Array.from(selectedIds).join(",");
      const res = await api.get(`/positioning/compare?ids=${encodeURIComponent(ids)}`);
      setCompareResult(normalizeComparePayload(unwrapApiData(res.data)));
    } catch (e) {
      setCompareError(resolveApiErrorMessage(e, t("placement.compare_error")));
    } finally {
      setCompareLoading(false);
    }
  };

  const finalize = async () => {
    if (!canOperate || !compareResult?.recommended?.id) return;
    try {
      await api.post("/positioning/finalize", { positionId: compareResult.recommended.id });
    } catch (_e) {
      // non bloquant
    }
  };

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
              <button
                onClick={runCompare}
                disabled={!canOperate || selectedCount < 2 || compareLoading}
                className="ui-ghost ui-ghost--primary"
                type="button"
              >
                <Wand2 className={`h-4 w-4 ${compareLoading ? "animate-spin" : ""}`} />
                {t("placement.run_compare")}
              </button>
              <span className="ui-badge text-muted-foreground">
                {t("placement.selection")}: <span className="text-foreground">{selectedCount}</span>
              </span>
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
                const selected = selectedIds.has(String(p.id));
                return (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`rounded-2xl border px-3 py-2 ${selected ? "border-primary/50 bg-primary/10" : "border-border/60 bg-background/30"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <label className="flex items-start gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 accent-primary"
                          checked={selected}
                          onChange={() => toggleSelected(p.id)}
                        />
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
            {compareError && <div className="mb-2 text-xs text-status-critical">{compareError}</div>}
            {!compareResult && !compareLoading && (
              <div className="rounded-2xl border border-border/60 bg-background/30 p-4 text-sm text-muted-foreground">
                {t("placement.hint_select")}
              </div>
            )}
            {compareLoading && <div className="text-sm text-muted-foreground">{t("placement.comparing")}</div>}

            {!!compareResult && (
              <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
                <div className="rounded-2xl border border-border/60 bg-background/30 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("placement.chart_title")}
                  </div>
                  <div className="mt-2 h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartRows} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="6 6" vertical={false} stroke="hsl(var(--border) / 0.6)" />
                        <XAxis dataKey="position" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground) / 0.6)" />
                        <YAxis width={36} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground) / 0.6)" domain={[0, 100]} />
                        <Tooltip
                          contentStyle={{
                            background: "hsl(var(--popover) / 0.92)",
                            border: "1px solid hsl(var(--border) / 0.8)",
                            borderRadius: 12,
                            fontSize: 12,
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="co2Capture" name={t("placement.capture_co2")} fill="hsl(var(--primary))" fillOpacity={0.75} />
                        <Bar dataKey="stability" name={t("placement.stability")} fill="hsl(var(--status-good))" fillOpacity={0.65} />
                        <Bar dataKey="interference" name={t("placement.interference")} fill="hsl(var(--status-warning))" fillOpacity={0.65} />
                        <Bar dataKey="score" name={t("placement.score")} fill="hsl(var(--status-critical))" fillOpacity={0.55} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div
                  className="rounded-2xl p-[1px]"
                  style={{
                    background:
                      "linear-gradient(135deg, hsl(var(--primary)) 0%, rgba(217,70,239,0.9) 55%, rgba(34,197,94,0.85) 100%)",
                    boxShadow: "0 0 0 2px hsl(var(--primary) / 0.10), 0 0 40px hsl(var(--primary) / 0.14)",
                  }}
                >
                  <div className="h-full rounded-2xl bg-background/40 p-4 backdrop-blur-xl">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {t("placement.recommended_title")}
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="text-xs text-muted-foreground">{t("placement.recommended_spot")}</div>
                      <div className="mt-1 text-base font-extrabold">{compareResult.recommended?.name || "—"}</div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        {t("placement.confidence")}:{" "}
                        <span className="font-mono font-semibold text-foreground">
                          {Number(compareResult.recommended?.confidence ?? 0).toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-2">
                      <button onClick={finalize} disabled={!canOperate} className="ui-ghost ui-ghost--primary w-full" type="button">
                        <CheckCircle2 className="h-4 w-4" /> {t("placement.finalize")}
                      </button>
                      {!canOperate && (
                        <div className="text-[11px] text-muted-foreground">{t("placement.finalize_locked")}</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </GlassCard>
        </div>
      </div>
    </AppLayout>
  );
}
