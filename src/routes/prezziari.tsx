import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Search, Upload, Plus, Trash2, Loader2, BookText, Globe2, Lock } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import {
  listPrezziari,
  searchPriceItems,
  createPersonalPrezziario,
  importPriceItems,
  deletePrezziario,
} from "@/server/prezziari.functions";
import valoraLogo from "@/assets/valora-logo.png";

export const Route = createFileRoute("/prezziari")({
  head: () => ({
    meta: [
      { title: "Prezziari — Valora" },
      {
        name: "description",
        content:
          "Gestisci i prezziari per il computo metrico. Importa CSV regionali o crea il tuo listino personale.",
      },
    ],
  }),
  component: PrezziariPage,
});

type Prezziario = {
  id: string;
  nome: string;
  regione: string | null;
  anno: number | null;
  source: string;
  is_public: boolean;
  owner_id: string | null;
};

type Voce = {
  id: string;
  price_list_id: string;
  codice: string | null;
  descrizione: string;
  unita_misura: string;
  prezzo: number;
  incidenza_manodopera: number;
  categoria: string | null;
};

function PrezziariPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [lists, setLists] = useState<Prezziario[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [voci, setVoci] = useState<Voce[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [newNome, setNewNome] = useState("");
  const [newRegione, setNewRegione] = useState("");
  const [newAnno, setNewAnno] = useState(String(new Date().getFullYear()));
  const [creating, setCreating] = useState(false);

  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(() => lists.find((l) => l.id === selectedId), [lists, selectedId]);
  const isOwn = selected && !selected.is_public && selected.owner_id === user?.id;

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [user, authLoading, navigate]);

  const refreshLists = async (preferId?: string) => {
    const res = await listPrezziari();
    const ls = (res.lists ?? []) as Prezziario[];
    setLists(ls);
    if (preferId && ls.find((l) => l.id === preferId)) setSelectedId(preferId);
    else if (!selectedId && ls.length > 0) setSelectedId(ls[0].id);
  };

  useEffect(() => {
    if (user) refreshLists().then(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Debounced search whenever selection or query changes
  useEffect(() => {
    if (!selectedId) {
      setVoci([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      const res = await searchPriceItems({
        data: { priceListId: selectedId, query: search.trim(), limit: 100 },
      });
      setVoci((res.items ?? []) as Voce[]);
      setSearching(false);
    }, 120);
    return () => clearTimeout(t);
  }, [selectedId, search]);

  const handleCreate = async () => {
    if (!newNome.trim()) {
      toast.error("Inserisci il nome del prezziario");
      return;
    }
    setCreating(true);
    const anno = parseInt(newAnno, 10);
    const res = await createPersonalPrezziario({
      data: {
        nome: newNome.trim(),
        regione: newRegione.trim() || null,
        anno: Number.isFinite(anno) ? anno : null,
      },
    });
    setCreating(false);
    if (res.error || !res.id) {
      toast.error(res.error ?? "Errore");
      return;
    }
    toast.success("Prezziario creato");
    setCreateOpen(false);
    setNewNome("");
    setNewRegione("");
    await refreshLists(res.id);
  };

  const handleDelete = async () => {
    if (!selected || !isOwn) return;
    if (!confirm(`Eliminare il prezziario "${selected.nome}" e tutte le sue voci?`)) return;
    const res = await deletePrezziario({ data: { id: selected.id } });
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Prezziario eliminato");
    setSelectedId("");
    refreshLists();
  };

  const handleImport = async (file: File) => {
    if (!selected || !isOwn) {
      toast.error("Selezione un prezziario personale per importare voci");
      return;
    }
    setImporting(true);
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (!parsed.length) {
        toast.error("Nessuna voce valida trovata nel file");
        return;
      }
      const replaceAll =
        voci.length > 0
          ? confirm(
              `Ci sono già voci in questo prezziario. Sostituire tutto con le ${parsed.length} voci del file? (Annulla = aggiungere in coda)`,
            )
          : false;
      const res = await importPriceItems({
        data: { priceListId: selected.id, items: parsed, replaceAll },
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`${res.inserted} voci importate`);
      // refresh voci
      const r = await searchPriceItems({
        data: { priceListId: selected.id, query: search.trim(), limit: 100 },
      });
      setVoci((r.items ?? []) as Voce[]);
    } catch {
      toast.error("Impossibile leggere il file");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <Link to="/app" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Indietro</span>
          </Link>
          <div className="flex items-center gap-2">
            <img src={valoraLogo} alt="Valora logo" className="h-6 w-6" />
            <span className="font-semibold">Prezziari</span>
          </div>
          <Button
            size="sm"
            onClick={() => setCreateOpen(true)}
            className="rounded-lg"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            <span className="hidden sm:inline">Nuovo prezziario</span>
            <span className="sm:hidden">Nuovo</span>
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
            <BookText className="w-6 h-6 text-primary" />
            Prezziari
          </h1>
          <p className="text-sm text-muted-foreground">
            Cerca tra le voci, importa prezziari regionali (CSV) o crea il tuo listino personale.
          </p>
        </div>

        {/* Selector + actions */}
        <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3 items-end">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Prezziario attivo
              </Label>
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger className="h-11 rounded-lg">
                  <SelectValue placeholder="Seleziona un prezziario" />
                </SelectTrigger>
                <SelectContent>
                  {lists.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      <span className="flex items-center gap-2">
                        {l.is_public ? (
                          <Globe2 className="w-3.5 h-3.5 text-muted-foreground" />
                        ) : (
                          <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                        <span>{l.nome}</span>
                        {l.anno && (
                          <span className="text-xs text-muted-foreground">· {l.anno}</span>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImport(f);
                }}
              />
              <Button
                variant="outline"
                className="h-11 rounded-lg w-full sm:w-auto"
                disabled={!isOwn || importing}
                onClick={() => fileInputRef.current?.click()}
                title={isOwn ? "Importa voci CSV" : "Solo prezziari personali"}
              >
                {importing ? (
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 mr-1.5" />
                )}
                Importa CSV
              </Button>
            </div>

            <Button
              variant="ghost"
              className="h-11 rounded-lg text-muted-foreground hover:text-destructive w-full sm:w-auto"
              disabled={!isOwn}
              onClick={handleDelete}
              title={isOwn ? "Elimina prezziario" : "Non puoi eliminare un prezziario pubblico"}
            >
              <Trash2 className="w-4 h-4 mr-1.5" />
              Elimina
            </Button>
          </div>

          {selected && (
            <div className="text-xs text-muted-foreground flex items-center gap-2 pt-1">
              {selected.is_public ? (
                <>
                  <Globe2 className="w-3 h-3" />
                  Prezziario pubblico {selected.regione ? `· ${selected.regione}` : ""}{" "}
                  {selected.anno ? `· ${selected.anno}` : ""} — sola lettura
                </>
              ) : (
                <>
                  <Lock className="w-3 h-3" />
                  Prezziario personale {selected.regione ? `· ${selected.regione}` : ""}{" "}
                  {selected.anno ? `· ${selected.anno}` : ""}
                </>
              )}
            </div>
          )}
        </div>

        {/* Search */}
        <div className="bg-card border border-border rounded-2xl p-4 sm:p-5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cerca per codice, descrizione, categoria..."
              className="h-12 pl-10 rounded-lg text-base"
            />
            {searching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            {voci.length} {voci.length === 1 ? "voce trovata" : "voci trovate"}
            {search && ` per "${search}"`}
          </div>
        </div>

        {/* Results */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2.5 w-28">Codice</th>
                  <th className="text-left px-4 py-2.5">Descrizione</th>
                  <th className="text-left px-4 py-2.5 w-20">UM</th>
                  <th className="text-right px-4 py-2.5 w-28">Prezzo</th>
                  <th className="text-right px-4 py-2.5 w-24 hidden sm:table-cell">% MO</th>
                </tr>
              </thead>
              <tbody>
                {voci.length === 0 && !searching && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                      {selected
                        ? search
                          ? "Nessuna voce corrisponde alla ricerca."
                          : isOwn
                            ? "Prezziario vuoto. Importa un CSV per popolarlo."
                            : "Prezziario vuoto."
                        : "Seleziona un prezziario per iniziare."}
                    </td>
                  </tr>
                )}
                {voci.map((v) => (
                  <tr key={v.id} className="border-t border-border/50 hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground tabular-nums">
                      {v.codice ?? "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <div>{v.descrizione}</div>
                      {v.categoria && (
                        <div className="text-[11px] text-muted-foreground mt-0.5">{v.categoria}</div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{v.unita_misura}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                      € {Number(v.prezzo).toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground hidden sm:table-cell">
                      {Number(v.incidenza_manodopera).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Formato CSV atteso: <code>codice, descrizione, categoria, unita, prezzo, incidenza_manodopera</code>{" "}
          (header sulla prima riga, separatore <code>,</code> o <code>;</code>).
        </p>
      </main>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuovo prezziario personale</DialogTitle>
            <DialogDescription>
              Crea un prezziario tuo, modificabile e importabile via CSV.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input
                value={newNome}
                onChange={(e) => setNewNome(e.target.value)}
                placeholder="es. Listino studio 2026"
                className="h-11 rounded-lg"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Regione (opzionale)</Label>
                <Input
                  value={newRegione}
                  onChange={(e) => setNewRegione(e.target.value)}
                  placeholder="es. Lombardia"
                  className="h-11 rounded-lg"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Anno (opzionale)</Label>
                <Input
                  type="number"
                  value={newAnno}
                  onChange={(e) => setNewAnno(e.target.value)}
                  className="h-11 rounded-lg tabular-nums"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} className="rounded-lg">
              Annulla
            </Button>
            <Button onClick={handleCreate} disabled={creating} className="rounded-lg">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Crea"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ----- CSV parser (header-aware, supports , and ;) -----
function parseCsv(text: string): Array<{
  codice: string | null;
  descrizione: string;
  unita_misura: string;
  prezzo: number;
  incidenza_manodopera: number;
  categoria: string | null;
  sottocategoria: string | null;
}> {
  const cleaned = text.replace(/\r\n/g, "\n").trim();
  if (!cleaned) return [];
  const firstLine = cleaned.split("\n")[0];
  const delim =
    (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";

  const rows: string[][] = [];
  let cur = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < cleaned.length; i++) {
    const c = cleaned[i];
    if (inQuotes) {
      if (c === '"' && cleaned[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') inQuotes = false;
      else cur += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === delim) {
        row.push(cur);
        cur = "";
      } else if (c === "\n") {
        row.push(cur);
        rows.push(row);
        row = [];
        cur = "";
      } else cur += c;
    }
  }
  if (cur || row.length) {
    row.push(cur);
    rows.push(row);
  }
  if (!rows.length) return [];

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = (names: string[]) =>
    header.findIndex((h) => names.some((n) => h.includes(n)));
  const iCode = idx(["codice", "code"]);
  const iDesc = idx(["descriz", "voce", "name"]);
  const iCat = idx(["categ"]);
  const iSub = idx(["sotto", "subcat"]);
  const iUnit = idx(["unita", "u.m", "um", "unit"]);
  const iPrice = idx(["prezzo", "price", "importo"]);
  const iInc = idx(["incidenza", "manodopera", "mo"]);

  const hasHeader = iDesc !== -1 && iPrice !== -1;
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const out: ReturnType<typeof parseCsv> = [];
  for (const r of dataRows) {
    const get = (i: number) => (i >= 0 && r[i] != null ? String(r[i]).trim() : "");
    const desc = hasHeader ? get(iDesc) : (r[1] ?? r[0] ?? "").trim();
    const priceRaw = hasHeader ? get(iPrice) : (r[4] ?? r[r.length - 1] ?? "").trim();
    if (!desc) continue;
    const num = (s: string) =>
      parseFloat(s.replace(/[^\d.,-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
    const price = num(priceRaw);
    if (isNaN(price)) continue;
    const inc = hasHeader && iInc >= 0 ? num(get(iInc)) : NaN;
    out.push({
      codice: (hasHeader ? get(iCode) : (r[0] ?? "").trim()) || null,
      descrizione: desc.slice(0, 500),
      unita_misura: (hasHeader ? get(iUnit) : (r[3] ?? "").trim()) || "cad",
      prezzo: price,
      incidenza_manodopera: Number.isFinite(inc) ? Math.max(0, Math.min(100, inc)) : 0,
      categoria: (hasHeader ? get(iCat) : (r[2] ?? "").trim()) || null,
      sottocategoria: (hasHeader ? get(iSub) : "") || null,
    });
  }
  return out;
}
