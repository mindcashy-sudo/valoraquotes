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

// === A4 in points ===
const PAGE_W = 595.28;
const PAGE_H = 841.89;

// Layout zones
const SIDEBAR_W = 200;        // dark sidebar width (top + bottom blocks)
const HEADER_H = 170;         // top header height
const FOOTER_BLOCK_H = 230;   // bottom block height (sidebar + totals)
const MX = 40;                // outer page horizontal margin (white area)
const MT = HEADER_H + 28;     // content top after header
const MB = FOOTER_BLOCK_H + 30; // content bottom safety
const CONTENT_X = MX;
const CONTENT_W = PAGE_W - 2 * MX;

// Palette
const INK = rgb(0.09, 0.11, 0.14);     // dark navy/black
const TEXT = rgb(0.22, 0.24, 0.28);
const MUTED = rgb(0.5, 0.53, 0.58);
const HAIRLINE = rgb(0.86, 0.88, 0.91);
const ROW_ALT = rgb(0.957, 0.965, 0.972);
const WHITE = rgb(1, 1, 1);
const SOFT_WHITE = rgb(0.78, 0.82, 0.88);

const fmtPrice = (n: number) =>
  n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d: Date) =>
  d.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });

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
  pageIndex: number;
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
  ctx.pageIndex += 1;
  drawContinuationHeader(ctx);
  ctx.y = PAGE_H - 60; // slim header takes ~30pt, leave a little breathing room
}
function ensure(ctx: Ctx, needed: number) {
  if (ctx.y - needed < MB) newPage(ctx);
}

// ── Continuation page header (slim)
function drawContinuationHeader(ctx: Ctx) {
  const { bold, font, studio } = ctx;
  const top = PAGE_H - 30;
  dLine(ctx, MX, top - 20, PAGE_W - MX, top - 20, 0.5, HAIRLINE);
  dText(ctx, studio.studio_name ?? "Preventivo", MX, top - 14, 9, bold, INK);
  dTextRight(ctx, "PREVENTIVO — segue", PAGE_W - MX, top - 14, 8, font, MUTED);
}

