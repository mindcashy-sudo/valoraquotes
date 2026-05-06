import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, ArrowLeft, FolderOpen, Pencil, Check, LogOut, Settings, Users, Sparkles, Lightbulb, Clock, LogIn } from "lucide-react";
import { toast } from "sonner";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { QuoteDisplay, type QuoteData } from "@/components/QuoteDisplay";
import { QuoteEditor } from "@/components/QuoteEditor";
import { Paywall } from "@/components/Paywall";
import { generateQuote } from "@/server/generate-quote.functions";
import { getQuoteStatus, saveQuoteFn, migrateLocalQuotes } from "@/server/quotes.functions";
import { syncCheckoutSession, syncCurrentStripeSubscription, createCheckoutSession } from "@/server/stripe.functions";
import { getStudioProfile } from "@/server/studio.functions";
import { listClients } from "@/server/clients.functions";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import { getSavedQuotes } from "@/lib/quote-storage";
import { getAnonCount, incAnonCount, ANON_FREE_LIMIT } from "@/lib/anon-quota";
import valoraLogo from "@/assets/valora-logo.png";

const EXAMPLE_PROMPTS = [
  "Ristrutturazione integrale appartamento 85 mq a Milano zona Isola, due bagni, cucina abitabile, finiture fascia media, rifacimento completo impianti elettrico e idraulico.",
  "Ristrutturazione bagno 6 mq con sostituzione sanitari, rivestimenti gres porcellanato, nuovo box doccia in cristallo, rifacimento impianti.",
  "Recupero sottotetto 60 mq con coibentazione, nuovi tramezzi, impianti, parquet rovere e bagno cieco con ventilazione meccanica.",
];

