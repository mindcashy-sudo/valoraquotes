// Standalone QA renderer that mirrors pdf.functions.ts drawing logic.
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fs from "fs";

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MX = 56;
const MT = 52;
const MB = 70;
const CONTENT_W = PAGE_W - 2 * MX;

const INK = rgb(0.06, 0.07, 0.1);
const TEXT = rgb(0.22, 0.24, 0.28);
const MUTED = rgb(0.5, 0.53, 0.58);
const HAIRLINE = rgb(0.88, 0.9, 0.93);
const PANEL = rgb(0.965, 0.97, 0.978);
const WHITE = rgb(1, 1, 1);

const fmtPrice = (n) => n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => d.toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" });
const eur = (n) => `€ ${fmtPrice(n)}`;

function sanitize(input) {
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

function wrap(text, font, size, maxW) {
  const safe = sanitize(text);
  if (!safe) return [];
  const out = [];
  for (const para of safe.split("\n")) {
    if (!para.trim()) { out.push(""); continue; }
    const words = para.split(/\s+/);
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) > maxW && line) { out.push(line); line = word; }
      else line = test;
    }
    if (line) out.push(line);
  }
  return out;
}

function dText(ctx, text, x, y, size, font, color = TEXT) {
  ctx.page.drawText(sanitize(text), { x, y, size, font, color });
}
function dTextRight(ctx, text, rightX, y, size, font, color = TEXT) {
  const safe = sanitize(text);
  const w = font.widthOfTextAtSize(safe, size);
  ctx.page.drawText(safe, { x: rightX - w, y, size, font, color });
}
function dRect(ctx, x, y, width, height, color) { ctx.page.drawRectangle({ x, y, width, height, color }); }
function dLine(ctx, x1, y1, x2, y2, thickness, color) {
  ctx.page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, color });
}
function newPage(ctx) { ctx.page = ctx.pdf.addPage([PAGE_W, PAGE_H]); ctx.y = PAGE_H - MT; }
function ensure(ctx, needed) { if (ctx.y - needed < MB) newPage(ctx); }

function drawEyebrow(ctx, label) {
  dText(ctx, label, MX, ctx.y, 7.5, ctx.bold, MUTED);
  ctx.y -= 8;
  dLine(ctx, MX, ctx.y, MX + 24, ctx.y, 1.2, INK);
  ctx.y -= 18;
}

function drawFooter(ctx, pageNum, pageTotal) {
  const { font, studio } = ctx;
  const y = 38;
  dLine(ctx, MX, y + 18, PAGE_W - MX, y + 18, 0.4, HAIRLINE);
  const left = [studio.studio_name, studio.vat_number ? `P.IVA ${studio.vat_number}` : null].filter(Boolean).join("   ·   ");
  const right = [studio.email, studio.phone].filter(Boolean).join("   ·   ");
  dText(ctx, left, MX, y, 7.5, font, MUTED);
  const center = `${pageNum} / ${pageTotal}`;
  const cw = font.widthOfTextAtSize(center, 7.5);
  dText(ctx, center, (PAGE_W - cw) / 2, y, 7.5, font, MUTED);
  dTextRight(ctx, right, PAGE_W - MX, y, 7.5, font, MUTED);
}

async function drawHeader(ctx) {
  const { font, bold, studio } = ctx;
  const top = PAGE_H - MT;
  const LOGO_BOX_W = 130, LOGO_BOX_H = 48, GUTTER = 32;
  const rightColX = MX + LOGO_BOX_W + GUTTER;
  const rightColW = PAGE_W - MX - rightColX;

  const name = studio.studio_name ?? "Studio";
  const lines = wrap(name, bold, 18, LOGO_BOX_W + GUTTER);
  let ly = top - 16;
  for (const line of lines.slice(0, 2)) { dText(ctx, line, MX, ly, 18, bold, INK); ly -= 21; }
  const leftBottom = ly;

  let yR = top - 4;
  const lineH = (s) => s + 4;
  const fit = (text, size, f) => {
    let s = sanitize(text);
    if (f.widthOfTextAtSize(s, size) <= rightColW) return s;
    while (s.length > 4 && f.widthOfTextAtSize(s + "...", size) > rightColW) s = s.slice(0, -1);
    return s + "...";
  };
  const drawR = (text, size, f, color = MUTED) => {
    if (!text) return;
    dTextRight(ctx, fit(text, size, f), PAGE_W - MX, yR, size, f, color);
    yR -= lineH(size);
  };
  if (studio.architect_name) drawR(studio.architect_name, 8.5, font, MUTED);
  if (studio.address) drawR(studio.address, 8, font, MUTED);
  const cityLine = [studio.postal_code, studio.city, studio.province ? `(${studio.province})` : null].filter(Boolean).join(" ");
  if (cityLine) drawR(cityLine, 8, font, MUTED);
  const contact = [studio.phone, studio.email].filter(Boolean).join("   ·   ");
  if (contact) drawR(contact, 8, font, MUTED);
  if (studio.pec) drawR(`PEC  ${studio.pec}`, 8, font, MUTED);
  const fiscal = [studio.vat_number ? `P.IVA ${studio.vat_number}` : null,
    studio.fiscal_code && studio.fiscal_code !== studio.vat_number ? `C.F. ${studio.fiscal_code}` : null]
    .filter(Boolean).join("   ·   ");
  if (fiscal) drawR(fiscal, 8, font, MUTED);
  if (studio.albo_number) drawR(`Albo n. ${studio.albo_number}`, 8, font, MUTED);

  ctx.y = Math.min(leftBottom, yR) - 18;
  dLine(ctx, MX, ctx.y, PAGE_W - MX, ctx.y, 0.5, INK);
  ctx.y -= 36;
}

