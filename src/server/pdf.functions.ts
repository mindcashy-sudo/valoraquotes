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

// === Layout (A4 in points) — generous editorial margins ===
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MX = 56;
const MT = 52;
const MB = 70;
const CONTENT_W = PAGE_W - 2 * MX;

// Editorial palette — restrained, premium, monochromatic + single accent
const INK = rgb(0.06, 0.07, 0.1);           // primary ink (almost-black)
const TEXT = rgb(0.22, 0.24, 0.28);         // body
const MUTED = rgb(0.5, 0.53, 0.58);         // labels / meta
const FAINT = rgb(0.74, 0.77, 0.82);        // subtle dividers
const HAIRLINE = rgb(0.88, 0.9, 0.93);      // table rules
const PANEL = rgb(0.965, 0.97, 0.978);      // soft panel
const ACCENT = rgb(0.13, 0.43, 0.28);       // single accent — used sparingly
const WHITE = rgb(1, 1, 1);

const fmtPrice = (n: number) =>
  n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d: Date) =>
  d.toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" });

function sanitize(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .replace(/\u00A0/g, " ")
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u2022/g, "-")
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

// ── Eyebrow label (uppercase, tracked) used to introduce every block
function drawEyebrow(ctx: Ctx, label: string) {
  dText(ctx, label, MX, ctx.y, 7.5, ctx.bold, MUTED);
  ctx.y -= 8;
  dLine(ctx, MX, ctx.y, MX + 24, ctx.y, 1.2, INK);
  ctx.y -= 18;
}

function drawFooter(ctx: Ctx, pageNum: number, pageTotal: number) {
  const { font, studio } = ctx;
  const y = 38;
  dLine(ctx, MX, y + 18, PAGE_W - MX, y + 18, 0.4, HAIRLINE);
  const left = [
    studio.studio_name,
    studio.vat_number ? `P.IVA ${studio.vat_number}` : null,
  ]
    .filter(Boolean)
    .join("   ·   ");
  const right = [studio.email, studio.phone].filter(Boolean).join("   ·   ");
  dText(ctx, left, MX, y, 7.5, font, MUTED);
  const center = `${pageNum} / ${pageTotal}`;
  const cw = font.widthOfTextAtSize(center, 7.5);
  dText(ctx, center, (PAGE_W - cw) / 2, y, 7.5, font, MUTED);
  dTextRight(ctx, right, PAGE_W - MX, y, 7.5, font, MUTED);
}

// ── Header: logo (or wordmark) left, studio meta right, hairline divider
async function drawHeader(ctx: Ctx, logoBytes: Uint8Array | null, logoMime: string | null) {
  const { font, bold, studio } = ctx;
  const top = PAGE_H - MT;

  const LOGO_BOX_W = 130;
  const LOGO_BOX_H = 48;
  const GUTTER = 32;
  const rightColX = MX + LOGO_BOX_W + GUTTER;
  const rightColW = PAGE_W - MX - rightColX;

  let leftBottom = top - LOGO_BOX_H;
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
        logoDrawn = true;
      }
    } catch {
      /* ignore */
    }
  }
  if (!logoDrawn) {
    const name = studio.studio_name ?? "Studio";
    const lines = wrap(name, bold, 18, LOGO_BOX_W + GUTTER);
    let ly = top - 16;
    for (const line of lines.slice(0, 2)) {
      dText(ctx, line, MX, ly, 18, bold, INK);
      ly -= 21;
    }
    leftBottom = ly;
  }

  // Right column — quiet, right-aligned meta
  let yR = top - 4;
  const lineH = (size: number) => size + 4;
  const fit = (text: string, size: number, f: PDFFont): string => {
    let s = sanitize(text);
    if (f.widthOfTextAtSize(s, size) <= rightColW) return s;
    while (s.length > 4 && f.widthOfTextAtSize(s + "...", size) > rightColW) {
      s = s.slice(0, -1);
    }
    return s + "...";
  };
  const drawR = (text: string, size: number, f: PDFFont, color = MUTED) => {
    if (!text) return;
    dTextRight(ctx, fit(text, size, f), PAGE_W - MX, yR, size, f, color);
    yR -= lineH(size);
  };

  if (logoDrawn && studio.studio_name) drawR(studio.studio_name, 10.5, bold, INK);
  if (studio.architect_name) drawR(studio.architect_name, 8.5, font, MUTED);
  if (studio.address) drawR(studio.address, 8, font, MUTED);
  const cityLine = [studio.postal_code, studio.city, studio.province ? `(${studio.province})` : null]
    .filter(Boolean)
    .join(" ");
  if (cityLine) drawR(cityLine, 8, font, MUTED);
  // Compact contact stack
  const contact = [studio.phone, studio.email].filter(Boolean).join("   ·   ");
  if (contact) drawR(contact, 8, font, MUTED);
  if (studio.pec) drawR(`PEC  ${studio.pec}`, 8, font, MUTED);
  const fiscal = [
    studio.vat_number ? `P.IVA ${studio.vat_number}` : null,
    studio.fiscal_code && studio.fiscal_code !== studio.vat_number
      ? `C.F. ${studio.fiscal_code}`
      : null,
  ]
    .filter(Boolean)
    .join("   ·   ");
  if (fiscal) drawR(fiscal, 8, font, MUTED);
  if (studio.albo_number) drawR(`Albo n. ${studio.albo_number}`, 8, font, MUTED);

  const lowest = Math.min(leftBottom, yR) - 18;
  ctx.y = lowest;
  dLine(ctx, MX, ctx.y, PAGE_W - MX, ctx.y, 0.5, INK);
  ctx.y -= 36;
}

