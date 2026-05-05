import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, CreditCard, ExternalLink, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getStudioProfile } from "@/server/studio.functions";
import { StudioProfileForm, type StudioProfile } from "@/components/StudioProfileForm";
import { Users } from "lucide-react";
import valoraLogo from "@/assets/valora-logo.png";
import { Button } from "@/components/ui/button";
import { createCustomerPortalSession } from "@/server/stripe.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Impostazioni studio — VALORA" },
      { name: "description", content: "Configura il tuo studio e i default dei preventivi." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
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
      .then((res) => setProfile(res.profile as StudioProfile | null))
      .finally(() => setLoading(false));
  }, [user]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link to="/app" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
            App
          </Link>
          <img src={valoraLogo} alt="Valora" className="h-14 md:h-16 w-auto" />
          <Link to="/clients" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
            <Users className="w-4 h-4" />
            Clienti
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10 space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Impostazioni studio</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Questi dati compaiono in ogni preventivo PDF che generi.
          </p>
        </div>

        <StudioProfileForm
          initial={profile}
          onSaved={(p) => setProfile(p)}
          saveLabel="Salva modifiche"
        />
      </main>
    </div>
  );
}