function drawCoverPlate(ctx, opts) {
  const { font, bold } = ctx;
  ensure(ctx, 200);
  dText(ctx, "PREVENTIVO", MX, ctx.y, 8, bold, MUTED);
  ctx.y -= 22;
  const titleLines = wrap(opts.projectTitle, bold, 26, CONTENT_W);
  for (const line of titleLines.slice(0, 3)) {
    ensure(ctx, 32);
    dText(ctx, line, MX, ctx.y - 22, 26, bold, INK);
    ctx.y -= 30;
  }
  ctx.y -= 14;

  ensure(ctx, 70);
  dLine(ctx, MX, ctx.y, PAGE_W - MX, ctx.y, 0.4, HAIRLINE);
  ctx.y -= 16;
  const colW = CONTENT_W / 3;
  const labelY = ctx.y;
  const valueY = labelY - 14;
  const col = (i, label, value) => {
    const x = MX + colW * i;
    dText(ctx, label, x, labelY, 7, bold, MUTED);
    const valLines = wrap(value, bold, 11, colW - 14);
    let vy = valueY;
    for (const line of valLines.slice(0, 2)) { dText(ctx, line, x, vy, 11, bold, INK); vy -= 13; }
  };
  col(0, "PREVENTIVO N.", opts.quoteNumber);
  col(1, "DATA EMISSIONE", fmtDate(opts.quoteDate));
  col(2, "VALIDO FINO AL", fmtDate(opts.validUntil));
  ctx.y -= 36;
  dLine(ctx, MX, ctx.y, PAGE_W - MX, ctx.y, 0.4, HAIRLINE);
  ctx.y -= 26;

  ensure(ctx, 80);
  const halfW = (CONTENT_W - 32) / 2;
  dText(ctx, "INTESTATO A", MX, ctx.y, 7, bold, MUTED);
  if (opts.projectAddress) dText(ctx, "CANTIERE", MX + halfW + 32, ctx.y, 7, bold, MUTED);
  ctx.y -= 16;
  const clientLines = wrap(opts.clientName, bold, 14, halfW);
  let cy = ctx.y;
  for (const line of clientLines.slice(0, 2)) { dText(ctx, line, MX, cy, 14, bold, INK); cy -= 17; }
  if (opts.projectAddress) {
    const addrLines = wrap(opts.projectAddress, font, 11, halfW);
    let ay = ctx.y;
    for (const line of addrLines.slice(0, 3)) { dText(ctx, line, MX + halfW + 32, ay, 11, font, INK); ay -= 14; }
  }
  ctx.y = cy - 26;
}

