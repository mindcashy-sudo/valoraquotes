import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

interface QuoteItem {
  name: string;
  price: number;
}
interface QuoteSection {
  name: string;
  items: QuoteItem[];
  subtotal: number;
}
interface QuoteContent {
  title: string;
  description: string;
  duration: string;
  finishLevel: string;
  sections: QuoteSection[];
  total: number;
  notes: string[];
}

interface StudioRow {
  studio_name: string | null;
  architect_name: string | null;
  vat_number: string | null;
  fiscal_code: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  province: string | null;
  phone: string | null;
  email: string | null;
  pec: string | null;
  iban: string | null;
  albo_number: string | null;
  logo_url: string | null;
  default_vat_percent: number | null;
  default_validity_days: number | null;
  default_terms: string | null;
}

// === Layout (A4 in points) ===
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MX = 48;
const MT = 46;
const MB = 64;
const CONTENT_W = PAGE_W - 2 * MX;

// Brand palette — editorial, restrained, premium
const INK = rgb(0.07, 0.09, 0.14);          // primary text / headings
const NAVY = rgb(0.06, 0.11, 0.2);          // hero bands
const ACCENT = rgb(0.16, 0.55, 0.32);       // green accent (sparingly)
const TEXT = rgb(0.18, 0.2, 0.24);          // body text
const MUTED = rgb(0.46, 0.49, 0.55);        // labels / meta
const HAIRLINE = rgb(0.84, 0.86, 0.9);      // dividers
const ZEBRA = rgb(0.975, 0.978, 0.985);     // alt rows
const PANEL = rgb(0.96, 0.965, 0.975);      // soft panels
const WHITE = rgb(1, 1, 1);

const fmtPrice = (n: number) =>
  n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d: Date) =>
  d.toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" });

// Helvetica (WinAnsi) supports €, so we keep it and only strip true unsupported glyphs.
function sanitize(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .replace(/\u00A0/g, " ")
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u2022/g, "-")
    // Keep printable ASCII + Latin-1 + €
    .replace(/[^\x09\x0A\x0D\x20-\x7E\u00A1-\u00FF\u20AC]/g, "");
}

const eur = (n: number) => `€ ${fmtPrice(n)}`;

function wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const safe = sanitize(text);
  if (!safe) return [];
  const out: string[] = [];
  for (const para of safe.split("\n")) {
    if (!para.trim()) {
      out.push("");
      continue;
    }
    const words = para.split(/\s+/);
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) > maxW && line) {
        out.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

interface Ctx {
  pdf: PDFDocument;
  page: PDFPage;
  y: number;
  font: PDFFont;
  bold: PDFFont;
  studio: StudioRow;
}

function dText(ctx: Ctx, text: string, x: number, y: number, size: number, font: PDFFont, color = TEXT) {
  ctx.page.drawText(sanitize(text), { x, y, size, font, color });
}
function dTextRight(ctx: Ctx, text: string, rightX: number, y: number, size: number, font: PDFFont, color = TEXT) {
  const safe = sanitize(text);
  const w = font.widthOfTextAtSize(safe, size);
  ctx.page.drawText(safe, { x: rightX - w, y, size, font, color });
}
function dRect(ctx: Ctx, x: number, y: number, width: number, height: number, color: ReturnType<typeof rgb>) {
  ctx.page.drawRectangle({ x, y, width, height, color });
}
function dLine(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, thickness: number, color: ReturnType<typeof rgb>) {
  ctx.page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, color });
}

function newPage(ctx: Ctx) {
  ctx.page = ctx.pdf.addPage([PAGE_W, PAGE_H]);
  ctx.y = PAGE_H - MT;
}
function ensure(ctx: Ctx, needed: number) {
  if (ctx.y - needed < MB) newPage(ctx);
}

function drawFooter(ctx: Ctx, pageNum: number, pageTotal: number) {
  const { font, studio } = ctx;
  const y = 36;
  dLine(ctx, MX, y + 16, PAGE_W - MX, y + 16, 0.4, HAIRLINE);
  const left = [
    studio.studio_name,
    studio.vat_number ? `P.IVA ${studio.vat_number}` : null,
  ]
    .filter(Boolean)
    .join("  •  ");
  const right = [studio.email, studio.phone].filter(Boolean).join("  •  ");
  dText(ctx, left, MX, y, 7.5, font, MUTED);
  const center = `Pagina ${pageNum} di ${pageTotal}`;
  const cw = font.widthOfTextAtSize(center, 7.5);
  dText(ctx, center, (PAGE_W - cw) / 2, y, 7.5, font, MUTED);
  dTextRight(ctx, right, PAGE_W - MX, y, 7.5, font, MUTED);
}

