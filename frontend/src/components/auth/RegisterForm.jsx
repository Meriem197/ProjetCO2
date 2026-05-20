import { useMemo, useState } from "react";
import { AlertCircle, Eye, EyeOff, Loader2, UserPlus } from "lucide-react";
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export default function RegisterForm({ onSubmit }) {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [role, setRole] = useState("CLIENT");
    const [showPass, setShowPass] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const passwordHint = useMemo(() => {
        if (!password)
            return "Minimum 8 caracteres";
        return password.length >= 8 ? "Mot de passe valide" : "Mot de passe trop court";
    }, [password]);
    const validate = () => {
        if (name.trim().length < 3)
            return "Le nom complet doit contenir au moins 3 caracteres";
        if (!emailRegex.test(email.trim()))
            return "Veuillez saisir un email valide";
        if (password.length < 8)
            return "Le mot de passe doit contenir au moins 8 caracteres";
        if (confirmPassword !== password)
            return "La confirmation du mot de passe ne correspond pas";
        return null;
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        const validationError = validate();
        if (validationError) {
            setError(validationError);
            return;
        }
        setError(null);
        setLoading(true);
        try {
            await onSubmit({ name: name.trim(), email: email.trim(), password, confirmPassword, role });
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Impossible de creer le compte");
        }
        finally {
            setLoading(false);
        }
    };
    return (<form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium">Nom complet</label>
        <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Samir Ben Ali" className="w-full rounded-xl border border-input bg-card px-4 py-2.5 text-sm shadow-soft outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"/>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium">Email professionnel</label>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@entreprise.com" className="w-full rounded-xl border border-input bg-card px-4 py-2.5 text-sm shadow-soft outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"/>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium">Role</label>
        <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full rounded-xl border border-input bg-card px-4 py-2.5 text-sm shadow-soft outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15">
          <option value="CLIENT">Client (visualisation)</option>
          <option value="TECHNICIAN">Technicien (maintenance)</option>
          <option value="ADMIN">Admin (acces complet)</option>
        </select>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium">Mot de passe</label>
        <div className="relative">
          <input type={showPass ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full rounded-xl border border-input bg-card px-4 py-2.5 pr-10 text-sm shadow-soft outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"/>
          <button type="button" onClick={() => setShowPass((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            {showPass ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
          </button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{passwordHint}</p>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium">Confirmer le mot de passe</label>
        <div className="relative">
          <input type={showConfirm ? "text" : "password"} required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" className="w-full rounded-xl border border-input bg-card px-4 py-2.5 pr-10 text-sm shadow-soft outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"/>
          <button type="button" onClick={() => setShowConfirm((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            {showConfirm ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
          </button>
        </div>
      </div>

      {error && (<div className="flex items-center gap-2 rounded-xl border border-status-critical/30 bg-status-critical/10 px-3 py-2 text-sm text-status-critical">
          <AlertCircle className="h-4 w-4"/> {error}
        </div>)}

      <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow transition hover:opacity-95 disabled:opacity-60">
        {loading ? <Loader2 className="h-4 w-4 animate-spin"/> : <UserPlus className="h-4 w-4"/>}
        Creer le compte
      </button>
    </form>);
}
