import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, FileText, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { getProject } from "@/server/computi.functions";
import valoraLogo from "@/assets/valora-logo.png";

export const Route = createFileRoute("/progetti/$projectId/")({
  component: ProgettoPage,
});

type Computo = {
  id: string;
  nome: string;
  tipo: string;
  versione: number;
  stato: string;
  parent_computo_id: string | null;
  totale_imponibile: number;
  totale_manodopera: number;
  motivazione: string | null;
};

type Project = {
  id: string;
  nome: string;
  committente: string | null;
  indirizzo_cantiere: string | null;
  stato: string;
};

function ProgettoPage() {
  const { projectId } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [computi, setComputi] = useState<Computo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    getProject({ data: { id: projectId } }).then((res) => {
      setProject(res.project as Project | null);
      setComputi((res.computi ?? []) as Computo[]);
      setLoading(false);
    });
  }, [projectId, user, authLoading, navigate]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!project) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <p className="text-muted-foreground">Progetto non trovato</p>
        <Link to="/progetti">
          <Button variant="outline">Torna ai progetti</Button>
        </Link>
      </div>
    );
  }

  const base = computi.find((c) => c.tipo === "base");
  const varianti = computi.filter((c) => c.tipo !== "base");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 px-6 py-4 bg-background/85 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <Link to="/progetti" className="flex items-center gap-2.5 hover:opacity-80">
            <ArrowLeft className="w-4 h-4 text-muted-foreground" />
            <img src={valoraLogo} alt="Valora" className="h-12 w-auto" />
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto w-full px-6 py-10">
        <div className="mb-8">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">
            Progetto
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{project.nome}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {project.committente || "—"}
            {project.indirizzo_cantiere ? ` · ${project.indirizzo_cantiere}` : ""}
          </p>
        </div>

        <section className="mb-10">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Computo base
          </h2>
          {base ? (
            <Link
              to="/progetti/$projectId/computo/$computoId"
              params={{ projectId, computoId: base.id }}
              className="block border border-border rounded-xl p-5 hover:border-foreground/30 hover:shadow-sm transition-all bg-card"
            >
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{base.nome}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Totale imponibile:{" "}
                    <span className="font-medium tabular-nums">
                      € {Number(base.totale_imponibile).toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ) : (
            <p className="text-sm text-muted-foreground">Nessun computo base.</p>
          )}
        </section>

        {varianti.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Varianti
            </h2>
            <div className="grid gap-2">
              {varianti.map((v) => (
                <Link
                  key={v.id}
                  to="/progetti/$projectId/computo/$computoId"
                  params={{ projectId, computoId: v.id }}
                  className="block border border-border rounded-xl p-4 hover:border-foreground/30 transition-all bg-card"
                >
                  <div className="flex items-center gap-3">
                    <FolderOpen className="w-4 h-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">
                        {v.nome} <span className="text-xs text-muted-foreground">v{v.versione}</span>
                      </div>
                      {v.motivazione && (
                        <div className="text-xs text-muted-foreground mt-0.5 truncate">
                          {v.motivazione}
                        </div>
                      )}
                    </div>
                    <div className="text-sm tabular-nums">
                      € {Number(v.totale_imponibile).toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