async function drawHeader(ctx: Ctx, logoBytes: Uint8Array | null, logoMime: string | null) {
  const { font, bold, studio } = ctx;
  const top = PAGE_H - MT;

  const GUTTER = 28;
  const LOGO_BOX_W = 140;
  const LOGO_BOX_H = 54;
  const rightColX = MX + LOGO_BOX_W + GUTTER;
  const rightColW = PAGE_W - MX - rightColX;

  let leftBottom = top;
  let logoDrawn = false;
  if (logoBytes && logoMime) {
    try {
      let img;
      if (logoMime.includes("png")) img = await ctx.pdf.embedPng(logoBytes);
      else if (logoMime.includes("jpeg") || logoMime.includes("jpg"))
        img = await ctx.pdf.embedJpg(logoBytes);
      if (img) {
        const ratio = img.width / img.height;
        let h = LOGO_BOX_H;
        let w = h * ratio;
        if (w > LOGO_BOX_W) {
          w = LOGO_BOX_W;
          h = w / ratio;
        }
        const yOffset = (LOGO_BOX_H - h) / 2;
        ctx.page.drawImage(img, {
          x: MX,
          y: top - LOGO_BOX_H + yOffset,
          width: w,
          height: h,
        });
        leftBottom = top - LOGO_BOX_H;
        logoDrawn = true;
      }
    } catch {
      // ignore
    }
  }
  if (!logoDrawn) {
    const nameLines = wrap(studio.studio_name ?? "Studio", bold, 17, LOGO_BOX_W + GUTTER);
    let ly = top - 14;
    for (const line of nameLines.slice(0, 2)) {
      dText(ctx, line, MX, ly, 17, bold, NAVY);
      ly -= 20;
    }
    if (studio.architect_name) {
      ly -= 1;
      dText(ctx, studio.architect_name, MX, ly, 9, font, MUTED);
      ly -= 12;
    }
    leftBottom = ly;
  }

  // RIGHT — studio details, right aligned
  let yR = top - 2;
  const lineH = (size: number) => size + 4;
  const fit = (text: string, size: number, f: PDFFont): string => {
    let s = sanitize(text);
    if (f.widthOfTextAtSize(s, size) <= rightColW) return s;
    while (s.length > 4 && f.widthOfTextAtSize(s + "...", size) > rightColW) {
      s = s.slice(0, -1);
    }
    return s + "...";
  };
  const drawR = (text: string, size: number, f: PDFFont, color = TEXT) => {
    if (!text) return;
    dTextRight(ctx, fit(text, size, f), PAGE_W - MX, yR, size, f, color);
    yR -= lineH(size);
  };
  if (logoDrawn && studio.studio_name) drawR(studio.studio_name, 11, bold, NAVY);
  if (studio.architect_name) drawR(studio.architect_name, 9, font, MUTED);
  if (studio.address) drawR(studio.address, 8.5, font, MUTED);
  const cityLine = [studio.postal_code, studio.city, studio.province ? `(${studio.province})` : null]
    .filter(Boolean)
    .join(" ");
  if (cityLine) drawR(cityLine, 8.5, font, MUTED);
  if (studio.phone) drawR(`T  ${studio.phone}`, 8.5, font, MUTED);
  if (studio.email) drawR(studio.email, 8.5, font, MUTED);
  if (studio.pec) drawR(`PEC  ${studio.pec}`, 8.5, font, MUTED);
  if (studio.vat_number) drawR(`P.IVA  ${studio.vat_number}`, 8.5, font, MUTED);
  if (studio.fiscal_code && studio.fiscal_code !== studio.vat_number) {
    drawR(`C.F.  ${studio.fiscal_code}`, 8.5, font, MUTED);
  }
  if (studio.albo_number) drawR(`Albo n. ${studio.albo_number}`, 8.5, font, MUTED);

  const lowest = Math.min(leftBottom, yR) - 14;
  ctx.y = lowest;
  dLine(ctx, MX, ctx.y, PAGE_W - MX, ctx.y, 0.6, INK);
  ctx.y -= 26;
}

