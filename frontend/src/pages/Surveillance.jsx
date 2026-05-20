import { useMemo } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { GlassCard } from "@/components/ui/glass-card";
import { CO2HistoryChart } from "@/components/charts/CO2Charts";
import { useCO2Data } from "@/hooks/useCO2Data";
import { Download, FileText, Radio } from "lucide-react";
import jsPDF from "jspdf";
export default function Surveillance() {
    const { history, threshold, sensor, isLive } = useCO2Data();
    const stats = useMemo(() => {
        const ppms = history.map((p) => p.ppm);
        return {
            avg: Math.round(ppms.reduce((a, b) => a + b, 0) / Math.max(ppms.length, 1)),
            max: Math.max(...ppms),
            min: Math.min(...ppms),
            count: ppms.length,
        };
    }, [history]);
    const exportCSV = () => {
        const rows = [["timestamp_iso", "ppm"], ...history.map((p) => [new Date(p.t).toISOString(), String(p.ppm)])];
        const csv = rows.map((r) => r.join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `airsense_co2_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };
    const exportPDF = () => {
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text("AirSense — Rapport de surveillance CO₂", 14, 20);
        doc.setFontSize(10);
        doc.text(`Généré le ${new Date().toLocaleString("fr-FR")}`, 14, 28);
        doc.setFontSize(12);
        doc.text(`Moyenne : ${stats.avg} ppm`, 14, 44);
        doc.text(`Maximum : ${stats.max} ppm`, 14, 52);
        doc.text(`Minimum : ${stats.min} ppm`, 14, 60);
        doc.text(`Mesures : ${stats.count}`, 14, 68);
        doc.text(`Seuil critique configuré : ${threshold} ppm`, 14, 76);
        doc.save(`airsense_rapport_${new Date().toISOString().slice(0, 10)}.pdf`);
    };
    return (<AppLayout title="Surveillance" subtitle="Analyse historique et placement des capteurs">
      <div className="grid gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 rounded-full border border-border/60 bg-card px-4 py-2 text-sm">
            <Radio className={`h-4 w-4 ${isLive ? "text-status-good" : "text-status-warning"}`}/>
            <span className="font-medium">Capteur principal</span>
            <span className="text-muted-foreground">·</span>
            <span className="capitalize text-muted-foreground">{sensor.mqtt}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={exportCSV} className="flex items-center gap-2 rounded-xl border border-border/60 bg-card px-4 py-2 text-sm font-medium hover:bg-accent transition">
              <Download className="h-4 w-4"/> Exporter CSV
            </button>
            <button onClick={exportPDF} className="flex items-center gap-2 rounded-xl bg-gradient-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-glow hover:opacity-95 transition">
              <FileText className="h-4 w-4"/> Rapport PDF
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { l: "Minimum", v: stats.min, color: "text-status-good" },
            { l: "Moyenne", v: stats.avg, color: "text-primary" },
            { l: "Maximum", v: stats.max, color: "text-status-critical" },
        ].map((k, i) => (<GlassCard key={k.l} delay={i * 0.05}>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{k.l}</p>
              <p className={`mt-2 text-3xl font-bold tabular-nums ${k.color}`}>{k.v} <span className="text-base text-muted-foreground">ppm</span></p>
            </GlassCard>))}
        </div>

        <GlassCard delay={0.15}>
          <h3 className="mb-4 text-base font-semibold">Évolution CO₂ — 24 dernières heures</h3>
          <CO2HistoryChart data={history} threshold={threshold} height={340}/>
        </GlassCard>

      </div>
    </AppLayout>);
}