// ── Page 1 header: dark sidebar (brand) + title block (right)
async function drawPageOneHeader(
  ctx: Ctx,
  logoBytes: Uint8Array | null,
  logoMime: string | null,
  quoteNumber: string,
  quoteDate: Date,
  validUntil: Date
) {
  const { font, bold, studio } = ctx;
  const headerTop = PAGE_H;
  const headerBottom = PAGE_H - HEADER_H;

  // Dark brand block (left)
  dRect(ctx, 0, headerBottom, SIDEBAR_W, HEADER_H, INK);

  // Brand content inside dark block
  const brandPad = 22;
  let by = headerTop - 36;

  let logoDrawn = false;
  if (logoBytes && logoMime) {
    try {
      let img;
      if (logoMime.includes("png")) img = await ctx.pdf.embedPng(logoBytes);
      else if (logoMime.includes("jpeg") || logoMime.includes("jpg")) img = await ctx.pdf.embedJpg(logoBytes);
      if (img) {
        const maxW = SIDEBAR_W - brandPad * 2;
        const maxH = 56;
        const ratio = img.width / img.height;
        let h = maxH;
        let w = h * ratio;
        if (w > maxW) {
          w = maxW;
          h = w / ratio;
        }
        ctx.page.drawImage(img, { x: brandPad, y: by - h + 8, width: w, height: h });
        by -= h + 6;
        logoDrawn = true;
      }
    } catch {
      /* ignore */
    }
  }

  if (!logoDrawn && studio.studio_name) {
    const lines = wrap(studio.studio_name, bold, 16, SIDEBAR_W - brandPad * 2);
    for (const line of lines.slice(0, 2)) {
      dText(ctx, line, brandPad, by, 16, bold, WHITE);
      by -= 19;
    }
    by -= 4;
  } else if (logoDrawn && studio.studio_name) {
    const lines = wrap(studio.studio_name, bold, 11, SIDEBAR_W - brandPad * 2);
    for (const line of lines.slice(0, 1)) {
      dText(ctx, line, brandPad, by, 11, bold, WHITE);
      by -= 14;
    }
  }

  if (studio.architect_name) {
    dText(ctx, studio.architect_name.toUpperCase(), brandPad, by, 7, bold, SOFT_WHITE);
    by -= 12;
  }

  // Spacer line
  dLine(ctx, brandPad, by - 2, brandPad + 28, by - 2, 1, SOFT_WHITE);
  by -= 14;

  // Compact contact stack (small, light)
  const contactLines: string[] = [];
  if (studio.address) contactLines.push(studio.address);
  const cityLine = [studio.postal_code, studio.city].filter(Boolean).join(" ");
  if (cityLine) contactLines.push(cityLine);
  if (studio.phone) contactLines.push(studio.phone);
  if (studio.email) contactLines.push(studio.email);

  for (const line of contactLines.slice(0, 5)) {
    if (by < headerBottom + 14) break;
    const fitted = wrap(line, font, 7.5, SIDEBAR_W - brandPad * 2)[0] ?? line;
    dText(ctx, fitted, brandPad, by, 7.5, font, SOFT_WHITE);
    by -= 11;
  }

  // Right side: PREVENTIVO title + meta (white area)
  const rx = SIDEBAR_W + 40;
  const rRight = PAGE_W - MX;

  // Big title
  dText(ctx, "PREVENTIVO", rx, headerTop - 70, 36, bold, INK);

  // Meta rows
  const metaY1 = headerTop - 110;
  const metaY2 = headerTop - 128;
  dText(ctx, "Numero", rx, metaY1, 9, bold, INK);
  dTextRight(ctx, quoteNumber, rRight, metaY1, 10, font, INK);
  dText(ctx, "Data", rx, metaY2, 9, bold, INK);
  dTextRight(ctx, fmtDate(quoteDate), rRight, metaY2, 10, font, INK);

  // Validity small line
  dText(ctx, `Valido fino al ${fmtDate(validUntil)}`, rx, headerBottom + 18, 8, font, MUTED);

  // Set content cursor below header
  ctx.y = headerBottom - 28;
}

// ── Project title + description (under header)
function drawProjectIntro(ctx: Ctx, q: QuoteContent, clientName: string, projectAddress?: string) {
  const { font, bold } = ctx;
  ensure(ctx, 100);

  // Two columns: left INTESTATO A / CANTIERE — right Project title
  const leftW = SIDEBAR_W - MX - 8; // align under sidebar approx
  const rightX = SIDEBAR_W + 40;
  const rightW = PAGE_W - MX - rightX;
  const top = ctx.y;

  // Left meta
  dText(ctx, "INTESTATO A", MX, top, 7.5, bold, MUTED);
  let ly = top - 14;
  const cLines = wrap(clientName, bold, 11, leftW);
  for (const line of cLines.slice(0, 2)) {
    dText(ctx, line, MX, ly, 11, bold, INK);
    ly -= 14;
  }
  if (projectAddress) {
    ly -= 4;
    dText(ctx, "CANTIERE", MX, ly, 7.5, bold, MUTED);
    ly -= 12;
    const aLines = wrap(projectAddress, font, 9, leftW);
    for (const line of aLines.slice(0, 3)) {
      dText(ctx, line, MX, ly, 9, font, TEXT);
      ly -= 12;
    }
  }
  const leftBottom = ly;

  // Right project title + description
  let ry = top;
  dText(ctx, "PROGETTO", rightX, ry, 7.5, bold, MUTED);
  ry -= 16;
  const tLines = wrap(q.title, bold, 16, rightW);
  for (const line of tLines.slice(0, 3)) {
    dText(ctx, line, rightX, ry, 16, bold, INK);
    ry -= 19;
  }
  if (q.description) {
    ry -= 4;
    const dLines = wrap(q.description, font, 9.5, rightW);
    for (const line of dLines.slice(0, 4)) {
      dText(ctx, line, rightX, ry, 9.5, font, TEXT);
      ry -= 13;
    }
  }

  // Quick spec chips: durata · livello finiture
  ry -= 6;
  const chip = (label: string, val: string, x: number) => {
    const labelText = label.toUpperCase();
    const labelW = bold.widthOfTextAtSize(labelText, 7);
    const valW = bold.widthOfTextAtSize(val, 9);
    const w = Math.max(labelW, valW) + 22;
    dRect(ctx, x, ry - 26, w, 28, ROW_ALT);
    dText(ctx, labelText, x + 10, ry - 8, 7, bold, MUTED);
    dText(ctx, val, x + 10, ry - 22, 9, bold, INK);
    return x + w + 10;
  };
  let cx = rightX;
  cx = chip("Durata", q.duration, cx);
  chip("Finiture", q.finishLevel, cx);
  ry -= 32;

  ctx.y = Math.min(leftBottom, ry) - 18;
}

