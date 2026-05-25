import { createContext, useContext, useEffect, useMemo, useState } from "react";
import api, { resolveApiErrorMessage, unwrapApiData, USE_MOCK } from "@/services/api";
const AuthContext = createContext(undefined);
const roleHome = {
    ADMIN: "/dashboard/admin",
    TECHNICIAN: "/dashboard/tech",
    CLIENT: "/dashboard",
    USER: "/dashboard",
};
function normalizeRole(role) {
    const value = String(role || "").trim().toUpperCase();
    if (value === "ADMIN")
        return "ADMIN";
    if (value === "TECHNICIAN" || value === "TECH" || value === "TECHNICIEN")
        return "TECHNICIAN";
    if (value === "CLIENT" || value === "USER" || value === "UTILISATEUR")
        return "CLIENT";
    return "CLIENT";
}
export const getHomeByRole = (role) => roleHome[normalizeRole(role)] || "/dashboard";
const mapBackendRolesToFrontendRole = (roles = []) => {
    const normalized = roles.map((r) => String(r).toUpperCase());
    if (normalized.includes("ADMIN"))
        return "ADMIN";
    if (normalized.includes("TECHNICIAN"))
        return "TECHNICIAN";
    return "CLIENT";
};
export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        const t = localStorage.getItem("airsense_token");
        const u = localStorage.getItem("airsense_user");
        if (t && u) {
            try {
                setToken(t);
                setUser(JSON.parse(u));
            }
            catch {
                localStorage.removeItem("airsense_token");
                localStorage.removeItem("airsense_user");
            }
        }
        setLoading(false);
    }, []);
    const login = async (email, password) => {
        if (USE_MOCK)
            throw new Error("Mode mock desactive pour l'authentification. Utilisez un compte reel.");
        try {
            const response = await api.post("/auth/login", { email, password });
            const data = unwrapApiData(response.data);
            const role = mapBackendRolesToFrontendRole(data.memberships?.[0]?.roles ?? []);
            const safe = {
                id: String(data.user.id),
                name: data.user.name?.trim() || data.user.email,
                email: data.user.email,
                role: normalizeRole(role),
                activeCompanyId: data.activeCompanyId ?? data.memberships?.[0]?.companyId ?? null,
            };
            localStorage.setItem("airsense_token", data.token);
            localStorage.setItem("airsense_user", JSON.stringify(safe));
            setToken(data.token);
            setUser(safe);
        }
        catch (error) {
            throw new Error(resolveApiErrorMessage(error, "Identifiants invalides"));
        }
    };
    const register = async ({ name, email, password, role }) => {
        if (USE_MOCK)
            throw new Error("Mode mock desactive pour l'inscription. Utilisez le backend reel.");
        try {
            await api.post("/auth/register", {
                name: name.trim(),
                email: email.trim().toLowerCase(),
                password,
                companyName: "EcoSense",
                tenantKey: "ecosense",
                role: role || "CLIENT",
            });
        }
        catch (error) {
            throw new Error(resolveApiErrorMessage(error, "Impossible de creer le compte"));
        }
    };
    const updateProfile = async (payload) => {
        try {
            const response = await api.patch("/auth/profile", payload);
            const data = unwrapApiData(response.data);
            const role = mapBackendRolesToFrontendRole(data.memberships?.[0]?.roles ?? []);
            const safe = {
                id: String(data.user.id),
                name: data.user.name?.trim() || data.user.email,
                email: data.user.email,
                role: normalizeRole(role),
                activeCompanyId: data.activeCompanyId ?? data.memberships?.[0]?.companyId ?? null,
            };
            localStorage.setItem("airsense_token", data.token);
            localStorage.setItem("airsense_user", JSON.stringify(safe));
            setToken(data.token);
            setUser(safe);
        }
        catch (error) {
            throw new Error(resolveApiErrorMessage(error, "Mise a jour du profil impossible"));
        }
    };
    const logout = async () => {
        try {
            await api.post("/auth/logout");
        }
        catch (_error) {
        }
        localStorage.removeItem("airsense_token");
        localStorage.removeItem("airsense_user");
        setToken(null);
        setUser(null);
    };
    const value = useMemo(() => ({
        user,
        token,
        loading,
        login,
        register,
        updateProfile,
        logout,
        hasRole: (...roles) => {
            if (!user)
                return false;
            const current = normalizeRole(user.role);
            return roles.map((r) => String(r).toUpperCase()).includes(current);
        },
    }), [user, token, loading]);
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx)
        throw new Error("useAuth doit être utilisé dans <AuthProvider>");
    return ctx;
}
