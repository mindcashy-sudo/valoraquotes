import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Loader2,
  Search,
  Plus,
  Trash2,
  Calculator,
  Eye,
  HardHat,
  BookOpen,
  Hammer,
  Ruler,
} from "lucide-react";
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
        voce: { descrizione: "Nuova lavorazione", prezzo_unitario: 0, quantita: 0 },
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

  // Group voci by capitolo (ordered by first appearance)
  const grouped = useMemo(() => {
    const map = new Map<string, Voce[]>();
    for (const v of voci) {
      const cap = v.capitolo?.trim() || "Lavorazioni varie";
      if (!map.has(cap)) map.set(cap, []);
      map.get(cap)!.push(v);
    }
    return Array.from(map.entries());
  }, [voci]);

  const totali = useMemo(() => {
    const imp = voci.reduce((s, v) => s + Number(v.importo ?? 0), 0);
    const mo = voci.reduce(
      (s, v) => s + Number(v.importo ?? 0) * (Number(v.incidenza_manodopera ?? 0) / 100),
      0
    );
    return { imp, mo, materiali: imp - mo };
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
          <Button variant="outline">Torna ai cantieri</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header className="border-b border-border bg-background sticky top-0 z-50">
        <div className="max-w-[1500px] mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/progetti/$projectId" params={{ projectId }} className="flex items-center gap-2 hover:opacity-80">
              <ArrowLeft className="w-4 h-4 text-muted-foreground" />
              <img src={valoraLogo} alt="Valora" className="h-8 w-auto" />
            </Link>
            <div className="h-6 w-px bg-border mx-1" />
            <HardHat className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold leading-none">
                {computo.tipo === "base" ? "Computo metrico estimativo" : "Variante in corso d'opera"}
              </div>
              <div className="font-semibold truncate text-sm mt-0.5">{computo.nome}</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant={viewCliente ? "default" : "outline"}
              size="sm"
              className="gap-1.5 h-8"
              onClick={() => setViewCliente((v) => !v)}
            >
              <Eye className="w-3.5 h-3.5" />
              {viewCliente ? "Vista committente" : "Vista tecnica"}
            </Button>
          </div>
        </div>

        {/* KPI bar */}
        <div className="border-t border-border bg-muted/30">
          <div className="max-w-[1500px] mx-auto px-4 py-2 flex items-center gap-6 overflow-x-auto">
            <KPI label="Lavorazioni" value={String(voci.length)} mono />
            <KPI label="Categorie di lavoro" value={String(grouped.length)} mono />
            <KPI label="Importo materiali" value={eur(totali.materiali)} />
            <KPI label="Importo manodopera" value={eur(totali.mo)} />
            <div className="flex-1" />
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
                Totale lavori a base d'asta
              </div>
              <div className="text-lg font-bold tabular-nums leading-none mt-0.5">{eur(totali.imp)}</div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1500px] mx-auto w-full px-4 py-4 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
        {/* Computo */}
        <section className="border border-border rounded-xl bg-card overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/20">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Elenco delle lavorazioni
            </div>
            <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs" onClick={handleAddManual}>
              <Plus className="w-3 h-3" /> Riga manuale
            </Button>
          </div>

          {voci.length === 0 ? (
            <div className="p-12 text-center">
              <Ruler className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium">Nessuna lavorazione inserita</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Ricerca le voci nell'elenco prezzi a destra, oppure inserisci una riga manuale per lavorazioni non a prezziario.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left font-semibold px-3 py-2 w-24">N° · Codice</th>
                    <th className="text-left font-semibold px-3 py-2">Designazione dei lavori</th>
                    <th className="text-center font-semibold px-2 py-2 w-14">U.M.</th>
                    <th className="text-right font-semibold px-3 py-2 w-44">Misurazioni · Quantità</th>
                    <th className="text-right font-semibold px-3 py-2 w-28">Prezzo unit.</th>
                    {!viewCliente && (
                      <th className="text-right font-semibold px-2 py-2 w-14">M.O. %</th>
                    )}
                    <th className="text-right font-semibold px-3 py-2 w-32">Importo (€)</th>
                    <th className="w-9"></th>
                  </tr>
                </thead>
                <tbody>
                  {grouped.map(([cap, items], gi) => {
                    const groupTotal = items.reduce((s, v) => s + Number(v.importo ?? 0), 0);
                    const colSpan = viewCliente ? 6 : 7;
                    return (
                      <FragmentGroup key={`${cap}-${gi}`}>
                        <tr className="bg-foreground/[0.04] border-t border-border">
                          <td colSpan={colSpan + 1} className="px-3 py-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-[11px] uppercase tracking-[0.15em] font-bold text-foreground/80">
                                Cap. {String(gi + 1).padStart(2, "0")} — {cap}
                              </div>
                              <div className="text-[11px] font-mono tabular-nums text-muted-foreground">
                                Σ {eur(groupTotal)}
                              </div>
                            </div>
                          </td>
                        </tr>
                        {items.map((v, idx) => (
                          <VoceRow
                            key={v.id}
                            voce={v}
                            num={`${gi + 1}.${idx + 1}`}
                            viewCliente={viewCliente}
                            onUpdated={refresh}
                            onDelete={() => handleDelete(v.id)}
                          />
                        ))}
                      </FragmentGroup>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-foreground/40 bg-muted/40">
                    <td colSpan={viewCliente ? 5 : 6} className="px-3 py-2.5 text-right text-[11px] uppercase tracking-[0.15em] text-foreground font-bold">
                      Sommano i lavori
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold tabular-nums">{eur(totali.imp)}</td>
                    <td></td>
                  </tr>
                  {!viewCliente && (
                    <tr className="bg-muted/20">
                      <td colSpan={6} className="px-3 py-1.5 text-right text-[10px] uppercase tracking-wider text-muted-foreground">
                        Incidenza manodopera
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

        {/* Elenco prezzi */}
        <aside className="border border-border rounded-xl bg-card overflow-hidden flex flex-col h-fit lg:sticky lg:top-[112px]">
          <div className="px-4 py-2.5 border-b border-border bg-muted/20 flex items-center gap-2">
            <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Elenco prezzi unitari
            </div>
          </div>
          <div className="px-3 py-3 border-b border-border space-y-2">
            <select
              value={activePrezziarioId}
              onChange={(e) => setActivePrezziarioId(e.target.value)}
              className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
            >
              {prezziari.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.is_public ? "📘 " : "🗂 "}
                  {p.nome}
                </option>
              ))}
            </select>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cerca voce (es. scavo, intonaco, OG.01)…"
                className="pl-8 h-8 text-xs"
              />
            </div>
          </div>
          <div className="max-h-[65vh] overflow-y-auto">
            {searching && (
              <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 inline animate-spin mr-2" /> Consultazione in corso…
              </div>
            )}
            {!searching && results.length === 0 && (
              <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                Nessuna voce corrispondente nell'elenco prezzi.
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
                        <div className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider">
                          {it.codice}
                        </div>
                      )}
                      <div className="text-xs leading-snug line-clamp-2 mt-0.5">{it.descrizione}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-semibold tabular-nums">{eur(Number(it.prezzo))}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">/ {it.unita_misura}</div>
                    </div>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-valora-green mt-1.5 font-semibold uppercase tracking-wider inline-flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Inserisci in computo
                  </div>
                </button>
              ))}
          </div>
        </aside>
      </main>
    </div>
  );
}

function FragmentGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function KPI({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="shrink-0">
      <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold leading-none">
        {label}
      </div>
      <div className={`text-sm font-semibold tabular-nums mt-1 ${mono ? "font-mono" : ""}`}>
        {value}
      </div>
    </div>
  );
}

// -------- Editable row --------

function VoceRow({
  voce,
  num,
  viewCliente,
  onUpdated,
  onDelete,
}: {
  voce: Voce;
  num: string;
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
    const changed =
      patch.descrizione !== voce.descrizione ||
      Number(patch.prezzo_unitario) !== Number(voce.prezzo_unitario) ||
      Number(patch.quantita) !== Number(voce.quantita) ||
      Number(patch.incidenza_manodopera) !== Number(voce.incidenza_manodopera) ||
      (patch.formula_misura ?? null) !== (voce.formula_misura ?? null);
    if (changed) void persist(patch);
  };

  return (
    <tr className="border-t border-border hover:bg-muted/20 align-top">
      <td className="px-3 py-2">
        <div className="font-mono text-[11px] tabular-nums text-foreground font-semibold">{num}</div>
        {voce.codice && (
          <div className="font-mono text-[10px] text-muted-foreground tracking-wider mt-0.5">
            {voce.codice}
          </div>
        )}
      </td>
      <td className="px-3 py-2">
        <input
          value={descrizione}
          onChange={(e) => setDescrizione(e.target.value)}
          onBlur={onBlurAll}
          className="w-full bg-transparent text-sm leading-snug focus:outline-none focus:ring-1 focus:ring-ring rounded px-1 -mx-1"
        />
        {!viewCliente && (
          <div className="text-[10px] text-muted-foreground mt-1 inline-flex items-center gap-1">
            <Hammer className="w-2.5 h-2.5" />
            M.O. {moStr || 0}%
          </div>
        )}
      </td>
      <td className="px-2 py-2 text-center text-xs font-mono uppercase text-muted-foreground">
        {voce.unita_misura}
      </td>
      <td className="px-3 py-2">
        {showFormula ? (
          <div className="space-y-1">
            <input
              value={formula}
              onChange={(e) => setFormula(e.target.value)}
              onBlur={onBlurAll}
              placeholder="Es: 4.50 * 3.20 * 2"
              className="w-full bg-transparent text-right text-sm tabular-nums font-mono focus:outline-none focus:ring-1 focus:ring-ring rounded px-1"
            />
            <div className="flex items-center justify-end gap-1.5 text-[10px]">
              {formulaResult.error ? (
                <span className="text-destructive">{formulaResult.error}</span>
              ) : (
                <span className="text-muted-foreground tabular-nums font-mono">
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
              className="w-full bg-transparent text-right text-sm tabular-nums font-mono focus:outline-none focus:ring-1 focus:ring-ring rounded px-1"
              inputMode="decimal"
            />
            <button
              onClick={() => setShowFormula(true)}
              className="shrink-0 text-muted-foreground hover:text-foreground"
              title="Inserisci formula di misurazione"
            >
              <Calculator className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </td>
      <td className="px-3 py-2">
        <input
          value={prezzoStr}
          onChange={(e) => setPrezzoStr(e.target.value)}
          onBlur={onBlurAll}
          className="w-full bg-transparent text-right text-sm tabular-nums font-mono focus:outline-none focus:ring-1 focus:ring-ring rounded px-1"
          inputMode="decimal"
        />
      </td>
      {!viewCliente && (
        <td className="px-2 py-2">
          <input
            value={moStr}
            onChange={(e) => setMoStr(e.target.value)}
            onBlur={onBlurAll}
            className="w-full bg-transparent text-right text-sm tabular-nums font-mono focus:outline-none focus:ring-1 focus:ring-ring rounded px-1"
            inputMode="decimal"
          />
        </td>
      )}
      <td className="px-3 py-2 text-right font-semibold tabular-nums font-mono">{eur(importo)}</td>
      <td className="px-2 py-2">
        <button
          onClick={onDelete}
          className="text-muted-foreground hover:text-destructive transition-colors"
          title="Elimina lavorazione"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  );
}
