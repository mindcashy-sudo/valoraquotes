import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import valoraLogo from "@/assets/valora-logo.png";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: "VALORA — Accedi" }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState("");

  useEffect(() => {
    if (!authLoading && user) navigate({ to: "/app" });
  }, [user, authLoading, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/app" },
        });
        if (error) throw error;
        setInfo("Controlla la tua email per confermare l'account.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/app" });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <Link to="/" className="mb-10">
        <img src={valoraLogo} alt="Valora logo" className="h-32 w-auto" />
      </Link>
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">
            {mode === "signin" ? "Accedi a Valora" : "Crea il tuo account"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {mode === "signin"
              ? "Bentornato. Continua a generare preventivi."
              : "Inizia con 3 preventivi gratis."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 rounded-xl"
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 rounded-xl"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {info && <p className="text-sm text-valora-green">{info}</p>}

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-xl text-base"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : mode === "signin" ? (
              "Accedi"
            ) : (
              "Crea account"
            )}
          </Button>
        </form>

        <div className="text-center text-sm text-muted-foreground">
          {mode === "signin" ? (
            <>
              Non hai un account?{" "}
              <button
                onClick={() => {
                  setMode("signup");
                  setError("");
                  setInfo("");
                }}
                className="text-foreground font-medium hover:underline"
              >
                Registrati
              </button>
            </>
          ) : (
            <>
              Hai già un account?{" "}
              <button
                onClick={() => {
                  setMode("signin");
                  setError("");
                  setInfo("");
                }}
                className="text-foreground font-medium hover:underline"
              >
                Accedi
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
