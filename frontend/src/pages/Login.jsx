import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Wind } from "lucide-react";
import { motion } from "framer-motion";
import { getHomeByRole, useAuth } from "@/context/AuthContext";
import { useTranslation } from "react-i18next";
import LoginForm from "@/components/auth/LoginForm";
import { toast } from "sonner";
export default function Login() {
    const { login, user } = useAuth();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    if (user)
        return <Navigate to={getHomeByRole(user.role)} replace/>;
    const handleLogin = async ({ email, password }) => {
        await login(email, password);
        const from = location.state?.from?.pathname;
        const redirectedUser = JSON.parse(localStorage.getItem("airsense_user") ?? "{}");
        const home = redirectedUser.role ? getHomeByRole(redirectedUser.role) : "/dashboard";
        toast.success(`Bienvenue ${redirectedUser.name ?? ""}`.trim());
        navigate(from ?? home, { replace: true });
    };
    return (<div className="relative grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-gradient-sidebar p-12 text-white">
        <div className="absolute inset-0 grid-bg opacity-20"/>
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-primary/30 blur-3xl"/>
        <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-primary-glow/20 blur-3xl"/>

        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
            <Wind className="h-5 w-5"/>
          </div>
          <div>
            <p className="font-bold tracking-tight">EcoSense IoT</p>
            <p className="text-xs text-white/60">CO2 Monitoring System</p>
          </div>
        </div>

        <div className="relative space-y-6">
          <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-4xl font-bold leading-tight">
            Supervision CO2 temps reel
            <br />
            <span className="text-gradient-primary">& authentification securisee</span>
          </motion.h2>
          <p className="max-w-md text-white/70">
            Console industrielle de suivi qualite de l'air avec controle d'acces base
            sur les roles, alertes intelligentes et traces de connexion.
          </p>
        </div>

        <p className="relative text-xs text-white/40">© {new Date().getFullYear()} EcoSense</p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md space-y-6 rounded-3xl border border-border/60 bg-card/80 p-6 shadow-elevated backdrop-blur">
          <div className="space-y-1 text-center lg:text-left">
            <h1 className="text-3xl font-bold tracking-tight">{t("login")}</h1>
            
          </div>

          <LoginForm onSubmit={handleLogin}/>

          <p className="text-center text-sm text-muted-foreground">
            Nouveau sur la plateforme ?{" "}
            <Link to="/register" className="font-medium text-primary hover:underline">
              {t("create_account")}
            </Link>
          </p>
        </motion.div>
      </div>
    </div>);
}
