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

// === Layout constants ===
const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const MARGIN_X = 50;
const MARGIN_TOP = 50;
const MARGIN_BOTTOM = 60;

// Brand colors
const NAVY = rgb(0.06, 0.11, 0.2);
const GREEN = rgb(0.18, 0.6, 0.34);
const TEXT = rgb(0.1, 0.1, 0.12);
const MUTED = rgb(0.45, 0.45, 0.5);
const LIGHT = rgb(0.88, 0.88, 0.9);
const VERY_LIGHT = rgb(0.96, 0.96, 0.97);

const fmtPrice = (n: number) =>
  n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d: Date) =>
  d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  if (!text) return [""];
  const lines: string[] = [];
  const paragraphs = text.split("\n");
  for (const para of paragraphs) {
    const words = para.split(" ");
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    if (paragraphs.length > 1) lines.push("");
  }
  return lines;
}

interface Ctx {
  pdf: PDFDocument;
  page: PDFPage;
  y: number;
  font: PDFFont;
  fontBold: PDFFont;
  studio: StudioRow;
}

function newPage(ctx: Ctx) {
  ctx.page = ctx.pdf.addPage([PAGE_W, PAGE_H]);
  ctx.y = PAGE_H - MARGIN_TOP;
  drawFooter(ctx);
}

function ensureSpace(ctx: Ctx, needed: number) {
  if (ctx.y - needed < MARGIN_BOTTOM) newPage(ctx);
}

function drawFooter(ctx: Ctx) {
  const { page, font, studio } = ctx;
  const footerY = 30;
  page.drawLine({
    start: { x: MARGIN_X, y: footerY + 18 },
    end: { x: PAGE_W - MARGIN_X, y: footerY + 18 },
    thickness: 0.5,
    color: LIGHT,
  });
  const parts = [
    studio.studio_name,
    studio.vat_number ? `P.IVA ${studio.vat_number}` : null,
    studio.email,
    studio.phone,
  ].filter(Boolean);
  page.drawText(parts.join(" · "), {
    x: MARGIN_X,
    y: footerY,
    size: 7,
    font,
    color: MUTED,
  });
  page.drawText("Documento generato con Valora", {
    x: PAGE_W - MARGIN_X - font.widthOfTextAtSize("Documento generato con Valora", 7),
    y: footerY,
    size: 7,
    font,
    color: MUTED,
  });
}

