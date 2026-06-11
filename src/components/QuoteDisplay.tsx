import { Copy, Download, Check, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { generateQuotePdf } from "@/lib/server-fns/pdf.functions";
import { reserveQuoteNumber } from "@/lib/server-fns/quotes.functions";

export interface QuoteItem {
  name: string;
  price: number;
}

export interface QuoteSection {
  name: string;
  items: QuoteItem[];
  subtotal: number;
}

export interface QuoteData {
  title: string;
  description: string;
  duration: string;
  finishLevel: string;
  sections: QuoteSection[];
  total: number;
  notes: string[];
}

interface QuoteDisplayProps {
  quote: QuoteData;
  defaultClientName?: string;
  defaultProjectAddress?: string;
}

function formatPrice(price: number): string {
  return price.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getSectionNumber(index: number): string {
  return String(index + 1).padStart(2, "0");
}

export function QuoteDisplay({ quote, defaultClientName, defaultProjectAddress }: QuoteDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [clientName, setClientName] = useState(defaultClientName ?? "");
  const [projectAddress, setProjectAddress] = useState(defaultProjectAddress ?? "");

  const quoteText = [
    quote.title.toUpperCase(),
    "",
    quote.description,
    "",
    `Durata stimata: ${quote.duration}`,
    `Livello finiture: ${quote.finishLevel}`,
    "",
    "═".repeat(50),
    "",
    ...quote.sections.flatMap((s, i) => [
      `${getSectionNumber(i)}. ${s.name.toUpperCase()}`,
      ...s.items.map((item) => `    ${item.name}  €${formatPrice(item.price)}`),
      `    ─── Subtotale: €${formatPrice(s.subtotal)}`,
      "",
    ]),
    "═".repeat(50),
    `TOTALE PREVENTIVO: €${formatPrice(quote.total)}`,
    "═".repeat(50),
    "",
    "NOTE:",
    ...quote.notes.map((n, i) => `${i + 1}. ${n}`),
  ].join("\n");

  const handleCopy = async () => {
    await navigator.clipboard.writeText(quoteText);
    setCopied(true);
    toast.success("Preventivo copiato");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPdf = async () => {
    setPdfLoading(true);
    try {
      // Reserve a real progressive number from the server (per user/year)
      let quoteNumber: string | undefined;
      try {
        const reserve = await reserveQuoteNumber();
        quoteNumber = reserve.quoteNumber;
      } catch {
        // Non-blocking — server will fall back to a generated number
      }

      const res = await generateQuotePdf({
        data: {
          quote,
          clientName: clientName.trim() || undefined,
          projectAddress: projectAddress.trim() || undefined,
          quoteNumber,
        },
      });
      const binary = atob(res.pdf);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setPdfOpen(false);
      toast.success("PDF scaricato");
    } catch (e) {
      console.error(e);
      toast.error("Errore generazione PDF");
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div id="quote-printable" className="bg-card border border-border rounded-2xl overflow-hidden">
        {/* Document header band */}
        <div className="bg-valora-navy px-8 py-6 md:px-10 md:py-8">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center gap-2.5 mb-3">
                <FileText className="w-4 h-4 text-valora-green opacity-80" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary-foreground/50">
                  Preventivo
                </span>
              </div>
              <h2 className="text-lg md:text-xl font-bold tracking-tight text-primary-foreground leading-snug">
                {quote.title}
              </h2>
              <p className="text-sm text-primary-foreground/60 leading-relaxed mt-1">
                {quote.description}
              </p>
            </div>
          </div>
        </div>

        <div className="px-8 py-8 md:px-10 md:py-10 space-y-8">
          {/* Meta info */}
          <div className="grid grid-cols-2 gap-6 pb-6 border-b border-border/50">
            <div className="space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/70">
                Durata stimata
              </span>
              <p className="text-sm font-medium text-card-foreground">{quote.duration}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/70">
                Livello finiture
              </span>
              <p className="text-sm font-medium text-card-foreground">{quote.finishLevel}</p>
            </div>
          </div>

          {/* Sections */}
          <div className="space-y-8">
            {quote.sections.map((section, si) => (
              <div key={si} className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-valora-green tabular-nums">
                    {getSectionNumber(si)}
                  </span>
                  <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-card-foreground">
                    {section.name}
                  </h3>
                  <div className="flex-1 border-b border-border/40" />
                </div>

                <div className="ml-7">
                  {section.items.map((item, ii) => (
                    <div
                      key={ii}
                      className="flex justify-between items-start py-2.5 border-b border-border/20 last:border-0 gap-6"
                    >
                      <span className="text-[13px] text-card-foreground/85 leading-snug flex-1">
                        {item.name}
                      </span>
                      <span className="text-[13px] font-medium text-card-foreground tabular-nums whitespace-nowrap">
                        € {formatPrice(item.price)}
                      </span>
                    </div>
                  ))}

                  <div className="flex justify-between items-center pt-3 mt-1">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/60">
                      Subtotale sezione
                    </span>
                    <span className="text-sm font-semibold text-card-foreground tabular-nums">
                      € {formatPrice(section.subtotal)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="border-t-2 border-valora-green/40 pt-5">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-lg font-bold text-card-foreground tracking-tight">
                  Totale Preventivo
                </span>
                <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mt-0.5">
                  Imponibile · IVA calcolata in PDF
                </p>
              </div>
              <span className="text-2xl font-bold text-valora-green tabular-nums">
                € {formatPrice(quote.total)}
              </span>
            </div>
          </div>

          {/* Notes */}
          {quote.notes && quote.notes.length > 0 && (
            <div className="bg-muted/40 rounded-xl p-6 space-y-3 mt-2">
              <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70">
                Note e condizioni
              </h4>
              <ol className="space-y-2 list-decimal list-inside">
                {quote.notes.map((note, i) => (
                  <li key={i} className="text-xs text-muted-foreground leading-relaxed">
                    {note}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-3 print:hidden">
        <Button variant="outline" onClick={handleCopy} className="flex-1 h-11 rounded-xl">
          {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
          {copied ? "Copiato" : "Copia testo"}
        </Button>
        <Button onClick={() => setPdfOpen(true)} className="flex-1 h-11 rounded-xl">
          <Download className="w-4 h-4 mr-2" />
          Scarica PDF
        </Button>
      </div>

      <Dialog open={pdfOpen} onOpenChange={setPdfOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Scarica preventivo PDF</DialogTitle>
            <DialogDescription>
              Inserisci i dati del cliente per il PDF brandizzato. Lasciali vuoti per un PDF generico.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Nome cliente
              </label>
              <Input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Mario Rossi"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Indirizzo cantiere (opzionale)
              </label>
              <Input
                value={projectAddress}
                onChange={(e) => setProjectAddress(e.target.value)}
                placeholder="Via Roma 12, Milano"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPdfOpen(false)}>
              Annulla
            </Button>
            <Button onClick={handleDownloadPdf} disabled={pdfLoading}>
              {pdfLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Genera PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
