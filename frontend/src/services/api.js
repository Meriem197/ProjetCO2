import axios from "axios";
/**
 * Service API central — Axios instance configurée.
 * Branchez votre backend en définissant VITE_API_URL dans un .env :
 *   VITE_API_URL=https://api.votre-backend.com
 *
 * Si non défini, l'application bascule automatiquement sur les
 * données simulées (mock) — utile pour démo / dev sans backend.
 */
export const API_BASE_URL = import.meta.env.VITE_API_URL ?? "";
export const USE_MOCK = String(import.meta.env.VITE_ENABLE_MOCK || "").toLowerCase() === "true";
const api = axios.create({
    baseURL: API_BASE_URL || "/api/v1",
    timeout: 10000,
    headers: { "Content-Type": "application/json" },
});
// Injection JWT depuis localStorage
api.interceptors.request.use((config) => {
    const token = localStorage.getItem("airsense_token");
    if (token)
        config.headers.Authorization = `Bearer ${token}`;
    return config;
});
// Gestion expiration / erreurs réseau
api.interceptors.response.use((res) => res, (error) => {
    if (error.response?.status === 401) {
        localStorage.removeItem("airsense_token");
        localStorage.removeItem("airsense_user");
        if (!window.location.pathname.startsWith("/login")) {
            window.location.href = "/login";
        }
    }
    return Promise.reject(error);
});
export default api;
export function unwrapApiData(payload) {
    if (payload &&
        typeof payload === "object" &&
        "success" in payload &&
        "data" in payload) {
        return payload.data;
    }
    return payload;
}
export function resolveApiErrorMessage(error, fallback) {
    const e = error;
    if (!e.response) {
        return "Backend indisponible ou URL API incorrecte. Verifie VITE_API_URL / proxy Vite.";
    }
    return e.response?.data?.error?.message ?? fallback;
}