async function drawHeader(
  ctx: Ctx,
  logoBytes: Uint8Array | null,
  logoMime: string | null
) {
  const { page, font, fontBold, studio } = ctx;
  const top = PAGE_H - MARGIN_TOP;

  // Logo
  if (logoBytes && logoMime) {
    try {
      let img;
      if (logoMime.includes("png")) img = await ctx.pdf.embedPng(logoBytes);
      else if (logoMime.includes("jpeg") || logoMime.includes("jpg"))
        img = await ctx.pdf.embedJpg(logoBytes);
      if (img) {
        const maxH = 50;
        const ratio = img.width / img.height;
        const h = Math.min(maxH, img.height);
        const w = h * ratio;
        page.drawImage(img, {
          x: MARGIN_X,
          y: top - h,
          width: Math.min(w, 160),
          height: h,
        });
      }
    } catch {
      // ignore logo errors
    }
  }

  // Studio info on the right
  let yR = top;
  const drawR = (text: string, size: number, f: PDFFont, color = TEXT) => {
    if (!text) return;
    const w = f.widthOfTextAtSize(text, size);
    page.drawText(text, { x: PAGE_W - MARGIN_X - w, y: yR, size, font: f, color });
    yR -= size + 2;
  };
  drawR(studio.studio_name ?? "", 11, fontBold, NAVY);
  drawR(studio.architect_name ?? "", 9, font, MUTED);
  if (studio.address) {
    const cityLine = [studio.postal_code, studio.city, studio.province ? `(${studio.province})` : null]
      .filter(Boolean)
      .join(" ");
    drawR(studio.address, 8, font, MUTED);
    if (cityLine) drawR(cityLine, 8, font, MUTED);
  }
  if (studio.phone) drawR(`Tel ${studio.phone}`, 8, font, MUTED);
  if (studio.email) drawR(studio.email, 8, font, MUTED);
  if (studio.vat_number) drawR(`P.IVA ${studio.vat_number}`, 8, font, MUTED);
  if (studio.albo_number) drawR(`Albo n° ${studio.albo_number}`, 8, font, MUTED);

  ctx.y = Math.min(top - 70, yR - 20);
  // Divider
  page.drawLine({
    start: { x: MARGIN_X, y: ctx.y },
    end: { x: PAGE_W - MARGIN_X, y: ctx.y },
    thickness: 0.8,
    color: NAVY,
  });
  ctx.y -= 20;
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
  const { page, font, fontBold } = ctx;
  ensureSpace(ctx, 100);

  // Left: client
  page.drawText("Spett.le", { x: MARGIN_X, y: ctx.y, size: 8, font, color: MUTED });
  page.drawText(opts.clientName, {
    x: MARGIN_X,
    y: ctx.y - 14,
    size: 12,
    font: fontBold,
    color: TEXT,
  });
  if (opts.projectAddress) {
    page.drawText(opts.projectAddress, {
      x: MARGIN_X,
      y: ctx.y - 30,
      size: 9,
      font,
      color: MUTED,
    });
  }

  // Right: meta
  const rightX = PAGE_W - MARGIN_X - 200;
  const rows: [string, string][] = [
    ["Preventivo n°", opts.quoteNumber],
    ["Data", fmtDate(opts.quoteDate)],
    ["Validità offerta", fmtDate(opts.validUntil)],
  ];
  let ry = ctx.y;
  for (const [k, v] of rows) {
    page.drawText(k, { x: rightX, y: ry, size: 8, font, color: MUTED });
    page.drawText(v, {
      x: PAGE_W - MARGIN_X - fontBold.widthOfTextAtSize(v, 9),
      y: ry,
      size: 9,
      font: fontBold,
      color: TEXT,
    });
    ry -= 14;
  }

  ctx.y -= 60;
}

function drawTitleBlock(ctx: Ctx, q: QuoteContent) {
  const { page, font, fontBold } = ctx;
  const innerW = PAGE_W - 2 * MARGIN_X;
  const titleLines = wrapText(q.title, fontBold, 14, innerW);
  ensureSpace(ctx, 30 + titleLines.length * 18);

  // Background band
  const bandH = 18 + titleLines.length * 18 + 12;
  page.drawRectangle({
    x: MARGIN_X,
    y: ctx.y - bandH + 14,
    width: innerW,
    height: bandH,
    color: VERY_LIGHT,
  });
  page.drawRectangle({
    x: MARGIN_X,
    y: ctx.y - bandH + 14,
    width: 3,
    height: bandH,
    color: GREEN,
  });

  ctx.y -= 4;
  for (const line of titleLines) {
    page.drawText(line, { x: MARGIN_X + 12, y: ctx.y, size: 14, font: fontBold, color: NAVY });
    ctx.y -= 18;
  }
  ctx.y -= 8;

  // Description
  const descLines = wrapText(q.description, font, 9, innerW - 12);
  ensureSpace(ctx, descLines.length * 12);
  for (const line of descLines) {
    page.drawText(line, { x: MARGIN_X + 12, y: ctx.y, size: 9, font, color: MUTED });
    ctx.y -= 12;
  }
  ctx.y -= 14;

  // Meta row: durata + finiture
  const metaY = ctx.y;
  page.drawText("DURATA", { x: MARGIN_X, y: metaY, size: 7, font: fontBold, color: MUTED });
  page.drawText(q.duration, {
    x: MARGIN_X,
    y: metaY - 12,
    size: 9,
    font,
    color: TEXT,
  });
  page.drawText("LIVELLO FINITURE", {
    x: MARGIN_X + 200,
    y: metaY,
    size: 7,
    font: fontBold,
    color: MUTED,
  });
  page.drawText(q.finishLevel, {
    x: MARGIN_X + 200,
    y: metaY - 12,
    size: 9,
    font,
    color: TEXT,
  });
  ctx.y -= 30;
}

