import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, XCircle, Loader2, Building2, MapPin, Mail, Phone, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { QuoteData } from "@/components/QuoteDisplay";

interface PublicResponse {
  quote: {
    content: QuoteData;
    quote_number: string | null;
    project_address: string | null;
    share_status: "shared" | "viewed" | "accepted" | "rejected";
    accepted_at: string | null;
    rejected_at: string | null;
  };
  studio: {
    studio_name: string | null;
    architect_name: string | null;
    logo_url: string | null;
    city: string | null;
    address: string | null;
    vat_number: string | null;
    email: string | null;
    phone: string | null;
    iban: string | null;
    albo_number: string | null;
    default_vat_percent: number | null;
  } | null;
  client: {
    name: string | null;
    city: string | null;
    address: string | null;
  } | null;
}

export const Route = createFileRoute("/p/$token")({
  head: () => ({
    meta: [
      { title: "Preventivo — Valora" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PublicQuotePage,
});

function fmt(n: number) {
  return n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function PublicQuotePage() {
  const { token } = Route.useParams();
  const [data, setData] = useState<PublicResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<"accept" | "reject" | null>(null);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState<"accepted" | "rejected" | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/public/quote/${token}`)
      .then(async (r) => {
        if (!r.ok) {
          if (r.status === 404) throw new Error("Preventivo non trovato");
          if (r.status === 410) throw new Error("Questo link è scaduto");
          throw new Error("Impossibile caricare il preventivo");
        }
        return (await r.json()) as PublicResponse;
      })
      .then((d) => {
        if (cancelled) return;
        setData(d);
        if (d.quote.share_status === "accepted") setDone("accepted");
        if (d.quote.share_status === "rejected") setDone("rejected");
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleAction = async (action: "accept" | "reject") => {
    setSubmitting(action);
    try {
      const res = await fetch(`/api/public/quote/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, message: message.trim() || undefined }),
      });
      if (!res.ok) throw new Error("Errore");
      setDone(action === "accept" ? "accepted" : "rejected");
      toast.success(action === "accept" ? "Preventivo accettato" : "Risposta inviata");
    } catch {
      toast.error("Si è verificato un errore");
    } finally {
      setSubmitting(null);
    }
  };

  const studioName = data?.studio?.studio_name || data?.studio?.architect_name || "Studio";

  const totalNum = useMemo(() => data?.quote.content.total ?? 0, [data]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="max-w-md text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-muted mx-auto flex items-center justify-center">
            <XCircle className="w-7 h-7 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold">Link non disponibile</h1>
          <p className="text-muted-foreground">{error ?? "Riprova più tardi"}</p>
        </div>
      </div>
    );
  }

  const q = data.quote.content;

  return (
    <div className="min-h-screen bg-secondary/30">
      {/* Studio header */}
      <header className="bg-background border-b border-border">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {data.studio?.logo_url ? (
              <img src={data.studio.logo_url} alt={studioName} className="h-10 w-auto" />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{studioName}</p>
              {data.studio?.city && (
                <p className="text-xs text-muted-foreground truncate">{data.studio.city}</p>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Preventivo
            </p>
            {data.quote.quote_number && (
              <p className="text-sm font-semibold tabular-nums">N° {data.quote.quote_number}</p>
            )}
          </div>
        </div>
      </header>

      {/* Quote body */}
      <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        <section className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="bg-primary px-8 py-7">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary-foreground/50 mb-2">
              Oggetto
            </p>
            <h1 className="text-xl md:text-2xl font-bold text-primary-foreground tracking-tight">
              {q.title}
            </h1>
            <p className="text-sm text-primary-foreground/70 mt-2 leading-relaxed">
              {q.description}
            </p>
          </div>

          <div className="px-8 py-7 space-y-7">
            {/* meta */}
            <div className="grid grid-cols-2 gap-6 pb-5 border-b border-border/50">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  Durata
                </span>
                <p className="text-sm font-medium mt-0.5">{q.duration}</p>
              </div>
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  Finiture
                </span>
                <p className="text-sm font-medium mt-0.5">{q.finishLevel}</p>
              </div>
            </div>

            {/* sections */}
            <div className="space-y-7">
              {q.sections.map((s, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-valora-green tabular-nums">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <h2 className="text-xs font-bold uppercase tracking-[0.12em]">
                      {s.name}
                    </h2>
                    <div className="flex-1 border-b border-border/40" />
                  </div>
                  <div className="ml-7 space-y-1.5">
                    {s.items.map((it, j) => (
                      <div key={j} className="flex justify-between gap-6 py-2 border-b border-border/20 last:border-0">
                        <span className="text-sm leading-snug">{it.name}</span>
                        <span className="text-sm font-medium tabular-nums whitespace-nowrap">
                          € {fmt(it.price)}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between pt-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Subtotale
                      </span>
                      <span className="text-sm font-semibold tabular-nums">
                        € {fmt(s.subtotal)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* total */}
            <div className="border-t-2 border-valora-green/40 pt-5 flex items-center justify-between">
              <div>
                <span className="text-lg font-bold tracking-tight">Totale</span>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
                  IVA inclusa salvo diversa indicazione
                </p>
              </div>
              <span className="text-2xl font-bold text-valora-green tabular-nums">
                € {fmt(totalNum)}
              </span>
            </div>

            {q.notes?.length > 0 && (
              <div className="bg-muted/40 rounded-xl p-5">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground mb-2">
                  Note e condizioni
                </h3>
                <ol className="space-y-1.5 list-decimal list-inside">
                  {q.notes.map((n, i) => (
                    <li key={i} className="text-xs text-muted-foreground leading-relaxed">
                      {n}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </section>

        {/* Action panel */}
        {!done ? (
          <section className="bg-card border border-border rounded-2xl p-6 md:p-8 space-y-5">
            <div>
              <h2 className="text-lg font-bold">La tua risposta</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Conferma l'accettazione o richiedi modifiche. {studioName} riceverà subito una notifica.
              </p>
            </div>
            <Textarea
              placeholder="Vuoi lasciare un messaggio? (opzionale)"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              maxLength={1000}
            />
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={() => handleAction("accept")}
                disabled={submitting !== null}
                className="flex-1 h-12 text-base"
              >
                {submitting === "accept" ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                )}
                Accetto il preventivo
              </Button>
              <Button
                variant="outline"
                onClick={() => handleAction("reject")}
                disabled={submitting !== null}
                className="flex-1 h-12 text-base"
              >
                {submitting === "reject" ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                Richiedi modifiche
              </Button>
            </div>
          </section>
        ) : (
          <section
            className={`rounded-2xl p-6 md:p-8 border ${
              done === "accepted"
                ? "bg-valora-green/10 border-valora-green/30"
                : "bg-muted/60 border-border"
            }`}
          >
            <div className="flex items-start gap-3">
              {done === "accepted" ? (
                <CheckCircle2 className="w-6 h-6 text-valora-green shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-6 h-6 text-muted-foreground shrink-0 mt-0.5" />
              )}
              <div>
                <h2 className="text-lg font-bold">
                  {done === "accepted"
                    ? "Preventivo accettato"
                    : "Risposta inviata"}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {done === "accepted"
                    ? `Grazie. ${studioName} ti contatterà a breve per i passi successivi.`
                    : `${studioName} è stato avvisato della tua richiesta di modifiche.`}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Studio contact */}
        {data.studio && (
          <section className="bg-card border border-border rounded-2xl p-6 space-y-3">
            <h3 className="text-sm font-semibold">Contatti</h3>
            <div className="grid sm:grid-cols-2 gap-3 text-sm text-muted-foreground">
              {data.studio.address && (
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>
                    {data.studio.address}
                    {data.studio.city ? `, ${data.studio.city}` : ""}
                  </span>
                </div>
              )}
              {data.studio.email && (
                <div className="flex items-start gap-2">
                  <Mail className="w-4 h-4 mt-0.5 shrink-0" />
                  <a href={`mailto:${data.studio.email}`} className="hover:text-foreground">
                    {data.studio.email}
                  </a>
                </div>
              )}
              {data.studio.phone && (
                <div className="flex items-start gap-2">
                  <Phone className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{data.studio.phone}</span>
                </div>
              )}
              {data.studio.vat_number && (
                <div className="flex items-start gap-2">
                  <Building2 className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>P.IVA {data.studio.vat_number}</span>
                </div>
              )}
            </div>
          </section>
        )}

        <footer className="text-center text-xs text-muted-foreground pt-4 pb-8">
          <a
            href="/"
            className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
          >
            <Sparkles className="w-3 h-3 text-valora-green" />
            Generato con Valora
          </a>
        </footer>
      </main>
    </div>
  );
}
