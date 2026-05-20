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
} from "lucide-react";
import { motion } from "framer-motion";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Link } from "react-router-dom";
export default function Alertes() {
    const { alerts } = useCO2Data();
    const { hasRole, user } = useAuth();
    const role = String(user?.role || "").toUpperCase();
    const canOperate = hasRole("ADMIN", "TECHNICIAN");
    const [filter, setFilter] = useState("all"); // all | active | acquittee | resolue
    const [selected, setSelected] = useState(null);
    const [contextLoading, setContextLoading] = useState(false);
    const [contextError, setContextError] = useState("");
    const [contextSeries, setContextSeries] = useState([]);

    const filtered = useMemo(() => {
        if (filter === "all")
            return alerts;
        return alerts.filter((a) => a.status === filter);
    }, [alerts, filter]);

    const active = alerts.filter((a) => a.status === "active").length;
    const ack = alerts.filter((a) => a.status === "acquittee").length;
    const done = alerts.filter((a) => a.status === "resolue").length;

    useEffect(() => {
        let mounted = true;
        const loadContext = async () => {
            if (!selected?.id)
                return;
            setContextLoading(true);
            setContextError("");
            try {
                const res = await api.get(`/alerts/${selected.id}/context`);
                const payload = unwrapApiData(res.data);
                const series = Array.isArray(payload?.series) ? payload.series : [];
                if (!mounted)
                    return;
                setContextSeries(series.map((p) => ({
                    t: p.time,
                    label: new Date(p.time).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
                    ppm: p.ppm,
                })));
            }
            catch (e) {
                if (!mounted)
                    return;
                setContextError(e?.response?.data?.error?.message || "Impossible de charger le contexte de l’alerte.");
                setContextSeries([]);
            }
            finally {
                if (mounted)
                    setContextLoading(false);
            }
        };
        loadContext();
        return () => {
            mounted = false;
        };
    }, [selected?.id]);

    const updateStatus = async (alertRow, next) => {
        try {
            await api.patch(`/alerts/${alertRow.id}`, { status: next });
        }
        catch (_e) {
            // le polling/socket rafraîchira; éviter de bloquer l’UI
        }
    };

    const nextBackendStatus = (uiStatus) => {
        if (uiStatus === "active")
            return "ACKNOWLEDGED";
        if (uiStatus === "acquittee")
            return "RESOLVED";
        return "RESOLVED";
    };

    const statusLabel = (uiStatus) => {
        if (uiStatus === "active")
            return "Non traitée";
        if (uiStatus === "acquittee")
            return "En cours";
        return "Résolue";
    };

    return (<AppLayout title="Alertes & Maintenance" subtitle="Tri, diagnostic et actions temps réel (WebSockets)">
      <div className="space-y-4">
        {active > 0 && (<motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 rounded-2xl border border-status-critical/35 bg-status-critical/10 px-4 py-3 text-status-critical">
            <ShieldAlert className="h-5 w-5 animate-pulse-critical"/>
            <p className="text-sm">
              <span className="font-semibold">{active} alerte{active > 1 ? "s" : ""}</span> active{active > 1 ? "s" : ""} — intervention requise.
            </p>
          </motion.div>)}

        <div className="grid gap-3 sm:grid-cols-3">
          <CountCard label="Actives" value={active} icon={Bell} tone="critical"/>
          <CountCard label="En cours" value={ack} icon={Clock} tone="warning"/>
          <CountCard label="Résolues" value={done} icon={CheckCircle2} tone="good"/>
        </div>

        <GlassCard className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Filtrer les alertes
            </p>
            <button onClick={() => setSelected(null)} className="rounded-full border border-border/60 px-4 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-accent/10 hover:text-foreground">
              Fermer détails
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {["all", "active", "acquittee", "resolue"].map((f) => (<button key={f} onClick={() => setFilter(f)} className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition ${filter === f
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/60 bg-card/40 text-muted-foreground hover:text-foreground hover:bg-accent/10"}`}>
                {f === "all" ? "Toutes" : f === "active" ? "Actives" : f === "acquittee" ? "En cours" : "Résolues"}
              </button>))}
          </div>
        </GlassCard>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
          {/* Tableau compact */}
          <GlassCard className="p-0">
            <div className="overflow-hidden rounded-2xl">
              <div className="border-b border-border/60 px-4 py-3">
                <p className="text-sm font-bold">Liste des alertes</p>
                <p className="text-xs text-muted-foreground">
                  {filtered.length} alerte{filtered.length > 1 ? "s" : ""} affichée{filtered.length > 1 ? "s" : ""}
                </p>
              </div>
              <div className="ui-table__head min-w-[940px]" style={{ gridTemplateColumns: "190px 140px 140px 110px 160px 1fr" }}>
                <div>Horodatage</div>
                <div>ID Capteur</div>
                <div>Classe risque</div>
                <div>Valeur</div>
                <div>Statut</div>
                <div>Actions</div>
              </div>

              <div className="max-h-[560px] overflow-auto">
                {filtered.length === 0 && (<div className="px-4 py-10 text-center text-sm text-muted-foreground">
                    Aucune alerte pour ce filtre.
                  </div>)}
                {filtered.map((a) => (<button key={a.id} onClick={() => setSelected(a)} className={`ui-table__row`} style={{
                    gridTemplateColumns: "190px 140px 140px 110px 160px 1fr",
                    background: selected?.id === a.id ? "hsl(var(--primary) / 0.10)" : undefined,
                }}>
                    <div className="text-xs text-muted-foreground">
                      {a.triggeredAt ? new Date(a.triggeredAt).toLocaleString("fr-FR") : "—"}
                    </div>
                    <div className="text-xs font-mono text-foreground/90 truncate">{a.sensorId ?? "—"}</div>
                    <div className="text-xs">
                      <StatusBadge status={a.level} pulse={a.level === "critical"} />
                    </div>
                    <div className="text-xs font-mono font-semibold">{a.ppm ?? "--"} ppm</div>
                    <div>
                      <span className={`rounded-full px-3 py-1 text-[11px] font-semibold border ${a.status === "active"
                        ? "border-status-critical/30 bg-status-critical/10 text-status-critical"
                        : a.status === "acquittee"
                          ? "border-status-warning/30 bg-status-warning/10 text-status-warning"
                          : "border-status-good/30 bg-status-good/10 text-status-good"}`}>
                        {statusLabel(a.status)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {canOperate ? (<>
                          {a.status === "active" && (<button onClick={(e) => {
                            e.stopPropagation();
                            updateStatus(a, nextBackendStatus(a.status));
                          }} className="ui-ghost ui-ghost--primary ui-pill--sm">
                            Acquitter <ChevronRight className="h-4 w-4"/>
                          </button>)}
                          {a.status === "acquittee" && (<button onClick={(e) => {
                            e.stopPropagation();
                            updateStatus(a, nextBackendStatus(a.status));
                          }} className="ui-ghost ui-ghost--primary ui-pill--sm">
                            Résolue <ChevronRight className="h-4 w-4"/>
                          </button>)}
                          {a.status === "resolue" && (<span className="text-[11px] text-muted-foreground">—</span>)}
                        </>) : (<span className="text-[11px] text-muted-foreground">Lecture seule ({role})</span>)}
                    </div>
                  </button>))}
              </div>
            </div>
          </GlassCard>

          {/* Panneau latéral (détails) */}
          <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }}>
            <GlassCard className="h-full p-4 xl:sticky xl:top-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-extrabold">Détails</p>
                  <p className="mt-1 text-xs text-muted-foreground truncate">
                    {selected ? `Alerte #${selected.id}` : "Sélectionner une alerte"}
                  </p>
                </div>
                <button
                  onClick={() => selected && setSelected({ ...selected })}
                  className="rounded-full border border-border/60 p-2 text-muted-foreground hover:text-foreground hover:bg-accent/10 transition"
                  title="Rafraîchir"
                >
                  <RefreshCw className={`h-4 w-4 ${contextLoading ? "animate-spin" : ""}`} />
                </button>
              </div>

              {!selected && (
                <div className="mt-8 text-sm text-muted-foreground">
                  Clique sur une alerte dans le tableau pour voir la série temporelle autour de l’anomalie.
                </div>
              )}

              {selected && (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <StatusBadge status={selected.level} pulse={selected.level === "critical"} />
                    <Link to="/surveillance" className="inline-flex items-center gap-2 text-xs font-semibold text-primary hover:underline">
                      Ouvrir surveillance <ExternalLink className="h-4 w-4" />
                    </Link>
                  </div>

                  <div className="rounded-2xl border border-border/60 bg-background/40 p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Message</div>
                    <p className="mt-1 text-sm leading-relaxed">{selected.message || "Aucun message fourni."}</p>
                    <div className="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                      <div>
                        CO₂: <span className="font-mono font-semibold text-foreground">{selected.ppm ?? "--"} ppm</span>
                      </div>
                      <div>
                        Seuil: <span className="font-mono font-semibold text-foreground">{selected.threshold ?? "--"} ppm</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/60 bg-background/40 p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Série temporelle (±15 min)
                      </div>
                      {contextError && <span className="text-xs text-status-critical">{contextError}</span>}
                    </div>
                    <div className="mt-2 h-[220px]">
                      {contextLoading ? (
                        <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                          Chargement…
                        </div>
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
                            <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground) / 0.6)" />
                            <YAxis width={42} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground) / 0.6)" />
                            <Tooltip
                              contentStyle={{
                                background: "hsl(var(--popover) / 0.92)",
                                border: "1px solid hsl(var(--border) / 0.8)",
                                borderRadius: 12,
                                fontSize: 12,
                              }}
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
    </AppLayout>);
}
function CountCard({ label, value, icon: Icon, tone }) {
    const cls = {
        critical: "bg-status-critical/10 text-status-critical",
        warning: "bg-status-warning/10 text-status-warning",
        good: "bg-status-good/10 text-status-good",
    }[tone];
    return (<GlassCard className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-bold tabular-nums">{value}</p>
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${cls}`}>
          <Icon className="h-5 w-5"/>
        </div>
      </div>
    </GlassCard>);
}
