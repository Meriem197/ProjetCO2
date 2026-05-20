import AppLayout from "@/components/layout/AppLayout";
import { GlassCard } from "@/components/ui/glass-card";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { toast } from "sonner";
import { Mail, Shield, KeyRound } from "lucide-react";
export default function Profil() {
    const { user, updateProfile } = useAuth();
    const [profile, setProfile] = useState({ name: user?.name ?? "", email: user?.email ?? "" });
    const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });
    const onSaveProfile = async (e) => {
        e.preventDefault();
        try {
            await updateProfile({
                name: profile.name.trim(),
                email: profile.email.trim().toLowerCase(),
            });
            toast.success("Profil mis a jour");
        }
        catch (err) {
            toast.error(err instanceof Error ? err.message : "Erreur de mise a jour");
        }
    };
    const onSavePassword = async (e) => {
        e.preventDefault();
        if (pwd.next.length < 8) return toast.error("Le mot de passe doit faire au moins 8 caracteres");
        if (pwd.next !== pwd.confirm)
            return toast.error("Les mots de passe ne correspondent pas");
        try {
            await updateProfile({
                currentPassword: pwd.current,
                newPassword: pwd.next,
            });
            toast.success("Mot de passe mis a jour");
            setPwd({ current: "", next: "", confirm: "" });
        }
        catch (err) {
            toast.error(err instanceof Error ? err.message : "Erreur mot de passe");
        }
    };
    if (!user)
        return null;
    return (<AppLayout title="Profil" subtitle="Vos informations et sécurité du compte">
      <div className="grid gap-6 lg:grid-cols-3">
        <GlassCard className="lg:col-span-1">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-primary text-2xl font-bold text-white shadow-glow">
              {user.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
            </div>
            <h3 className="mt-4 text-lg font-semibold">{user.name}</h3>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary capitalize">
              <Shield className="h-3.5 w-3.5"/> {user.role}
            </span>
          </div>
        </GlassCard>

        <GlassCard className="lg:col-span-2" delay={0.05}>
          <h3 className="mb-4 text-base font-semibold">Informations personnelles</h3>
          <form onSubmit={onSaveProfile} className="grid gap-3 sm:grid-cols-2">
            <EditableField label="Nom complet" value={profile.name} onChange={(v) => setProfile((p) => ({ ...p, name: v }))}/>
            <Info label="Identifiant" value={user.id} mono/>
            <EditableField label="Email" value={profile.email} onChange={(v) => setProfile((p) => ({ ...p, email: v }))} icon={Mail}/>
            <Info label="Role" value={user.role}/>
            <div className="sm:col-span-2">
              <button className="rounded-xl bg-gradient-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-glow hover:opacity-95 transition">
                Enregistrer le profil
              </button>
            </div>
          </form>
        </GlassCard>

        <GlassCard className="lg:col-span-3" delay={0.1}>
          <div className="mb-4 flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary"/>
            <h3 className="text-base font-semibold">Changement de mot de passe</h3>
          </div>
          <form onSubmit={onSavePassword} className="grid gap-3 sm:grid-cols-3">
            <PwdField label="Actuel" value={pwd.current} onChange={(v) => setPwd({ ...pwd, current: v })}/>
            <PwdField label="Nouveau" value={pwd.next} onChange={(v) => setPwd({ ...pwd, next: v })}/>
            <PwdField label="Confirmation" value={pwd.confirm} onChange={(v) => setPwd({ ...pwd, confirm: v })}/>
            <div className="sm:col-span-3">
              <button className="rounded-xl bg-gradient-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-glow hover:opacity-95 transition">
                Mettre à jour
              </button>
            </div>
          </form>
        </GlassCard>
      </div>
    </AppLayout>);
}
function Info({ label, value, icon: Icon, mono }) {
    return (<div className="rounded-xl border border-border/60 p-3">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 flex items-center gap-2 text-sm font-semibold capitalize ${mono ? "font-mono" : ""}`}>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground"/>}
        {value}
      </p>
    </div>);
}
function EditableField({ label, value, onChange, icon: Icon }) {
    return (<div className="rounded-xl border border-border/60 p-3">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="mt-2 flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground"/>}
        <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-input bg-card px-2 py-1.5 text-sm"/>
      </div>
    </div>);
}
function PwdField({ label, value, onChange }) {
    return (<div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      <input type="password" value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border border-input bg-card px-3 py-2 text-sm" placeholder="••••••••"/>
    </div>);
}