// ── Cover plate: doc type / title / meta grid / client block
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
  ensure(ctx, 200);

  // Document type — small, set in INK, no accent
  dText(ctx, "PREVENTIVO", MX, ctx.y, 8, bold, MUTED);
  ctx.y -= 22;

  // Hero title — large, tight tracking
  const titleLines = wrap(opts.projectTitle, bold, 26, CONTENT_W);
  for (const line of titleLines.slice(0, 3)) {
    ensure(ctx, 32);
    dText(ctx, line, MX, ctx.y - 22, 26, bold, INK);
    ctx.y -= 30;
  }
  ctx.y -= 14;

  // 3-col meta strip (no boxes — pure typography on hairline)
  ensure(ctx, 70);
  dLine(ctx, MX, ctx.y, PAGE_W - MX, ctx.y, 0.4, HAIRLINE);
  ctx.y -= 16;
  const colW = CONTENT_W / 3;
  const labelY = ctx.y;
  const valueY = labelY - 14;

  const col = (i: number, label: string, value: string) => {
    const x = MX + colW * i;
    dText(ctx, label, x, labelY, 7, bold, MUTED);
    const valLines = wrap(value, bold, 11, colW - 14);
    let vy = valueY;
    for (const line of valLines.slice(0, 2)) {
      dText(ctx, line, x, vy, 11, bold, INK);
      vy -= 13;
    }
  };
  col(0, "PREVENTIVO N.", opts.quoteNumber);
  col(1, "DATA EMISSIONE", fmtDate(opts.quoteDate));
  col(2, "VALIDO FINO AL", fmtDate(opts.validUntil));
  ctx.y -= 36;
  dLine(ctx, MX, ctx.y, PAGE_W - MX, ctx.y, 0.4, HAIRLINE);
  ctx.y -= 26;

  // Client / cantiere — typographic, no panel boxes
  ensure(ctx, 80);
  const halfW = (CONTENT_W - 32) / 2;

  dText(ctx, "INTESTATO A", MX, ctx.y, 7, bold, MUTED);
  if (opts.projectAddress) {
    dText(ctx, "CANTIERE", MX + halfW + 32, ctx.y, 7, bold, MUTED);
  }
  ctx.y -= 16;

  const clientLines = wrap(opts.clientName, bold, 14, halfW);
  let cy = ctx.y;
  for (const line of clientLines.slice(0, 2)) {
    dText(ctx, line, MX, cy, 14, bold, INK);
    cy -= 17;
  }

  if (opts.projectAddress) {
    const addrLines = wrap(opts.projectAddress, font, 11, halfW);
    let ay = ctx.y;
    for (const line of addrLines.slice(0, 3)) {
      dText(ctx, line, MX + halfW + 32, ay, 11, font, INK);
      ay -= 14;
    }
  }

  ctx.y = cy - 26;
}

