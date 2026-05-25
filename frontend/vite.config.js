import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// PERFORMANCE FIX 3: Code splitting + bundle optimization
export default defineConfig(({ mode }) => {
    const backendTarget = process.env.VITE_BACKEND_PROXY_TARGET || "http://localhost:4000";
    return ({
    server: {
        host: "::",
        port: 8080,
        hmr: {
            overlay: false,
        },
        proxy: {
            "/api": {
                target: backendTarget,
                changeOrigin: true,
            },
            "/health": {
                target: backendTarget,
                changeOrigin: true,
            },
            "/socket.io": {
                target: backendTarget,
                changeOrigin: true,
                ws: true,
            },
        },
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
        dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
    },
    build: {
        target: 'es2020',
        minify: 'esbuild',
        esbuild: {
            drop: mode === 'production' ? ['console', 'debugger'] : ['debugger'],
        },
        rollupOptions: {
            output: {
                manualChunks: {
                    // Vendor chunks for libraries
                    'vendor-react': ['react', 'react-dom'],
                    'vendor-routing': ['react-router-dom'],
                    'vendor-query': ['@tanstack/react-query'],
                    'vendor-ui': [
                        '@radix-ui/react-dialog',
                        '@radix-ui/react-select',
                        '@radix-ui/react-dropdown-menu',
                        '@radix-ui/react-tabs',
                        '@radix-ui/react-alert-dialog',
                    ],
                    'vendor-charts': ['recharts'],
                    'vendor-realtime': ['socket.io-client'],
                    'vendor-form': ['react-hook-form', '@hookform/resolvers'],
                    'vendor-utils': ['axios', 'date-fns', 'zod', 'clsx'],
                },
            },
        },
        chunkSizeWarningLimit: 600,
        sourcemap: mode === 'development',
    },
    optimizeDeps: {
        include: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query', 'socket.io-client'],
    },
});
});
