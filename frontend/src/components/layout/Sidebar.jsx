import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Activity,
  BrainCircuit,
  ShieldAlert,
  Settings,
  User,
  LogOut,
  Wind,
  Tag,
} from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

const items = [
  {
    to: "/dashboard",
    labelKey: "sidebar_dashboard",
    icon: LayoutDashboard,
  },
  {
    to: "/surveillance",
    labelKey: "sidebar_surveillance",
    icon: Activity,
  },
  {
    to: "/prediction",
    labelKey: "sidebar_prediction",
    icon: BrainCircuit,
  },
  {
    to: "/classification",
    labelKey: "sidebar_classification",
    icon: Tag,
  },
  {
    to: "/alertes",
    labelKey: "sidebar_alerts",
    icon: ShieldAlert,
  },
  {
    to: "/parametres",
    labelKey: "sidebar_settings",
    icon: Settings,
    roles: ["ADMIN", "TECHNICIAN"],
  },
  {
    to: "/ia-placement",
    labelKey: "sidebar_placement",
    icon: BrainCircuit,
  },
  {
    to: "/profil",
    labelKey: "sidebar_profile",
    icon: User,
  },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex h-screen w-64 shrink-0 flex-col overflow-hidden bg-gradient-sidebar text-sidebar-foreground border-r border-sidebar-border">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
          <Wind className="h-5 w-5 text-white" />
        </div>

        <div>
          <p className="text-sm font-bold tracking-tight">
            AirSense IoT
          </p>
          <p className="text-[11px] text-sidebar-foreground/60">
            CO₂ Monitoring
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3">
        {items
          .filter(
            (i) =>
              !i.roles ||
              (user &&
                i.roles.includes(
                  String(user.role).toUpperCase()
                ))
          )
          .map(({ to, labelKey, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-primary shadow-soft"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-sidebar-primary" />
                  )}

                  <Icon
                    className={cn(
                      "h-4.5 w-4.5 shrink-0",
                      isActive && "text-sidebar-primary"
                    )}
                  />

                  <span>{t(labelKey)}</span>
                </>
              )}
            </NavLink>
          ))}
      </nav>

      {/* User Section */}
      <div className="border-t border-sidebar-border p-3">
        <div className="mb-2 flex items-center gap-3 rounded-xl bg-sidebar-accent/50 p-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-primary text-xs font-bold text-white">
            {user?.name
              ?.split(" ")
              .map((n) => n[0])
              .slice(0, 2)
              .join("")}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {user?.name}{" "}
              <span className="text-sidebar-foreground/70">
                ({String(user?.role || "").toUpperCase()})
              </span>
            </p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground transition"
        >
          <LogOut className="h-4 w-4" />
          {t("logout")}
        </button>
      </div>
    </aside>
  );
}