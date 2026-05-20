import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { getHomeByRole } from "@/context/AuthContext";
export default function ProtectedRoute({ children, roles }) {
    const { user, loading } = useAuth();
    const location = useLocation();
    const normalizedUserRole = String(user?.role || "").toUpperCase();
    const normalizedAllowedRoles = Array.isArray(roles)
        ? roles.map((r) => String(r).toUpperCase())
        : [];
    if (loading) {
        return (<div className="flex h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent"/>
      </div>);
    }
    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace/>;
    }
    if (normalizedAllowedRoles.length > 0 && !normalizedAllowedRoles.includes(normalizedUserRole)) {
        const fallback = getHomeByRole(normalizedUserRole);
        const target = fallback && fallback !== location.pathname ? fallback : "/login";
        return <Navigate to={target} replace/>;
    }
    return <>{children}</>;
}
