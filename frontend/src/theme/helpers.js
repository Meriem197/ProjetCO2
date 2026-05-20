/**
 * Theme Integration Helper
 * Utilitaires pour intégrer le thème dans les composants existants
 */
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
/**
 * Combine classes Tailwind intelligemment
 */
export function cn(...inputs) {
    return twMerge(clsx(inputs));
}
/**
 * Crée des classes pour les variantes de statut
 */
export function getStatusClasses(status) {
    const statusMap = {
        good: {
            bg: "bg-status-good/10",
            border: "border-status-good/30",
            text: "text-status-good",
            dot: "bg-status-good",
        },
        warning: {
            bg: "bg-status-warning/10",
            border: "border-status-warning/30",
            text: "text-status-warning",
            dot: "bg-status-warning",
        },
        critical: {
            bg: "bg-status-critical/10",
            border: "border-status-critical/30",
            text: "text-status-critical",
            dot: "bg-status-critical",
        },
        info: {
            bg: "bg-primary/10",
            border: "border-primary/30",
            text: "text-primary",
            dot: "bg-primary",
        },
    };
    return statusMap[status];
}
/**
 * Crée des classes pour les tailles de composants
 */
export function getSizeClasses(size) {
    const sizeMap = {
        sm: "px-3 py-1.5 text-xs",
        md: "px-4 py-2 text-sm",
        lg: "px-6 py-3 text-base",
        xl: "px-8 py-4 text-lg",
    };
    return sizeMap[size];
}
/**
 * Crée des classes pour les variantes de boutons
 */
export function getButtonClasses(variant, size = "md") {
    const baseClasses = "inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-300";
    const variants = {
        primary: "bg-gradient-primary text-primary-foreground shadow-card hover:shadow-elevated hover:-translate-y-1",
        secondary: "bg-secondary text-secondary-foreground border border-secondary/30 hover:bg-secondary/80 hover:border-secondary/50",
        ghost: "text-foreground hover:bg-muted/50 border border-transparent hover:border-border",
        outline: "border-2 border-primary text-primary hover:bg-primary/5",
    };
    return cn(baseClasses, variants[variant], getSizeClasses(size));
}
/**
 * Crée des classes pour les cartes
 */
export function getCardClasses(elevated = false) {
    const base = "rounded-2xl bg-card border border-border/60 p-6 transition-all duration-300";
    const shadow = elevated ? "shadow-elevated" : "shadow-soft hover:shadow-card hover:-translate-y-1";
    return cn(base, shadow);
}
/**
 * Vérifie si le dark mode est actif
 */
export function isDarkMode() {
    if (typeof window === "undefined")
        return false;
    return document.documentElement.classList.contains("dark");
}
/**
 * Bascule le dark mode
 */
export function toggleDarkMode() {
    if (typeof window === "undefined")
        return;
    document.documentElement.classList.toggle("dark");
}
/**
 * Définit explicitement le mode (dark ou light)
 */
export function setDarkMode(isDark) {
    if (typeof window === "undefined")
        return;
    if (isDark) {
        document.documentElement.classList.add("dark");
    }
    else {
        document.documentElement.classList.remove("dark");
    }
}
/**
 * Crée un style inline pour les gradients
 */
export function getGradientStyle(type) {
    const gradients = {
        primary: "linear-gradient(135deg, rgb(79, 172, 254) 0%, rgb(79, 142, 255) 100%)",
        environment: "linear-gradient(135deg, rgb(16, 185, 129) 0%, rgb(34, 197, 94) 100%)",
        cloud: "linear-gradient(180deg, rgb(255, 255, 255) 0%, rgb(240, 249, 255) 100%)",
        critical: "linear-gradient(135deg, rgb(220, 38, 38) 0%, rgb(239, 68, 68) 100%)",
        good: "linear-gradient(135deg, rgb(34, 197, 94) 0%, rgb(74, 222, 128) 100%)",
        warning: "linear-gradient(135deg, rgb(217, 119, 6) 0%, rgb(251, 146, 60) 100%)",
    };
    return { background: gradients[type] };
}
/**
 * Format de couleur HSL en RGB
 */
export function hslToRgb(h, s, l) {
    s /= 100;
    l /= 100;
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [255 * f(0), 255 * f(8), 255 * f(4)].map((x) => Math.round(x));
}
/**
 * Crée une ombre personnalisée
 */
export function getShadowStyle(shadow) {
    const shadows = {
        soft: "0 2px 4px rgba(16, 24, 48, 0.05), 0 4px 12px rgba(16, 24, 48, 0.08)",
        card: "0 1px 3px rgba(16, 24, 48, 0.08), 0 10px 32px rgba(79, 172, 254, 0.12)",
        elevated: "0 4px 12px rgba(16, 24, 48, 0.12), 0 20px 48px rgba(79, 172, 254, 0.18)",
        glow: "0 0 0 2px rgba(79, 172, 254, 0.2), 0 0 40px rgba(79, 172, 254, 0.25)",
        inset: "inset 0 1px 2px rgba(200, 20, 92, 0.1), inset 0 -2px 8px rgba(16, 24, 48, 0.04)",
    };
    return { boxShadow: shadows[shadow] };
}
/**
 * Crée un objet de variable CSS pour personnalisation
 */
export function createCSSVariables(overrides) {
    const defaults = {
        "--primary": "199 89% 48%",
        "--secondary": "140 50% 58%",
        "--status-good": "140 65% 48%",
        "--status-warning": "38 92% 55%",
        "--status-critical": "0 84% 60%",
        "--shadow-card": "0 1px 3px rgba(16, 24, 48, 0.08), 0 10px 32px rgba(79, 172, 254, 0.12)",
    };
    return { ...defaults, ...overrides };
}
/**
 * Utilitaire pour créer des animations personnalisées
 */
export const animationPresets = {
    fadeIn: "fade-in 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
    slideInLeft: "slide-in-left 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
    scaleIn: "scale-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
    floatCloud: "float-cloud 4s ease-in-out infinite",
    driftSlow: "drift-slow 6s ease-in-out infinite",
    glowPulse: "glow-pulse 3s ease-in-out infinite",
};
/**
 * Hook pour observer le changement de thème (côté client)
 */
export function useThemeObserver(callback) {
    if (typeof window === "undefined")
        return;
    const observer = new MutationObserver(() => {
        callback(isDarkMode());
    });
    observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
    });
    return () => observer.disconnect();
}
export default {
    cn,
    getStatusClasses,
    getSizeClasses,
    getButtonClasses,
    getCardClasses,
    isDarkMode,
    toggleDarkMode,
    setDarkMode,
    getGradientStyle,
    hslToRgb,
    getShadowStyle,
    createCSSVariables,
    animationPresets,
    useThemeObserver,
};