// ── Items table — modern, alternating row backgrounds
function drawSections(ctx: Ctx, q: QuoteContent) {
  const { font, bold } = ctx;

  // Column geometry
  const COL_NUM_X = MX + 6;
  const COL_NUM_W = 28;
  const COL_DESC_X = COL_NUM_X + COL_NUM_W;
  const COL_PRICE_RIGHT = PAGE_W - MX - 12;
  const COL_PRICE_LABEL_W = 90;
  const COL_DESC_W = COL_PRICE_RIGHT - COL_PRICE_LABEL_W - COL_DESC_X - 8;

  // Table header
  ensure(ctx, 40);
  const headerY = ctx.y;
  dRect(ctx, MX, headerY - 26, CONTENT_W, 26, INK);
  dText(ctx, "N.", COL_NUM_X, headerY - 17, 8, bold, WHITE);
  dText(ctx, "DESCRIZIONE LAVORAZIONE", COL_DESC_X, headerY - 17, 8, bold, WHITE);
  dTextRight(ctx, "IMPORTO", COL_PRICE_RIGHT, headerY - 17, 8, bold, WHITE);
  ctx.y = headerY - 26 - 14;

  let rowCounter = 0;

  q.sections.forEach((section, si) => {
    // Section title row
    ensure(ctx, 30);
    const stTop = ctx.y;
    dText(ctx, `${String(si + 1).padStart(2, "0")}  ${section.name.toUpperCase()}`, MX + 6, stTop - 6, 9, bold, INK);
    dLine(ctx, MX, stTop - 14, PAGE_W - MX, stTop - 14, 0.6, INK);
    ctx.y = stTop - 22;

    section.items.forEach((item) => {
      rowCounter += 1;
      const priceStr = eur(item.price);
      const nameLines = wrap(item.name, font, 9.5, COL_DESC_W);
      const rowH = Math.max(nameLines.length * 13, 13) + 16;
      ensure(ctx, rowH + 2);

      const rowTop = ctx.y;
      // alternating background
      if (rowCounter % 2 === 0) {
        dRect(ctx, MX, rowTop - rowH, CONTENT_W, rowH, ROW_ALT);
      }

      // Number
      dText(ctx, String(rowCounter), COL_NUM_X, rowTop - 13, 9, bold, MUTED);

      // Description
      let ily = rowTop - 13;
      let first = true;
      for (const line of nameLines) {
        dText(ctx, line, COL_DESC_X, ily, 9.5, font, TEXT);
        if (first) {
          dTextRight(ctx, priceStr, COL_PRICE_RIGHT, ily, 10, bold, INK);
          first = false;
        }
        ily -= 13;
      }
      ctx.y = rowTop - rowH;
    });

    // Subtotal
    ensure(ctx, 26);
    const stbY = ctx.y;
    dText(ctx, `Subtotale ${section.name}`.toUpperCase(), COL_DESC_X, stbY - 14, 8, bold, MUTED);
    dTextRight(ctx, eur(section.subtotal), COL_PRICE_RIGHT, stbY - 14, 11, bold, INK);
    dLine(ctx, MX, stbY - 22, PAGE_W - MX, stbY - 22, 0.4, HAIRLINE);
    ctx.y = stbY - 32;
  });
}