function drawSections(ctx: Ctx, q: QuoteContent) {
  const { page, font, fontBold } = ctx;
  const innerW = PAGE_W - 2 * MARGIN_X;

  q.sections.forEach((section, si) => {
    ensureSpace(ctx, 50);
    // Section header
    const num = String(si + 1).padStart(2, "0");
    page.drawText(num, {
      x: MARGIN_X,
      y: ctx.y,
      size: 9,
      font: fontBold,
      color: GREEN,
    });
    page.drawText(section.name.toUpperCase(), {
      x: MARGIN_X + 24,
      y: ctx.y,
      size: 9,
      font: fontBold,
      color: NAVY,
    });
    page.drawLine({
      start: { x: MARGIN_X, y: ctx.y - 4 },
      end: { x: PAGE_W - MARGIN_X, y: ctx.y - 4 },
      thickness: 0.5,
      color: LIGHT,
    });
    ctx.y -= 18;

    // Items
    for (const item of section.items) {
      const priceStr = `€ ${fmtPrice(item.price)}`;
      const priceW = fontBold.widthOfTextAtSize(priceStr, 9);
      const nameMaxW = innerW - priceW - 30;
      const nameLines = wrapText(item.name, font, 9, nameMaxW);
      ensureSpace(ctx, nameLines.length * 12 + 4);
      let firstLine = true;
      for (const line of nameLines) {
        page.drawText(line, {
          x: MARGIN_X + 12,
          y: ctx.y,
          size: 9,
          font,
          color: TEXT,
        });
        if (firstLine) {
          page.drawText(priceStr, {
            x: PAGE_W - MARGIN_X - priceW,
            y: ctx.y,
            size: 9,
            font: fontBold,
            color: TEXT,
          });
          firstLine = false;
        }
        ctx.y -= 12;
      }
      ctx.y -= 2;
    }

    // Subtotal
    ensureSpace(ctx, 24);
    ctx.y -= 4;
    const subStr = `€ ${fmtPrice(section.subtotal)}`;
    page.drawText("Subtotale sezione", {
      x: MARGIN_X + 12,
      y: ctx.y,
      size: 8,
      font,
      color: MUTED,
    });
    const subW = fontBold.widthOfTextAtSize(subStr, 10);
    page.drawText(subStr, {
      x: PAGE_W - MARGIN_X - subW,
      y: ctx.y,
      size: 10,
      font: fontBold,
      color: TEXT,
    });
    ctx.y -= 22;
  });
}

function drawTotals(ctx: Ctx, q: QuoteContent, vatPercent: number) {
  const { page, font, fontBold } = ctx;
  ensureSpace(ctx, 90);

  const imponibile = q.total;
  const iva = imponibile * (vatPercent / 100);
  const totale = imponibile + iva;

  const boxW = 240;
  const boxX = PAGE_W - MARGIN_X - boxW;
  const boxH = 80;
  page.drawRectangle({
    x: boxX,
    y: ctx.y - boxH,
    width: boxW,
    height: boxH,
    color: NAVY,
  });

  const drawRow = (label: string, value: string, y: number, big = false) => {
    page.drawText(label, {
      x: boxX + 14,
      y,
      size: big ? 10 : 8,
      font: big ? fontBold : font,
      color: rgb(0.85, 0.88, 0.92),
    });
    const w = fontBold.widthOfTextAtSize(value, big ? 14 : 9);
    page.drawText(value, {
      x: boxX + boxW - 14 - w,
      y: big ? y - 2 : y,
      size: big ? 14 : 9,
      font: fontBold,
      color: big ? GREEN : rgb(1, 1, 1),
    });
  };

  drawRow("Imponibile", `€ ${fmtPrice(imponibile)}`, ctx.y - 18);
  drawRow(`IVA ${vatPercent}%`, `€ ${fmtPrice(iva)}`, ctx.y - 36);
  page.drawLine({
    start: { x: boxX + 14, y: ctx.y - 46 },
    end: { x: boxX + boxW - 14, y: ctx.y - 46 },
    thickness: 0.5,
    color: rgb(0.3, 0.35, 0.45),
  });
  drawRow("TOTALE", `€ ${fmtPrice(totale)}`, ctx.y - 64, true);
  ctx.y -= boxH + 20;
}

