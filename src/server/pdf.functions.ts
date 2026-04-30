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
const MX = 50;
const MT = 50;
const MB = 70;
const CONTENT_W = PAGE_W - 2 * MX;

// Brand colors
const NAVY = rgb(0.06, 0.11, 0.2);
const GREEN = rgb(0.18, 0.6, 0.34);
const TEXT = rgb(0.13, 0.13, 0.16);
const MUTED = rgb(0.45, 0.47, 0.52);
const LIGHT = rgb(0.88, 0.89, 0.92);
const VERY_LIGHT = rgb(0.965, 0.97, 0.975);
const WHITE = rgb(1, 1, 1);

const fmtPrice = (n: number) =>
  n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d: Date) =>
  d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });

function sanitize(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .replace(/\u00A0/g, " ")
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u2022/g, "-")
    .replace(/\u20AC/g, "EUR ")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\u00A1-\u00FF]/g, "");
}

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

// IMPORTANT: all draw helpers below take Ctx so they always render on
// ctx.page (which can change after a page break via newPage/ensure).

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
  const y = 38;
  dLine(ctx, MX, y + 14, PAGE_W - MX, y + 14, 0.5, LIGHT);
  const parts = [
    studio.studio_name,
    studio.vat_number ? `P.IVA ${studio.vat_number}` : null,
    studio.email,
    studio.phone,
  ]
    .filter(Boolean)
    .join("  -  ");
  dText(ctx, parts, MX, y, 7.5, font, MUTED);
  dTextRight(ctx, `Pagina ${pageNum} di ${pageTotal}`, PAGE_W - MX, y, 7.5, font, MUTED);
}

async function drawHeader(ctx: Ctx, logoBytes: Uint8Array | null, logoMime: string | null) {
  const { font, bold, studio } = ctx;
  const top = PAGE_H - MT;

  const GUTTER = 24;
  const leftColW = Math.floor((CONTENT_W - GUTTER) * 0.45);
  const rightColW = CONTENT_W - GUTTER - leftColW;

  let leftBottom = top;
  let logoDrawn = false;
  if (logoBytes && logoMime) {
    try {
      let img;
      if (logoMime.includes("png")) img = await ctx.pdf.embedPng(logoBytes);
      else if (logoMime.includes("jpeg") || logoMime.includes("jpg"))
        img = await ctx.pdf.embedJpg(logoBytes);
      if (img) {
        const maxH = 64;
        const maxW = leftColW;
        const ratio = img.width / img.height;
        let h = maxH;
        let w = h * ratio;
        if (w > maxW) {
          w = maxW;
          h = w / ratio;
        }
        ctx.page.drawImage(img, { x: MX, y: top - h, width: w, height: h });
        leftBottom = top - h;
        logoDrawn = true;
      }
    } catch {
      // ignore
    }
  }
  if (!logoDrawn) {
    const nameLines = wrap(studio.studio_name ?? "Studio", bold, 15, leftColW);
    let ly = top - 13;
    for (const line of nameLines.slice(0, 2)) {
      dText(ctx, line, MX, ly, 15, bold, NAVY);
      ly -= 18;
    }
    if (studio.architect_name) {
      ly -= 2;
      dText(ctx, studio.architect_name, MX, ly, 9, font, MUTED);
      ly -= 12;
    }
    leftBottom = ly;
  }

  // RIGHT column — studio details, right-aligned
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
  if (logoDrawn) {
    drawR(studio.studio_name ?? "", 11, bold, NAVY);
  }
  if (studio.architect_name) drawR(studio.architect_name, 9, font, MUTED);
  if (studio.address) drawR(studio.address, 8.5, font, MUTED);
  const cityLine = [studio.postal_code, studio.city, studio.province ? `(${studio.province})` : null]
    .filter(Boolean)
    .join(" ");
  if (cityLine) drawR(cityLine, 8.5, font, MUTED);
  if (studio.phone) drawR(`Tel. ${studio.phone}`, 8.5, font, MUTED);
  if (studio.email) drawR(studio.email, 8.5, font, MUTED);
  if (studio.vat_number) drawR(`P.IVA ${studio.vat_number}`, 8.5, font, MUTED);
  if (studio.albo_number) drawR(`Albo n. ${studio.albo_number}`, 8.5, font, MUTED);

  const lowest = Math.min(leftBottom, yR) - 8;
  ctx.y = lowest - 14;

  dLine(ctx, MX, ctx.y, PAGE_W - MX, ctx.y, 0.8, NAVY);
  ctx.y -= 28;
}