// ── Executive summary: prose + a 4-row spec list, no dark box clutter
function drawExecutiveSummary(ctx: Ctx, q: QuoteContent, vatPercent: number) {
  const { font, bold } = ctx;
  ensure(ctx, 160);

  drawEyebrow(ctx, "SINTESI DELL'OFFERTA");

  // Description — calm prose, generous leading
  if (q.description) {
    const descLines = wrap(q.description, font, 10.5, CONTENT_W);
    for (const line of descLines.slice(0, 4)) {
      ensure(ctx, 16);
      dText(ctx, line, MX, ctx.y, 10.5, font, TEXT);
      ctx.y -= 16;
    }
    ctx.y -= 14;
  }

  // Two-column spec list (Ambito | Durata, Finiture | Sezioni)
  const halfW = (CONTENT_W - 32) / 2;
  const specs: Array<[string, string]> = [
    ["AMBITO", q.sections.length === 1 ? "Intervento mirato" : "Intervento integrale"],
    ["DURATA STIMATA", q.duration],
    ["LIVELLO FINITURE", q.finishLevel],
    ["SEZIONI DI LAVORO", String(q.sections.length).padStart(2, "0")],
  ];

  ensure(ctx, 64);
  for (let i = 0; i < specs.length; i += 2) {
    const rowTop = ctx.y;
    const [lLabel, lVal] = specs[i];
    dText(ctx, lLabel, MX, rowTop, 7, bold, MUTED);
    dText(ctx, lVal, MX, rowTop - 14, 11, bold, INK);

    if (specs[i + 1]) {
      const [rLabel, rVal] = specs[i + 1];
      const rx = MX + halfW + 32;
      dText(ctx, rLabel, rx, rowTop, 7, bold, MUTED);
      dText(ctx, rVal, rx, rowTop - 14, 11, bold, INK);
    }
    ctx.y -= 36;
    dLine(ctx, MX, ctx.y + 6, PAGE_W - MX, ctx.y + 6, 0.4, HAIRLINE);
  }
  ctx.y -= 14;
}

// ── Sections: minimal, editorial — no zebra, big breathing room
function drawSections(ctx: Ctx, q: QuoteContent) {
  const { font, bold } = ctx;

  ensure(ctx, 50);
  drawEyebrow(ctx, "DETTAGLIO LAVORAZIONI");

  // Table column header
  ensure(ctx, 24);
  dText(ctx, "DESCRIZIONE", MX, ctx.y, 7, bold, MUTED);
  dTextRight(ctx, "IMPORTO", PAGE_W - MX, ctx.y, 7, bold, MUTED);
  ctx.y -= 8;
  dLine(ctx, MX, ctx.y, PAGE_W - MX, ctx.y, 0.6, INK);
  ctx.y -= 18;

  q.sections.forEach((section, si) => {
    ensure(ctx, 60);

    // Section title — number + name on one baseline, calm typography
    const num = String(si + 1).padStart(2, "0");
    dText(ctx, num, MX, ctx.y, 9, bold, MUTED);
    dText(ctx, section.name.toUpperCase(), MX + 28, ctx.y, 10.5, bold, INK);
    ctx.y -= 16;

    // Items — clean rows, hairline between, generous padding
    section.items.forEach((item, ii) => {
      const priceStr = eur(item.price);
      const priceW = bold.widthOfTextAtSize(priceStr, 10.5);
      const nameMaxW = CONTENT_W - priceW - 24;
      const nameLines = wrap(item.name, font, 10.5, nameMaxW);
      const rowH = Math.max(nameLines.length * 14, 14) + 14;
      ensure(ctx, rowH + 4);

      const rowTop = ctx.y;
      let ily = rowTop - 4;
      let first = true;
      for (const line of nameLines) {
        dText(ctx, line, MX, ily, 10.5, font, TEXT);
        if (first) {
          dTextRight(ctx, priceStr, PAGE_W - MX, ily, 10.5, bold, INK);
          first = false;
        }
        ily -= 14;
      }
      ctx.y = rowTop - rowH;
      if (ii < section.items.length - 1) {
        dLine(ctx, MX, ctx.y + 6, PAGE_W - MX, ctx.y + 6, 0.3, HAIRLINE);
      }
    });

    // Subtotal — strong horizontal rule then bold value with breathing room
    ensure(ctx, 40);
    dLine(ctx, MX, ctx.y + 4, PAGE_W - MX, ctx.y + 4, 0.8, INK);
    ctx.y -= 18;
    dText(ctx, `Subtotale  ${section.name}`.toUpperCase(), MX, ctx.y, 8, bold, MUTED);
    dTextRight(ctx, eur(section.subtotal), PAGE_W - MX, ctx.y - 1, 12, bold, INK);
    ctx.y -= si === q.sections.length - 1 ? 32 : 38;
  });
}

