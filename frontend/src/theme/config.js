/**
 * Theme Configuration
 * Premium CO₂ Environment Monitoring Theme
 * Cloud Morphism + Modern Minimalism
 */
export const themeConfig = {
    colors: {
        /* Primary: Sky Blue */
        primary: {
            light: "#4FACFE",
            main: "#0084FF",
            dark: "#006FCC",
            glow: "#7FC9FF",
        },
        /* Secondary: Emerald Green (Environment) */
        secondary: {
            light: "#A7F3D0",
            main: "#10B981",
            dark: "#047857",
        },
        /* Status Colors */
        status: {
            good: "#22C55E",
            warning: "#EAB308",
            critical: "#DC2626",
            info: "#3B82F6",
        },
        /* Grays & Neutrals */
        neutral: {
            50: "#FAFAF9",
            100: "#F5F5F4",
            200: "#E7E5E4",
            300: "#D6D3D1",
            400: "#A8A29E",
            500: "#78716B",
            600: "#57534E",
            700: "#44403C",
            800: "#292524",
            900: "#1C1917",
        },
        /* Background Gradients */
        gradients: {
            primary: "linear-gradient(135deg, rgb(79, 172, 254) 0%, rgb(79, 142, 255) 100%)",
            environment: "linear-gradient(135deg, rgb(16, 185, 129) 0%, rgb(34, 197, 94) 100%)",
            cloud: "linear-gradient(180deg, rgb(255, 255, 255) 0%, rgb(240, 249, 255) 100%)",
            critical: "linear-gradient(135deg, rgb(220, 38, 38) 0%, rgb(239, 68, 68) 100%)",
        },
        /* Shadows */
        shadows: {
            soft: "0 2px 4px rgba(16, 24, 48, 0.05), 0 4px 12px rgba(16, 24, 48, 0.08)",
            card: "0 1px 3px rgba(16, 24, 48, 0.08), 0 10px 32px rgba(79, 172, 254, 0.12)",
            elevated: "0 4px 12px rgba(16, 24, 48, 0.12), 0 20px 48px rgba(79, 172, 254, 0.18)",
            glow: "0 0 0 2px rgba(79, 172, 254, 0.2), 0 0 40px rgba(79, 172, 254, 0.25)",
        },
    },
    spacing: {
        xs: "0.25rem",
        sm: "0.5rem",
        md: "1rem",
        lg: "1.5rem",
        xl: "2rem",
        "2xl": "3rem",
        "3xl": "4rem",
    },
    radius: {
        sm: "0.5rem",
        md: "1rem",
        lg: "1.5rem",
        xl: "2rem",
        full: "9999px",
    },
    typography: {
        family: {
            sans: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            mono: "'JetBrains Mono', 'Courier New', monospace",
        },
        sizes: {
            xs: "0.75rem",
            sm: "0.875rem",
            base: "1rem",
            lg: "1.125rem",
            xl: "1.25rem",
            "2xl": "1.5rem",
            "3xl": "1.875rem",
            "4xl": "2.25rem",
            "5xl": "3rem",
        },
        weights: {
            light: 300,
            normal: 400,
            medium: 500,
            semibold: 600,
            bold: 700,
            extrabold: 800,
        },
    },
    transitions: {
        fast: "150ms cubic-bezier(0.4, 0, 0.2, 1)",
        base: "300ms cubic-bezier(0.4, 0, 0.2, 1)",
        slow: "500ms cubic-bezier(0.4, 0, 0.2, 1)",
        spring: "300ms cubic-bezier(0.34, 1.56, 0.64, 1)",
    },
    breakpoints: {
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
        "2xl": "1536px",
    },
};
/* Theme Tokens - For use in Tailwind */
export const themeTokens = {
    keyframes: {
        "drift-slow": {
            "0%, 100%": { transform: "translateX(0px) translateY(0px)" },
            "50%": { transform: "translateX(12px) translateY(-8px)" },
        },
        "float-cloud": {
            "0%, 100%": { transform: "translateY(0px)" },
            "50%": { transform: "translateY(-8px)" },
        },
        "glow-pulse": {
            "0%, 100%": { boxShadow: "0 0 20px rgba(79, 172, 254, 0.2)", opacity: "1" },
            "50%": { boxShadow: "0 0 40px rgba(79, 172, 254, 0.4)", opacity: "1" },
        },
    },
    animations: {
        "drift-slow": "drift-slow 6s ease-in-out infinite",
        "float-cloud": "float-cloud 4s ease-in-out infinite",
        "glow-pulse": "glow-pulse 3s ease-in-out infinite",
    },
};
/* Color mapping for status indicators */
export const statusColorMap = {
    good: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-600 dark:text-green-400" },
    warning: {
        bg: "bg-yellow-100 dark:bg-yellow-900/30",
        text: "text-yellow-600 dark:text-yellow-400",
    },
    critical: {
        bg: "bg-red-100 dark:bg-red-900/30",
        text: "text-red-600 dark:text-red-400",
    },
};
/* Size variants */
export const sizeVariants = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
    xl: "px-8 py-4 text-lg",
};
export default themeConfig;