function drawExecutiveSummary(ctx, q) {
  const { font, bold } = ctx;
  ensure(ctx, 160);
  drawEyebrow(ctx, "SINTESI DELL'OFFERTA");
  if (q.description) {
    const descLines = wrap(q.description, font, 10.5, CONTENT_W);
    for (const line of descLines.slice(0, 4)) {
      ensure(ctx, 16);
      dText(ctx, line, MX, ctx.y, 10.5, font, TEXT);
      ctx.y -= 16;
    }
    ctx.y -= 14;
  }
  const halfW = (CONTENT_W - 32) / 2;
  const specs = [
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

function drawSections(ctx, q) {
  const { font, bold } = ctx;
  ensure(ctx, 50);
  drawEyebrow(ctx, "DETTAGLIO LAVORAZIONI");
  ensure(ctx, 24);
  dText(ctx, "DESCRIZIONE", MX, ctx.y, 7, bold, MUTED);
  dTextRight(ctx, "IMPORTO", PAGE_W - MX, ctx.y, 7, bold, MUTED);
  ctx.y -= 8;
  dLine(ctx, MX, ctx.y, PAGE_W - MX, ctx.y, 0.6, INK);
  ctx.y -= 18;

  q.sections.forEach((section, si) => {
    ensure(ctx, 60);
    const num = String(si + 1).padStart(2, "0");
    dText(ctx, num, MX, ctx.y, 9, bold, MUTED);
    dText(ctx, section.name.toUpperCase(), MX + 28, ctx.y, 10.5, bold, INK);
    ctx.y -= 16;
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
        if (first) { dTextRight(ctx, priceStr, PAGE_W - MX, ily, 10.5, bold, INK); first = false; }
        ily -= 14;
      }
      ctx.y = rowTop - rowH;
      if (ii < section.items.length - 1) dLine(ctx, MX, ctx.y + 6, PAGE_W - MX, ctx.y + 6, 0.3, HAIRLINE);
    });
    ensure(ctx, 40);
    dLine(ctx, MX, ctx.y + 4, PAGE_W - MX, ctx.y + 4, 0.8, INK);
    ctx.y -= 18;
    dText(ctx, `Subtotale  ${section.name}`.toUpperCase(), MX, ctx.y, 8, bold, MUTED);
    dTextRight(ctx, eur(section.subtotal), PAGE_W - MX, ctx.y - 1, 12, bold, INK);
    ctx.y -= si === q.sections.length - 1 ? 32 : 38;
  });
}

