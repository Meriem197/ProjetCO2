import { Bell, Battery, Wifi, Radio } from "lucide-react";
import { useCO2Data } from "@/hooks/useCO2Data";
import { useAuth } from "@/hooks/useAuth";
import { useUi } from "@/context/UiContext";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
export default function Topbar({ title, subtitle }) {
    const { sensor, alerts, isLive, lastUpdate } = useCO2Data();
    const { user } = useAuth();
    const { theme, setTheme } = useUi();
    const { t, i18n } = useTranslation();
    const activeAlerts = alerts.filter((a) => a.status === "active").length;
    return (<header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-3">
          <motion.div key={lastUpdate} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="hidden md:flex items-center gap-2 rounded-full border border-border/60 bg-card px-3 py-1.5 text-xs">
            <span className={`h-2 w-2 rounded-full ${isLive ? "bg-status-good animate-pulse-glow" : "bg-status-critical"}`}/>
              <span className="font-medium text-foreground">
              {isLive ? t("realtime") : `${t("reconnecting")}...`}
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">
              {t("update")} {Math.max(0, Math.round((Date.now() - lastUpdate) / 1000))}s
            </span>
          </motion.div>

          <div className="hidden md:flex items-center gap-3 rounded-full border border-border/60 bg-card px-3 py-1.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Battery className="h-3.5 w-3.5 text-status-good"/>
              {t("battery")}: {sensor.battery ?? "--"}%
            </span>
            <span className="flex items-center gap-1">
              <Wifi className="h-3.5 w-3.5 text-primary"/>
              {t("wifi_signal")}: {sensor.wifi ?? "--"} dBm
            </span>
            <span className="flex items-center gap-1 capitalize">
              <Radio className={`h-3.5 w-3.5 ${sensor.mqtt === "connected" ? "text-status-good" : "text-status-warning"}`}/>
              MQTT
            </span>
          </div>
          <button onClick={() => setTheme((t) => t === "dark" ? "light" : "dark")} className="rounded-xl border border-border/60 bg-card px-3 py-2 text-xs font-medium hover:bg-accent transition">
            {theme === "dark" ? t("light_mode") : t("dark_mode")}
          </button>
          <select value={i18n.language} onChange={(e) => i18n.changeLanguage(e.target.value)} className="rounded-xl border border-border/60 bg-card px-2 py-2 text-xs font-medium">
            <option value="fr">FR</option>
            <option value="en">EN</option>
            <option value="ar">AR</option>
          </select>

          <Link to="/alertes" className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-card hover:bg-accent transition">
            <Bell className="h-4.5 w-4.5 text-foreground"/>
            {activeAlerts > 0 && (<span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-status-critical px-1 text-[10px] font-bold text-white animate-pulse-critical">
                {activeAlerts}
              </span>)}
          </Link>

          <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-card px-2 py-1.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-primary text-[11px] font-bold text-white">
              {user?.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
            </div>
            <div className="hidden sm:block pr-1">
              <p className="text-xs font-semibold leading-tight">{user?.name}</p>
              <p className="text-[10px] capitalize text-muted-foreground leading-tight">{user?.role}</p>
            </div>
          </div>
        </div>
      </div>
    </header>);
}