// ── Bottom block: dark sidebar (cliente + condizioni) + totals + signature
function drawFooterBlock(
  ctx: Ctx,
  q: QuoteContent,
  vatPercent: number,
  studio: StudioRow,
  clientName: string,
  projectAddress: string | undefined,
  termsText: string | null
) {
  const { font, bold } = ctx;

  // Reserve enough space — push to a new page if not enough room
  if (ctx.y < MB + 40) newPage(ctx);

  const blockTop = FOOTER_BLOCK_H; // distance from page bottom
  const blockBottom = 0;
  const blockHeight = FOOTER_BLOCK_H;

  // Dark left sidebar
  dRect(ctx, 0, blockBottom, SIDEBAR_W, blockHeight, INK);

  // Sidebar content
  const sx = 22;
  let sy = blockHeight - 24;

  dText(ctx, "INTESTATO A", sx, sy, 8, bold, SOFT_WHITE);
  sy -= 14;
  const cLines = wrap(clientName, bold, 11, SIDEBAR_W - sx * 2);
  for (const line of cLines.slice(0, 2)) {
    dText(ctx, line, sx, sy, 11, bold, WHITE);
    sy -= 14;
  }
  if (projectAddress) {
    sy -= 4;
    const aLines = wrap(projectAddress, font, 8.5, SIDEBAR_W - sx * 2);
    for (const line of aLines.slice(0, 3)) {
      dText(ctx, line, sx, sy, 8.5, font, SOFT_WHITE);
      sy -= 11;
    }
  }
  sy -= 10;

  dLine(ctx, sx, sy, sx + 28, sy, 1, SOFT_WHITE);
  sy -= 12;

  dText(ctx, "CONDIZIONI", sx, sy, 8, bold, SOFT_WHITE);
  sy -= 12;

  const defaultTerms =
    termsText && termsText.trim()
      ? termsText
      : `Importi comprensivi di IVA al ${vatPercent}%. Eventuali varianti saranno contabilizzate previa accettazione scritta. Tempi indicativi soggetti a verifica in fase esecutiva.`;
  const tLines = wrap(defaultTerms, font, 7.5, SIDEBAR_W - sx * 2);
  for (const line of tLines) {
    if (sy < 14) break;
    dText(ctx, line, sx, sy, 7.5, font, SOFT_WHITE);
    sy -= 10;
  }

  // Right side: "Grazie" + Pagamento + Totals + Signature
  const rx = SIDEBAR_W + 30;
  const rRight = PAGE_W - MX;
  let ry = blockHeight - 24;

  dText(ctx, "Grazie per la fiducia", rx, ry, 11, bold, INK);
  ry -= 18;

  // Pagamento info (compact)
  if (studio.iban || studio.email) {
    dText(ctx, "DATI PAGAMENTO", rx, ry, 7.5, bold, MUTED);
    ry -= 12;
    if (studio.iban) {
      dText(ctx, `IBAN`, rx, ry, 8, bold, INK);
      dText(ctx, studio.iban, rx + 50, ry, 8, font, TEXT);
      ry -= 11;
    }
    if (studio.studio_name) {
      dText(ctx, `Beneficiario`, rx, ry, 8, bold, INK);
      dText(ctx, studio.studio_name, rx + 64, ry, 8, font, TEXT);
      ry -= 11;
    }
    ry -= 6;
  }

  // Totals (right aligned)
  const imponibile = q.total;
  const iva = imponibile * (vatPercent / 100);
  const totale = imponibile + iva;

  const totRowY = (label: string, val: string, size = 9, color = TEXT, weight: PDFFont = font) => {
    dText(ctx, label, rx, ry, size, bold, MUTED);
    dTextRight(ctx, val, rRight, ry, size + 1, weight, color);
    ry -= 16;
  };
  totRowY("Imponibile", eur(imponibile), 9, INK, bold);
  totRowY(`IVA ${vatPercent}%`, eur(iva), 9, INK, bold);
  dLine(ctx, rx, ry + 6, rRight, ry + 6, 0.5, HAIRLINE);
  ry -= 6;

  // TOTAL — big
  dText(ctx, "TOTALE", rx, ry - 6, 11, bold, INK);
  dTextRight(ctx, eur(totale), rRight, ry - 10, 20, bold, INK);
  ry -= 32;

  // Signature line
  const sigY = 38;
  dLine(ctx, rx, sigY + 14, rx + 180, sigY + 14, 0.6, INK);
  dText(ctx, "Firma per accettazione", rx, sigY, 8, bold, MUTED);
  if (studio.architect_name) {
    dTextRight(ctx, studio.architect_name, rRight, sigY, 8, bold, INK);
    dTextRight(ctx, "Per lo studio", rRight, sigY - 11, 7.5, font, MUTED);
  }
}

