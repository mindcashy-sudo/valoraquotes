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
const MX = 50; // horizontal margin
const MT = 50; // top margin
const MB = 70; // bottom margin (room for footer)
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

// ASCII-safe text — Helvetica (WinAnsi) lacks many unicode glyphs.
// Replace common typographic chars and strip everything else outside the safe range.
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

function drawText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  size: number,
  font: PDFFont,
  color = TEXT
) {
  page.drawText(sanitize(text), { x, y, size, font, color });
}

function drawTextRight(
  page: PDFPage,
  text: string,
  rightX: number,
  y: number,
  size: number,
  font: PDFFont,
  color = TEXT
) {
  const safe = sanitize(text);
  const w = font.widthOfTextAtSize(safe, size);
  page.drawText(safe, { x: rightX - w, y, size, font, color });
}

function drawFooter(ctx: Ctx, pageNum: number, pageTotal: number) {
  const { page, font, studio } = ctx;
  const y = 38;
  page.drawLine({
    start: { x: MX, y: y + 14 },
    end: { x: PAGE_W - MX, y: y + 14 },
    thickness: 0.5,
    color: LIGHT,
  });
  const parts = [
    studio.studio_name,
    studio.vat_number ? `P.IVA ${studio.vat_number}` : null,
    studio.email,
    studio.phone,
  ]
    .filter(Boolean)
    .join("  -  ");
  drawText(page, parts, MX, y, 7.5, font, MUTED);
  drawTextRight(
    page,
    `Pagina ${pageNum} di ${pageTotal}`,
    PAGE_W - MX,
    y,
    7.5,
    font,
    MUTED
  );
}

function newPage(ctx: Ctx) {
  ctx.page = ctx.pdf.addPage([PAGE_W, PAGE_H]);
  ctx.y = PAGE_H - MT;
}

function ensure(ctx: Ctx, needed: number) {
  if (ctx.y - needed < MB) newPage(ctx);
}

async function drawHeader(
  ctx: Ctx,
  logoBytes: Uint8Array | null,
  logoMime: string | null
) {
  const { page, font, bold, studio } = ctx;
  const top = PAGE_H - MT;

  // Left side: logo
  let leftBottom = top;
  if (logoBytes && logoMime) {
    try {
      let img;
      if (logoMime.includes("png")) img = await ctx.pdf.embedPng(logoBytes);
      else if (logoMime.includes("jpeg") || logoMime.includes("jpg"))
        img = await ctx.pdf.embedJpg(logoBytes);
      if (img) {
        const maxH = 55;
        const maxW = 180;
        const ratio = img.width / img.height;
        let h = maxH;
        let w = h * ratio;
        if (w > maxW) {
          w = maxW;
          h = w / ratio;
        }
        page.drawImage(img, { x: MX, y: top - h, width: w, height: h });
        leftBottom = top - h;
      }
    } catch {
      // ignore
    }
  }
  // Studio name fallback if no logo
  if (leftBottom === top && studio.studio_name) {
    drawText(page, studio.studio_name, MX, top - 14, 14, bold, NAVY);
    leftBottom = top - 18;
    if (studio.architect_name) {
      drawText(page, studio.architect_name, MX, top - 30, 9, font, MUTED);
      leftBottom = top - 34;
    }
  }

  // Right side: studio info stack
  let yR = top - 4;
  const lineH = (size: number) => size + 3;
  const drawR = (text: string, size: number, f: PDFFont, color = TEXT) => {
    if (!text) return;
    drawTextRight(page, text, PAGE_W - MX, yR, size, f, color);
    yR -= lineH(size);
  };
  if (logoBytes) {
    // Show studio name on the right when logo is on the left
    drawR(studio.studio_name ?? "", 11, bold, NAVY);
  }
  drawR(studio.architect_name ?? "", 9, font, MUTED);
  if (studio.address) drawR(studio.address, 8.5, font, MUTED);
  const cityLine = [studio.postal_code, studio.city, studio.province ? `(${studio.province})` : null]
    .filter(Boolean)
    .join(" ");
  if (cityLine) drawR(cityLine, 8.5, font, MUTED);
  if (studio.phone) drawR(`Tel. ${studio.phone}`, 8.5, font, MUTED);
  if (studio.email) drawR(studio.email, 8.5, font, MUTED);
  if (studio.vat_number) drawR(`P.IVA ${studio.vat_number}`, 8.5, font, MUTED);
  if (studio.albo_number) drawR(`Albo n. ${studio.albo_number}`, 8.5, font, MUTED);

  // Set y below the lower of the two sides, with safe gap
  const lowest = Math.min(leftBottom, yR);
  ctx.y = lowest - 18;

  // Divider
  page.drawLine({
    start: { x: MX, y: ctx.y },
    end: { x: PAGE_W - MX, y: ctx.y },
    thickness: 0.8,
    color: NAVY,
  });
  ctx.y -= 24;
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
  const { page, font, bold } = ctx;
  ensure(ctx, 90);
  const blockTop = ctx.y;

  // Two columns with gutter, no overlap
  const GUTTER = 24;
  const rightW = 220;
  const leftW = CONTENT_W - rightW - GUTTER;

  // LEFT — client
  drawText(page, "SPETT.LE", MX, blockTop, 7.5, bold, MUTED);
  const nameLines = wrap(opts.clientName, bold, 14, leftW);
  let ly = blockTop - 17;
  for (const line of nameLines.slice(0, 2)) {
    drawText(page, line, MX, ly, 14, bold, NAVY);
    ly -= 17;
  }
  if (opts.projectAddress) {
    const lines = wrap(`Cantiere: ${opts.projectAddress}`, font, 9, leftW);
    for (const line of lines.slice(0, 2)) {
      drawText(page, line, MX, ly - 2, 9, font, MUTED);
      ly -= 12;
    }
  }
  const leftBottom = ly - 6;

  // RIGHT — meta box (subtle background)
  const boxX = PAGE_W - MX - rightW;
  const rows: [string, string][] = [
    ["Preventivo n.", opts.quoteNumber],
    ["Data emissione", fmtDate(opts.quoteDate)],
    ["Validita' offerta", fmtDate(opts.validUntil)],
  ];
  const boxH = rows.length * 18 + 14;
  page.drawRectangle({
    x: boxX,
    y: blockTop - boxH + 6,
    width: rightW,
    height: boxH,
    color: VERY_LIGHT,
  });
  let ry = blockTop - 6;
  for (const [k, v] of rows) {
    drawText(page, k, boxX + 12, ry, 7.5, bold, MUTED);
    drawTextRight(page, v, boxX + rightW - 12, ry - 1, 9.5, bold, NAVY);
    ry -= 18;
  }
  const rightBottom = blockTop - boxH;

  ctx.y = Math.min(leftBottom, rightBottom) - 18;
}

