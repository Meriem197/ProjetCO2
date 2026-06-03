import { useMemo } from "react";
import { Activity, Battery, Loader2, Radio, TrendingDown, TrendingUp, Wind } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { GlassCard } from "@/components/ui/glass-card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { CO2HistoryChart } from "@/components/charts/CO2Charts";
import { useCO2Data } from "@/hooks/useCO2Data";
import { getCo2Metrology } from "@/lib/co2Metrology";

function signalLabel(rssi) {
  if (!Number.isFinite(rssi)) return "N/A";
  if (rssi >= -60) return "Excellent";
  if (rssi >= -75) return "Stable";
  return "Faible";
}

export default function Dashboard() {
  const { current, history, sensor, alerts, threshold, limits, isLoading, error } = useCO2Data();

  const metrics = useMemo(() => {
    const latest = history.slice(-12);
    const previous = history.slice(-24, -12);
    const avgNow = latest.length ? latest.reduce((s, p) => s + p.ppm, 0) / latest.length : current;
    const avgPrev = previous.length ? previous.reduce((s, p) => s + p.ppm, 0) / previous.length : avgNow;
    const trendDelta = Math.round(avgNow - avgPrev);
    return {
      trendDelta,
      trendUp: trendDelta > 0,
      battery: Number.isFinite(sensor?.battery) ? Math.max(0, Math.min(100, Number(sensor.battery))) : null,
      rssi: Number.isFinite(sensor?.wifi) ? Number(sensor.wifi) : null,
      activeAlerts: alerts.filter((a) => a.status === "active").length,
    };
  }, [history, current, sensor, alerts]);

  const tone = getCo2Metrology(current, limits);

  return (
    <AppLayout title="Tableau de bord" subtitle="Monitoring CO₂ temps réel, batterie et signal IoT">
      <div className="grid gap-4">
        <div className="grid gap-4 lg:grid-cols-4">
          <GlassCard className="rounded-xl border border-slate-800/60 p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Concentration actuelle</p>
            {isLoading ? (
              <Skeleton className="mt-3 h-10 w-24 rounded-xl" />
            ) : (
              <div className="mt-3">
                <p className="text-3xl font-bold tabular-nums">
                  {current} <span className="text-base text-muted-foreground">ppm</span>
                </p>
                <span className={`mt-2 inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${tone.badgeClass}`}>
                  <Wind className="mr-1 h-3.5 w-3.5" /> {tone.label}
                </span>
              </div>
            )}
          </GlassCard>

          <GlassCard className="rounded-xl border border-slate-800/60 p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Tendance</p>
            {isLoading ? (
              <Skeleton className="mt-3 h-10 w-28 rounded-xl" />
            ) : (
              <div className="mt-3 flex items-center gap-2">
                {metrics.trendUp ? <TrendingUp className="h-5 w-5 text-rose-500" /> : <TrendingDown className="h-5 w-5 text-emerald-500" />}
                <p className={`text-2xl font-bold ${metrics.trendUp ? "text-rose-500" : "text-emerald-500"}`}>
                  {metrics.trendDelta > 0 ? "+" : ""}
                  {metrics.trendDelta} ppm
                </p>
              </div>
            )}
          </GlassCard>

          <GlassCard className="rounded-xl border border-slate-800/60 p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Autonomie batterie</p>
            {isLoading ? (
              <Skeleton className="mt-3 h-10 w-20 rounded-xl" />
            ) : (
              <div className="mt-3 flex items-center gap-2">
                <Battery className="h-5 w-5 text-primary" />
                <p className="text-2xl font-bold tabular-nums">
                  {metrics.battery ?? "N/A"}
                  {metrics.battery != null ? "%" : ""}
                </p>
              </div>
            )}
          </GlassCard>

          <GlassCard className="rounded-xl border border-slate-800/60 p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Stabilité signal RSSI</p>
            {isLoading ? (
              <Skeleton className="mt-3 h-10 w-24 rounded-xl" />
            ) : (
              <div className="mt-3 flex items-center gap-2">
                <Radio className="h-5 w-5 text-primary" />
                <p className="text-xl font-semibold">{signalLabel(metrics.rssi)}</p>
                <span className="text-sm text-muted-foreground">{metrics.rssi ?? "N/A"} dBm</span>
              </div>
            )}
          </GlassCard>
        </div>

        <GlassCard className="rounded-xl border border-slate-800/60 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Historique CO₂</p>
              <p className="text-xs text-muted-foreground">Seuil modéré: {threshold} ppm</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-800 bg-slate-900/40 px-3 py-1 text-xs text-muted-foreground">
              <Activity className="h-3.5 w-3.5" /> {metrics.activeAlerts} alertes actives
            </span>
          </div>
          {isLoading ? (
            <div className="flex h-[340px] items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Chargement des données...
            </div>
          ) : history.length === 0 ? (
            <EmptyState
              className="h-[340px]"
              title="Aucune mesure disponible"
              description="Vérifiez la connexion MQTT et qu'InfluxDB reçoit les publications du capteur."
            />
          ) : (
            <CO2HistoryChart data={history} threshold={threshold} height={340} />
          )}
          {error && <p className="mt-2 text-xs text-rose-500">{error}</p>}
        </GlassCard>
      </div>
    </AppLayout>
  );
}