function drawClientBlock(
  ctx: Ctx,
  opts: {
    clientName: string;
    quoteNumber: string;
    quoteDate: Date;
    validUntil: Date;
    projectAddress?: string;
  }
) {
  const { font, bold } = ctx;
  ensure(ctx, 100);
  const blockTop = ctx.y;

  const GUTTER = 24;
  const rightW = 220;
  const leftW = CONTENT_W - rightW - GUTTER;

  // LEFT — client
  dText(ctx, "SPETT.LE", MX, blockTop, 7.5, bold, MUTED);
  const nameLines = wrap(opts.clientName, bold, 14, leftW);
  let ly = blockTop - 18;
  for (const line of nameLines.slice(0, 2)) {
    dText(ctx, line, MX, ly, 14, bold, NAVY);
    ly -= 17;
  }
  if (opts.projectAddress) {
    const lines = wrap(`Cantiere: ${opts.projectAddress}`, font, 9, leftW);
    ly -= 2;
    for (const line of lines.slice(0, 2)) {
      dText(ctx, line, MX, ly, 9, font, MUTED);
      ly -= 12;
    }
  }
  const leftBottom = ly - 6;

  // RIGHT — meta box
  const boxX = PAGE_W - MX - rightW;
  const rows: [string, string][] = [
    ["Preventivo n.", opts.quoteNumber],
    ["Data emissione", fmtDate(opts.quoteDate)],
    ["Validita' offerta", fmtDate(opts.validUntil)],
  ];
  const boxH = rows.length * 20 + 16;
  dRect(ctx, boxX, blockTop - boxH + 8, rightW, boxH, VERY_LIGHT);
  let ry = blockTop - 6;
  for (const [k, v] of rows) {
    dText(ctx, k, boxX + 14, ry, 7.5, bold, MUTED);
    dTextRight(ctx, v, boxX + rightW - 14, ry - 1, 9.5, bold, NAVY);
    ry -= 20;
  }
  const rightBottom = blockTop - boxH;

  ctx.y = Math.min(leftBottom, rightBottom) - 20;
}

function drawTitleBlock(ctx: Ctx, q: QuoteContent) {
  const { font, bold } = ctx;

  const titleLines = wrap(q.title, bold, 13, CONTENT_W - 16);
  const titleH = titleLines.length * 17;
  ensure(ctx, titleH + 16);

  dRect(ctx, MX, ctx.y - titleH - 4, 3, titleH + 8, GREEN);
  let ty = ctx.y - 12;
  for (const line of titleLines) {
    dText(ctx, line, MX + 12, ty, 13, bold, NAVY);
    ty -= 17;
  }
  ctx.y -= titleH + 14;

  if (q.description) {
    const descLines = wrap(q.description, font, 9.5, CONTENT_W);
    ensure(ctx, descLines.length * 13 + 6);
    for (const line of descLines) {
      dText(ctx, line, MX, ctx.y, 9.5, font, MUTED);
      ctx.y -= 13;
    }
    ctx.y -= 8;
  }

  ensure(ctx, 36);
  const colW = CONTENT_W / 2;
  dText(ctx, "DURATA STIMATA", MX, ctx.y, 7, bold, MUTED);
  dText(ctx, q.duration, MX, ctx.y - 14, 10, font, TEXT);
  dText(ctx, "LIVELLO FINITURE", MX + colW, ctx.y, 7, bold, MUTED);
  dText(ctx, q.finishLevel, MX + colW, ctx.y - 14, 10, font, TEXT);
  ctx.y -= 38;
}

function drawSections(ctx: Ctx, q: QuoteContent) {
  q.sections.forEach((section, si) => {
    const { font, bold } = ctx;
    ensure(ctx, 60);

    // Section header band
    dRect(ctx, MX, ctx.y - 18, CONTENT_W, 22, VERY_LIGHT);
    const num = String(si + 1).padStart(2, "0");
    dText(ctx, num, MX + 10, ctx.y - 12, 10, bold, GREEN);
    dText(ctx, section.name.toUpperCase(), MX + 32, ctx.y - 12, 9.5, bold, NAVY);
    ctx.y -= 32;

    // Items
    for (const item of section.items) {
      const priceStr = `EUR ${fmtPrice(item.price)}`;
      const priceW = bold.widthOfTextAtSize(priceStr, 9.5);
      const nameMaxW = CONTENT_W - priceW - 30;
      const nameLines = wrap(item.name, font, 9.5, nameMaxW);
      const itemH = Math.max(nameLines.length * 13, 13) + 6;
      ensure(ctx, itemH);

      let ily = ctx.y;
      let first = true;
      for (const line of nameLines) {
        dText(ctx, line, MX + 10, ily, 9.5, font, TEXT);
        if (first) {
          dTextRight(ctx, priceStr, PAGE_W - MX - 4, ily, 9.5, bold, TEXT);
          first = false;
        }
        ily -= 13;
      }
      dLine(ctx, MX + 10, ily + 6, PAGE_W - MX - 4, ily + 6, 0.3, LIGHT);
      ctx.y = ily - 2;
    }

    // Subtotal
    ensure(ctx, 24);
    ctx.y -= 6;
    dText(ctx, "Subtotale sezione", MX + 10, ctx.y, 8.5, font, MUTED);
    dTextRight(ctx, `EUR ${fmtPrice(section.subtotal)}`, PAGE_W - MX - 4, ctx.y, 10, bold, NAVY);
    ctx.y -= 24;
  });
}

