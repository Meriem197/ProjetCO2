import { motion } from "framer-motion";


/**
 * PremiumKpiCard - Carte KPI moderne avec icône et statut
 */
export function PremiumKpiCard({
  label,
  value,
  icon: Icon,
  accent = "primary",
  trend,
  delay = 0,
  className = "",
}) {
  const accentColors = {
    primary: "bg-primary/12 text-primary border-primary/20",
    warning: "bg-status-warning/12 text-status-warning border-status-warning/20",
    critical: "bg-status-critical/12 text-status-critical border-status-critical/20",
    good: "bg-status-good/12 text-status-good border-status-good/20",
    secondary: "bg-secondary/12 text-secondary border-secondary/20",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className={`group rounded-2xl border border-border/50 bg-card/60 backdrop-blur-sm p-4 shadow-soft hover:shadow-card hover:border-border/80 transition-all duration-300 ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
            {label}
          </p>
          <p className="text-2xl font-bold tabular-nums mt-1.5 text-foreground">
            {value}
          </p>
          {trend && (
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {trend}
            </p>
          )}
        </div>

        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl ${accentColors[accent]} border flex-shrink-0`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </motion.div>
  );
}

/**
 * LargeCO2Card - Grande carte principale pour la concentration CO2
 */
export function LargeCO2Card({
  current,
  threshold,
  isLive,
  statusGradient,
}) {
  const getQualityLabel = (ppm) => {
    if (ppm <= 450) return "Excellent";
    if (ppm <= 650) return "Bon";
    if (ppm <= 1000) return "Acceptable";
    if (ppm <= 1500) return "Mauvais";
    return "Dangereux";
  };

  const getProgressPercent = (ppm) => Math.min(100, (ppm / 1500) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className={`relative overflow-hidden rounded-3xl border border-border/50 p-8 shadow-elevated transition-all duration-300 ${statusGradient} bg-gradient-to-br`}
    >
      {/* Gradient overlay pour profondeur */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />

      <div className="relative z-10">
        {/* Header avec label et live indicator */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-white/80">
              Concentration CO₂
            </p>
            {isLive && (
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-white/20 px-3 py-1 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  Direct Live
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Grande valeur CO2 */}
        <div className="mb-8">
          <div className="flex items-baseline gap-2">
            <span className="text-7xl font-black text-white tabular-nums tracking-tight">
              {current}
            </span>
            <span className="text-3xl font-bold text-white/90">ppm</span>
          </div>
        </div>

        {/* Quality indicator */}
        <div className="mb-8">
          <div className="inline-block px-4 py-2 rounded-full bg-white/15 border border-white/30">
            <span className="text-sm font-bold text-white">
              {getQualityLabel(current)}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="h-2.5 w-full rounded-full bg-white/20 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${getProgressPercent(current)}%` }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="h-full bg-white/80 rounded-full"
            />
          </div>
        </div>

        {/* Scale labels */}
        <div className="flex justify-between text-xs font-medium text-white/70">
          <span>0</span>
          <span>500</span>
          <span>1000</span>
          <span>1500 ppm</span>
        </div>

        {/* Threshold info */}
        <div className="mt-6 pt-6 border-t border-white/20">
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/70 font-medium">
              Seuil critique
            </span>
            <span className="text-sm font-bold text-white">
              {threshold} ppm
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * SensorStatusPanel - Panneau statut capteur moderne
 */
export function SensorStatusPanel({ sensor, mqttStatus }) {
  const StatusItem = ({ icon: Icon, label, value, good }) => {
    const statusColor = good
      ? "text-status-good"
      : value === "N/A" || value === "--"
      ? "text-muted-foreground"
      : "text-status-warning";

    return (
      <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-muted/30 border border-border/40 hover:border-border/60 transition-colors">
        <span className="flex items-center gap-3 text-sm">
          <Icon className={`h-4 w-4 ${statusColor}`} />
          <span className="text-muted-foreground">{label}</span>
        </span>
        <span className={`font-semibold text-sm ${statusColor}`}>{value}</span>
      </div>
    );
  };

  const isMqttConnected = mqttStatus === "connected";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-sm p-6 shadow-soft"
    >
      <h3 className="text-base font-bold mb-5 text-foreground">Statut Capteur</h3>

      <div className="space-y-3">
        <StatusItem
          icon={Battery}
          label="Batterie"
          value={sensor.battery ? `${sensor.battery}%` : "--"}
          good={(sensor.battery ?? 0) > 30}
        />
        <StatusItem
          icon={Wifi}
          label="Signal Wi-Fi"
          value={sensor.wifi ? `${sensor.wifi} dBm` : "--"}
          good={(sensor.wifi ?? -100) > -70}
        />
        <StatusItem
          icon={Radio}
          label="MQTT"
          value={mqttStatus === "connected" ? "Connecté" : "Déconnecté"}
          good={isMqttConnected}
        />
        <StatusItem
          icon={Clock}
          label="Vu il y a"
          value={
            sensor.lastSeen
              ? `${Math.round((Date.now() - sensor.lastSeen) / 1000)}s`
              : "--"
          }
          good
        />
      </div>

      {/* Firmware info */}
      <div className="mt-6 pt-6 border-t border-border/40">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
            Firmware
          </p>
          <p className="font-mono text-sm font-semibold text-foreground">
            {sensor.firmware ?? "--"}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

import { Battery, Wifi, Radio, Clock } from "lucide-react";

