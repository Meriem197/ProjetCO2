import { useMemo } from "react";
import { motion as Motion } from "framer-motion";
import { Activity, AlertTriangle, Droplets } from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { PremiumKpiCard } from "@/components/dashboard/DashboardCards";

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

function getQualityLabel(ppm, t) {
  if (ppm <= 450) return t("quality.excellent");
  if (ppm <= 650) return t("quality.good");
  if (ppm <= 1000) return t("quality.acceptable");
  if (ppm <= 1500) return t("quality.bad");
  return t("quality.dangerous");
}



function getRingPercent(ppm, maxPpm = 1500) {
  if (!Number.isFinite(ppm)) return 0;
  return clamp((ppm / maxPpm) * 100, 0, 100);
}

function ringGradientByStatus(status) {
  // Keep it thin & premium: gradients + subtle glow.
  if (status === "good") return { from: "#2DD4BF", to: "#06B6D4" };
  if (status === "warning") return { from: "#60A5FA", to: "#3B82F6" };
  return { from: "#F87171", to: "#EF4444" };
}

function Co2CircularIndicator({ value, status }) {
  const size = 92; // compact
  const stroke = 2; // very thin
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const percent = getRingPercent(value);
  const dash = (percent / 100) * c;

  const g = ringGradientByStatus(status);

  return (
    <div className="relative flex items-center justify-center">
      {/* Soft glow */}
      <div
        className="pointer-events-none absolute inset-0 rounded-full blur-[10px] opacity-80"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${g.to}33 0%, transparent 60%)`,
        }}
      />

      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="block">
          <defs>
            <linearGradient id="co2RingGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={g.from} />
              <stop offset="100%" stopColor={g.to} />
            </linearGradient>
            <filter id="co2Glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Background ring (no thick borders) */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="rgba(255,255,255,0.10)"
            strokeWidth={stroke}
            fill="transparent"
          />

          {/* Progress ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="url(#co2RingGrad)"
            strokeWidth={stroke}
            fill="transparent"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c - dash}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            filter="url(#co2Glow)"
          />
        </svg>

        {/* Center typography */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-[16px] font-semibold tabular-nums text-foreground/90 leading-none">
            {value}
          </div>
          <div className="text-[10px] font-semibold tracking-wide text-muted-foreground/90 mt-1">
            ppm
          </div>
        </div>
      </div>
    </div>
  );
}

function computeStats(history) {
  const ppmValues = Array.isArray(history)
    ? history.map((p) => Number(p.ppm)).filter((v) => Number.isFinite(v))
    : [];

  if (ppmValues.length === 0) {
    return { avg: 0, min: 0, max: 0 };
  }

  const sum = ppmValues.reduce((a, b) => a + b, 0);
  return {
    avg: Math.round(sum / ppmValues.length),
    min: Math.min(...ppmValues),
    max: Math.max(...ppmValues),
  };
}

export default function DashboardTopSection({
  current,
  status,
  threshold,
  history,
  // keep props for compatibility with existing hook/data, but we won't render extra KPI cards
  temperature,
  humidity,
  sensor,
  mqttStatus,
  alerts,
  sensorId,
}) {
  const { t } = useTranslation();
  const stats = useMemo(() => computeStats(history), [history]);

  const airQuality = useMemo(() => getQualityLabel(current, t), [current, t]);


  return (
    <div className="grid gap-12 lg:grid-cols-12 lg:items-stretch lg:gap-x-16">
      {/* LEFT: CO2 indicator (blend into dashboard; no white card container) */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="lg:col-span-3 flex items-center"
      >
        <div className="relative h-full rounded-3xl bg-transparent p-2">
          <div className="flex items-center gap-4">
            <div className="min-w-[92px]">
              <Co2CircularIndicator value={current} status={status} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                {t("sensors.current_co2")}
              </div>

              <div className="mt-3 flex items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/20 px-3 py-1 text-xs font-semibold text-foreground/90">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: status === "good" ? "#06B6D4" : status === "warning" ? "#3B82F6" : "#EF4444" }}
                  />
                  {airQuality}
                </span>
              </div>

              <div className="mt-3 text-xs text-muted-foreground">
                {t("sensors.critical_threshold")} :{" "}
                <span className="font-semibold text-foreground">{threshold} ppm</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* RIGHT: KPI cards (separés visuellement du bloc CO2/qualité d'air) */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.05 }}
        className="lg:col-span-9 lg:mt-0"
      >
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <PremiumKpiCard
            label={t("monitoring.average")}
            value={history?.length ? String(stats.avg) : "--"}
            icon={Activity}
            accent="primary"
            delay={0.05}
            className="hover:shadow-[0_0_30px_rgba(56,189,248,0.18)]"
          />

          <PremiumKpiCard
            label={t("monitoring.maximum")}
            value={history?.length ? String(stats.max) : "--"}
            icon={AlertTriangle}
            accent="warning"
            delay={0.1}
            className="hover:shadow-[0_0_30px_rgba(59,130,246,0.18)]"
          />

          <PremiumKpiCard
            label={t("monitoring.minimum")}
            value={history?.length ? String(stats.min) : "--"}
            icon={Droplets}
            accent="good"
            delay={0.15}
            className="hover:shadow-[0_0_30px_rgba(45,212,191,0.18)]"
          />
        </div>
      </motion.div>
    </div>
  );
}

