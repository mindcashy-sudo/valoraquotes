import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Plus, FolderOpen, Loader2, Trash2 } from "lucide-react";
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
import { listProjects, createProject, deleteProject } from "@/server/computi.functions";
import valoraLogo from "@/assets/valora-logo.png";

export const Route = createFileRoute("/progetti")({
  head: () => ({
    meta: [
      { title: "Progetti — Valora" },
      { name: "description", content: "Gestisci progetti e computi metrici." },
    ],
  }),
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

function ProgettiPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCreate, setOpenCreate] = useState(false);
  const [creating, setCreating] = useState(false);
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
      toast.success("Progetto creato");
      navigate({
        to: "/progetti/$projectId/computo/$computoId",
        params: { projectId: res.projectId, computoId: res.computoId },
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Eliminare il progetto e tutti i suoi computi?")) return;
    const res = await deleteProject({ data: { id } });
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setProjects((prev) => prev.filter((p) => p.id !== id));
    toast.success("Progetto eliminato");
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
      <header className="border-b border-border/50 px-6 py-4 bg-background/85 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <Link to="/app" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <ArrowLeft className="w-4 h-4 text-muted-foreground" />
            <img src={valoraLogo} alt="Valora" className="h-12 w-auto" />
          </Link>
          <Button onClick={() => setOpenCreate(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Nuovo progetto
          </Button>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Progetti</h1>
          <p className="text-muted-foreground mt-1">
            Ogni progetto contiene il computo base e le sue varianti.
          </p>
        </div>

        {projects.length === 0 ? (
          <div className="border border-dashed border-border rounded-2xl p-12 text-center">
            <FolderOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <h2 className="text-lg font-semibold">Nessun progetto ancora</h2>
            <p className="text-sm text-muted-foreground mt-1 mb-5">
              Crea il primo progetto per iniziare a redigere il computo metrico.
            </p>
            <Button onClick={() => setOpenCreate(true)} className="gap-2">
              <Plus className="w-4 h-4" /> Crea progetto
            </Button>
          </div>
        ) : (
          <div className="grid gap-3">
            {projects.map((p) => (
              <div
                key={p.id}
                className="group border border-border rounded-xl p-4 hover:border-foreground/30 hover:shadow-sm transition-all flex items-center justify-between gap-4 bg-card"
              >
                <Link
                  to="/progetti/$projectId"
                  params={{ projectId: p.id }}
                  className="flex-1 min-w-0"
                >
                  <div className="font-semibold truncate">{p.nome}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">
                    {p.committente || "—"}
                    {p.indirizzo_cantiere ? ` · ${p.indirizzo_cantiere}` : ""}
                  </div>
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(p.id)}
                  title="Elimina"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </main>

      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuovo progetto</DialogTitle>
            <DialogDescription>
              Il computo base viene creato automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="nome">Nome progetto</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Es: Ristrutturazione Via Roma 12"
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="comm">Committente</Label>
              <Input
                id="comm"
                value={committente}
                onChange={(e) => setCommittente(e.target.value)}
                placeholder="Es: Sig. Rossi"
              />
            </div>
            <div>
              <Label htmlFor="ind">Indirizzo cantiere</Label>
              <Input
                id="ind"
                value={indirizzo}
                onChange={(e) => setIndirizzo(e.target.value)}
                placeholder="Es: Via Roma 12, Milano"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenCreate(false)}>
              Annulla
            </Button>
            <Button onClick={handleCreate} disabled={creating || !nome.trim()}>
              {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Crea
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
