import AppLayout from "@/components/layout/AppLayout";
import { GlassCard } from "@/components/ui/glass-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { useCO2Data } from "@/hooks/useCO2Data";
import { useEffect, useMemo, useState } from "react";
import api, { unwrapApiData } from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import {
  ShieldAlert,
  CheckCircle2,
  Bell,
  Clock,
  ChevronRight,
  ExternalLink,
  RefreshCw,
  Archive,
  Loader2,
} from "lucide-react";
import { motion } from "framer-motion";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

export default function Alertes() {
  const { t, i18n } = useTranslation();
  const { alerts, isLoading, refreshAlerts } = useCO2Data();
  const { hasRole } = useAuth();
  const canOperate = hasRole("ADMIN", "TECHNICIAN");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [contextError, setContextError] = useState("");
  const [contextSeries, setContextSeries] = useState([]);

  const locale = i18n.language === "ar" ? "ar-TN" : i18n.language === "en" ? "en-GB" : "fr-FR";

  const filtered = useMemo(() => {
    if (filter === "all") return alerts;
    return alerts.filter((a) => a.status === filter);
  }, [alerts, filter]);

  const active = alerts.filter((a) => a.status === "active").length;
  const ack = alerts.filter((a) => a.status === "acquittee").length;
  const done = alerts.filter((a) => a.status === "resolue").length;

  useEffect(() => {
    let mounted = true;
    const loadContext = async () => {
      if (!selected?.id) return;
      setContextLoading(true);
      setContextError("");
      try {
        const res = await api.get(`/alerts/${selected.id}/context`);
        const payload = unwrapApiData(res.data);
        const series = Array.isArray(payload?.series) ? payload.series : [];
        if (!mounted) return;
        setContextSeries(
          series.map((p) => ({
            t: new Date(p.time).getTime(),
            label: new Date(p.time).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }),
            ppm: Number(p.ppm),
          }))
          .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.ppm))
          .sort((a, b) => a.t - b.t)
        );
      } catch (e) {
        if (!mounted) return;
        setContextError(e?.response?.data?.error?.message || t("alerts.context_error"));
        setContextSeries([]);
      } finally {
        if (mounted) setContextLoading(false);
      }
    };
    loadContext();
    return () => {
      mounted = false;
    };
  }, [selected?.id, locale, t]);

  const updateStatus = async (alertRow, next) => {
    try {
      await api.patch(`/alerts/${alertRow.id}`, { status: next });
      await refreshAlerts(alertRow.sensorId);
    } catch (_e) {
      // rafraîchi par polling/socket
    }
  };

  const nextBackendStatus = (uiStatus) => {
    if (uiStatus === "active") return "ACKNOWLEDGED";
    if (uiStatus === "acquittee") return "RESOLVED";
    return "CLOSED";
  };

  const statusLabel = (uiStatus) => {
    if (uiStatus === "active") return t("alerts.status_untreated");
    if (uiStatus === "acquittee") return t("alerts.status_in_progress");
    return t("alerts.status_resolved");
  };

  const filterButtons = [
    { key: "all", label: t("alerts.all") },
    { key: "active", label: t("alerts.active") },
    { key: "acquittee", label: t("alerts.in_progress") },
    { key: "resolue", label: t("alerts.resolved") },
  ];

  return (
    <AppLayout title={t("alerts.title")} subtitle={t("alerts.subtitle")}>
      <div className="space-y-4">
        {active > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 rounded-2xl border border-status-critical/35 bg-status-critical/10 px-4 py-3 text-status-critical"
          >
            <ShieldAlert className="h-5 w-5 animate-pulse-critical" />
            <p className="text-sm">
              <span className="font-semibold">
                {active} {t("alerts.active_banner")}
              </span>
            </p>
          </motion.div>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <CountCard label={t("alerts.active")} value={active} icon={Bell} tone="critical" />
          <CountCard label={t("alerts.in_progress")} value={ack} icon={Clock} tone="warning" />
          <CountCard label={t("alerts.resolved")} value={done} icon={CheckCircle2} tone="good" />
        </div>

        <GlassCard className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("alerts.filter_label")}</p>
            <button
              onClick={() => setSelected(null)}
              className="rounded-full border border-border/60 px-4 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-accent/10 hover:text-foreground"
              type="button"
            >
              {t("alerts.close_details")}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {filterButtons.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                type="button"
                className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
                  filter === f.key
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/60 bg-card/40 text-muted-foreground hover:text-foreground hover:bg-accent/10"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </GlassCard>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
          <GlassCard className="p-0">
            <div className="overflow-hidden rounded-2xl">
              <div className="border-b border-border/60 px-4 py-3">
                <p className="text-sm font-bold">{t("alerts.list_title")}</p>
                <p className="text-xs text-muted-foreground">
                  {filtered.length} {t("alerts.shown")}
                </p>
              </div>
              <div className="ui-table__head min-w-[940px]" style={{ gridTemplateColumns: "190px 140px 140px 110px 160px 1fr" }}>
                <div>{t("alerts.timestamp")}</div>
                <div>{t("alerts.sensor_id")}</div>
                <div>{t("alerts.risk_class")}</div>
                <div>{t("alerts.value")}</div>
                <div>{t("alerts.status")}</div>
                <div>{t("alerts.actions")}</div>
              </div>

              <div className="max-h-[560px] overflow-auto">
                {isLoading && (
                  <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                    <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                    Chargement des alertes...
                  </div>
                )}
                {!isLoading && filtered.length === 0 && (
                  <div className="px-4 py-10 text-center text-sm text-muted-foreground">{t("alerts.empty")}</div>
                )}
                {filtered.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setSelected(a)}
                    type="button"
                    className="ui-table__row"
                    style={{
                      gridTemplateColumns: "190px 140px 140px 110px 160px 1fr",
                      background: selected?.id === a.id ? "hsl(var(--primary) / 0.10)" : undefined,
                    }}
                  >
                    <div className="text-xs text-muted-foreground">
                      {a.triggeredAt ? new Date(a.triggeredAt).toLocaleString(locale) : "—"}
                    </div>
                    <div className="text-xs font-mono text-foreground/90 truncate">{a.sensorId ?? "—"}</div>
                    <div className="text-xs">
                      <StatusBadge status={a.level} pulse={a.level === "critical"} />
                    </div>
                    <div className="text-xs font-mono font-semibold">{a.ppm ?? "--"} ppm</div>
                    <div>
                      <span
                        className={`rounded-full px-3 py-1 text-[11px] font-semibold border ${
                          a.status === "active"
                            ? "border-status-critical/30 bg-status-critical/10 text-status-critical"
                            : a.status === "acquittee"
                              ? "border-status-warning/30 bg-status-warning/10 text-status-warning"
                              : "border-status-good/30 bg-status-good/10 text-status-good"
                        }`}
                      >
                        {statusLabel(a.status)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {canOperate ? (
                        <>
                          {a.status === "active" && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                updateStatus(a, nextBackendStatus(a.status));
                              }}
                              className="ui-ghost ui-ghost--primary ui-pill--sm"
                              type="button"
                            >
                              {t("alerts.acknowledge")} <ChevronRight className="h-4 w-4" />
                            </button>
                          )}
                          {a.status === "acquittee" && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                updateStatus(a, nextBackendStatus(a.status));
                              }}
                              className="ui-ghost ui-ghost--primary ui-pill--sm"
                              type="button"
                            >
                              {t("alerts.resolve")} <ChevronRight className="h-4 w-4" />
                            </button>
                          )}
                          {a.status === "resolue" && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                updateStatus(a, "CLOSED");
                              }}
                              className="ui-ghost ui-pill--sm"
                              type="button"
                            >
                              <Archive className="h-4 w-4" /> {t("alerts.archive")}
                            </button>
                          )}
                        </>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">{t("alerts.readonly")}</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </GlassCard>

          <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }}>
            <GlassCard className="h-full p-4 xl:sticky xl:top-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-extrabold">{t("alerts.details")}</p>
                  <p className="mt-1 text-xs text-muted-foreground truncate">
                    {selected ? `#${selected.id}` : t("alerts.select_alert")}
                  </p>
                </div>
                <button
                  onClick={() => selected && setSelected({ ...selected })}
                  className="rounded-full border border-border/60 p-2 text-muted-foreground hover:text-foreground hover:bg-accent/10 transition"
                  title={t("alerts.details")}
                  type="button"
                >
                  <RefreshCw className={`h-4 w-4 ${contextLoading ? "animate-spin" : ""}`} />
                </button>
              </div>

              {!selected && <div className="mt-8 text-sm text-muted-foreground">{t("alerts.select_hint")}</div>}

              {selected && (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <StatusBadge status={selected.level} pulse={selected.level === "critical"} />
                    <Link to="/surveillance" className="inline-flex items-center gap-2 text-xs font-semibold text-primary hover:underline">
                      {t("alerts.open_monitoring")} <ExternalLink className="h-4 w-4" />
                    </Link>
                  </div>

                  <div className="rounded-2xl border border-border/60 bg-background/40 p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("alerts.message")}</div>
                    <p className="mt-1 text-sm leading-relaxed">{selected.message || "—"}</p>
                    <div className="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                      <div>
                        {t("alerts.co2")}: <span className="font-mono font-semibold text-foreground">{selected.ppm ?? "--"} ppm</span>
                      </div>
                      <div>
                        {t("alerts.threshold")}: <span className="font-mono font-semibold text-foreground">{selected.threshold ?? "--"} ppm</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/60 bg-background/40 p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("alerts.timeseries")}</div>
                      {contextError && <span className="text-xs text-status-critical">{contextError}</span>}
                    </div>
                    <div className="mt-2 h-[220px]">
                      {contextLoading ? (
                        <div className="h-full flex items-center justify-center text-sm text-muted-foreground">{t("settings.common.loading")}</div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={contextSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <defs>
                              <linearGradient id="alertFill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="6 6" vertical={false} stroke="hsl(var(--border) / 0.6)" />
                            <XAxis
                              type="number"
                              scale="time"
                              dataKey="t"
                              domain={["dataMin", "dataMax"]}
                              tick={{ fontSize: 10 }}
                              tickFormatter={(v) => new Date(v).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
                              stroke="hsl(var(--muted-foreground) / 0.6)"
                            />
                            <YAxis width={42} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground) / 0.6)" />
                            <Tooltip
                              contentStyle={{
                                background: "hsl(var(--popover) / 0.92)",
                                border: "1px solid hsl(var(--border) / 0.8)",
                                borderRadius: 12,
                                fontSize: 12,
                              }}
                              labelFormatter={(v) => new Date(v).toLocaleString(locale)}
                              formatter={(v) => [`${v} ppm`, "CO₂"]}
                            />
                            {typeof selected.threshold === "number" && (
                              <ReferenceLine y={selected.threshold} stroke="hsl(var(--status-warning) / 0.9)" strokeDasharray="4 6" />
                            )}
                            <Area type="monotone" dataKey="ppm" stroke="hsl(var(--primary))" strokeWidth={1.5} fill="url(#alertFill)" isAnimationActive={false} />
                          </AreaChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </GlassCard>
          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
}

function CountCard({ label, value, icon: Icon, tone }) {
  const cls = {
    critical: "bg-status-critical/10 text-status-critical",
    warning: "bg-status-warning/10 text-status-warning",
    good: "bg-status-good/10 text-status-good",
  }[tone];
  return (
    <GlassCard className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-bold tabular-nums">{value}</p>
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${cls}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </GlassCard>
  );
}
