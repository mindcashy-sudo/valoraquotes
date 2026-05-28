import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, FileSpreadsheet, GitBranch, MapPin, User } from "lucide-react";
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

function eur(n: number) {
  return `€ ${Number(n || 0).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function statoLabel(s: string) {
  switch (s) {
    case "bozza":
      return "In redazione";
    case "approvato":
      return "Approvato";
    case "consegnato":
      return "Consegnato";
    default:
      return s;
  }
}

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
        <p className="text-muted-foreground">Cantiere non trovato</p>
        <Link to="/progetti">
          <Button variant="outline">Torna all'archivio</Button>
        </Link>
      </div>
    );
  }

  const base = computi.find((c) => c.tipo === "base");
  const varianti = computi.filter((c) => c.tipo !== "base");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 px-6 py-3 bg-background/85 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <Link to="/progetti" className="flex items-center gap-2.5 hover:opacity-80">
            <ArrowLeft className="w-4 h-4 text-muted-foreground" />
            <img src={valoraLogo} alt="Valora" className="h-10 w-auto" />
          </Link>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-mono">
            CANT–{projectId.slice(0, 6).toUpperCase()}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto w-full px-6 py-8">
        {/* Cantiere header */}
        <div className="mb-8 border-b border-border pb-6">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-2">
            Cantiere · Scheda lavori
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{project.nome}</h1>
          <div className="flex flex-wrap gap-x-6 gap-y-1.5 mt-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              {project.committente || "Committente non indicato"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              {project.indirizzo_cantiere || "Ubicazione non indicata"}
            </span>
          </div>
        </div>

        {/* Computo metrico estimativo */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Computo metrico estimativo
            </h2>
          </div>
          {base ? (
            <Link
              to="/progetti/$projectId/computo/$computoId"
              params={{ projectId, computoId: base.id }}
              className="block border border-border rounded-xl p-5 hover:border-foreground/40 hover:shadow-sm transition-all bg-card group"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-foreground/5 flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-5 h-5 text-foreground/70" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <div className="font-semibold">{base.nome}</div>
                    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-semibold">
                      {statoLabel(base.stato)}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1.5 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-0.5">
                    <div>
                      <span className="uppercase tracking-wider text-[10px]">Importo lavori</span>
                      <div className="text-foreground font-semibold tabular-nums text-sm mt-0.5">
                        {eur(Number(base.totale_imponibile))}
                      </div>
                    </div>
                    <div>
                      <span className="uppercase tracking-wider text-[10px]">Di cui manodopera</span>
                      <div className="tabular-nums text-sm mt-0.5">
                        {eur(Number(base.totale_manodopera))}
                      </div>
                    </div>
                    <div>
                      <span className="uppercase tracking-wider text-[10px]">Revisione</span>
                      <div className="font-mono text-sm mt-0.5">rev. {base.versione}</div>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ) : (
            <p className="text-sm text-muted-foreground">Nessun computo metrico predisposto.</p>
          )}
        </section>

        {/* Varianti */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Varianti in corso d'opera
            </h2>
          </div>
          {varianti.length === 0 ? (
            <div className="border border-dashed border-border rounded-xl p-6 text-center">
              <GitBranch className="w-5 h-5 mx-auto text-muted-foreground mb-2" />
              <p className="text-xs text-muted-foreground">
                Nessuna variante registrata. Le varianti vengono generate dal computo base, mantenendo la tracciabilità delle modifiche.
              </p>
            </div>
          ) : (
            <div className="border border-border rounded-xl overflow-hidden bg-card">
              {varianti.map((v, i) => (
                <Link
                  key={v.id}
                  to="/progetti/$projectId/computo/$computoId"
                  params={{ projectId, computoId: v.id }}
                  className={`flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors ${i > 0 ? "border-t border-border" : ""}`}
                >
                  <GitBranch className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm flex items-baseline gap-2 flex-wrap">
                      <span className="truncate">{v.nome}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">rev. {v.versione}</span>
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-semibold">
                        {statoLabel(v.stato)}
                      </span>
                    </div>
                    {v.motivazione && (
                      <div className="text-xs text-muted-foreground mt-0.5 truncate">
                        Motivazione: {v.motivazione}
                      </div>
                    )}
                  </div>
                  <div className="text-sm tabular-nums font-semibold shrink-0">
                    {eur(Number(v.totale_imponibile))}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
