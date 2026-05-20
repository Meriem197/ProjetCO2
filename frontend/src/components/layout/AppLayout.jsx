import { NavLink } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
const mobileItems = [
    { to: "/dashboard", labelKey: "sidebar_dashboard" },
    { to: "/surveillance", labelKey: "sidebar_surveillance" },
    { to: "/prediction", labelKey: "sidebar_prediction" },
    { to: "/classification", labelKey: "sidebar_classification" },
    { to: "/alertes", labelKey: "sidebar_alerts" },
    { to: "/profil", labelKey: "sidebar_profile" },
    { to: "/ia-placement", labelKey: "sidebar_placement" },
    { to: "/parametres", labelKey: "sidebar_settings", roles: ["ADMIN", "TECHNICIAN"] },
];
export default function AppLayout({ children, title, subtitle }) {
    const { user } = useAuth();
    const { t } = useTranslation();
    return (<div className="flex min-h-screen w-full bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col lg:ml-64">
        <Header title={title} subtitle={subtitle}/>
        <nav className="sticky top-[72px] z-20 border-b border-border/60 bg-background/90 px-4 py-2 backdrop-blur lg:hidden">
          <div className="flex gap-2 overflow-x-auto">
            {mobileItems
            .filter((item) => !item.roles || (user && item.roles.includes(String(user.role).toUpperCase())))
            .map((item) => (<NavLink key={item.to} to={item.to} className={({ isActive }) => cn("whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition", isActive
                ? "border-primary bg-primary/10 text-primary"
                : "border-border/70 bg-card text-muted-foreground hover:text-foreground")}>
                  {t(item.labelKey)}
                </NavLink>))}
          </div>
        </nav>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 animate-fade-in">{children}</main>
      </div>
    </div>);
}
