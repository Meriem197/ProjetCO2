/**
 * Dashboard.jsx - Tableau de bord premium IoT CO2
 * Layout:
 * 1) Top section (redesign only)
 * 2) Analytics section (charts unchanged)
 */

import { useCO2Data } from "@/hooks/useCO2Data";
import { useTranslation } from "react-i18next";

import { CO2HistoryChart, CO2ForecastChart } from "@/components/charts/CO2Charts";
import { motion } from "framer-motion";
import { BarChart3, Zap } from "lucide-react";

import AppLayout from "@/components/layout/AppLayout";
import { GlassCard } from "@/components/ui/glass-card";
import DashboardTopSection from "@/components/dashboard/DashboardTopSection";

export default function Dashboard() {
  const { current, status, history, forecast, sensor, threshold } = useCO2Data();
  const { t } = useTranslation();

  return (
    <AppLayout title={t("dashboard_title")} subtitle={t("dashboard_subtitle")}>
      <div className="space-y-8">
        {/* TOP section redesign ONLY (charts below stay unchanged) */}
        <DashboardTopSection
          current={current}
          status={status}
          history={history}
          temperature={sensor?.temperature}
          humidity={sensor?.humidity}
          sensor={sensor}
          mqttStatus={sensor?.mqtt}
          threshold={threshold}
        />

        {/* 3) ANALYTICS (2 graphiques côte à côte) */}
        <div className="grid gap-6 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.3 }}
          >
            <GlassCard className="h-full">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h3 className="flex items-center gap-2 text-base font-bold text-foreground">
                    <BarChart3 size={18} className="text-primary" />
                    {t("history_24h") || "24h History"}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("history_desc") || "Last 24 hours measurements"}
                  </p>
                </div>
              </div>
              <CO2HistoryChart data={history} threshold={threshold} height={320} />
            </GlassCard>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.3 }}
          >
            <GlassCard className="h-full">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h3 className="flex items-center gap-2 text-base font-bold text-foreground">
                    <Zap size={18} className="text-secondary" />
                    {t("prediction_30m") || "AI Prediction 30min"}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("prediction_desc") || "Real-time AI forecast"}
                  </p>
                </div>
              </div>
              <CO2ForecastChart
                history={history.slice(-36)}
                forecast={forecast}
                height={320}
              />
            </GlassCard>
          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
}

