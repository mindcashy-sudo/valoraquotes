import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, FileText, Plus, Mail, Phone, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { getClient, listClientQuotes } from "@/server/clients.functions";
import valoraLogo from "@/assets/valora-logo.png";

export const Route = createFileRoute("/clients/$clientId")({
  head: () => ({
    meta: [{ title: "Cliente — VALORA" }],
  }),
  component: ClientDetailPage,
});

interface QuoteRow {
  id: string;
  content: { title: string; total: number };
  created_at: string;
  status: string;
  project_address: string | null;
}

interface ClientFull {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  vat_number: string | null;
  notes: string | null;
}

function ClientDetailPage() {
  const { clientId } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [client, setClient] = useState<ClientFull | null>(null);
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getClient({ data: { id: clientId } }),
      listClientQuotes({ data: { clientId } }),
    ]).then(([c, q]) => {
      setClient(c.client as ClientFull | null);
      setQuotes((q.quotes ?? []) as QuoteRow[]);
      setLoading(false);
    });
  }, [user, clientId]);

  if (authLoading || !user || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-center px-6">
        <div>
          <p className="text-muted-foreground mb-4">Cliente non trovato.</p>
          <Link to="/clients">
            <Button>Torna ai clienti</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-background/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link to="/clients" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <ArrowLeft className="w-4 h-4 text-muted-foreground" />
            <img src={valoraLogo} alt="Valora" className="h-14 md:h-16 w-auto" />
          </Link>
          <Link to="/app" search={{ clientId } as never}>
            <Button className="rounded-xl h-11 px-5">
              <Plus className="w-4 h-4 mr-2" />
              Nuovo preventivo
            </Button>
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10 space-y-8">
        {/* Client card */}
        <div className="bg-card border border-border rounded-2xl p-8">
          <h1 className="text-2xl font-bold tracking-tight">{client.name}</h1>
          <div className="grid sm:grid-cols-2 gap-4 mt-6 text-sm">
            {client.email && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="w-4 h-4" />
                <span>{client.email}</span>
              </div>
            )}
            {client.phone && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="w-4 h-4" />
                <span>{client.phone}</span>
              </div>
            )}
            {(client.address || client.city) && (
              <div className="flex items-center gap-2 text-muted-foreground sm:col-span-2">
                <MapPin className="w-4 h-4" />
                <span>{[client.address, client.city].filter(Boolean).join(", ")}</span>
              </div>
            )}
            {client.vat_number && (
              <div className="text-muted-foreground">
                <span className="font-semibold uppercase tracking-wider text-[10px] mr-2">P.IVA</span>
                {client.vat_number}
              </div>
            )}
          </div>
          {client.notes && (
            <p className="mt-6 text-sm text-muted-foreground leading-relaxed border-t border-border pt-6 whitespace-pre-line">
              {client.notes}
            </p>
          )}
        </div>

        {/* Quotes */}
        <div>
          <h2 className="text-lg font-bold mb-4">Preventivi</h2>
          {quotes.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-border rounded-2xl">
              <FileText className="w-10 h-10 text-muted-foreground/40 mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">Nessun preventivo per questo cliente.</p>
              <Link to="/app" search={{ clientId } as never}>
                <Button className="rounded-xl">
                  <Plus className="w-4 h-4 mr-2" />
                  Crea preventivo
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {quotes.map((q) => (
                <div
                  key={q.id}
                  className="bg-card border border-border rounded-xl p-5 flex items-center justify-between gap-4 hover:border-valora-green/40 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{q.content.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(q.created_at).toLocaleDateString("it-IT", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                      {q.project_address && ` · ${q.project_address}`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-valora-green tabular-nums">
                      € {q.content.total.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                    </p>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {q.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
