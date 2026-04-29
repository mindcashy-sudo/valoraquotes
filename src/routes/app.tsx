import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, ArrowLeft, FolderOpen, Pencil, Check, LogOut, Settings } from "lucide-react";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { QuoteDisplay, type QuoteData } from "@/components/QuoteDisplay";
import { QuoteEditor } from "@/components/QuoteEditor";
import { Paywall } from "@/components/Paywall";
import { generateQuote } from "@/server/generate-quote.functions";
import { getQuoteStatus, saveQuoteFn, migrateLocalQuotes } from "@/server/quotes.functions";
import { syncCheckoutSession, syncCurrentStripeSubscription } from "@/server/stripe.functions";
import { getStudioProfile } from "@/server/studio.functions";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/lib/auth-context";
import { getSavedQuotes } from "@/lib/quote-storage";
import valoraLogo from "@/assets/valora-logo.png";

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      { title: "VALORA — Genera il tuo preventivo" },
      {
        name: "description",
        content: "Genera preventivi professionali dalla tua voce in pochi secondi.",
      },
    ],
  }),
  component: AppPage,
});

type Step = "record" | "edit" | "generating" | "result" | "editing" | "blocked";

function AppPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("record");
  const [transcription, setTranscription] = useState("");
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const [count, setCount] = useState(0);
  const [limit, setLimit] = useState(3);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [syncingPayment, setSyncingPayment] = useState(false);
  const [workZone, setWorkZone] = useState<string | null>(null);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [user, authLoading, navigate]);

  // Migrate localStorage quotes once + load status
  useEffect(() => {
    if (!user) return;
    const run = async () => {
      try {
        const local = getSavedQuotes();
        const migratedKey = `valora_migrated_${user.id}`;
        if (local.length > 0 && !localStorage.getItem(migratedKey)) {
          await migrateLocalQuotes({
            data: { quotes: local.map((q) => q.quote) },
          });
          localStorage.setItem(migratedKey, "1");
        }
        const params = new URLSearchParams(window.location.search);
        const checkoutSessionId = params.get("checkout_session_id");
        if (params.get("upgraded") === "1" && checkoutSessionId) {
          setSyncingPayment(true);
          try {
            for (let attempt = 0; attempt < 6; attempt += 1) {
              const sync = await syncCheckoutSession({ data: { sessionId: checkoutSessionId } });
              if (sync.isSubscribed) break;
              await new Promise((resolve) => setTimeout(resolve, 1200));
            }
          } finally {
            setSyncingPayment(false);
          }
          window.history.replaceState({}, "", window.location.pathname);
        }

        if (params.get("upgraded") === "1" && !checkoutSessionId) {
          setSyncingPayment(true);
          try {
            await syncCurrentStripeSubscription();
          } finally {
            setSyncingPayment(false);
          }
          window.history.replaceState({}, "", window.location.pathname);
        }

        let status = await getQuoteStatus();
        if (!status.canGenerate) {
          setSyncingPayment(true);
          try {
            const sync = await syncCurrentStripeSubscription();
            if (sync.isSubscribed) status = await getQuoteStatus();
          } finally {
            setSyncingPayment(false);
          }
        }
        setCount(status.count);
        setLimit(status.limit);
        setIsSubscribed(status.isSubscribed);
        setStep(status.canGenerate ? "record" : "blocked");
      } catch (e) {
        console.error(e);
      } finally {
        setStatusLoading(false);
      }
    };
    run();
  }, [user]);

  const handleTranscription = (text: string) => {
    setTranscription(text);
    setStep("edit");
  };

  const handleGenerate = async () => {
    if (!transcription.trim()) return;
    if (!isSubscribed && count >= limit) {
      setStep("blocked");
      return;
    }
    setStep("generating");
    setError("");

    try {
      const result = await generateQuote({
        data: { transcription: transcription.trim().slice(0, 2000) },
      });
      if ("error" in result && result.error) {
        setError(result.error);
        setStep("edit");
        return;
      }
      if ("quote" in result && result.quote) {
        setQuote(result.quote as QuoteData);
        setSaved(false);
        setStep("result");
      }
    } catch {
      setError("Qualcosa è andato storto. Riprova.");
      setStep("edit");
    }
  };

  const handleReset = async () => {
    // Refresh status
    const status = await getQuoteStatus();
    setCount(status.count);
    setIsSubscribed(status.isSubscribed);
    if (!status.canGenerate) {
      setStep("blocked");
    } else {
      setTranscription("");
      setQuote(null);
      setError("");
      setSaved(false);
      setStep("record");
    }
  };

  const handleSave = async () => {
    if (!quote) return;
    const res = await saveQuoteFn({ data: { quote } });
    if (res.error) {
      setError(res.error);
      return;
    }
    setSaved(true);
    setCount((c) => c + 1);
  };

  const remaining = Math.max(0, limit - count);

  if (authLoading || !user || statusLoading || syncingPayment) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-6 text-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        {syncingPayment && (
          <p className="text-sm text-muted-foreground">Sto attivando il tuo Early Access...</p>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 px-6 py-5 md:py-6 print:hidden bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <ArrowLeft className="w-4 h-4 text-muted-foreground" />
              <img src={valoraLogo} alt="Valora" className="h-20 md:h-28 w-auto" />
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/saved">
              <Button variant="ghost" size="sm" className="rounded-lg gap-2">
                <FolderOpen className="w-4 h-4" />
                <span className="hidden sm:inline">Salvati</span>
              </Button>
            </Link>
            <ThemeToggle />
            {isSubscribed ? (
              <span className="text-xs font-semibold text-valora-green uppercase tracking-wider px-2 py-1 rounded-md bg-valora-green/10">
                Early Access
              </span>
            ) : (
              step !== "blocked" && (
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {Array.from({ length: limit }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-2 h-2 rounded-full transition-colors ${
                          i < remaining ? "bg-valora-green" : "bg-border"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground ml-1">
                    {remaining}/{limit}
                  </span>
                </div>
              )
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={async () => {
                await signOut();
                navigate({ to: "/login" });
              }}
              title="Esci"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-2xl">
          {step === "record" && (
            <div className="text-center space-y-10">
              <div className="space-y-3">
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                  Descrivi il tuo progetto
                </h1>
                <p className="text-lg text-muted-foreground max-w-md mx-auto leading-relaxed">
                  Registra un memo vocale e genereremo un preventivo professionale in pochi secondi.
                </p>
              </div>
              <VoiceRecorder onTranscription={handleTranscription} />
            </div>
          )}

          {step === "edit" && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h2 className="text-2xl font-bold tracking-tight text-foreground">
                  Rivedi la trascrizione
                </h2>
                <p className="text-muted-foreground">
                  Modifica se necessario, poi genera il preventivo.
                </p>
              </div>
              <textarea
                value={transcription}
                onChange={(e) => setTranscription(e.target.value)}
                className="w-full h-40 rounded-xl border border-input bg-card px-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 resize-none transition-shadow"
                placeholder="La trascrizione apparirà qui..."
                maxLength={2000}
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={handleReset}
                  className="flex-1 h-12 rounded-xl text-base"
                >
                  Ricomincia
                </Button>
                <Button
                  onClick={handleGenerate}
                  disabled={!transcription.trim()}
                  className="flex-1 h-12 rounded-xl text-base"
                >
                  Genera Preventivo
                </Button>
              </div>
            </div>
          )}

          {step === "generating" && (
            <div className="text-center space-y-6 py-20">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
                <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
              </div>
              <p className="text-muted-foreground text-lg">
                Generazione del preventivo in corso...
              </p>
            </div>
          )}

          {step === "result" && quote && (
            <div className="space-y-4">
              <QuoteDisplay quote={quote} />
              <div className="flex flex-col sm:flex-row gap-3 print:hidden">
                <Button
                  variant="outline"
                  onClick={() => setStep("editing")}
                  className="flex-1 h-12 rounded-xl text-base"
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  Modifica
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saved}
                  className="flex-1 h-12 rounded-xl text-base"
                >
                  {saved ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Salvato
                    </>
                  ) : (
                    "Salva preventivo"
                  )}
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleReset}
                  className="flex-1 h-12 rounded-xl text-base"
                >
                  Nuovo
                </Button>
              </div>
            </div>
          )}

          {step === "editing" && quote && (
            <QuoteEditor
              quote={quote}
              onCancel={() => setStep("result")}
              onSave={(updated) => {
                setQuote(updated);
                setSaved(false);
                setStep("result");
              }}
              saveLabel="Conferma modifiche"
            />
          )}

          {step === "blocked" && <Paywall count={count} limit={limit} />}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 py-4 px-6 print:hidden">
        <p className="text-center text-xs text-muted-foreground/50">
          VALORA · Preventivi intelligenti per professionisti
        </p>
      </footer>
    </div>
  );
}
