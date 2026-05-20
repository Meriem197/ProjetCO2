import React from "react";
import { Battery, Wifi, Radio, Clock, Moon, Sun, Globe } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * DashboardHeader - Header horizontal premium industriel
 * Contient: titre, état connexion, batterie, Wi-Fi, mode sombre, langue
 */
export function DashboardHeader({
  isLive,
  battery,
  wifi,
  mqttStatus,
  lastSeen,
  onToggleDarkMode,
  isDarkMode,
  onToggleLanguage,
  currentLanguage,
}) {
  const { t } = useTranslation();

  const getWifiColor = (dbm) => {
    if (!dbm) return "text-muted-foreground";
    if (dbm > -70) return "text-status-good";
    if (dbm > -85) return "text-status-warning";
    return "text-status-critical";
  };

  const getBatteryColor = (pct) => {
    if (!pct) return "text-muted-foreground";
    if (pct > 30) return "text-status-good";
    if (pct > 15) return "text-status-warning";
    return "text-status-critical";
  };

  const isMqttConnected = mqttStatus === "connected";

  return (
    <div className="border-b border-border/40 bg-gradient-to-r from-card via-card to-card/80 backdrop-blur-md">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between gap-6">
          {/* LEFT: Titre et Subtitle */}
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-foreground">
              {t("dashboard_title")}
            </h1>
            <p className="text-xs text-muted-foreground">
              {t("dashboard_subtitle")}
            </p>
          </div>

          {/* CENTER: État système compacte */}
          <div className="flex items-center gap-4 px-4 py-2 rounded-lg bg-muted/30 border border-border/50">
            {/* Status MQTT */}
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  isMqttConnected ? "bg-status-good animate-pulse" : "bg-status-critical"
                }`}
              />
              <span className="text-xs font-medium text-muted-foreground">
                {isMqttConnected ? "MQTT" : "Offline"}
              </span>
            </div>

            {/* Live indicator */}
            {isLive && (
              <div className="w-px h-4 bg-border/50" />
            )}
            {isLive && (
              <span className="text-[10px] font-semibold text-status-good flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-status-good animate-pulse" />
                Live
              </span>
            )}

            {/* Last updated */}
            {lastSeen && (
              <>
                <div className="w-px h-4 bg-border/50" />
                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Clock size={12} />
                  {Math.round((Date.now() - lastSeen) / 1000)}s
                </span>
              </>
            )}
          </div>

          {/* RIGHT: Controls (Battery, WiFi, Dark Mode, Language, Settings) */}
          <div className="flex items-center gap-3">
            {/* Battery */}
            {battery !== undefined && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/20 border border-border/30">
                <Battery size={16} className={getBatteryColor(battery)} />
                <span className="text-xs font-medium text-muted-foreground">
                  {battery}%
                </span>
              </div>
            )}

            {/* WiFi Signal */}
            {wifi !== undefined && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/20 border border-border/30">
                <Wifi size={16} className={getWifiColor(wifi)} />
                <span className="text-xs font-medium text-muted-foreground">
                  {wifi} dBm
                </span>
              </div>
            )}

            {/* Divider */}
            <div className="w-px h-5 bg-border/50" />

            {/* Dark Mode Toggle */}
            <button
              onClick={onToggleDarkMode}
              className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors"
              title={isDarkMode ? "mode claire" : "modes sombre"}
            >
              {isDarkMode ? (
                <Sun size={16} className="text-yellow-500" />
              ) : (
                <Moon size={16} className="text-indigo-500" />
              )}
            </button>

            {/* Language Toggle */}
            <button
              onClick={onToggleLanguage}
              className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors text-xs font-semibold"
              title="Toggle language"
            >
              <span>{currentLanguage === "en" ? "FR" : "EN"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardHeader;
