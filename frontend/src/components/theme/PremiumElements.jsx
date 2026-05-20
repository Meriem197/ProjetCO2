import React from "react";
/**
 * CloudBackground - Animated cloud particles for premium aesthetic
 */
export const CloudBackground = () => (<div className="fixed inset-0 -z-50 overflow-hidden pointer-events-none">
    {/* Primary gradient sphere */}
    <div className="absolute w-96 h-96 rounded-full opacity-20 blur-3xl animate-cloud-drift-1" style={{
        background: "linear-gradient(135deg, rgb(79, 172, 254), rgb(59, 130, 246))",
        top: "-20%",
        right: "-10%",
    }}/>

    {/* Secondary gradient sphere */}
    <div className="absolute w-80 h-80 rounded-full opacity-15 blur-3xl animate-cloud-drift-2" style={{
        background: "linear-gradient(135deg, rgb(34, 197, 94), rgb(59, 130, 246))",
        top: "50%",
        left: "-10%",
    }}/>

    {/* Tertiary gradient sphere */}
    <div className="absolute w-72 h-72 rounded-full opacity-10 blur-3xl animate-cloud-drift-3" style={{
        background: "linear-gradient(135deg, rgb(79, 172, 254), rgb(34, 197, 94))",
        bottom: "10%",
        right: "5%",
    }}/>
  </div>);
/**
 * GlowOrb - Floating glowing orb for accent decoration
 */
export const GlowOrb = ({ size = "w-16 h-16", color = "from-primary to-primary-glow", className = "", }) => (<div className={`${size} rounded-full animate-float-cloud ${className}`} style={{
        background: `linear-gradient(135deg, hsl(199 89% 48%), hsl(195 85% 55%))`,
        boxShadow: "0 0 40px rgba(79, 172, 254, 0.4), 0 0 80px rgba(79, 172, 254, 0.2)",
    }}/>);
/**
 * PremiumCard - High-end card with glass morphism
 */
export const PremiumCard = ({ children, className = "", elevated = false, }) => (<div className={`
      relative rounded-2xl p-6 backdrop-blur-xl
      ${elevated ? "shadow-elevated bg-card/80" : "shadow-card bg-white/70 dark:bg-slate-900/50"}
      border border-white/40 dark:border-white/10
      transition-all duration-300 hover:shadow-elevated hover:-translate-y-1
      ${className}
    `}>
    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/20 to-transparent pointer-events-none"/>
    <div className="relative">{children}</div>
  </div>);
/**
 * StatusIndicator - Premium status with glow effect
 */
export const StatusIndicator = ({ status = "good", label = "", animated = true, }) => {
    const statusConfig = {
        good: { color: "bg-status-good", shadowColor: "rgba(34, 197, 94, 0.5)" },
        warning: { color: "bg-status-warning", shadowColor: "rgba(217, 119, 6, 0.5)" },
        critical: { color: "bg-status-critical", shadowColor: "rgba(220, 38, 38, 0.6)" },
    };
    const config = statusConfig[status];
    return (<div className="flex items-center gap-2">
      <div className={`h-3 w-3 rounded-full ${config.color} ${animated && status === "critical" ? "animate-pulse" : ""}`} style={{
            boxShadow: `0 0 12px ${config.shadowColor}`,
        }}/>
      {label && <span className="text-xs font-medium text-muted-foreground">{label}</span>}
    </div>);
};
/**
 * ShimmerText - Text with shimmer effect
 */
export const ShimmerText = ({ children, className = "", }) => (<div className={`relative overflow-hidden ${className}`}>
    <div className="absolute inset-0" style={{
        background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)",
        animation: "shimmer 2s infinite",
    }}/>
    <span className="relative">{children}</span>
  </div>);
/**
 * FloatingElement - Element with floating animation
 */
export const FloatingElement = ({ children, delay = 0, className = "", }) => (<div className={`animate-float-cloud ${className}`} style={{
        animationDelay: `${delay}s`,
    }}>
    {children}
  </div>);
/**
 * GradientDivider - Decorative gradient divider
 */
export const GradientDivider = ({ className = "" }) => (<div className={`h-1 ${className}`} style={{
        background: "linear-gradient(90deg, transparent, hsl(199 89% 48%), transparent)",
    }}/>);
/**
 * PulseRing - Expanding pulse ring effect
 */
export const PulseRing = ({ color = "primary", size = "w-16 h-16", className = "", }) => {
    const colorMap = {
        primary: "rgba(79, 172, 254, 0.5)",
        accent: "rgba(34, 197, 94, 0.5)",
        warning: "rgba(217, 119, 6, 0.5)",
        critical: "rgba(220, 38, 38, 0.6)",
    };
    return (<div className={`relative ${size} ${className}`}>
      <div className="absolute inset-0 rounded-full" style={{
            border: `2px solid ${colorMap[color]}`,
            animation: "pulse-scale 2s ease-in-out infinite",
        }}/>
      <div className="absolute inset-2 rounded-full" style={{
            background: colorMap[color],
        }}/>
    </div>);
};
/**
 * EnvironmentBadge - Nature-themed badge
 */
export const EnvironmentBadge = ({ icon: Icon, label, value, className = "", }) => (<div className={`
      flex items-center gap-3 rounded-2xl px-4 py-3
      bg-gradient-to-br from-emerald-50 to-cyan-50
      dark:from-emerald-900/30 dark:to-cyan-900/30
      border border-emerald-200/50 dark:border-emerald-700/30
      shadow-soft hover:shadow-card transition-all
      ${className}
    `}>
    <div className="text-emerald-600 dark:text-emerald-400">{Icon}</div>
    <div className="flex-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  </div>);
