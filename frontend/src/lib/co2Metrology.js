export const CO2_DEFAULT_LIMITS = {
  healthy: 800,
  moderate: 1000,
};

export function getCo2Metrology(ppm, limits = CO2_DEFAULT_LIMITS) {
  const healthy = Number(limits.healthy ?? limits.limitGood ?? CO2_DEFAULT_LIMITS.healthy);
  const moderate = Number(limits.moderate ?? limits.limitWarning ?? CO2_DEFAULT_LIMITS.moderate);
  const value = Number(ppm);

  if (!Number.isFinite(value)) {
    return {
      label: "Indisponible",
      level: "unknown",
      textClass: "text-slate-400",
      badgeClass: "text-slate-400 bg-slate-500/10 border-slate-500/30",
      markerColor: "#94a3b8",
    };
  }

  if (value < healthy) {
    return {
      label: "Sain",
      level: "healthy",
      textClass: "text-emerald-500",
      badgeClass: "text-emerald-500 bg-emerald-500/10 border-emerald-500/30",
      markerColor: "#10b981",
    };
  }
  if (value <= moderate) {
    return {
      label: "Modéré",
      level: "moderate",
      textClass: "text-amber-500",
      badgeClass: "text-amber-500 bg-amber-500/10 border-amber-500/30",
      markerColor: "#f59e0b",
    };
  }
  return {
    label: "Critique",
    level: "critical",
    textClass: "text-rose-500",
    badgeClass: "text-rose-500 bg-rose-500/10 border-rose-500/30",
    markerColor: "#f43f5e",
  };
}

export function co2StatusLevel(ppm, limits = CO2_DEFAULT_LIMITS) {
  const m = getCo2Metrology(ppm, limits);
  if (m.level === "healthy") return "good";
  if (m.level === "moderate") return "warning";
  if (m.level === "critical") return "critical";
  return "warning";
}