// ── Totals: the climax — Imponibile + IVA on light, then dominant dark TOTALE
function drawTotals(ctx: Ctx, q: QuoteContent, vatPercent: number) {
  const imponibile = q.total;
  const iva = imponibile * (vatPercent / 100);
  const totale = imponibile + iva;
  const { font, bold } = ctx;

  ensure(ctx, 160);
  ctx.y -= 4;

  // Subtotal lines — pure typography, right aligned, no panel
  const lineRow = (label: string, value: string, valueSize = 12) => {
    ensure(ctx, 22);
    dText(ctx, label.toUpperCase(), MX, ctx.y, 8, bold, MUTED);
    dTextRight(ctx, value, PAGE_W - MX, ctx.y - 1, valueSize, bold, INK);
    ctx.y -= 14;
    dLine(ctx, MX, ctx.y, PAGE_W - MX, ctx.y, 0.4, HAIRLINE);
    ctx.y -= 14;
  };
  lineRow("Imponibile", eur(imponibile));
  lineRow(`IVA  ${vatPercent}%`, eur(iva));

  // Hero TOTAL bar — full width, dominant
  ensure(ctx, 88);
  ctx.y -= 8;
  const totalH = 78;
  const totalTop = ctx.y;
  dRect(ctx, MX, totalTop - totalH, CONTENT_W, totalH, INK);
  dText(ctx, "TOTALE OFFERTA", MX + 22, totalTop - 26, 9, bold, rgb(0.6, 0.68, 0.82));
  dText(ctx, "IVA inclusa", MX + 22, totalTop - 44, 8, font, rgb(0.55, 0.62, 0.75));
  dTextRight(ctx, eur(totale), PAGE_W - MX - 22, totalTop - 48, 30, bold, WHITE);

  ctx.y = totalTop - totalH - 30;
}

function drawNotesAndTerms(ctx: Ctx, q: QuoteContent, terms: string | null) {
  const { font, bold } = ctx;

  const defaultNotes = [
    "Prezzi espressi in Euro, IVA esclusa salvo dove diversamente indicato.",
    "Eventuali varianti in corso d'opera saranno contabilizzate previa accettazione scritta.",
    "Tempi di esecuzione indicativi, soggetti a verifica in fase esecutiva.",
    "L'offerta non comprende lavorazioni non espressamente menzionate.",
  ];
  const notes = q.notes && q.notes.length >= 3 ? q.notes : defaultNotes;

  if (notes.length > 0) {
    ensure(ctx, 50);
    drawEyebrow(ctx, "NOTE E CONDIZIONI");

    notes.forEach((note) => {
      const indent = 16;
      const lines = wrap(note, font, 9.5, CONTENT_W - indent);
      ensure(ctx, lines.length * 13 + 8);
      // Subtle bullet — small square in INK, never colored
      dRect(ctx, MX + 2, ctx.y - 4, 3, 3, INK);
      let ly = ctx.y;
      for (const line of lines) {
        dText(ctx, line, MX + indent, ly, 9.5, font, TEXT);
        ly -= 13;
      }
      ctx.y = ly - 6;
    });
    ctx.y -= 6;
  }

  if (terms && terms.trim()) {
    ensure(ctx, 50);
    drawEyebrow(ctx, "CONDIZIONI CONTRATTUALI");
    const lines = wrap(terms, font, 9, CONTENT_W);
    for (const line of lines) {
      ensure(ctx, 13);
      dText(ctx, line, MX, ctx.y, 9, font, TEXT);
      ctx.y -= 13;
    }
    ctx.y -= 8;
  }
}

function drawAcceptance(ctx: Ctx, studio: StudioRow) {
  const { font, bold } = ctx;
  ensure(ctx, 160);
  ctx.y -= 6;

  drawEyebrow(ctx, "ACCETTAZIONE");

  const stmt =
    "Per accettazione integrale dei termini economici e tecnici riportati nel presente preventivo, il Cliente sottoscrive di seguito.";
  const lines = wrap(stmt, font, 9.5, CONTENT_W);
  for (const line of lines) {
    dText(ctx, line, MX, ctx.y, 9.5, font, TEXT);
    ctx.y -= 14;
  }
  ctx.y -= 24;

  const colW = (CONTENT_W - 48) / 2;

  // Place & date — single line above signatures
  dText(ctx, "LUOGO E DATA", MX, ctx.y, 7, bold, MUTED);
  dLine(ctx, MX + 80, ctx.y + 2, MX + colW, ctx.y + 2, 0.5, INK);

  ctx.y -= 56;
  const lineY = ctx.y;

  dLine(ctx, MX, lineY, MX + colW, lineY, 0.6, INK);
  dText(ctx, "FIRMA DEL CLIENTE", MX, lineY - 14, 7, bold, MUTED);

  const sx = MX + colW + 48;
  dLine(ctx, sx, lineY, sx + colW, lineY, 0.6, INK);
  dText(ctx, "PER LO STUDIO", sx, lineY - 14, 7, bold, MUTED);
  if (studio.architect_name) {
    dText(ctx, studio.architect_name, sx, lineY - 28, 9.5, bold, INK);
  }
  ctx.y -= 60;
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
        /* skip */
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
