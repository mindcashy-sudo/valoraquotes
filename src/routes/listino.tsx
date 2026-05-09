import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Plus,
  Loader2,
  Search,
  Trash2,
  Upload,
  Pencil,
  BookText,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import {
  listPriceItems,
  upsertPriceItem,
  deletePriceItem,
  bulkImportPriceItems,
} from "@/server/price-list.functions";
import valoraLogo from "@/assets/valora-logo.png";

export const Route = createFileRoute("/listino")({
  head: () => ({
    meta: [
      { title: "Listino studio — VALORA" },
      {
        name: "description",
        content:
          "Il tuo listino prezzi personale. Valora lo userà come fonte primaria nei preventivi.",
      },
    ],
  }),
  component: PriceListPage,
});

interface PriceItem {
  id: string;
  code: string | null;
  name: string;
  category: string | null;
  unit: string;
  unit_price: number;
  notes: string | null;
}

const emptyDraft = {
  code: "",
  name: "",
  category: "",
  unit: "cad",
  unit_price: "",
  notes: "",
};

function PriceListPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<PriceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [user, authLoading, navigate]);

  const refresh = async () => {
    const res = await listPriceItems();
    setItems(((res.items ?? []) as PriceItem[]).map((i) => ({
      ...i,
      unit_price: Number(i.unit_price),
    })));
    setLoading(false);
  };

  useEffect(() => {
    if (user) refresh();
  }, [user]);

  const openNew = () => {
    setEditingId(null);
    setDraft(emptyDraft);
    setOpen(true);
  };

  const openEdit = (item: PriceItem) => {
    setEditingId(item.id);
    setDraft({
      code: item.code ?? "",
      name: item.name,
      category: item.category ?? "",
      unit: item.unit,
      unit_price: String(item.unit_price),
      notes: item.notes ?? "",
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!draft.name.trim()) {
      toast.error("Inserisci la descrizione della voce");
      return;
    }
    const price = parseFloat(draft.unit_price.replace(",", "."));
    if (isNaN(price) || price < 0) {
      toast.error("Prezzo non valido");
      return;
    }
    setSaving(true);
    const res = await upsertPriceItem({
      data: {
        id: editingId ?? undefined,
        item: {
          code: draft.code.trim() || null,
          name: draft.name.trim(),
          category: draft.category.trim() || null,
          unit: draft.unit.trim() || "cad",
          unit_price: price,
          notes: draft.notes.trim() || null,
        },
      },
    });
    setSaving(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(editingId ? "Voce aggiornata" : "Voce aggiunta al listino");
    setOpen(false);
    refresh();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Eliminare questa voce dal listino?")) return;
    const res = await deletePriceItem({ data: { id } });
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Voce eliminata");
    refresh();
  };

  const handleImport = async (file: File) => {
    setImporting(true);
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (!parsed.length) {
        toast.error("Nessuna voce trovata nel file");
        return;
      }
      const replaceAll = items.length > 0
        ? confirm(
            `Hai già ${items.length} voci nel listino. Sostituire tutto con le ${parsed.length} voci del file? (Annulla = aggiungere)`,
          )
        : false;
      const res = await bulkImportPriceItems({
        data: { items: parsed, replaceAll },
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`${res.inserted} voci importate`);
      refresh();
    } catch (e) {
      toast.error("Impossibile leggere il file");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const filtered = items.filter((i) => {
    const q = search.toLowerCase();
    return (
      i.name.toLowerCase().includes(q) ||
      (i.category ?? "").toLowerCase().includes(q) ||
      (i.code ?? "").toLowerCase().includes(q)
    );
  });

  const grouped = filtered.reduce<Record<string, PriceItem[]>>((acc, i) => {
    const k = i.category || "Senza categoria";
    (acc[k] ||= []).push(i);
    return acc;
  }, {});

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link
            to="/app"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
            App
          </Link>
          <img src={valoraLogo} alt="Valora" className="h-14 md:h-16 w-auto" />
          <div className="w-12" />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <BookText className="w-6 h-6 text-valora-green" />
              Listino studio
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Le tue voci e i tuoi prezzi. Valora le userà come fonte primaria
              quando genera un preventivo: i tuoi numeri, non quelli inventati
              dall'AI.
            </p>
          </div>
          <div className="flex gap-2">
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
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
            >
              {importing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Importa CSV
                </>
              )}
            </Button>
            <Button onClick={openNew}>
              <Plus className="w-4 h-4 mr-2" />
              Nuova voce
            </Button>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center">
            <BookText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <h2 className="font-semibold">Il tuo listino è vuoto</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Aggiungi le voci che usi più spesso oppure importa un CSV. Da quel
              momento Valora userà i tuoi prezzi nei preventivi.
            </p>
            <p className="text-xs text-muted-foreground mt-3">
              Formato CSV: <code>codice,descrizione,categoria,unita,prezzo,note</code>
            </p>
          </div>
        ) : (
          <>
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Cerca per descrizione, categoria, codice…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="space-y-6">
              {Object.entries(grouped).map(([cat, rows]) => (
                <div key={cat} className="rounded-2xl border border-border overflow-hidden">
                  <div className="px-5 py-3 bg-muted/40 border-b border-border flex items-center justify-between">
                    <h3 className="text-sm font-semibold tracking-tight">{cat}</h3>
                    <span className="text-xs text-muted-foreground">
                      {rows.length} {rows.length === 1 ? "voce" : "voci"}
                    </span>
                  </div>
                  <div className="divide-y divide-border">
                    {rows.map((i) => (
                      <div
                        key={i.id}
                        className="px-5 py-3 flex items-center gap-4 hover:bg-muted/20"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {i.code && (
                              <span className="text-xs font-mono text-muted-foreground">
                                {i.code}
                              </span>
                            )}
                            <span className="text-sm font-medium truncate">{i.name}</span>
                          </div>
                          {i.notes && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              {i.notes}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-semibold">
                            € {i.unit_price.toLocaleString("it-IT", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </div>
                          <div className="text-xs text-muted-foreground">/ {i.unit}</div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(i)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDelete(i.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Modifica voce" : "Nuova voce"}</DialogTitle>
            <DialogDescription>
              I prezzi sono imponibili (al netto IVA).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Codice</Label>
                <Input
                  placeholder="DEM.01"
                  value={draft.code}
                  onChange={(e) => setDraft({ ...draft, code: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Categoria</Label>
                <Input
                  placeholder="Opere edili"
                  value={draft.category}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Descrizione *</Label>
              <Input
                placeholder="Demolizione tramezzi e smaltimento macerie"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Unità</Label>
                <Input
                  placeholder="mq"
                  value={draft.unit}
                  onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Prezzo unitario (€) *</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="35.00"
                  value={draft.unit_price}
                  onChange={(e) => setDraft({ ...draft, unit_price: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Note</Label>
              <Textarea
                rows={2}
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Annulla
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salva"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Minimal CSV parser supporting comma/semicolon delimiter, quoted values, header row.
function parseCsv(text: string): Array<{
  code: string | null;
  name: string;
  category: string | null;
  unit: string;
  unit_price: number;
  notes: string | null;
}> {
  const cleaned = text.replace(/\r\n/g, "\n").trim();
  if (!cleaned) return [];
  const firstLine = cleaned.split("\n")[0];
  const delim = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0)
    ? ";" : ",";

  const rows: string[][] = [];
  let cur = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < cleaned.length; i++) {
    const c = cleaned[i];
    if (inQuotes) {
      if (c === '"' && cleaned[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else cur += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === delim) { row.push(cur); cur = ""; }
      else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
      else cur += c;
    }
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  if (!rows.length) return [];

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = (names: string[]) =>
    header.findIndex((h) => names.some((n) => h.includes(n)));
  const iCode = idx(["codice", "code"]);
  const iName = idx(["descriz", "name", "voce"]);
  const iCat = idx(["categ"]);
  const iUnit = idx(["unit", "u.m", "um"]);
  const iPrice = idx(["prezzo", "price", "importo"]);
  const iNotes = idx(["note", "notes"]);

  const hasHeader = iName !== -1 && iPrice !== -1;
  const dataRows = hasHeader ? rows.slice(1) : rows;

  const out = [];
  for (const r of dataRows) {
    const get = (i: number) => (i >= 0 && r[i] != null ? String(r[i]).trim() : "");
    const name = hasHeader ? get(iName) : (r[1] ?? r[0] ?? "").trim();
    const priceRaw = hasHeader ? get(iPrice) : (r[4] ?? r[r.length - 1] ?? "").trim();
    if (!name) continue;
    const price = parseFloat(
      priceRaw.replace(/[^\d.,-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."),
    );
    if (isNaN(price)) continue;
    out.push({
      code: (hasHeader ? get(iCode) : (r[0] ?? "").trim()) || null,
      name,
      category: (hasHeader ? get(iCat) : (r[2] ?? "").trim()) || null,
      unit: (hasHeader ? get(iUnit) : (r[3] ?? "").trim()) || "cad",
      unit_price: price,
      notes: (hasHeader ? get(iNotes) : "") || null,
    });
  }
  return out;
}
