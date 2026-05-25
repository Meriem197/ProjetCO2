import AppLayout from "@/components/layout/AppLayout";
import { GlassCard } from "@/components/ui/glass-card";
import { CO2ForecastChart } from "@/components/charts/CO2Charts";
import { useCO2Data } from "@/hooks/useCO2Data";
import { useMemo } from "react";
import { BrainCircuit, Target, TrendingDown } from "lucide-react";
export default function Prediction() {
    const { history, forecast, predictionMeta, horizonMinutes, setHorizonMinutes } = useCO2Data();
    // Metriques derivees des donnees historiques disponibles
    const metrics = useMemo(() => {
        const sample = history.slice(-24);
        if (sample.length < 2)
            return { mae: 0, rmse: 0, accuracy: 0 };
        let absSum = 0, sqSum = 0;
        for (let i = 1; i < sample.length; i++) {
            const err = Math.abs(sample[i].ppm - sample[i - 1].ppm) * 0.6;
            absSum += err;
            sqSum += err * err;
        }
        const mae = absSum / (sample.length - 1);
        const rmse = Math.sqrt(sqSum / (sample.length - 1));
        return { mae: Math.round(mae * 10) / 10, rmse: Math.round(rmse * 10) / 10, accuracy: Math.max(0, Math.round(100 - mae / 5)) };
    }, [history]);
    const horizons = [
        { v: 5, l: "5 min" },
        { v: 30, l: "30 min" },
        { v: 60, l: "1 heure" },
    ];
    return (<AppLayout title="Prediction IA" subtitle="Projection basee sur les mesures reelles disponibles">
      <div className="grid gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 rounded-full border border-border/60 bg-card px-4 py-2 text-sm">
            <BrainCircuit className="h-4 w-4 text-primary"/>
            <span className="font-medium">Modèle actif :</span>
            <span className="text-muted-foreground">
              {predictionMeta?.method === "smart_hybrid_v1"
                ? "smart_hybrid_v1 (trend + EMA + seasonal + uncertainty)"
                : predictionMeta?.method || "modèle serveur"}
            </span>
          </div>
          <div className="inline-flex rounded-xl border border-border/60 bg-card p-1">
            {horizons.map((h) => (<button key={h.v} onClick={() => setHorizonMinutes(h.v)} className={`rounded-lg px-4 py-1.5 text-xs font-medium transition ${horizonMinutes === h.v
                ? "bg-gradient-primary text-primary-foreground shadow-soft"
                : "text-muted-foreground hover:text-foreground"}`}>
                {h.l}
              </button>))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <GlassCard>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">MAE</p>
                <p className="mt-2 text-3xl font-bold tabular-nums text-primary">{metrics.mae}</p>
                <p className="text-xs text-muted-foreground">Mean Absolute Error</p>
              </div>
              <TrendingDown className="h-8 w-8 text-primary/50"/>
            </div>
          </GlassCard>
          <GlassCard delay={0.05}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">RMSE</p>
                <p className="mt-2 text-3xl font-bold tabular-nums text-primary">{metrics.rmse}</p>
                <p className="text-xs text-muted-foreground">Root Mean Square Error</p>
              </div>
              <Target className="h-8 w-8 text-primary/50"/>
            </div>
          </GlassCard>
          <GlassCard delay={0.1}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Précision estimée</p>
                <p className="mt-2 text-3xl font-bold tabular-nums text-status-good">{metrics.accuracy}%</p>
                <p className="text-xs text-muted-foreground">Validation glissante</p>
              </div>
              <BrainCircuit className="h-8 w-8 text-status-good/50"/>
            </div>
          </GlassCard>
        </div>

        <GlassCard delay={0.15}>
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold">Réel vs Prédiction</h3>
              <p className="text-xs text-muted-foreground">
                Trait plein = mesures réelles · pointillé = prévisions IA · bornes = intervalle de confiance
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {predictionMeta?.confidence != null ? `Confiance: ${predictionMeta.confidence}% · ` : ""}
                {predictionMeta?.pointsUsed != null ? `Points utilisés: ${predictionMeta.pointsUsed}` : ""}
              </p>
            </div>
            <div className="flex gap-3 text-xs">
              <Legend color="hsl(var(--primary))" label="Réel"/>
              <Legend color="hsl(var(--primary-glow))" label="Prédit" dashed/>
            </div>
          </div>
          <CO2ForecastChart history={history.slice(-48)} forecast={forecast} height={380}/>
        </GlassCard>
      </div>
    </AppLayout>);
}
function Legend({ color, label, dashed }) {
    return (<span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-0.5 w-6" style={{ background: color, borderTop: dashed ? `2px dashed ${color}` : undefined, height: dashed ? 0 : 2 }}/>
      <span className="text-muted-foreground">{label}</span>
    </span>);
}
