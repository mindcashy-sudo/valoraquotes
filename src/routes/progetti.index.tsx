import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Plus, HardHat, Loader2, Trash2, MapPin, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { listProjects, createProject, deleteProject } from "@/lib/server-fns/computi.functions";
import valoraLogo from "@/assets/valora-logo.png";

export const Route = createFileRoute("/progetti/")({
  component: ProgettiPage,
});

type Project = {
  id: string;
  nome: string;
  committente: string | null;
  indirizzo_cantiere: string | null;
  stato: string;
  updated_at: string;
};

function formatData(d: string) {
  try {
    return new Date(d).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "—";
  }
}

function ProgettiPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCreate, setOpenCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [q, setQ] = useState("");
  const [nome, setNome] = useState("");
  const [committente, setCommittente] = useState("");
  const [indirizzo, setIndirizzo] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    listProjects().then((res) => {
      setProjects((res.projects ?? []) as Project[]);
      setLoading(false);
    });
  }, [user, authLoading, navigate]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return projects;
    return projects.filter(
      (p) =>
        p.nome.toLowerCase().includes(s) ||
        (p.committente ?? "").toLowerCase().includes(s) ||
        (p.indirizzo_cantiere ?? "").toLowerCase().includes(s)
    );
  }, [q, projects]);

  const handleCreate = async () => {
    if (!nome.trim()) return;
    setCreating(true);
    try {
      const res = await createProject({
        data: {
          nome: nome.trim(),
          committente: committente.trim() || null,
          indirizzo_cantiere: indirizzo.trim() || null,
        },
      });
      if (res.error || !res.projectId || !res.computoId) {
        toast.error(res.error ?? "Errore");
        return;
      }
      toast.success("Cantiere aperto");
      await navigate({
        to: "/progetti/$projectId/computo/$computoId",
        params: { projectId: res.projectId, computoId: res.computoId },
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Eliminare il cantiere e tutti i suoi computi metrici? L'operazione è irreversibile.")) return;
    const res = await deleteProject({ data: { id } });
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setProjects((prev) => prev.filter((p) => p.id !== id));
    toast.success("Cantiere eliminato");
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border/50 px-6 py-3 bg-background/85 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <Link to="/app" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <ArrowLeft className="w-4 h-4 text-muted-foreground" />
            <img src={valoraLogo} alt="Valora" className="h-10 w-auto" />
          </Link>
          <Button onClick={() => setOpenCreate(true)} size="sm" className="gap-2">
            <Plus className="w-4 h-4" /> Nuovo cantiere
          </Button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8">
        <div className="mb-6 flex items-end justify-between gap-6 flex-wrap">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-1">
              Studio · Archivio cantieri
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Cantieri</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Ogni cantiere raccoglie computo metrico estimativo, perizie e varianti in corso d'opera.
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cerca cantiere, committente, indirizzo…"
              className="pl-8 h-9"
            />
          </div>
        </div>

        {projects.length === 0 ? (
          <div className="border border-dashed border-border rounded-2xl p-12 text-center">
            <HardHat className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <h2 className="text-lg font-semibold">Nessun cantiere in archivio</h2>
            <p className="text-sm text-muted-foreground mt-1 mb-5">
              Apri un cantiere per redigere il computo metrico estimativo, gestire misurazioni e varianti.
            </p>
            <Button onClick={() => setOpenCreate(true)} className="gap-2">
              <Plus className="w-4 h-4" /> Apri cantiere
            </Button>
          </div>
        ) : (
          <div className="border border-border rounded-xl overflow-hidden bg-card">
            <div className="grid grid-cols-[1fr_220px_140px_40px] gap-3 px-4 py-2.5 bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              <div>Cantiere · Indirizzo</div>
              <div>Committente</div>
              <div>Ultima modifica</div>
              <div></div>
            </div>
            {filtered.map((p) => (
              <div
                key={p.id}
                className="group grid grid-cols-[1fr_220px_140px_40px] gap-3 px-4 py-3 border-t border-border items-center hover:bg-muted/20 transition-colors"
              >
                <Link
                  to="/progetti/$projectId"
                  params={{ projectId: p.id }}
                  className="min-w-0"
                >
                  <div className="font-semibold truncate">{p.nome}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 truncate flex items-center gap-1">
                    <MapPin className="w-3 h-3 shrink-0" />
                    {p.indirizzo_cantiere || "Indirizzo non specificato"}
                  </div>
                </Link>
                <div className="text-sm truncate">
                  {p.committente || <span className="text-muted-foreground">—</span>}
                </div>
                <div className="text-xs text-muted-foreground tabular-nums">{formatData(p.updated_at)}</div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(p.id)}
                  title="Elimina cantiere"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground border-t border-border">
                Nessun cantiere corrisponde alla ricerca.
              </div>
            )}
          </div>
        )}
      </main>

      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apri nuovo cantiere</DialogTitle>
            <DialogDescription>
              Inserisci i dati identificativi. Il computo metrico estimativo base viene predisposto in automatico.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="nome">Denominazione lavori</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Es: Ristrutturazione unità immobiliare Via Roma 12"
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="comm">Committente</Label>
              <Input
                id="comm"
                value={committente}
                onChange={(e) => setCommittente(e.target.value)}
                placeholder="Es: Sig. Mario Rossi"
              />
            </div>
            <div>
              <Label htmlFor="ind">Ubicazione cantiere</Label>
              <Input
                id="ind"
                value={indirizzo}
                onChange={(e) => setIndirizzo(e.target.value)}
                placeholder="Es: Via Roma 12, 20121 Milano (MI)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenCreate(false)}>
              Annulla
            </Button>
            <Button onClick={handleCreate} disabled={creating || !nome.trim()}>
              {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Apri cantiere
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