function drawTitleBlock(ctx: Ctx, q: QuoteContent) {
  const { page, font, bold } = ctx;

  // Title with green accent bar
  const titleLines = wrap(q.title, bold, 13, CONTENT_W - 16);
  const titleH = titleLines.length * 17;
  ensure(ctx, titleH + 16);

  page.drawRectangle({
    x: MX,
    y: ctx.y - titleH - 4,
    width: 3,
    height: titleH + 8,
    color: GREEN,
  });
  let ty = ctx.y - 12;
  for (const line of titleLines) {
    drawText(page, line, MX + 12, ty, 13, bold, NAVY);
    ty -= 17;
  }
  ctx.y -= titleH + 14;

  // Description
  if (q.description) {
    const descLines = wrap(q.description, font, 9.5, CONTENT_W);
    ensure(ctx, descLines.length * 13 + 6);
    for (const line of descLines) {
      drawText(page, line, MX, ctx.y, 9.5, font, MUTED);
      ctx.y -= 13;
    }
    ctx.y -= 8;
  }

  // Meta row
  ensure(ctx, 32);
  const colW = CONTENT_W / 2;
  drawText(page, "DURATA STIMATA", MX, ctx.y, 7, bold, MUTED);
  drawText(page, q.duration, MX, ctx.y - 13, 10, font, TEXT);
  drawText(page, "LIVELLO FINITURE", MX + colW, ctx.y, 7, bold, MUTED);
  drawText(page, q.finishLevel, MX + colW, ctx.y - 13, 10, font, TEXT);
  ctx.y -= 36;
}

function drawSections(ctx: Ctx, q: QuoteContent) {
  q.sections.forEach((section, si) => {
    const { page, font, bold } = ctx;
    ensure(ctx, 50);

    // Section header band
    page.drawRectangle({
      x: MX,
      y: ctx.y - 18,
      width: CONTENT_W,
      height: 22,
      color: VERY_LIGHT,
    });
    const num = String(si + 1).padStart(2, "0");
    drawText(page, num, MX + 10, ctx.y - 12, 10, bold, GREEN);
    drawText(page, section.name.toUpperCase(), MX + 32, ctx.y - 12, 9.5, bold, NAVY);
    ctx.y -= 30;

    // Items
    for (const item of section.items) {
      const priceStr = `EUR ${fmtPrice(item.price)}`;
      const priceW = bold.widthOfTextAtSize(priceStr, 9.5);
      const nameMaxW = CONTENT_W - priceW - 30;
      const nameLines = wrap(item.name, font, 9.5, nameMaxW);
      const itemH = Math.max(nameLines.length * 13, 13) + 4;
      ensure(ctx, itemH);

      let ly = ctx.y;
      let first = true;
      for (const line of nameLines) {
        drawText(page, line, MX + 10, ly, 9.5, font, TEXT);
        if (first) {
          drawTextRight(page, priceStr, PAGE_W - MX - 4, ly, 9.5, bold, TEXT);
          first = false;
        }
        ly -= 13;
      }
      // Light separator
      page.drawLine({
        start: { x: MX + 10, y: ly + 6 },
        end: { x: PAGE_W - MX - 4, y: ly + 6 },
        thickness: 0.3,
        color: LIGHT,
      });
      ctx.y = ly - 2;
    }

    // Subtotal
    ensure(ctx, 22);
    ctx.y -= 4;
    drawText(page, "Subtotale sezione", MX + 10, ctx.y, 8.5, font, MUTED);
    drawTextRight(
      page,
      `EUR ${fmtPrice(section.subtotal)}`,
      PAGE_W - MX - 4,
      ctx.y,
      10,
      bold,
      NAVY
    );
    ctx.y -= 22;
  });
}