// "Cover plate": document type chip + client + project meta in a clean grid
function drawCoverPlate(
  ctx: Ctx,
  opts: {
    clientName: string;
    quoteNumber: string;
    quoteDate: Date;
    validUntil: Date;
    projectAddress?: string;
    projectTitle: string;
  }
) {
  const { font, bold } = ctx;
  ensure(ctx, 130);

  // Document-type chip
  dText(ctx, "PREVENTIVO", MX, ctx.y, 8.5, bold, ACCENT);
  ctx.y -= 14;

  // Project title — hero typography
  const titleLines = wrap(opts.projectTitle, bold, 22, CONTENT_W);
  for (const line of titleLines.slice(0, 3)) {
    ensure(ctx, 28);
    dText(ctx, line, MX, ctx.y - 22, 22, bold, INK);
    ctx.y -= 26;
  }
  ctx.y -= 6;

  // 3-column meta strip
  ensure(ctx, 60);
  const colW = CONTENT_W / 3;
  const labelY = ctx.y;
  const valueY = labelY - 14;

  const col = (i: number, label: string, value: string) => {
    const x = MX + colW * i;
    dText(ctx, label, x, labelY, 7, bold, MUTED);
    const valLines = wrap(value, bold, 10, colW - 14);
    let vy = valueY;
    for (const line of valLines.slice(0, 2)) {
      dText(ctx, line, x, vy, 10, bold, INK);
      vy -= 13;
    }
  };
  col(0, "PREVENTIVO N.", opts.quoteNumber);
  col(1, "DATA EMISSIONE", fmtDate(opts.quoteDate));
  col(2, "VALIDITA' OFFERTA", fmtDate(opts.validUntil));
  ctx.y -= 44;

  // Client panel
  ensure(ctx, 70);
  const panelTop = ctx.y;
  const panelH = opts.projectAddress ? 64 : 48;
  dRect(ctx, MX, panelTop - panelH, CONTENT_W, panelH, PANEL);
  dRect(ctx, MX, panelTop - panelH, 3, panelH, ACCENT);
  dText(ctx, "INTESTATO A", MX + 16, panelTop - 14, 7, bold, MUTED);
  dText(ctx, opts.clientName, MX + 16, panelTop - 30, 13, bold, INK);
  if (opts.projectAddress) {
    dText(ctx, "CANTIERE", MX + CONTENT_W / 2 + 8, panelTop - 14, 7, bold, MUTED);
    const addr = wrap(opts.projectAddress, font, 10, CONTENT_W / 2 - 24);
    dText(ctx, addr[0] ?? "", MX + CONTENT_W / 2 + 8, panelTop - 30, 10, font, INK);
    if (addr[1]) dText(ctx, addr[1], MX + CONTENT_W / 2 + 8, panelTop - 44, 10, font, INK);
  }
  ctx.y = panelTop - panelH - 22;
}

// Executive summary: scope / duration / finish / investment
function drawExecutiveSummary(ctx: Ctx, q: QuoteContent, vatPercent: number) {
  const { font, bold } = ctx;
  ensure(ctx, 130);

  dText(ctx, "SINTESI DELL'OFFERTA", MX, ctx.y, 8, bold, MUTED);
  ctx.y -= 6;
  dLine(ctx, MX, ctx.y, MX + 60, ctx.y, 1, ACCENT);
  ctx.y -= 14;

  // Description (concise)
  if (q.description) {
    const descLines = wrap(q.description, font, 10.5, CONTENT_W);
    for (const line of descLines.slice(0, 3)) {
      ensure(ctx, 14);
      dText(ctx, line, MX, ctx.y, 10.5, font, TEXT);
      ctx.y -= 14;
    }
    ctx.y -= 8;
  }

  // 4-stat hero card with prominent total
  ensure(ctx, 84);
  const cardTop = ctx.y;
  const cardH = 78;
  dRect(ctx, MX, cardTop - cardH, CONTENT_W, cardH, NAVY);

  const totale = q.total * (1 + vatPercent / 100);

  // Left side: 3 small stats
  const statCol = CONTENT_W * 0.55 / 3;
  const drawStat = (i: number, label: string, value: string) => {
    const x = MX + 18 + statCol * i;
    dText(ctx, label, x, cardTop - 18, 7, bold, rgb(0.62, 0.7, 0.82));
    const valLines = wrap(value, bold, 11, statCol - 10);
    let vy = cardTop - 34;
    for (const line of valLines.slice(0, 2)) {
      dText(ctx, line, x, vy, 11, bold, WHITE);
      vy -= 13;
    }
  };
  drawStat(0, "AMBITO", q.sections.length === 1 ? "Intervento mirato" : "Intervento integrale");
  drawStat(1, "DURATA STIMATA", q.duration);
  drawStat(2, "LIVELLO FINITURE", q.finishLevel);

  // Right side: TOTAL — dominant
  const rightX = MX + CONTENT_W * 0.6;
  dLine(ctx, rightX, cardTop - 14, rightX, cardTop - cardH + 14, 0.5, rgb(0.25, 0.32, 0.45));
  dText(ctx, "INVESTIMENTO TOTALE", rightX + 14, cardTop - 18, 7, bold, rgb(0.62, 0.7, 0.82));
  dTextRight(ctx, eur(totale), MX + CONTENT_W - 18, cardTop - 50, 24, bold, WHITE);
  dTextRight(ctx, `IVA ${vatPercent}% inclusa`, MX + CONTENT_W - 18, cardTop - 64, 7.5, font, rgb(0.62, 0.7, 0.82));

  ctx.y = cardTop - cardH - 24;
}

