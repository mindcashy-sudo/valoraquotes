import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Loader2, Search, Plus, Trash2, Calculator, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import {
  getComputo,
  addVoce,
  updateVoce,
  deleteVoce,
} from "@/server/computi.functions";
import { listPrezziari, searchPriceItems } from "@/server/prezziari.functions";
import { evalFormula } from "@/lib/formula-parser";
import valoraLogo from "@/assets/valora-logo.png";

export const Route = createFileRoute("/progetti/$projectId/computo/$computoId")({
  component: ComputoEditorPage,
});

type Voce = {
  id: string;
  ordine: number;
  codice: string | null;
  descrizione: string;
  unita_misura: string;
  prezzo_unitario: number;
  quantita: number;
  importo: number | null;
  incidenza_manodopera: number;
  formula_misura: string | null;
  capitolo: string | null;
  visibile_cliente: boolean;
};

type Computo = {
  id: string;
  nome: string;
  tipo: string;
  totale_imponibile: number;
  totale_manodopera: number;
};

type PriceItem = {
  id: string;
  codice: string | null;
  descrizione: string;
  unita_misura: string;
  prezzo: number;
  incidenza_manodopera: number;
};

type Prezziario = { id: string; nome: string; is_public: boolean };

function eur(n: number) {
  return `€ ${Number(n || 0).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function ComputoEditorPage() {
  const { projectId, computoId } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [computo, setComputo] = useState<Computo | null>(null);
  const [voci, setVoci] = useState<Voce[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewCliente, setViewCliente] = useState(false);

  const [prezziari, setPrezziari] = useState<Prezziario[]>([]);
  const [activePrezziarioId, setActivePrezziarioId] = useState<string>("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PriceItem[]>([]);
  const [searching, setSearching] = useState(false);

  const refresh = useCallback(async () => {
    const res = await getComputo({ data: { id: computoId } });
    setComputo(res.computo as Computo | null);
    setVoci((res.voci ?? []) as Voce[]);
  }, [computoId]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    (async () => {
      await refresh();
      const pl = await listPrezziari();
      const lists = (pl.lists ?? []) as Prezziario[];
      setPrezziari(lists);
      if (lists[0]) setActivePrezziarioId(lists[0].id);
      setLoading(false);
    })();
  }, [computoId, user, authLoading, navigate, refresh]);

  // Debounced search
  useEffect(() => {
    if (!activePrezziarioId) return;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await searchPriceItems({
          data: { priceListId: activePrezziarioId, query, limit: 40 },
        });
        setResults((res.items ?? []) as PriceItem[]);
      } finally {
        setSearching(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query, activePrezziarioId]);

  const handleAddFromPrice = async (item: PriceItem) => {
    const res = await addVoce({
      data: { computoId, priceItemId: item.id, quantita: 1 },
    });
    if (res.error) {
      toast.error(res.error);
      return;
    }
    await refresh();
  };

  const handleAddManual = async () => {
    const res = await addVoce({
      data: {
        computoId,
        voce: { descrizione: "Nuova voce", prezzo_unitario: 0, quantita: 0 },
      },
    });
    if (res.error) {
      toast.error(res.error);
      return;
    }
    await refresh();
  };

  const handleDelete = async (id: string) => {
    setVoci((prev) => prev.filter((v) => v.id !== id));
    const res = await deleteVoce({ data: { id } });
    if (res.error) {
      toast.error(res.error);
      await refresh();
      return;
    }
    await refresh();
  };

  const totali = useMemo(() => {
    const imp = voci.reduce((s, v) => s + Number(v.importo ?? 0), 0);
    const mo = voci.reduce(
      (s, v) => s + Number(v.importo ?? 0) * (Number(v.incidenza_manodopera ?? 0) / 100),
      0
    );
    return { imp, mo };
  }, [voci]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!computo) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <p className="text-muted-foreground">Computo non trovato</p>
        <Link to="/progetti">
          <Button variant="outline">Torna ai progetti</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border/50 px-6 py-3 bg-background/85 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/progetti/$projectId" params={{ projectId }} className="flex items-center gap-2 hover:opacity-80">
              <ArrowLeft className="w-4 h-4 text-muted-foreground" />
              <img src={valoraLogo} alt="Valora" className="h-10 w-auto" />
            </Link>
            <div className="ml-2 min-w-0">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                {computo.tipo === "base" ? "Computo base" : "Variante"}
              </div>
              <div className="font-semibold truncate">{computo.nome}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={viewCliente ? "default" : "outline"}
              size="sm"
              className="gap-2"
              onClick={() => setViewCliente((v) => !v)}
              title="Toggle vista cliente"
            >
              {viewCliente ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              Vista {viewCliente ? "cliente" : "tecnica"}
            </Button>
            <div className="hidden md:flex flex-col items-end ml-2">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Totale</div>
              <div className="font-bold tabular-nums">{eur(totali.imp)}</div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1400px] mx-auto w-full px-4 py-4 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
        {/* Grid */}
        <section className="border border-border rounded-xl bg-card overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="text-sm font-semibold">Voci ({voci.length})</div>
            <Button size="sm" variant="outline" className="gap-2" onClick={handleAddManual}>
              <Plus className="w-3.5 h-3.5" /> Aggiungi riga
            </Button>
          </div>
          {voci.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              Nessuna voce. Cerca nel prezziario a destra o aggiungi una riga manuale.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left font-semibold px-3 py-2 w-20">Cod.</th>
                    <th className="text-left font-semibold px-3 py-2">Descrizione</th>
                    <th className="text-left font-semibold px-3 py-2 w-16">U.M.</th>
                    <th className="text-right font-semibold px-3 py-2 w-40">Quantità / Formula</th>
                    <th className="text-right font-semibold px-3 py-2 w-28">Prezzo</th>
                    {!viewCliente && (
                      <th className="text-right font-semibold px-3 py-2 w-16">MO%</th>
                    )}
                    <th className="text-right font-semibold px-3 py-2 w-28">Importo</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {voci.map((v) => (
                    <VoceRow
                      key={v.id}
                      voce={v}
                      viewCliente={viewCliente}
                      onUpdated={refresh}
                      onDelete={() => handleDelete(v.id)}
                    />
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border bg-muted/30">
                    <td colSpan={viewCliente ? 5 : 6} className="px-3 py-2 text-right text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                      Totale imponibile
                    </td>
                    <td className="px-3 py-2 text-right font-bold tabular-nums">{eur(totali.imp)}</td>
                    <td></td>
                  </tr>
                  {!viewCliente && (
                    <tr className="bg-muted/20">
                      <td colSpan={6} className="px-3 py-1.5 text-right text-[11px] uppercase tracking-wider text-muted-foreground">
                        di cui manodopera
                      </td>
                      <td className="px-3 py-1.5 text-right text-xs tabular-nums text-muted-foreground">{eur(totali.mo)}</td>
                      <td></td>
                    </tr>
                  )}
                </tfoot>
              </table>
            </div>
          )}
        </section>

        {/* Price search panel */}
        <aside className="border border-border rounded-xl bg-card overflow-hidden flex flex-col h-fit lg:sticky lg:top-20">
          <div className="px-4 py-3 border-b border-border">
            <div className="text-sm font-semibold mb-2">Prezziario</div>
            <select
              value={activePrezziarioId}
              onChange={(e) => setActivePrezziarioId(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              {prezziari.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.is_public ? "🌐 " : "🔒 "}
                  {p.nome}
                </option>
              ))}
            </select>
            <div className="relative mt-2">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cerca voce (es. scavo, intonaco)..."
                className="pl-8 h-9"
              />
            </div>
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {searching && (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 inline animate-spin mr-2" /> Cerco...
              </div>
            )}
            {!searching && results.length === 0 && (
              <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                Nessun risultato
              </div>
            )}
            {!searching &&
              results.map((it) => (
                <button
                  key={it.id}
                  onClick={() => handleAddFromPrice(it)}
                  className="w-full text-left border-b border-border px-3 py-2.5 hover:bg-muted/40 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      {it.codice && (
                        <div className="text-[10px] font-mono uppercase text-muted-foreground">
                          {it.codice}
                        </div>
                      )}
                      <div className="text-xs leading-snug line-clamp-2">{it.descrizione}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-semibold tabular-nums">{eur(Number(it.prezzo))}</div>
                      <div className="text-[10px] text-muted-foreground">/{it.unita_misura}</div>
                    </div>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-valora-green mt-1 font-semibold uppercase tracking-wider">
                    + aggiungi al computo
                  </div>
                </button>
              ))}
          </div>
        </aside>
      </main>
    </div>
  );
}

// -------- Editable row --------

function VoceRow({
  voce,
  viewCliente,
  onUpdated,
  onDelete,
}: {
  voce: Voce;
  viewCliente: boolean;
  onUpdated: () => Promise<void>;
  onDelete: () => void;
}) {
  const [descrizione, setDescrizione] = useState(voce.descrizione);
  const [qtaStr, setQtaStr] = useState(String(voce.quantita));
  const [formula, setFormula] = useState(voce.formula_misura ?? "");
  const [prezzoStr, setPrezzoStr] = useState(String(voce.prezzo_unitario));
  const [moStr, setMoStr] = useState(String(voce.incidenza_manodopera));
  const [showFormula, setShowFormula] = useState(Boolean(voce.formula_misura));
  const savingRef = useRef(false);

  const formulaResult = useMemo(() => evalFormula(formula), [formula]);

  const effectiveQta = showFormula && formulaResult.value !== null ? formulaResult.value : Number(qtaStr.replace(",", ".") || 0);
  const effectivePrezzo = Number(prezzoStr.replace(",", ".") || 0);
  const importo = Math.round(effectiveQta * effectivePrezzo * 100) / 100;

  const persist = async (patch: Record<string, unknown>) => {
    if (savingRef.current) return;
    savingRef.current = true;
    try {
      const res = await updateVoce({ data: { id: voce.id, patch } });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      await onUpdated();
    } finally {
      savingRef.current = false;
    }
  };

  const onBlurAll = () => {
    const patch: Record<string, unknown> = {
      descrizione,
      prezzo_unitario: effectivePrezzo,
      quantita: effectiveQta,
      incidenza_manodopera: Number(moStr.replace(",", ".") || 0),
      formula_misura: showFormula ? formula.trim() || null : null,
    };
    // Only persist if something changed vs original
    const changed =
      patch.descrizione !== voce.descrizione ||
      Number(patch.prezzo_unitario) !== Number(voce.prezzo_unitario) ||
      Number(patch.quantita) !== Number(voce.quantita) ||
      Number(patch.incidenza_manodopera) !== Number(voce.incidenza_manodopera) ||
      (patch.formula_misura ?? null) !== (voce.formula_misura ?? null);
    if (changed) void persist(patch);
  };

  return (
    <tr className="border-t border-border hover:bg-muted/20">
      <td className="px-3 py-2 align-top">
        <span className="text-[11px] font-mono text-muted-foreground">{voce.codice ?? "—"}</span>
      </td>
      <td className="px-3 py-2 align-top">
        <input
          value={descrizione}
          onChange={(e) => setDescrizione(e.target.value)}
          onBlur={onBlurAll}
          className="w-full bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-ring rounded px-1 -mx-1"
        />
        {voce.capitolo && !viewCliente && (
          <div className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider">
            {voce.capitolo}
          </div>
        )}
      </td>
      <td className="px-3 py-2 align-top text-xs text-muted-foreground">
        {voce.unita_misura}
      </td>
      <td className="px-3 py-2 align-top">
        {showFormula ? (
          <div className="space-y-1">
            <input
              value={formula}
              onChange={(e) => setFormula(e.target.value)}
              onBlur={onBlurAll}
              placeholder="Es: 4.5 * 3.2"
              className="w-full bg-transparent text-right text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-ring rounded px-1"
            />
            <div className="flex items-center justify-end gap-1.5 text-[10px]">
              {formulaResult.error ? (
                <span className="text-destructive">{formulaResult.error}</span>
              ) : (
                <span className="text-muted-foreground tabular-nums">
                  = {formulaResult.value ?? 0}
                </span>
              )}
              <button
                onClick={() => {
                  setShowFormula(false);
                  if (formulaResult.value !== null) setQtaStr(String(formulaResult.value));
                }}
                className="text-muted-foreground hover:text-foreground"
                title="Disattiva formula"
              >
                ×
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-1">
            <input
              value={qtaStr}
              onChange={(e) => setQtaStr(e.target.value)}
              onBlur={onBlurAll}
              className="w-full bg-transparent text-right text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-ring rounded px-1"
              inputMode="decimal"
            />
            <button
              onClick={() => setShowFormula(true)}
              className="shrink-0 text-muted-foreground hover:text-foreground"
              title="Inserisci formula"
            >
              <Calculator className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </td>
      <td className="px-3 py-2 align-top">
        <input
          value={prezzoStr}
          onChange={(e) => setPrezzoStr(e.target.value)}
          onBlur={onBlurAll}
          className="w-full bg-transparent text-right text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-ring rounded px-1"
          inputMode="decimal"
        />
      </td>
      {!viewCliente && (
        <td className="px-3 py-2 align-top">
          <input
            value={moStr}
            onChange={(e) => setMoStr(e.target.value)}
            onBlur={onBlurAll}
            className="w-full bg-transparent text-right text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-ring rounded px-1"
            inputMode="decimal"
          />
        </td>
      )}
      <td className="px-3 py-2 align-top text-right font-semibold tabular-nums">{eur(importo)}</td>
      <td className="px-2 py-2 align-top">
        <button
          onClick={onDelete}
          className="text-muted-foreground hover:text-destructive transition-colors"
          title="Elimina"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  );
}
