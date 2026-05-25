import AppLayout from "@/components/layout/AppLayout";
import { useCO2Data } from "@/hooks/useCO2Data";
import { useMemo, useState, useCallback, useEffect } from "react";
import {
  AreaChart,
  Area,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { fetchUnifiedClassificationStats } from "@/services/classificationUnifiedService";
import { PieChart, Pie, Cell } from "recharts";
import { useTranslation } from "react-i18next";

const STATE_COLORS = {
  good: "#4CAF50",
  warning: "#FBBF24",
  critical: "#F87171",
  unknown: "#94A3B8",
};

const STATE_LABELS_FR = {
  good: "Air sain",
  warning: "Qualité moyenne",
  critical: "Critique",
  unknown: "—",
};

const PERIODS = [
  { key: "24h", label: "24h", api: "24h" },
  { key: "Semaine", label: "Semaine", api: "semaine" },
  { key: "Mois", label: "Mois", api: "mois" },
  { key: "Année", label: "Année", api: "an" },
];

const FILTERS = [
  { key: "brutes", label: "Données brutes" },
  { key: "moyenne", label: "Moyenne" },
  { key: "agrégé", label: "Agrégation par mois" },
];

function formatTickLabelFR(dateISO, periodKey, aggregation) {
  const d = new Date(dateISO);
  if (Number.isNaN(d.getTime())) return "";

  if (aggregation === "monthly") {
    return new Intl.DateTimeFormat("fr-FR", { month: "short", year: "2-digit" }).format(d);
  }
  if (periodKey === "Année" || periodKey === "Mois") {
    return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" }).format(d);
  }
  return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(d);
}

function formatRangeFR(startISO, endISO) {
  const a = new Date(startISO);
  const b = new Date(endISO);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return "—";
  const sameDay =
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (sameDay) {
    const day = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" }).format(a);
    const t1 = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(a);
    const t2 = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(b);
    return `${day} · ${t1} → ${t2}`;
  }

  const dt1 = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(a);
  const dt2 = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(b);
  return `${dt1} → ${dt2}`;
}

function TrendInline({ trend }) {
  const v = Number(trend?.ppmPerHour);
  const has = Number.isFinite(v);
  if (!has) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
        <Minus className="h-3.5 w-3.5" />
        tendance —
      </span>
    );
  }

  const up = v > 0;
  const down = v < 0;
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
  const color = up ? "text-status-critical" : down ? "text-status-good" : "text-muted-foreground";
  const sign = v > 0 ? "+" : "";

  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${color}`}>
      <Icon className="h-3.5 w-3.5" />
      {sign}
      {Math.round(v)} ppm/h
    </span>
  );
}

function DonutEtatCourant({ distribution, current, trend }) {
  const donutData = [
    { key: "good", name: "Air sain", value: distribution?.good ?? 0, color: STATE_COLORS.good },
    { key: "warning", name: "Qualité moyenne", value: distribution?.warning ?? 0, color: STATE_COLORS.warning },
    { key: "critical", name: "Critique", value: distribution?.critical ?? 0, color: STATE_COLORS.critical },
  ].filter((d) => Number(d.value) > 0);

  const fallback = donutData.length ? donutData : [{ key: "unknown", name: "—", value: 100, color: STATE_COLORS.unknown }];

  return (
    <div className="h-[320px] rounded-2xl border border-border/60 bg-card/55 p-3 flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-foreground">État courant</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">Répartition</p>
        </div>
      </div>

      <div className="mt-2 relative flex-1 flex items-center justify-center">
        <PieChart width={190} height={190}>
          <Pie
            data={fallback}
            dataKey="value"
            cx="50%"
            cy="50%"
            innerRadius={74}
            outerRadius={84}
            paddingAngle={2}
            stroke="transparent"
            isAnimationActive={false}
          >
            {fallback.map((entry) => (
              <Cell key={entry.key} fill={entry.color} />
            ))}
          </Pie>
        </PieChart>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-3xl font-extrabold tracking-tight text-foreground leading-none">
            {current || "—"} <span className="text-sm font-bold text-muted-foreground">ppm</span>
          </div>
          <div className="mt-1">
            <TrendInline trend={trend} />
          </div>
        </div>
      </div>

      <div className="mt-1 flex items-center justify-between gap-2 text-[11px]">
        {[
          { key: "good", label: "Air sain", value: distribution?.good ?? 0 },
          { key: "warning", label: "Moyenne", value: distribution?.warning ?? 0 },
          { key: "critical", label: "Critique", value: distribution?.critical ?? 0 },
        ].map((it) => (
          <div key={it.key} className="flex items-center gap-2 rounded-xl px-2 py-1">
            <span className="h-2 w-2 rounded-full" style={{ background: STATE_COLORS[it.key] }} />
            <span className="text-muted-foreground">
              {it.label} <span className="font-semibold text-foreground">{it.value}%</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Classification() {
  const { t } = useTranslation();
  const { current, threshold, sensorId } = useCO2Data();

  const [periodKey, setPeriodKey] = useState("24h"); // FR label key
  const [filter, setFilter] = useState("moyenne"); // brutes | moyenne | agrégé

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [stats, setStats] = useState({ max: 0, mean: 0, min: 0 });
  const [distribution, setDistribution] = useState({ good: 0, warning: 0, critical: 0 });
  const [historySegments, setHistorySegments] = useState([]);
  const [report, setReport] = useState(null);
  const [trend, setTrend] = useState(null);
  const [timeSeries, setTimeSeries] = useState([]);

  const fetchPeriod = useCallback(
    async ({ periodKey: nextPeriodKey, filter: nextFilter }) => {
      setLoading(true);
      setError(null);
      try {
        const period = PERIODS.find((p) => p.key === nextPeriodKey)?.api || "24h";
        const res = await fetchUnifiedClassificationStats({
          period,
          threshold,
          filter: nextFilter,
          // BUGFIX: le capteur est porté par le DataContext via `sensorId`, pas `sensor.sensorId`
          sensorId: sensorId || undefined,
        });

        setStats({
          max: res?.stats?.max ?? 0,
          mean: res?.stats?.mean ?? 0,
          min: res?.stats?.min ?? 0,
        });
        setTimeSeries(Array.isArray(res?.timeSeries) ? res.timeSeries : []);
        setDistribution(res?.distribution || { good: 0, warning: 0, critical: 0 });
        setHistorySegments(Array.isArray(res?.history) ? res.history : []);
        setReport(res?.report || null);
        setTrend(res?.trend || null);
      } catch (e) {
        setError(e?.response?.data?.error?.message || e?.message || "Impossible de charger la classification");
        setStats({ max: 0, mean: 0, min: 0 });
        setDistribution({ good: 0, warning: 0, critical: 0 });
        setHistorySegments([]);
        setReport(null);
        setTrend(null);
        setTimeSeries([]);
      } finally {
        setLoading(false);
      }
    },
    [threshold, sensorId]
  );

  useEffect(() => {
    fetchPeriod({ periodKey, filter });
  }, [fetchPeriod, periodKey, filter]);

  const chartData = useMemo(() => {
    return (timeSeries || []).map((p) => {
      const ppm = Number(p.ppm) || 0;
      const t = new Date(p.time).getTime();
      const good = Math.min(ppm, 600);
      const warning = Math.min(Math.max(ppm - 600, 0), Math.max(0, threshold - 600));
      const critical = Math.max(ppm - threshold, 0);
      return {
        t,
        label: formatTickLabelFR(p.time, periodKey, filter === "agrégé" ? "monthly" : "mean"),
        ppm,
        good,
        warning,
        critical,
      };
    }).filter((p) => Number.isFinite(p.t)).sort((a, b) => a.t - b.t);
  }, [timeSeries, threshold, periodKey, filter]);

  return (
    <AppLayout title={t("classification.title")} subtitle={t("classification.subtitle")}>
      <div className="rounded-2xl border border-border/60 bg-background/55 p-3 space-y-3">
        {/* Filtres + contexte (compact, intégré) */}
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <h1 className="text-lg font-extrabold tracking-tight text-foreground">{t("classification.title")}</h1>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                {t("classification.subtitle")}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 rounded-2xl border border-border/60 bg-background/70 p-1">
                {PERIODS.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => setPeriodKey(p.key)}
                    className={[
                      "px-3 py-1.5 rounded-xl text-xs font-semibold transition",
                      periodKey === p.key
                        ? "bg-primary text-primary-foreground shadow-soft"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/40",
                    ].join(" ")}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 rounded-2xl border border-border/60 bg-background/70 p-1">
                {FILTERS.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    className={[
                      "px-3 py-1.5 rounded-xl text-xs font-semibold transition",
                      filter === f.key
                        ? "bg-secondary text-secondary-foreground shadow-soft"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/40",
                    ].join(" ")}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {(error || loading) && (
            <div className="mt-2 text-xs">
              {error ? <span className="text-status-critical">{error}</span> : <span className="text-muted-foreground">Chargement…</span>}
            </div>
          )}
        </motion.div>

        {/* Section centrale (alignement parfait: 320px) */}
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-3">
          <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
            <DonutEtatCourant distribution={distribution} current={current} trend={trend} />
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: 0.03 }}>
            <div className="h-[320px] rounded-2xl border border-border/60 bg-card/55 p-3 flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-foreground">Évolution CO₂</h2>
                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate">Aires empilées · seuils 600 / {threshold}</p>
                </div>
              </div>

              <div className="mt-2 flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="fillGood" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={STATE_COLORS.good} stopOpacity={0.45} />
                        <stop offset="100%" stopColor={STATE_COLORS.good} stopOpacity={0.05} />
                      </linearGradient>
                      <linearGradient id="fillWarning" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={STATE_COLORS.warning} stopOpacity={0.40} />
                        <stop offset="100%" stopColor={STATE_COLORS.warning} stopOpacity={0.04} />
                      </linearGradient>
                      <linearGradient id="fillCritical" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={STATE_COLORS.critical} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={STATE_COLORS.critical} stopOpacity={0.03} />
                      </linearGradient>
                    </defs>

                    <CartesianGrid strokeDasharray="6 6" vertical={false} stroke="hsl(var(--border) / 0.55)" />
                    <XAxis
                      type="number"
                      scale="time"
                      dataKey="t"
                      domain={["dataMin", "dataMax"]}
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) =>
                        formatTickLabelFR(new Date(v).toISOString(), periodKey, filter === "agrégé" ? "monthly" : "mean")
                      }
                      stroke="hsl(var(--muted-foreground) / 0.5)"
                    />
                    <YAxis tick={{ fontSize: 11 }} width={46} stroke="hsl(var(--muted-foreground) / 0.5)" />

                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--popover) / 0.96)",
                        border: "1px solid hsl(var(--border) / 0.7)",
                        borderRadius: 14,
                        fontSize: 12,
                        boxShadow: "var(--shadow-card)",
                        padding: "10px 12px",
                      }}
                      formatter={(value, name) => {
                        if (name === "ppm") return [`${value} ppm`, "CO₂"];
                        return [`${Math.round(Number(value) || 0)} ppm`, name];
                      }}
                      labelFormatter={(v) => `Temps: ${new Date(v).toLocaleString("fr-FR")}`}
                    />

                    {/* Lignes d’horizon (pointillées) */}
                    <ReferenceLine y={600} stroke="hsl(var(--muted-foreground) / 0.55)" strokeDasharray="4 6" />
                    <ReferenceLine y={threshold} stroke="hsl(var(--muted-foreground) / 0.55)" strokeDasharray="4 6" />

                    {/* Aires empilées (bonne lisibilité + “couleur qui traverse les limites”) */}
                    <Area type="monotone" dataKey="good" stackId="1" stroke="none" fill="url(#fillGood)" isAnimationActive={false} />
                    <Area type="monotone" dataKey="warning" stackId="1" stroke="none" fill="url(#fillWarning)" isAnimationActive={false} />
                    <Area type="monotone" dataKey="critical" stackId="1" stroke="none" fill="url(#fillCritical)" isAnimationActive={false} />

                    {/* Courbe globale (fine) */}
                    <Area type="monotone" dataKey="ppm" stroke="hsl(var(--foreground) / 0.6)" strokeWidth={1.5} fill="transparent" isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                <div className="rounded-xl border border-border/60 bg-background/70 px-3 py-2">
                  <div className="text-muted-foreground">Max</div>
                  <div className="text-sm font-extrabold text-foreground">{Math.round(stats.max)} ppm</div>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/70 px-3 py-2">
                  <div className="text-muted-foreground">Moyenne</div>
                  <div className="text-sm font-extrabold text-foreground">{Math.round(stats.mean)} ppm</div>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/70 px-3 py-2">
                  <div className="text-muted-foreground">Min</div>
                  <div className="text-sm font-extrabold text-foreground">{Math.round(stats.min)} ppm</div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Section basse (table + rapport) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border/60 bg-card/55 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-foreground">Historique</h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">Derniers états</p>
              </div>
              <span className="text-[11px] text-muted-foreground">{historySegments.length}</span>
            </div>

            <div className="mt-2 overflow-hidden rounded-xl border border-border/60 bg-background/60">
              <div className="grid grid-cols-[1.4fr_1fr] px-3 py-2 text-[11px] font-semibold text-muted-foreground border-b border-border/60">
                <div>Time period</div>
                <div>Seuils / Durée</div>
              </div>

              <div className="max-h-[300px] overflow-auto">
                {historySegments.length === 0 ? (
                  <div className="px-3 py-8 text-center text-xs text-muted-foreground">Aucune donnée.</div>
                ) : (
                  historySegments.map((row, idx) => (
                    <div key={`${row.start}-${idx}`} className="grid grid-cols-[1.4fr_1fr] px-3 py-2 text-xs border-b border-border/40 last:border-b-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: STATE_COLORS[row.state] || STATE_COLORS.unknown }} />
                        <span className="truncate text-foreground">{formatRangeFR(row.start, row.end)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground">{row.rangeLabel}</span>
                        <span className="font-semibold text-foreground">{row.durationLabel}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card/55 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-foreground truncate">Rapport - {periodKey}</h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">Généré dynamiquement</p>
              </div>
              {report?.predominantState && (
                <span
                  className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold border shrink-0"
                  style={{
                    background: `${STATE_COLORS[report.predominantState] || STATE_COLORS.unknown}15`,
                    borderColor: `${STATE_COLORS[report.predominantState] || STATE_COLORS.unknown}35`,
                    color: STATE_COLORS[report.predominantState] || STATE_COLORS.unknown,
                  }}
                >
                  {STATE_LABELS_FR[report.predominantState] || "—"}
                </span>
              )}
            </div>

            <div className="mt-2 space-y-2">
              <div className="rounded-xl border border-border/60 bg-background/65 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Synthèse</div>
                <p className="mt-1.5 text-sm text-foreground leading-relaxed">
                  {report?.summary || (loading ? "Génération du rapport…" : "—")}
                </p>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/65 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Recommandations</div>
                <p className="mt-1.5 text-sm text-foreground leading-relaxed">
                  {report?.recommendation || (loading ? "Analyse des pics…" : "—")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