// Section header + items table with header row
function drawSections(ctx: Ctx, q: QuoteContent) {
  const { font, bold } = ctx;

  // Section list title
  ensure(ctx, 30);
  dText(ctx, "DETTAGLIO LAVORAZIONI", MX, ctx.y, 8, bold, MUTED);
  ctx.y -= 6;
  dLine(ctx, MX, ctx.y, MX + 60, ctx.y, 1, ACCENT);
  ctx.y -= 18;

  // Table header
  ensure(ctx, 22);
  dText(ctx, "DESCRIZIONE", MX + 4, ctx.y, 7, bold, MUTED);
  dTextRight(ctx, "IMPORTO", PAGE_W - MX - 4, ctx.y, 7, bold, MUTED);
  ctx.y -= 6;
  dLine(ctx, MX, ctx.y, PAGE_W - MX, ctx.y, 0.4, HAIRLINE);
  ctx.y -= 12;

  q.sections.forEach((section, si) => {
    ensure(ctx, 50);

    // Section title (no heavy band — quiet but clear)
    const num = String(si + 1).padStart(2, "0");
    dText(ctx, num, MX + 4, ctx.y, 9, bold, ACCENT);
    dText(ctx, section.name.toUpperCase(), MX + 26, ctx.y, 9.5, bold, INK);
    ctx.y -= 14;
    dLine(ctx, MX + 26, ctx.y + 4, PAGE_W - MX, ctx.y + 4, 0.3, HAIRLINE);
    ctx.y -= 4;

    // Items — alternating zebra rows, single line where possible
    section.items.forEach((item, ii) => {
      const priceStr = eur(item.price);
      const priceW = bold.widthOfTextAtSize(priceStr, 10);
      const padX = 10;
      const nameMaxW = CONTENT_W - priceW - padX * 2 - 8;
      const nameLines = wrap(item.name, font, 10, nameMaxW);
      const rowH = Math.max(nameLines.length * 13, 13) + 10;
      ensure(ctx, rowH + 2);

      const rowTop = ctx.y + 4;
      if (ii % 2 === 0) {
        dRect(ctx, MX, rowTop - rowH, CONTENT_W, rowH, ZEBRA);
      }

      let ily = rowTop - 14;
      let first = true;
      for (const line of nameLines) {
        dText(ctx, line, MX + padX, ily, 10, font, TEXT);
        if (first) {
          dTextRight(ctx, priceStr, PAGE_W - MX - padX, ily, 10, bold, INK);
          first = false;
        }
        ily -= 13;
      }
      ctx.y = rowTop - rowH;
    });

    // Subtotal — strong rule + bold
    ensure(ctx, 32);
    ctx.y -= 4;
    dLine(ctx, MX, ctx.y + 6, PAGE_W - MX, ctx.y + 6, 0.6, INK);
    dText(ctx, `Subtotale ${section.name}`.toUpperCase(), MX + 4, ctx.y - 6, 8, bold, MUTED);
    dTextRight(ctx, eur(section.subtotal), PAGE_W - MX - 4, ctx.y - 7, 11, bold, INK);
    // Breathing room between sections (last section ends naturally before totals)
    ctx.y -= si === q.sections.length - 1 ? 28 : 36;
  });
}

