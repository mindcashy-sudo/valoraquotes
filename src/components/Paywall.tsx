import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, Check, Clock, ShieldCheck, Infinity as InfinityIcon } from "lucide-react";
import { createCheckoutSession } from "@/server/stripe.functions";
import { useAuth } from "@/lib/auth-context";
import { useNavigate } from "@tanstack/react-router";

export function Paywall({ count, limit }: { count: number; limit: number }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleUpgrade = async () => {
    if (!user) {
      // Anonymous: send to login with a flag, then continue to checkout after auth
      try {
        sessionStorage.setItem("valora_post_login", "checkout");
      } catch {
        /* noop */
      }
      navigate({ to: "/login" });
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await createCheckoutSession({
        data: { origin: window.location.origin },
      });
      if (res.error || !res.url) {
        setError(res.error || "Impossibile avviare il checkout");
        setLoading(false);
        return;
      }
      window.location.href = res.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore");
      setLoading(false);
    }
  };

  // Rough estimate: 2.5h saved per quote, billable at €40/h = €100 of time per quote
  const hoursSaved = Math.round(count * 2.5);

  return (
    <div className="space-y-8 py-6 max-w-xl mx-auto">
      {/* Recap of what they did */}
      <div className="text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-valora-green/10 flex items-center justify-center mx-auto">
          <Sparkles className="w-6 h-6 text-valora-green" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
            Hai appena visto cosa può fare Valora
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            In {count} preventivi gratuiti hai risparmiato circa{" "}
            <strong className="text-foreground">{hoursSaved} ore</strong> di lavoro manuale.
            Continua senza limiti con Early Access.
          </p>
        </div>
      </div>

      {/* Value summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: InfinityIcon, label: "Preventivi", value: "Illimitati" },
          { icon: Clock, label: "Tempo per preventivo", value: "~2 min" },
          { icon: ShieldCheck, label: "Cancelli quando", value: "vuoi" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4 text-center space-y-1.5">
            <s.icon className="w-4 h-4 text-valora-green mx-auto" />
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {s.label}
            </p>
            <p className="text-sm font-semibold text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Pricing card */}
      <div className="bg-card border-2 border-valora-green/30 rounded-2xl p-6 space-y-5 shadow-lg shadow-valora-green/5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-valora-green mb-1">
              Early Access · Prezzo bloccato
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-4xl font-bold tracking-tight">€29</span>
              <span className="text-muted-foreground">/mese</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              Meno di un'ora del tuo tempo. Si ripaga al primo preventivo.
            </p>
          </div>
        </div>

        <div className="border-t border-border/60 pt-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Cosa è incluso
          </p>
          <ul className="space-y-2.5 text-sm">
            {[
              "Preventivi illimitati ogni mese",
              "PDF brandizzati con il tuo logo e dati studio",
              "Numerazione progressiva automatica (es. 2026-0001)",
              "Archivio clienti e storico preventivi",
              "Modifica voci e prezzi prima dell'invio",
              "Supporto via email diretto al fondatore",
            ].map((f) => (
              <li key={f} className="flex items-start gap-2.5">
                <Check className="w-4 h-4 text-valora-green flex-shrink-0 mt-0.5" />
                <span className="text-foreground/85">{f}</span>
              </li>
            ))}
          </ul>
        </div>

        <Button
          onClick={handleUpgrade}
          disabled={loading}
          className="w-full h-12 rounded-xl text-base font-semibold"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              Sblocca Early Access
              <Sparkles className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>

        <p className="text-[11px] text-center text-muted-foreground/80">
          Pagamento sicuro tramite Stripe · Disdici in 1 click dal pannello
        </p>
      </div>

      {error && <p className="text-sm text-destructive text-center">{error}</p>}

      <p className="text-[11px] text-center text-muted-foreground/70">
        Hai usato {count} di {limit} preventivi gratuiti.
      </p>
    </div>
  );
}