function drawTotals(ctx: Ctx, q: QuoteContent, vatPercent: number) {
  const imponibile = q.total;
  const iva = imponibile * (vatPercent / 100);
  const totale = imponibile + iva;

  const boxW = 280;
  const boxH = 100;
  ensure(ctx, boxH + 12);

  const { font, bold } = ctx;
  const boxX = PAGE_W - MX - boxW;
  const boxY = ctx.y - boxH;

  dRect(ctx, boxX, boxY, boxW, boxH, NAVY);

  const rowL = (label: string, value: string, yy: number) => {
    dText(ctx, label, boxX + 16, yy, 9, font, rgb(0.78, 0.82, 0.88));
    dTextRight(ctx, value, boxX + boxW - 16, yy, 10, bold, WHITE);
  };
  rowL("Imponibile", `EUR ${fmtPrice(imponibile)}`, boxY + boxH - 22);
  rowL(`IVA ${vatPercent}%`, `EUR ${fmtPrice(iva)}`, boxY + boxH - 42);

  dLine(ctx, boxX + 16, boxY + boxH - 52, boxX + boxW - 16, boxY + boxH - 52, 0.5, rgb(0.32, 0.38, 0.5));

  dText(ctx, "TOTALE", boxX + 16, boxY + 20, 11, bold, WHITE);
  dTextRight(ctx, `EUR ${fmtPrice(totale)}`, boxX + boxW - 16, boxY + 16, 16, bold, GREEN);

  ctx.y = boxY - 24;
}

function drawNotesAndTerms(ctx: Ctx, q: QuoteContent, terms: string | null) {
  const { font, bold } = ctx;

  if (q.notes && q.notes.length > 0) {
    ensure(ctx, 28);
    dText(ctx, "NOTE", MX, ctx.y, 8.5, bold, NAVY);
    ctx.y -= 16;
    q.notes.forEach((note, i) => {
      const lines = wrap(`${i + 1}. ${note}`, font, 8.5, CONTENT_W);
      ensure(ctx, lines.length * 12 + 4);
      for (const line of lines) {
        dText(ctx, line, MX, ctx.y, 8.5, font, MUTED);
        ctx.y -= 12;
      }
      ctx.y -= 3;
    });
    ctx.y -= 12;
  }

  if (terms && terms.trim()) {
    ensure(ctx, 30);
    dText(ctx, "CONDIZIONI CONTRATTUALI", MX, ctx.y, 8.5, bold, NAVY);
    ctx.y -= 16;
    const lines = wrap(terms, font, 8.5, CONTENT_W);
    for (const line of lines) {
      ensure(ctx, 12);
      dText(ctx, line, MX, ctx.y, 8.5, font, MUTED);
      ctx.y -= 12;
    }
    ctx.y -= 12;
  }
}

function drawSignature(ctx: Ctx) {
  const { bold } = ctx;
  ensure(ctx, 80);
  ctx.y -= 10;
  const colW = (CONTENT_W - 40) / 2;
  const drawBox = (x: number, label: string) => {
    dLine(ctx, x, ctx.y - 30, x + colW, ctx.y - 30, 0.6, TEXT);
    dText(ctx, label, x, ctx.y - 44, 7, bold, MUTED);
  };
  drawBox(MX, "PER ACCETTAZIONE - DATA E FIRMA DEL CLIENTE");
  drawBox(MX + colW + 40, "LO STUDIO");
  ctx.y -= 64;
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

    drawClientBlock(ctx, {
      clientName: data.clientName?.trim() || "Cliente",
      quoteNumber,
      quoteDate: now,
      validUntil,
      projectAddress: data.projectAddress,
    });

    drawTitleBlock(ctx, data.quote);
    drawSections(ctx, data.quote);
    drawTotals(ctx, data.quote, studio.default_vat_percent ?? 22);
    drawNotesAndTerms(ctx, data.quote, studio.default_terms ?? null);
    drawSignature(ctx);

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