// Hero totals — full width, generous, clearly the conclusion
function drawTotals(ctx: Ctx, q: QuoteContent, vatPercent: number) {
  const imponibile = q.total;
  const iva = imponibile * (vatPercent / 100);
  const totale = imponibile + iva;
  const { font, bold } = ctx;

  ensure(ctx, 130);
  ctx.y -= 4;

  // Imponibile + IVA on light strip
  const lightH = 56;
  const stripTop = ctx.y;
  dRect(ctx, MX, stripTop - lightH, CONTENT_W, lightH, PANEL);

  dText(ctx, "IMPONIBILE", MX + 18, stripTop - 18, 7.5, bold, MUTED);
  dTextRight(ctx, eur(imponibile), MX + CONTENT_W / 2 - 12, stripTop - 36, 13, bold, INK);

  dLine(ctx, MX + CONTENT_W / 2, stripTop - 12, MX + CONTENT_W / 2, stripTop - lightH + 12, 0.4, HAIRLINE);

  dText(ctx, `IVA ${vatPercent}%`, MX + CONTENT_W / 2 + 14, stripTop - 18, 7.5, bold, MUTED);
  dTextRight(ctx, eur(iva), MX + CONTENT_W - 18, stripTop - 36, 13, bold, INK);

  ctx.y = stripTop - lightH;

  // Big total bar
  const totalH = 60;
  const totalTop = ctx.y;
  dRect(ctx, MX, totalTop - totalH, CONTENT_W, totalH, INK);
  dText(ctx, "TOTALE OFFERTA", MX + 18, totalTop - 22, 9, bold, rgb(0.65, 0.72, 0.85));
  dText(ctx, "IVA inclusa", MX + 18, totalTop - 38, 7.5, font, rgb(0.55, 0.62, 0.75));
  dTextRight(ctx, eur(totale), PAGE_W - MX - 18, totalTop - 38, 26, bold, WHITE);

  ctx.y = totalTop - totalH - 24;
}

function drawNotesAndTerms(ctx: Ctx, q: QuoteContent, terms: string | null) {
  const { font, bold } = ctx;

  // Default notes if AI didn't provide good ones
  const defaultNotes = [
    "Prezzi espressi in Euro, IVA esclusa salvo dove diversamente indicato.",
    "Eventuali varianti in corso d'opera saranno contabilizzate previa accettazione scritta.",
    "Tempi di esecuzione indicativi, soggetti a verifica in fase esecutiva.",
    "L'offerta non comprende lavorazioni non espressamente menzionate.",
  ];
  const notes = q.notes && q.notes.length >= 3 ? q.notes : defaultNotes;

  if (notes.length > 0) {
    ensure(ctx, 30);
    dText(ctx, "NOTE E CONDIZIONI", MX, ctx.y, 8, bold, MUTED);
    ctx.y -= 6;
    dLine(ctx, MX, ctx.y, MX + 60, ctx.y, 1, ACCENT);
    ctx.y -= 16;

    notes.forEach((note, i) => {
      const num = String(i + 1).padStart(2, "0");
      const indent = 26;
      const lines = wrap(note, font, 9, CONTENT_W - indent);
      ensure(ctx, lines.length * 12 + 6);
      dText(ctx, num, MX, ctx.y, 8, bold, ACCENT);
      let ly = ctx.y;
      for (const line of lines) {
        dText(ctx, line, MX + indent, ly, 9, font, TEXT);
        ly -= 12;
      }
      ctx.y = ly - 4;
    });
    ctx.y -= 10;
  }

  if (terms && terms.trim()) {
    ensure(ctx, 30);
    dText(ctx, "CONDIZIONI CONTRATTUALI", MX, ctx.y, 8, bold, MUTED);
    ctx.y -= 6;
    dLine(ctx, MX, ctx.y, MX + 60, ctx.y, 1, ACCENT);
    ctx.y -= 14;
    const lines = wrap(terms, font, 8.5, CONTENT_W);
    for (const line of lines) {
      ensure(ctx, 12);
      dText(ctx, line, MX, ctx.y, 8.5, font, TEXT);
      ctx.y -= 12;
    }
    ctx.y -= 10;
  }
}

