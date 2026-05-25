import { Area, AreaChart, CartesianGrid, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, } from "recharts";
function fmtTime(t) {
    const d = new Date(t);
    return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}
export function CO2HistoryChart({ data, threshold = 1000, height = 280, compact }) {
    const sorted = [...(Array.isArray(data) ? data : [])].sort((a, b) => Number(a.t) - Number(b.t));
    return (<ResponsiveContainer width="100%" height={height}>
      <AreaChart data={sorted} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="co2Fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35}/>
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false}/>
        <XAxis type="number" scale="time" dataKey="t" domain={["dataMin", "dataMax"]} tickFormatter={fmtTime} stroke="hsl(var(--muted-foreground))" fontSize={11} minTickGap={40}/>
        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} width={40} domain={["dataMin - 50", "dataMax + 50"]}/>
        <Tooltip contentStyle={{
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 12,
            fontSize: 12,
        }} labelFormatter={(v) => fmtTime(Number(v))} formatter={(v) => [`${v} ppm`, "CO₂"]}/>
        {!compact && (<ReferenceLine y={threshold} stroke="hsl(var(--status-critical))" strokeDasharray="5 5" label={{ value: `Seuil ${threshold}`, fill: "hsl(var(--status-critical))", fontSize: 11, position: "right" }}/>)}
        <Area type="monotone" dataKey="ppm" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#co2Fill)" isAnimationActive={false}/>
      </AreaChart>
    </ResponsiveContainer>);
}
export function CO2ForecastChart({ history, forecast, height = 320, }) {
    const historyPart = [...(Array.isArray(history) ? history : [])]
        .map((p) => ({ t: Number(p.t), real: Number(p.ppm) }))
        .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.real))
        .slice(-48);
    const lastHistoryT = historyPart.length ? historyPart[historyPart.length - 1].t : -Infinity;
    const forecastPart = [...(Array.isArray(forecast) ? forecast : [])]
        .map((f) => ({
        t: Number(f.t),
        predicted: Number(f.ppm),
        lower: Number.isFinite(Number(f.lower)) ? Number(f.lower) : null,
        upper: Number.isFinite(Number(f.upper)) ? Number(f.upper) : null,
    }))
        .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.predicted) && p.t > lastHistoryT);
    const merged = [
        ...historyPart,
        ...forecastPart,
    ].sort((a, b) => a.t - b.t);
    return (<ResponsiveContainer width="100%" height={height}>
      <AreaChart data={merged} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="bandFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary-glow))" stopOpacity={0.35}/>
            <stop offset="100%" stopColor="hsl(var(--primary-glow))" stopOpacity={0.05}/>
          </linearGradient>
        </defs>
        <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false}/>
        <XAxis type="number" scale="time" dataKey="t" domain={["dataMin", "dataMax"]} tickFormatter={fmtTime} stroke="hsl(var(--muted-foreground))" fontSize={11} minTickGap={40}/>
        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} width={40}/>
        <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }} labelFormatter={(v) => fmtTime(Number(v))}/>
        <Area type="monotone" dataKey="upper" stroke="transparent" fill="url(#bandFill)" isAnimationActive={false}/>
        <Line type="monotone" dataKey="real" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} isAnimationActive={false}/>
        <Line type="monotone" dataKey="upper" stroke="hsl(var(--primary-glow))" strokeDasharray="2 3" strokeWidth={1.2} dot={false} isAnimationActive={false}/>
        <Line type="monotone" dataKey="lower" stroke="hsl(var(--primary-glow))" strokeDasharray="2 3" strokeWidth={1.2} dot={false} isAnimationActive={false}/>
        <Line type="monotone" dataKey="predicted" stroke="hsl(var(--primary-glow))" strokeDasharray="6 4" strokeWidth={2.5} dot={false} isAnimationActive={false}/>
      </AreaChart>
    </ResponsiveContainer>);
}