function drawNotesAndTerms(ctx: Ctx, q: QuoteContent, terms: string | null) {
  const { page, font, fontBold } = ctx;
  const innerW = PAGE_W - 2 * MARGIN_X;

  if (q.notes && q.notes.length > 0) {
    ensureSpace(ctx, 30);
    page.drawText("NOTE E CONDIZIONI", {
      x: MARGIN_X,
      y: ctx.y,
      size: 8,
      font: fontBold,
      color: NAVY,
    });
    ctx.y -= 14;
    q.notes.forEach((note, i) => {
      const lines = wrapText(`${i + 1}. ${note}`, font, 8, innerW);
      ensureSpace(ctx, lines.length * 11 + 4);
      for (const line of lines) {
        page.drawText(line, { x: MARGIN_X, y: ctx.y, size: 8, font, color: MUTED });
        ctx.y -= 11;
      }
      ctx.y -= 2;
    });
    ctx.y -= 10;
  }

  if (terms && terms.trim()) {
    ensureSpace(ctx, 40);
    page.drawText("CONDIZIONI CONTRATTUALI", {
      x: MARGIN_X,
      y: ctx.y,
      size: 8,
      font: fontBold,
      color: NAVY,
    });
    ctx.y -= 14;
    const lines = wrapText(terms, font, 8, innerW);
    for (const line of lines) {
      ensureSpace(ctx, 11);
      page.drawText(line, { x: MARGIN_X, y: ctx.y, size: 8, font, color: MUTED });
      ctx.y -= 11;
    }
    ctx.y -= 10;
  }
}

function drawSignature(ctx: Ctx) {
  const { page, font, fontBold } = ctx;
  ensureSpace(ctx, 80);
  ctx.y -= 10;
  const colW = (PAGE_W - 2 * MARGIN_X - 30) / 2;
  const drawBox = (x: number, label: string) => {
    page.drawLine({
      start: { x, y: ctx.y - 30 },
      end: { x: x + colW, y: ctx.y - 30 },
      thickness: 0.5,
      color: TEXT,
    });
    page.drawText(label, {
      x,
      y: ctx.y - 42,
      size: 7,
      font: fontBold,
      color: MUTED,
    });
  };
  drawBox(MARGIN_X, "PER ACCETTAZIONE — DATA E FIRMA DEL CLIENTE");
  drawBox(MARGIN_X + colW + 30, "LO STUDIO");
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

    // Fetch logo if any
    let logoBytes: Uint8Array | null = null;
    let logoMime: string | null = null;
    if (studio.logo_url) {
      try {
        const { data: file } = await supabase.storage
          .from("studio-assets")
          .download(studio.logo_url);
        if (file) {
          logoBytes = new Uint8Array(await file.arrayBuffer());
          logoMime = file.type || (studio.logo_url.endsWith(".png") ? "image/png" : "image/jpeg");
        }
      } catch {
        // skip logo
      }
    }

    const pdf = await PDFDocument.create();
    pdf.setTitle(data.quote.title);
    pdf.setProducer("Valora");
    pdf.setCreator("Valora");

    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const page = pdf.addPage([PAGE_W, PAGE_H]);
    const ctx: Ctx = { pdf, page, y: PAGE_H - MARGIN_TOP, font, fontBold, studio };
    drawFooter(ctx);

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

    const pdfBytes = await pdf.save();
    // Return as base64 (server functions serialize JSON)
    let binary = "";
    const chunk = 8192;
    for (let i = 0; i < pdfBytes.length; i += chunk) {
      binary += String.fromCharCode(...pdfBytes.subarray(i, i + chunk));
    }
    const base64 = btoa(binary);
    return { pdf: base64, filename: `Preventivo-${quoteNumber}.pdf` };
  });