function drawAcceptance(ctx: Ctx, studio: StudioRow) {
  const { font, bold } = ctx;
  ensure(ctx, 130);
  ctx.y -= 6;

  dText(ctx, "ACCETTAZIONE", MX, ctx.y, 8, bold, MUTED);
  ctx.y -= 6;
  dLine(ctx, MX, ctx.y, MX + 60, ctx.y, 1, ACCENT);
  ctx.y -= 18;

  // Acceptance statement
  const stmt =
    "Per accettazione integrale dei termini economici e tecnici riportati nel presente preventivo, il Cliente sottoscrive di seguito.";
  const lines = wrap(stmt, font, 9, CONTENT_W);
  for (const line of lines) {
    dText(ctx, line, MX, ctx.y, 9, font, TEXT);
    ctx.y -= 12;
  }
  ctx.y -= 18;

  // Two signature columns
  const colW = (CONTENT_W - 40) / 2;
  const sigTop = ctx.y;

  // Place & date row above signatures
  dText(ctx, "LUOGO E DATA", MX, sigTop, 7, bold, MUTED);
  dLine(ctx, MX + 70, sigTop + 2, MX + colW, sigTop + 2, 0.5, INK);

  ctx.y -= 36;
  const lineY = ctx.y;

  // Client signature
  dLine(ctx, MX, lineY, MX + colW, lineY, 0.6, INK);
  dText(ctx, "FIRMA DEL CLIENTE", MX, lineY - 12, 7, bold, MUTED);

  // Studio signature
  const sx = MX + colW + 40;
  dLine(ctx, sx, lineY, sx + colW, lineY, 0.6, INK);
  dText(ctx, "PER LO STUDIO", sx, lineY - 12, 7, bold, MUTED);
  if (studio.architect_name) {
    dText(ctx, studio.architect_name, sx, lineY - 24, 9, bold, INK);
  }
  ctx.y -= 50;
}

const inputSchema = z.object({
  quote: z.object({
    title: z.string(),
    description: z.string(),
    duration: z.string(),
    finishLevel: z.string(),
    sections: z.array(
      z.object({
        name: z.string(),
        items: z.array(z.object({ name: z.string(), price: z.number() })),
        subtotal: z.number(),
      })
    ),
    total: z.number(),
    notes: z.array(z.string()),
  }),
  clientName: z.string().trim().max(200).optional(),
  projectAddress: z.string().trim().max(300).optional(),
  quoteNumber: z.string().trim().max(50).optional(),
});

export const generateQuotePdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: studioData } = await supabase
      .from("studio_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    const studio: StudioRow = (studioData ?? {}) as StudioRow;

    let logoBytes: Uint8Array | null = null;
    let logoMime: string | null = null;
    if (studio.logo_url) {
      try {
        const { data: file } = await supabase.storage
          .from("studio-assets")
          .download(studio.logo_url);
        if (file) {
          logoBytes = new Uint8Array(await file.arrayBuffer());
          logoMime =
            file.type ||
            (studio.logo_url.endsWith(".png") ? "image/png" : "image/jpeg");
        }
      } catch {
        // skip
      }
    }

    const pdf = await PDFDocument.create();
    pdf.setTitle(sanitize(data.quote.title) || "Preventivo");
    pdf.setProducer("Valora");
    pdf.setCreator("Valora");

    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const page = pdf.addPage([PAGE_W, PAGE_H]);
    const ctx: Ctx = { pdf, page, y: PAGE_H - MT, font, bold, studio };

    await drawHeader(ctx, logoBytes, logoMime);

    const now = new Date();
    const validityDays = studio.default_validity_days ?? 30;
    const validUntil = new Date(now.getTime() + validityDays * 24 * 60 * 60 * 1000);
    const quoteNumber =
      data.quoteNumber ??
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}${String(
        now.getDate()
      ).padStart(2, "0")}-${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`;

    const vatPercent = studio.default_vat_percent ?? 22;

    drawCoverPlate(ctx, {
      clientName: data.clientName?.trim() || "Cliente",
      quoteNumber,
      quoteDate: now,
      validUntil,
      projectAddress: data.projectAddress,
      projectTitle: data.quote.title,
    });

    drawExecutiveSummary(ctx, data.quote, vatPercent);
    drawSections(ctx, data.quote);
    drawTotals(ctx, data.quote, vatPercent);
    drawNotesAndTerms(ctx, data.quote, studio.default_terms ?? null);
    drawAcceptance(ctx, studio);

    const total = pdf.getPageCount();
    for (let i = 0; i < total; i++) {
      ctx.page = pdf.getPage(i);
      drawFooter(ctx, i + 1, total);
    }

    const pdfBytes = await pdf.save();
    let binary = "";
    const chunk = 8192;
    for (let i = 0; i < pdfBytes.length; i += chunk) {
      binary += String.fromCharCode(...pdfBytes.subarray(i, i + chunk));
    }
    const base64 = btoa(binary);
    return { pdf: base64, filename: `Preventivo-${quoteNumber}.pdf` };
  });
