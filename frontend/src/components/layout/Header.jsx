import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { setUserLanguage } from "@/i18n";
import { motion } from "framer-motion";
import { Bell, Battery, Wifi, Radio, User, Wind } from "lucide-react";

import { useCO2Data } from "@/hooks/useCO2Data";
import { useAuth } from "@/hooks/useAuth";
import { useUi } from "@/context/UiContext";
import { cn } from "@/lib/utils";

function normalizeRole(role) {
  const r = String(role || "").trim().toUpperCase();
  if (r === "ADMIN") return "ADMIN";
  if (r === "TECHNICIAN" || r === "TECH" || r === "TECHNICIEN") return "TECHNICIAN";
  return "CLIENT";
}

function roleLabel(t, role) {
  const r = normalizeRole(role);
  if (r === "ADMIN") return t("role_admin");
  if (r === "TECHNICIAN") return t("role_technician");
  return t("role_client");
}

export default function Header({ title, subtitle }) {
  const { sensor, alerts, isLive, lastUpdate } = useCO2Data();
  const { user } = useAuth();
  const { theme, setTheme } = useUi();
  const { t, i18n } = useTranslation();

  const activeAlerts = alerts.filter((a) => a.status === "active").length;
  const linkOk = sensor.mqtt === "connected";

  const userRoleLabel = useMemo(() => roleLabel(t, user?.role), [t, user?.role]);

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
          {/* Gauche: logo + titre appli */}
          <div className="flex min-w-0 flex-1 items-center gap-3 sm:max-w-[38%]">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
              <Wind className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-extrabold tracking-tight truncate">
                {t("app_title")}
              </div>
              <div className="text-[11px] text-muted-foreground truncate">
                {title}
                {subtitle ? <span className="text-muted-foreground/60"> · {subtitle}</span> : null}
              </div>
            </div>
          </div>

          {/* Centre: indicateurs système */}
          <div className="hidden lg:flex flex-1 items-center justify-center">
            <div className="flex items-center gap-3 rounded-full border border-border/60 bg-card/50 px-3 py-1.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Radio className={cn("h-3.5 w-3.5", linkOk ? "text-status-good" : "text-status-warning")} />
                {linkOk ? t("link_ok") : t("link_lost")}
              </span>
              <span className="text-border">|</span>
              <span className="flex items-center gap-1">
                <Wifi className="h-3.5 w-3.5 text-primary" />
                {t("wifi_signal")}: {sensor.wifi ?? "--"} dBm
              </span>
              <span className="text-border">|</span>
              <span className="flex items-center gap-1">
                <Battery className="h-3.5 w-3.5 text-status-good" />
                {t("battery")}: {sensor.battery ?? "--"}%
              </span>
            </div>
          </div>

          {/* Droite: thème, langue, alertes, profil */}
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {/* Indicateur “live” (sans jargon technique) */}
            <motion.div
              key={lastUpdate}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="hidden lg:flex items-center gap-2 rounded-full border border-border/60 bg-card/50 px-3 py-1.5 text-xs"
            >
              <span className={cn("h-2 w-2 rounded-full", isLive ? "bg-status-good animate-pulse-glow" : "bg-status-warning")} />
              <span className="font-semibold text-foreground">
                {isLive ? t("status_live") : t("status_syncing")}
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">
                {t("status_updated")} {Math.max(0, Math.round((Date.now() - lastUpdate) / 1000))}s
              </span>
            </motion.div>

            {/* Thème */}
            <button
              onClick={() => setTheme((v) => (v === "dark" ? "light" : "dark"))}
              className="ui-ghost"
              title={theme === "dark" ? t("light_mode") : t("dark_mode")}
            >
              {theme === "dark" ? t("light_mode") : t("dark_mode")}
            </button>

            {/* Langue: changement uniquement sur clic explicite */}
            <div className="hidden sm:flex items-center gap-1 rounded-full border border-border/60 bg-card/50 p-1">
              {[
                { code: "fr", label: "FR" },
                { code: "en", label: "EN" },
                { code: "ar", label: "AR" },
              ].map((lng) => (
                <button
                  key={lng.code}
                  onClick={() => setUserLanguage(lng.code)}
                  className={cn(
                    "rounded-full px-3 py-1 text-[11px] font-semibold transition",
                    i18n.language === lng.code
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:bg-accent/10 hover:text-foreground"
                  )}
                  aria-label={`${t("language")}: ${lng.label}`}
                >
                  {lng.label}
                </button>
              ))}
            </div>

            {/* Alertes */}
            <Link
              to="/alertes"
              className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-card/50 hover:bg-accent/10 transition"
              aria-label={t("sidebar_alerts")}
            >
              <Bell className="h-4.5 w-4.5 text-foreground" />
              {activeAlerts > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-status-critical px-1 text-[10px] font-bold text-white animate-pulse-critical">
                  {activeAlerts}
                </span>
              )}
            </Link>

            {/* Profil */}
            <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-card/50 px-2 py-1.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-primary text-[11px] font-bold text-white">
                {(user?.name || "U")
                  .split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")}
              </div>
              <div className="hidden sm:block pr-1">
                <p className="text-xs font-semibold leading-tight truncate max-w-[140px]">
                  {user?.name || t("profile")}
                </p>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  {t("connected_as")} {userRoleLabel}
                </p>
              </div>
              <User className="h-4 w-4 text-muted-foreground hidden sm:block" />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

