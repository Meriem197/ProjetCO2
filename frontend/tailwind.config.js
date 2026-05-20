export default {
    darkMode: ["class"],
    content: ["./pages/**/*.{js,jsx}", "./components/**/*.{js,jsx}", "./app/**/*.{js,jsx}", "./src/**/*.{js,jsx}"],
    prefix: "",
    theme: {
        container: {
            center: true,
            padding: "2rem",
            screens: { "2xl": "1400px" },
        },
        extend: {
            fontFamily: {
                sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
                mono: ["JetBrains Mono", "ui-monospace", "monospace"],
            },
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
                "shimmer": {
                    "0%": { backgroundPosition: "-1000px 0" },
                    "100%": { backgroundPosition: "1000px 0" },
                },
            },
            animation: {
                "drift-slow": "drift-slow 6s ease-in-out infinite",
                "float-cloud": "float-cloud 4s ease-in-out infinite",
                "glow-pulse": "glow-pulse 3s ease-in-out infinite",
                "shimmer": "shimmer 3s infinite",
            },
            colors: {
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                primary: {
                    DEFAULT: "hsl(var(--primary))",
                    foreground: "hsl(var(--primary-foreground))",
                    glow: "hsl(var(--primary-glow))",
                },
                secondary: {
                    DEFAULT: "hsl(var(--secondary))",
                    foreground: "hsl(var(--secondary-foreground))",
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive))",
                    foreground: "hsl(var(--destructive-foreground))",
                },
                muted: {
                    DEFAULT: "hsl(var(--muted))",
                    foreground: "hsl(var(--muted-foreground))",
                },
                accent: {
                    DEFAULT: "hsl(var(--accent))",
                    foreground: "hsl(var(--accent-foreground))",
                },
                popover: {
                    DEFAULT: "hsl(var(--popover))",
                    foreground: "hsl(var(--popover-foreground))",
                },
                card: {
                    DEFAULT: "hsl(var(--card))",
                    foreground: "hsl(var(--card-foreground))",
                },
                status: {
                    good: {
                        DEFAULT: "hsl(var(--status-good))",
                        foreground: "hsl(var(--status-good-foreground))",
                    },
                    warning: {
                        DEFAULT: "hsl(var(--status-warning))",
                        foreground: "hsl(var(--status-warning-foreground))",
                    },
                    critical: {
                        DEFAULT: "hsl(var(--status-critical))",
                        foreground: "hsl(var(--status-critical-foreground))",
                    },
                },
                sidebar: {
                    DEFAULT: "hsl(var(--sidebar-background))",
                    foreground: "hsl(var(--sidebar-foreground))",
                    primary: "hsl(var(--sidebar-primary))",
                    "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
                    accent: "hsl(var(--sidebar-accent))",
                    "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
                    border: "hsl(var(--sidebar-border))",
                    ring: "hsl(var(--sidebar-ring))",
                },
            },
            backgroundImage: {
                "gradient-primary": "var(--gradient-primary)",
                "gradient-glow": "var(--gradient-glow)",
                "gradient-surface": "var(--gradient-surface)",
                "gradient-critical": "var(--gradient-critical)",
                "gradient-good": "var(--gradient-good)",
                "gradient-warning": "var(--gradient-warning)",
                "gradient-sidebar": "var(--gradient-sidebar)",
            },
            boxShadow: {
                soft: "var(--shadow-soft)",
                card: "var(--shadow-card)",
                elevated: "var(--shadow-elevated)",
                glow: "var(--shadow-glow)",
            },
            borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 4px)",
                sm: "calc(var(--radius) - 8px)",
            },
            keyframes: {
                "accordion-down": {
                    from: { height: "0" },
                    to: { height: "var(--radix-accordion-content-height)" },
                },
                "accordion-up": {
                    from: { height: "var(--radix-accordion-content-height)" },
                    to: { height: "0" },
                },
                "fade-in": {
                    "0%": { opacity: "0", transform: "translateY(8px)" },
                    "100%": { opacity: "1", transform: "translateY(0)" },
                },
                "scale-in": {
                    "0%": { opacity: "0", transform: "scale(0.96)" },
                    "100%": { opacity: "1", transform: "scale(1)" },
                },
                "pulse-glow": {
                    "0%, 100%": { boxShadow: "0 0 0 0 hsl(var(--primary) / 0.45)" },
                    "50%": { boxShadow: "0 0 0 12px hsl(var(--primary) / 0)" },
                },
                "pulse-critical": {
                    "0%, 100%": { boxShadow: "0 0 0 0 hsl(var(--status-critical) / 0.55)" },
                    "50%": { boxShadow: "0 0 0 16px hsl(var(--status-critical) / 0)" },
                },
                shimmer: {
                    "100%": { transform: "translateX(100%)" },
                },
            },
            animation: {
                "accordion-down": "accordion-down 0.2s ease-out",
                "accordion-up": "accordion-up 0.2s ease-out",
                "fade-in": "fade-in 0.4s ease-out both",
                "scale-in": "scale-in 0.25s ease-out both",
                "pulse-glow": "pulse-glow 2s ease-in-out infinite",
                "pulse-critical": "pulse-critical 1.4s ease-in-out infinite",
                shimmer: "shimmer 1.6s infinite",
            },
        },
    },
    plugins: [require("tailwindcss-animate")],
};