function drawTotals(ctx: Ctx, q: QuoteContent, vatPercent: number) {
  const { page, font, bold } = ctx;
  const imponibile = q.total;
  const iva = imponibile * (vatPercent / 100);
  const totale = imponibile + iva;

  const boxW = 260;
  const boxH = 92;
  ensure(ctx, boxH + 10);

  const boxX = PAGE_W - MX - boxW;
  const boxY = ctx.y - boxH;

  page.drawRectangle({
    x: boxX,
    y: boxY,
    width: boxW,
    height: boxH,
    color: NAVY,
  });

  // Rows
  const rowL = (label: string, value: string, yy: number) => {
    drawText(page, label, boxX + 16, yy, 9, font, rgb(0.78, 0.82, 0.88));
    drawTextRight(page, value, boxX + boxW - 16, yy, 10, bold, WHITE);
  };
  rowL("Imponibile", `EUR ${fmtPrice(imponibile)}`, boxY + boxH - 20);
  rowL(`IVA ${vatPercent}%`, `EUR ${fmtPrice(iva)}`, boxY + boxH - 38);

  page.drawLine({
    start: { x: boxX + 16, y: boxY + boxH - 48 },
    end: { x: boxX + boxW - 16, y: boxY + boxH - 48 },
    thickness: 0.5,
    color: rgb(0.32, 0.38, 0.5),
  });

  drawText(page, "TOTALE", boxX + 16, boxY + 18, 11, bold, WHITE);
  drawTextRight(
    page,
    `EUR ${fmtPrice(totale)}`,
    boxX + boxW - 16,
    boxY + 14,
    16,
    bold,
    GREEN
  );

  ctx.y = boxY - 22;
}

function drawNotesAndTerms(ctx: Ctx, q: QuoteContent, terms: string | null) {
  const { page, font, bold } = ctx;

  if (q.notes && q.notes.length > 0) {
    ensure(ctx, 24);
    drawText(page, "NOTE", MX, ctx.y, 8.5, bold, NAVY);
    ctx.y -= 14;
    q.notes.forEach((note, i) => {
      const lines = wrap(`${i + 1}. ${note}`, font, 8.5, CONTENT_W);
      ensure(ctx, lines.length * 12 + 4);
      for (const line of lines) {
        drawText(page, line, MX, ctx.y, 8.5, font, MUTED);
        ctx.y -= 12;
      }
      ctx.y -= 3;
    });
    ctx.y -= 10;
  }

  if (terms && terms.trim()) {
    ensure(ctx, 30);
    drawText(page, "CONDIZIONI CONTRATTUALI", MX, ctx.y, 8.5, bold, NAVY);
    ctx.y -= 14;
    const lines = wrap(terms, font, 8.5, CONTENT_W);
    for (const line of lines) {
      ensure(ctx, 12);
      drawText(page, line, MX, ctx.y, 8.5, font, MUTED);
      ctx.y -= 12;
    }
    ctx.y -= 10;
  }
}

function drawSignature(ctx: Ctx) {
  const { page, font, bold } = ctx;
  ensure(ctx, 70);
  ctx.y -= 8;
  const colW = (CONTENT_W - 40) / 2;
  const drawBox = (x: number, label: string) => {
    page.drawLine({
      start: { x, y: ctx.y - 28 },
      end: { x: x + colW, y: ctx.y - 28 },
      thickness: 0.6,
      color: TEXT,
    });
    drawText(page, label, x, ctx.y - 42, 7, bold, MUTED);
  };
  drawBox(MX, "PER ACCETTAZIONE - DATA E FIRMA DEL CLIENTE");
  drawBox(MX + colW + 40, "LO STUDIO");
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

    // Draw footers on every page now that we know totals
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
