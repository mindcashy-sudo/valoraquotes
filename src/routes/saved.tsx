import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, FileText, Trash2, Pencil, Eye, Loader2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

import { QuoteDisplay, type QuoteData } from "@/components/QuoteDisplay";
import { QuoteEditor } from "@/components/QuoteEditor";
import { ShareDialog } from "@/components/ShareDialog";
import {
  listQuotes,
  deleteQuoteFn,
  updateQuoteFn,
} from "@/server/quotes.functions";
import { useAuth } from "@/lib/auth-context";
import valoraLogo from "@/assets/valora-logo.png";

export const Route = createFileRoute("/saved")({
  head: () => ({
    meta: [
      { title: "VALORA — Preventivi salvati" },
      { name: "description", content: "I tuoi preventivi salvati." },
    ],
  }),
  component: SavedPage,
});

interface RemoteQuote {
  id: string;
  content: QuoteData;
  created_at: string;
  share_status?: string;
  view_count?: number;
  public_token?: string | null;
  accepted_at?: string | null;
  rejected_at?: string | null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function SavedPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState<RemoteQuote[]>([]);
  const [selected, setSelected] = useState<RemoteQuote | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [shareId, setShareId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [user, authLoading, navigate]);

  const refresh = async () => {
    const res = await listQuotes();
    setQuotes((res.quotes ?? []) as RemoteQuote[]);
    setLoading(false);
  };

  useEffect(() => {
    if (user) refresh();
  }, [user]);

  const handleDelete = async (id: string) => {
    await deleteQuoteFn({ data: { id } });
    if (selected?.id === id) setSelected(null);
    refresh();
  };

  if (authLoading || !user || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border/50 px-6 py-4 bg-background/85 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link to="/app" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <ArrowLeft className="w-4 h-4 text-muted-foreground" />
            <img src={valoraLogo} alt="Valora" className="h-14 md:h-16 w-auto" />
          </Link>
        </div>
      </header>

      <main className="flex-1 px-6 py-12">
        <div className="max-w-3xl mx-auto">
          {!selected && (
            <>
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                    Preventivi salvati
                  </h1>
                  <p className="text-muted-foreground mt-1">
                    {quotes.length} {quotes.length === 1 ? "preventivo" : "preventivi"}
                  </p>
                </div>
                <Link to="/app">
                  <Button className="rounded-xl h-11">Nuovo</Button>
                </Link>
              </div>

              {quotes.length === 0 ? (
                <div className="text-center py-20 space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
                    <FileText className="w-7 h-7 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground">Nessun preventivo salvato.</p>
                  <Link to="/app">
                    <Button variant="outline" className="rounded-xl">
                      Crea il primo
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {quotes.map((q) => (
                    <div
                      key={q.id}
                      className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4 hover:border-valora-green/40 transition-colors group"
                    >
                      <button
                        onClick={() => {
                          setSelected(q);
                          setEditing(false);
                        }}
                        className="flex-1 text-left min-w-0"
                      >
                        <h3 className="font-semibold truncate">{q.content.title}</h3>
                        <p className="text-sm text-muted-foreground truncate mt-0.5">
                          {q.content.description}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span>{formatDate(q.created_at)}</span>
                          <span>·</span>
                          <span className="font-semibold text-valora-green tabular-nums">
                            € {q.content.total.toFixed(2)}
                          </span>
                        </div>
                      </button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelected(q);
                          setEditing(false);
                        }}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(q.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {selected && !editing && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  onClick={() => setSelected(null)}
                  className="rounded-xl"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Torna alla lista
                </Button>
                <Button onClick={() => setEditing(true)} className="rounded-xl">
                  <Pencil className="w-4 h-4 mr-2" />
                  Modifica
                </Button>
              </div>
              <QuoteDisplay quote={selected.content} />
            </div>
          )}

          {selected && editing && (
            <div className="space-y-4">
              <Button
                variant="ghost"
                onClick={() => setEditing(false)}
                className="rounded-xl"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Annulla modifica
              </Button>
              <QuoteEditor
                quote={selected.content}
                onCancel={() => setEditing(false)}
                onSave={async (updated) => {
                  await updateQuoteFn({
                    data: { id: selected.id, quote: updated },
                  });
                  setSelected({ ...selected, content: updated });
                  setEditing(false);
                  refresh();
                }}
                saveLabel="Salva modifiche"
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
