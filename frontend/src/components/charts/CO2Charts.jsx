import { Area, AreaChart, CartesianGrid, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, } from "recharts";
function fmtTime(t) {
    const d = new Date(t);
    return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}
export function CO2HistoryChart({ data, threshold = 1000, height = 280, compact }) {
    return (<ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="co2Fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35}/>
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false}/>
        <XAxis dataKey="t" tickFormatter={fmtTime} stroke="hsl(var(--muted-foreground))" fontSize={11} minTickGap={40}/>
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
    const merged = [
        ...history.slice(-48).map((p) => ({ t: p.t, real: p.ppm })),
        ...forecast.map((f) => ({ t: f.t, predicted: f.ppm, lower: f.lower, upper: f.upper })),
    ];
    return (<ResponsiveContainer width="100%" height={height}>
      <AreaChart data={merged} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="bandFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary-glow))" stopOpacity={0.35}/>
            <stop offset="100%" stopColor="hsl(var(--primary-glow))" stopOpacity={0.05}/>
          </linearGradient>
        </defs>
        <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false}/>
        <XAxis dataKey="t" tickFormatter={fmtTime} stroke="hsl(var(--muted-foreground))" fontSize={11} minTickGap={40}/>
        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} width={40}/>
        <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }} labelFormatter={(v) => fmtTime(Number(v))}/>
        <Area type="monotone" dataKey="upper" stroke="transparent" fill="url(#bandFill)" isAnimationActive={false}/>
        <Area type="monotone" dataKey="lower" stroke="transparent" fill="hsl(var(--background))" isAnimationActive={false}/>
        <Line type="monotone" dataKey="real" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} isAnimationActive={false}/>
        <Line type="monotone" dataKey="predicted" stroke="hsl(var(--primary-glow))" strokeDasharray="6 4" strokeWidth={2.5} dot={false} isAnimationActive={false}/>
      </AreaChart>
    </ResponsiveContainer>);
}
