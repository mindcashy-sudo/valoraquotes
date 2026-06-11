import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Loader2, Search, Trash2, User2, Phone, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import {
  listClients,
  createClient,
  deleteClient,
} from "@/lib/server-fns/clients.functions";
import valoraLogo from "@/assets/valora-logo.png";

export const Route = createFileRoute("/clients")({
  head: () => ({
    meta: [
      { title: "Clienti — VALORA" },
      { name: "description", content: "Gestisci i tuoi clienti e i preventivi associati." },
    ],
  }),
  component: ClientsPage,
});

interface ClientRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
}

function ClientsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    vat_number: "",
    fiscal_code: "",
    notes: "",
  });

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [user, authLoading, navigate]);

  const refresh = async () => {
    const res = await listClients();
    setClients((res.clients ?? []) as ClientRow[]);
    setLoading(false);
  };

  useEffect(() => {
    if (user) refresh();
  }, [user]);

  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.email ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async () => {
    if (!draft.name.trim()) {
      toast.error("Inserisci il nome del cliente");
      return;
    }
    setSaving(true);
    try {
      const res = await createClient({ data: draft });
      if (res.error || !res.client) {
        toast.error(res.error ?? "Errore");
        return;
      }
      toast.success("Cliente creato");
      setOpen(false);
      setDraft({
        name: "",
        email: "",
        phone: "",
        address: "",
        city: "",
        vat_number: "",
        fiscal_code: "",
        notes: "",
      });
      refresh();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Eliminare il cliente "${name}"? I preventivi resteranno ma non saranno più collegati.`)) return;
    const res = await deleteClient({ data: { id } });
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Cliente eliminato");
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
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-background/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link to="/app" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <ArrowLeft className="w-4 h-4 text-muted-foreground" />
            <img src={valoraLogo} alt="Valora logo" className="h-14 md:h-16 w-auto" />
          </Link>
          <Button onClick={() => setOpen(true)} className="rounded-xl h-11 px-5">
            <Plus className="w-4 h-4 mr-2" />
            Nuovo cliente
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Clienti</h1>
          <p className="text-muted-foreground mt-1.5">
            {clients.length} {clients.length === 1 ? "cliente" : "clienti"} in archivio
          </p>
        </div>

        <div className="relative mb-6">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca per nome o email…"
            className="pl-10 h-12 rounded-xl"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-border rounded-2xl">
            <User2 className="w-10 h-10 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">
              {clients.length === 0
                ? "Non hai ancora aggiunto clienti."
                : "Nessun cliente corrisponde alla ricerca."}
            </p>
            {clients.length === 0 && (
              <Button onClick={() => setOpen(true)} className="rounded-xl">
                <Plus className="w-4 h-4 mr-2" />
                Aggiungi il primo cliente
              </Button>
            )}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {filtered.map((c) => (
              <div
                key={c.id}
                className="group bg-card border border-border rounded-2xl p-5 hover:border-valora-green/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <Link
                    to="/clients/$clientId"
                    params={{ clientId: c.id }}
                    className="flex-1 min-w-0"
                  >
                    <h2 className="font-semibold text-base truncate">{c.name}</h2>
                    {c.city && (
                      <p className="text-xs text-muted-foreground mt-0.5">{c.city}</p>
                    )}
                    <div className="mt-3 space-y-1">
                      {c.email && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Mail className="w-3 h-3" />
                          <span className="truncate">{c.email}</span>
                        </div>
                      )}
                      {c.phone && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Phone className="w-3 h-3" />
                          <span>{c.phone}</span>
                        </div>
                      )}
                    </div>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(c.id, c.name)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuovo cliente</DialogTitle>
            <DialogDescription>
              Aggiungi un cliente all'archivio. Solo il nome è obbligatorio.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Nome cliente *"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className="h-11"
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="Email"
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                className="h-11"
              />
              <Input
                placeholder="Telefono"
                value={draft.phone}
                onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                className="h-11"
              />
            </div>
            <Input
              placeholder="Indirizzo"
              value={draft.address}
              onChange={(e) => setDraft({ ...draft, address: e.target.value })}
              className="h-11"
            />
            <Input
              placeholder="Città"
              value={draft.city}
              onChange={(e) => setDraft({ ...draft, city: e.target.value })}
              className="h-11"
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="P.IVA"
                value={draft.vat_number}
                onChange={(e) => setDraft({ ...draft, vat_number: e.target.value })}
                className="h-11"
              />
              <Input
                placeholder="Codice fiscale"
                value={draft.fiscal_code}
                onChange={(e) => setDraft({ ...draft, fiscal_code: e.target.value })}
                className="h-11"
              />
            </div>
            <Textarea
              placeholder="Note (opzionale)"
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              className="min-h-[80px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="h-11">
              Annulla
            </Button>
            <Button onClick={handleCreate} disabled={saving} className="h-11 px-6">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Crea cliente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