function drawTotals(ctx, q, vatPercent) {
  const imponibile = q.total;
  const iva = imponibile * (vatPercent / 100);
  const totale = imponibile + iva;
  const { font, bold } = ctx;
  ensure(ctx, 160);
  ctx.y -= 4;
  const lineRow = (label, value) => {
    ensure(ctx, 22);
    dText(ctx, label.toUpperCase(), MX, ctx.y, 8, bold, MUTED);
    dTextRight(ctx, value, PAGE_W - MX, ctx.y - 1, 12, bold, INK);
    ctx.y -= 14;
    dLine(ctx, MX, ctx.y, PAGE_W - MX, ctx.y, 0.4, HAIRLINE);
    ctx.y -= 14;
  };
  lineRow("Imponibile", eur(imponibile));
  lineRow(`IVA  ${vatPercent}%`, eur(iva));
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

function drawNotes(ctx, q) {
  const { font, bold } = ctx;
  const notes = q.notes;
  ensure(ctx, 50);
  drawEyebrow(ctx, "NOTE E CONDIZIONI");
  notes.forEach((note) => {
    const indent = 16;
    const lines = wrap(note, font, 9.5, CONTENT_W - indent);
    ensure(ctx, lines.length * 13 + 8);
    dRect(ctx, MX + 2, ctx.y - 4, 3, 3, INK);
    let ly = ctx.y;
    for (const line of lines) { dText(ctx, line, MX + indent, ly, 9.5, font, TEXT); ly -= 13; }
    ctx.y = ly - 6;
  });
  ctx.y -= 6;
}

function drawAcceptance(ctx, studio) {
  const { font, bold } = ctx;
  ensure(ctx, 160);
  ctx.y -= 6;
  drawEyebrow(ctx, "ACCETTAZIONE");
  const stmt = "Per accettazione integrale dei termini economici e tecnici riportati nel presente preventivo, il Cliente sottoscrive di seguito.";
  const lines = wrap(stmt, font, 9.5, CONTENT_W);
  for (const line of lines) { dText(ctx, line, MX, ctx.y, 9.5, font, TEXT); ctx.y -= 14; }
  ctx.y -= 24;
  const colW = (CONTENT_W - 48) / 2;
  dText(ctx, "LUOGO E DATA", MX, ctx.y, 7, bold, MUTED);
  dLine(ctx, MX + 80, ctx.y + 2, MX + colW, ctx.y + 2, 0.5, INK);
  ctx.y -= 56;
  const lineY = ctx.y;
  dLine(ctx, MX, lineY, MX + colW, lineY, 0.6, INK);
  dText(ctx, "FIRMA DEL CLIENTE", MX, lineY - 14, 7, bold, MUTED);
  const sx = MX + colW + 48;
  dLine(ctx, sx, lineY, sx + colW, lineY, 0.6, INK);
  dText(ctx, "PER LO STUDIO", sx, lineY - 14, 7, bold, MUTED);
  if (studio.architect_name) dText(ctx, studio.architect_name, sx, lineY - 28, 9.5, bold, INK);
  ctx.y -= 60;
}

const studio = {
  studio_name: "Studio Marini Architetti",
  architect_name: "Arch. Lorenzo Marini",
  vat_number: "12345678901",
  fiscal_code: "MRNLNZ80A01H501Z",
  address: "Via della Spiga 18",
  city: "Milano",
  postal_code: "20121",
  province: "MI",
  phone: "+39 02 7600 4521",
  email: "studio@marini-architetti.it",
  pec: "marini@pec.architettimi.it",
  iban: null,
  albo_number: "12345 Ordine Architetti Milano",
  logo_url: null,
  default_vat_percent: 22,
  default_validity_days: 30,
  default_terms: null,
};

const quote = {
  title: "Ristrutturazione Integrale Appartamento - 95 mq - Milano, Porta Romana",
  description: "Ristrutturazione completa di appartamento residenziale al terzo piano. Rifacimento totale impianti, pavimenti, due bagni e cucina. Finiture di fascia media-alta con possibilita' di upgrade su rivestimenti.",
  duration: "10-12 settimane",
  finishLevel: "Fascia media estesa",
  sections: [
    {
      name: "Opere edili",
      items: [
        { name: "Demolizione tramezzi interni e smaltimento macerie, 45 mq", price: 4200 },
        { name: "Rimozione pavimenti e massetto esistenti, 95 mq", price: 3800 },
        { name: "Tracce per impianti elettrici e idraulici, 180 ml", price: 2700 },
        { name: "Massetto autolivellante, 95 mq", price: 5200 },
        { name: "Costruzione nuovi tramezzi in cartongesso, 32 mq", price: 3600 },
        { name: "Ponteggi, protezioni cantiere e oneri sicurezza", price: 2400 },
      ],
      subtotal: 21900,
    },
    {
      name: "Impianti",
      items: [
        { name: "Impianto elettrico completo, certificazione inclusa, 95 mq", price: 11400 },
        { name: "Impianto idraulico, adeguamento e nuove derivazioni, 95 mq", price: 9500 },
        { name: "Punti luce comandati e prese, 42 cad", price: 3200 },
        { name: "Caldaia a condensazione + termoarredi bagni, 6 cad", price: 5800 },
      ],
      subtotal: 29900,
    },
    {
      name: "Finiture interne",
      items: [
        { name: "Posa parquet rovere prefinito, fornitura inclusa, 70 mq", price: 9800 },
        { name: "Rivestimento bagno padronale h.220, 28 mq", price: 4600 },
        { name: "Rivestimento secondo bagno h.220, 22 mq", price: 3400 },
        { name: "Sanitari sospesi e rubinetteria, 2 bagni completi", price: 6800 },
        { name: "Tinteggiatura pareti e soffitti, 280 mq", price: 3200 },
      ],
      subtotal: 27800,
    },
    {
      name: "Serramenti",
      items: [
        { name: "Porte interne in laminato premium, 7 cad", price: 4900 },
        { name: "Porta blindata classe 3 con rivestimento, 1 cad", price: 2800 },
      ],
      subtotal: 7700,
    },
  ],
  total: 87300,
  notes: [
    "Prezzi soggetti a verifica delle quantita' effettive a misura in fase esecutiva.",
    "Eventuali varianti in corso d'opera saranno contabilizzate previa accettazione scritta.",
    "Non sono inclusi pratiche edilizie, oneri comunali, direzione lavori e progettazione.",
    "L'offerta non comprende arredi, elettrodomestici e mobili cucina.",
    "Tempi indicativi, soggetti a verifica disponibilita' materiali e condizioni di cantiere.",
    "IVA esclusa ove applicabile, in fattura secondo aliquota di legge.",
  ],
};

(async () => {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([PAGE_W, PAGE_H]);
  const ctx = { pdf, page, y: PAGE_H - MT, font, bold, studio };
  await drawHeader(ctx);
  drawCoverPlate(ctx, {
    clientName: "Famiglia Bianchi - Sig. Andrea Bianchi",
    quoteNumber: "2026-0042",
    quoteDate: new Date(2026, 3, 30),
    validUntil: new Date(2026, 4, 30),
    projectAddress: "Via Vincenzo Monti 14, 20123 Milano (MI)",
    projectTitle: quote.title,
  });
  drawExecutiveSummary(ctx, quote);
  drawSections(ctx, quote);
  drawTotals(ctx, quote, 22);
  drawNotes(ctx, quote);
  drawAcceptance(ctx, studio);
  const total = pdf.getPageCount();
  for (let i = 0; i < total; i++) { ctx.page = pdf.getPage(i); drawFooter(ctx, i + 1, total); }
  const bytes = await pdf.save();
  fs.writeFileSync("/tmp/qa.pdf", bytes);
  console.log("OK", bytes.length, "pages:", total);
})();