const MIN_INPUT_CHARS = 40;

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
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [projectAddress, setProjectAddress] = useState("");

  // No auth guard: /app is open. Login is required only to save quotes/clients.

  // Post-login: if user came from "Abbonati" CTA while anonymous, resume checkout.
  useEffect(() => {
    if (!user) return;
    let resume = false;
    try {
      resume = sessionStorage.getItem("valora_post_login") === "checkout";
      if (resume) sessionStorage.removeItem("valora_post_login");
    } catch {
      /* noop */
    }
    if (resume) {
      (async () => {
        try {
          const res = await createCheckoutSession({ data: { origin: window.location.origin } });
          if (res.url) window.location.href = res.url;
        } catch {
          /* noop */
        }
      })();
    }
  }, [user]);

  // Load status (logged-in) or initialize anonymous flow.
  useEffect(() => {
    if (authLoading) return;
    const run = async () => {
      try {
        if (!user) {
          // Anonymous flow: track quotes locally, no studio/onboarding.
          const c = getAnonCount();
          setCount(c);
          setLimit(ANON_FREE_LIMIT);
          setIsSubscribed(false);
          setStep(c < ANON_FREE_LIMIT ? "record" : "blocked");
          setStatusLoading(false);
          return;
        }

        // Check studio profile / onboarding
        const studioRes = await getStudioProfile();
        const studio = studioRes.profile;
        if (!studio || !studio.onboarding_completed) {
          navigate({ to: "/onboarding" });
          return;
        }
        setWorkZone(studio.default_work_zone ?? null);

        // Load clients list (best-effort)
        listClients().then((res) => {
          setClients((res.clients ?? []).map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })));
        });

        // Pre-select client from query param
        const preParams = new URLSearchParams(window.location.search);
        const preClient = preParams.get("clientId");
        if (preClient) setSelectedClientId(preClient);

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
  }, [user, authLoading, navigate]);

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
        data: {
          transcription: transcription.trim().slice(0, 2000),
          ...(workZone ? { workZone } : {}),
        },
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
    const res = await saveQuoteFn({
      data: {
        quote,
        clientId: selectedClientId || null,
        projectAddress: projectAddress.trim() || null,
      },
    });
    if (res.error) {
      setError(res.error);
      toast.error(res.error);
      return;
    }
    setSaved(true);
    setCount((c) => c + 1);
    toast.success(
      selectedClientId
        ? "Preventivo salvato e collegato al cliente"
        : "Preventivo salvato"
    );
  };

  const remaining = Math.max(0, limit - count);
  const selectedClientName = useMemo(
    () => clients.find((c) => c.id === selectedClientId)?.name ?? "",
    [clients, selectedClientId]
  );

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
      <header className="border-b border-border/50 px-6 py-4 print:hidden bg-background/85 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity shrink-0">
            <ArrowLeft className="w-4 h-4 text-muted-foreground" />
            <img src={valoraLogo} alt="Valora" className="h-14 md:h-16 w-auto" />
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/clients">
              <Button variant="ghost" size="sm" className="rounded-lg gap-2 h-9">
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">Clienti</span>
              </Button>
            </Link>
            <Link to="/saved">
              <Button variant="ghost" size="sm" className="rounded-lg gap-2 h-9">
                <FolderOpen className="w-4 h-4" />
                <span className="hidden sm:inline">Salvati</span>
              </Button>
            </Link>
            <Link to="/settings">
              <Button variant="ghost" size="sm" className="rounded-lg gap-2 h-9">
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Studio</span>
              </Button>
            </Link>
            {isSubscribed ? (
              <span className="text-[10px] font-bold text-valora-green uppercase tracking-wider px-2.5 py-1 rounded-md bg-valora-green/10 ml-1">
                Early Access
              </span>
            ) : (
              step !== "blocked" && (
                <div className="hidden md:flex items-center gap-2 ml-2">
                  <div className="flex gap-1">
                    {Array.from({ length: limit }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-1.5 h-1.5 rounded-full transition-colors ${
                          i < remaining ? "bg-valora-green" : "bg-border"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {remaining}/{limit}
                  </span>
                </div>
              )
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
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
            <div className="space-y-10">
              <div className="text-center space-y-3">
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                  Descrivi il tuo prossimo progetto
                </h1>
                <p className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
                  Registra un memo vocale o digita la richiesta del cliente.
                  In pochi secondi avrai un preventivo strutturato, pronto da inviare.
                </p>
                {!isSubscribed && (
                  <p className="text-xs text-muted-foreground/80">
                    {remaining > 0
                      ? `Hai ${remaining} ${remaining === 1 ? "preventivo gratuito" : "preventivi gratuiti"} rimanenti.`
                      : "Hai esaurito i preventivi gratuiti."}
                  </p>
                )}
              </div>

              <VoiceRecorder onTranscription={handleTranscription} />

              <div className="space-y-3">
                <div className="flex items-center gap-2 justify-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Lightbulb className="w-3.5 h-3.5 text-valora-green" />
                  Oppure parti da un esempio reale
                </div>
                <div className="grid sm:grid-cols-3 gap-3">
                  {EXAMPLE_PROMPTS.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => handleTranscription(p)}
                      className="text-left rounded-xl border border-border bg-card hover:border-valora-green/50 hover:shadow-sm transition-all p-4 text-xs text-muted-foreground leading-relaxed group"
                    >
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-valora-green/80 mb-1.5">
                        Esempio {i + 1}
                      </span>
                      <span className="line-clamp-3 group-hover:text-foreground transition-colors">
                        {p}
                      </span>
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground/70 text-center">
                  Più dettagli fornisci (mq, città, finiture, impianti), più il preventivo sarà accurato.
                </p>
              </div>
            </div>
          )}

          {step === "edit" && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h2 className="text-2xl font-bold tracking-tight text-foreground">
                  Rivedi i dettagli del progetto
                </h2>
                <p className="text-muted-foreground">
                  Aggiungi metratura, città, tipo di finiture e impianti per un preventivo più preciso.
                </p>
              </div>
              <div className="relative">
                <textarea
                  value={transcription}
                  onChange={(e) => setTranscription(e.target.value)}
                  className="w-full h-44 rounded-xl border border-input bg-card px-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 resize-none transition-shadow"
                  placeholder="Es. Ristrutturazione 90 mq a Roma zona Prati, due bagni, finiture fascia media, rifacimento impianti..."
                  maxLength={2000}
                />
                <div className="absolute bottom-2 right-3 text-[10px] tabular-nums text-muted-foreground/70">
                  {transcription.trim().length} / 2000
                </div>
              </div>
              {transcription.trim().length > 0 && transcription.trim().length < MIN_INPUT_CHARS && (
                <p className="text-xs text-muted-foreground bg-secondary/60 rounded-lg p-3 flex items-start gap-2">
                  <Lightbulb className="w-3.5 h-3.5 text-valora-green mt-0.5 shrink-0" />
                  <span>
                    Aggiungi almeno {MIN_INPUT_CHARS} caratteri. Includi <strong>metratura</strong>,
                    <strong> città/zona</strong> e tipo di intervento per un risultato realistico.
                  </span>
                </p>
              )}
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
                  disabled={transcription.trim().length < MIN_INPUT_CHARS}
                  className="flex-1 h-12 rounded-xl text-base"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Genera Preventivo
                </Button>
              </div>
            </div>
          )}

          {step === "generating" && (
            <div className="text-center space-y-6 py-20">
              <div className="w-16 h-16 rounded-2xl bg-valora-green/10 flex items-center justify-center mx-auto">
                <Loader2 className="w-7 h-7 animate-spin text-valora-green" />
              </div>
              <div className="space-y-2">
                <p className="text-foreground text-lg font-medium">
                  Sto preparando il tuo preventivo…
                </p>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Sto strutturando le sezioni, calcolando i prezzi sui benchmark di mercato italiano
                  e formulando le note tecniche.
                </p>
              </div>
            </div>
          )}

          {step === "result" && quote && (
            <div className="space-y-5">
              {/* Wow moment */}
              <div className="rounded-2xl border border-valora-green/30 bg-valora-green/5 p-4 flex items-center gap-3 print:hidden">
                <div className="w-9 h-9 rounded-full bg-valora-green/15 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 text-valora-green" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    Preventivo pronto in pochi secondi
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    <Clock className="w-3 h-3" />
                    Hai risparmiato circa 2-3 ore di lavoro manuale.
                    {!saved && <span className="hidden sm:inline">Salvalo per averlo sempre nel tuo archivio.</span>}
                  </p>
                </div>
              </div>

              <QuoteDisplay
                quote={quote}
                defaultClientName={selectedClientName}
                defaultProjectAddress={projectAddress}
              />

              {!saved && (
                <div className="bg-card border border-border rounded-2xl p-5 space-y-3 print:hidden">
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-muted-foreground" />
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Collega a cliente <span className="font-normal normal-case text-muted-foreground/60">(opzionale)</span>
                    </p>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <Select
                      value={selectedClientId || "none"}
                      onValueChange={(v) => setSelectedClientId(v === "none" ? "" : v)}
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Nessun cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nessun cliente</SelectItem>
                        {clients.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <input
                      value={projectAddress}
                      onChange={(e) => setProjectAddress(e.target.value)}
                      placeholder="Indirizzo cantiere"
                      className="h-11 rounded-md border border-input bg-background px-3 text-sm"
                    />
                  </div>
                  {clients.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Nessun cliente in archivio.{" "}
                      <Link to="/clients" className="underline hover:text-foreground">
                        Aggiungine uno
                      </Link>
                      .
                    </p>
                  )}
                </div>
              )}

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

              {saved && (
                <p className="text-center text-xs text-muted-foreground print:hidden">
                  Salvato nel tuo archivio.{" "}
                  <Link to="/saved" className="underline hover:text-foreground">
                    Vedi tutti i preventivi
                  </Link>
                </p>
              )}
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