// ── Notes section (renders inline before footer block, optional)
function drawNotes(ctx: Ctx, q: QuoteContent, vatPercent: number) {
  const { font, bold } = ctx;
  const cleaned = (q.notes ?? []).filter(
    (n) => !/iva\s+esclusa/i.test(n) && !/oltre\s+iva/i.test(n)
  );
  const defaults = [
    `Importi comprensivi di IVA al ${vatPercent}%.`,
    "Varianti in corso d'opera contabilizzate previa accettazione scritta.",
    "Tempi indicativi soggetti a verifica in fase esecutiva.",
  ];
  const notes = cleaned.length >= 2 ? cleaned : defaults;
  if (!notes.length) return;

  ensure(ctx, 40);
  dText(ctx, "NOTE", MX + 6, ctx.y, 8, bold, MUTED);
  dLine(ctx, MX, ctx.y - 6, PAGE_W - MX, ctx.y - 6, 0.4, HAIRLINE);
  ctx.y -= 16;

  notes.forEach((note) => {
    const lines = wrap(note, font, 8.5, CONTENT_W - 18);
    ensure(ctx, lines.length * 12 + 6);
    dText(ctx, "·", MX + 6, ctx.y, 9, bold, INK);
    let ly = ctx.y;
    for (const line of lines) {
      dText(ctx, line, MX + 18, ly, 8.5, font, TEXT);
      ly -= 12;
    }
    ctx.y = ly - 4;
  });
  ctx.y -= 6;
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
    const ctx: Ctx = { pdf, page, y: PAGE_H - MT, font, bold, studio, pageIndex: 0 };

    const now = new Date();
    const validityDays = studio.default_validity_days ?? 30;
    const validUntil = new Date(now.getTime() + validityDays * 24 * 60 * 60 * 1000);
    const quoteNumber =
      data.quoteNumber ??
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}${String(
        now.getDate()
      ).padStart(2, "0")}-${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`;

    const vatPercent = studio.default_vat_percent ?? 22;
    const clientName = data.clientName?.trim() || "Cliente";

    await drawPageOneHeader(ctx, logoBytes, logoMime, quoteNumber, now, validUntil);
    drawProjectIntro(ctx, data.quote, clientName, data.projectAddress);
    drawSections(ctx, data.quote);
    drawNotes(ctx, data.quote, vatPercent);

    // Always draw the footer block on the LAST page
    // If there isn't enough room, push to new page first
    if (ctx.y < MB + 30) {
      ctx.page = pdf.addPage([PAGE_W, PAGE_H]);
      ctx.pageIndex += 1;
      drawContinuationHeader(ctx);
      ctx.y = PAGE_H - 70;
    }
    drawFooterBlock(
      ctx,
      data.quote,
      vatPercent,
      studio,
      clientName,
      data.projectAddress,
      studio.default_terms ?? null
    );

    // Footer page numbers (skip page 1 — header is dominant)
    const total = pdf.getPageCount();
    for (let i = 1; i < total; i++) {
      const p = pdf.getPage(i);
      const txt = `${i + 1} / ${total}`;
      const w = font.widthOfTextAtSize(txt, 7.5);
      p.drawText(txt, { x: (PAGE_W - w) / 2, y: 18, size: 7.5, font, color: MUTED });
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
