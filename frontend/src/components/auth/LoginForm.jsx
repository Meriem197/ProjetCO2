import { useState } from "react";
import { Eye, EyeOff, Loader2, AlertCircle, LogIn } from "lucide-react";
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export default function LoginForm({ onSubmit }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [show, setShow] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const validate = () => {
        if (!emailRegex.test(email.trim()))
            return "Veuillez saisir un email valide";
        if (password.trim().length < 8)
            return "Le mot de passe doit contenir au moins 8 caracteres";
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
            await onSubmit({ email: email.trim(), password });
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Erreur de connexion");
        }
        finally {
            setLoading(false);
        }
    };
    return (<form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium">Email professionnel</label>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@entreprise.com" className="w-full rounded-xl border border-input bg-card px-4 py-2.5 text-sm shadow-soft outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"/>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium">Mot de passe</label>
        <div className="relative">
          <input type={show ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full rounded-xl border border-input bg-card px-4 py-2.5 pr-10 text-sm shadow-soft outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"/>
          <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            {show ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
          </button>
        </div>
      </div>

      {error && (<div className="flex items-center gap-2 rounded-xl border border-status-critical/30 bg-status-critical/10 px-3 py-2 text-sm text-status-critical">
          <AlertCircle className="h-4 w-4"/> {error}
        </div>)}

      <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow transition hover:opacity-95 disabled:opacity-60">
        {loading ? <Loader2 className="h-4 w-4 animate-spin"/> : <LogIn className="h-4 w-4"/>}
        Se connecter
      </button>

    </form>);
}
