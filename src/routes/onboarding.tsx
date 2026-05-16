import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getStudioProfile } from "@/server/studio.functions";
import { StudioProfileForm, type StudioProfile } from "@/components/StudioProfileForm";
import valoraLogo from "@/assets/valora-logo.png";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Benvenuto in Valora — Configura il tuo studio" },
      { name: "description", content: "Configura il tuo studio per iniziare a generare preventivi." },
    ],
  }),
  component: OnboardingPage,
});

function OnboardingPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<StudioProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    getStudioProfile()
      .then((res) => {
        const p = res.profile as StudioProfile | null;
        if (p?.onboarding_completed) {
          navigate({ to: "/app" });
          return;
        }
        setProfile(p);
      })
      .finally(() => setLoading(false));
  }, [user, navigate]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-4xl mx-auto px-6 h-20 flex items-center justify-center">
          <img src={valoraLogo} alt="Valora logo" className="h-28 w-auto" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-valora-green/10 px-3 py-1 text-xs font-medium text-valora-green">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Account creato
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Benvenuto in Valora</h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Configura il tuo studio: bastano 2 minuti. Questi dati compariranno automaticamente
            su ogni preventivo PDF che genererai.
          </p>
        </div>

        <StudioProfileForm
          initial={profile}
          onSaved={() => navigate({ to: "/app" })}
          saveLabel="Completa e inizia →"
        />
      </main>
    </div>
  );
}
