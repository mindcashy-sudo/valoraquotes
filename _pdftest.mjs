// Reproduce the PDF layout standalone with mock data
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fs from 'fs';

// Copy the source as-is but stub auth
const src = fs.readFileSync('src/server/pdf.functions.ts', 'utf8');

// Extract just the helper functions block
const start = src.indexOf('// === Layout');
const end = src.indexOf('const inputSchema');
const helpers = src.slice(start, end);

const mockStudio = {
  studio_name: "Studio Architettura Rossi & Associati",
  architect_name: "Arch. Marco Rossi",
  vat_number: "12345678901",
  fiscal_code: null,
  address: "Via Giuseppe Verdi 42",
  city: "Milano",
  postal_code: "20121",
  province: "MI",
  phone: "+39 02 1234567",
  email: "info@studiorossi.it",
  pec: null,
  iban: null,
  albo_number: "A1234",
  logo_url: null,
  default_vat_percent: 22,
  default_validity_days: 30,
  default_terms: "Il presente preventivo ha validita' di 30 giorni dalla data di emissione. I prezzi si intendono al netto di IVA. Acconto del 30% all'inizio lavori, 40% a meta' lavori, saldo a fine lavori. Eventuali variazioni in corso d'opera saranno oggetto di preventivo separato e dovranno essere approvate per iscritto dal committente.",
};

const mockQuote = {
  title: "Ristrutturazione completa appartamento 95 mq - Milano centro",
  description: "Ristrutturazione integrale di appartamento con rifacimento impianti elettrico e idraulico, sostituzione pavimenti, ridistribuzione interna con spostamento di una parete, rifacimento dei due bagni e della cucina.",
  duration: "14-16 settimane",
  finishLevel: "Medio-alto",
  sections: [
    {
      name: "Demolizioni e opere preliminari",
      items: [
        { name: "Smontaggio sanitari, rubinetterie e arredi bagno", price: 850 },
        { name: "Demolizione pavimenti esistenti (95 mq)", price: 2400 },
        { name: "Demolizione tramezza tra cucina e soggiorno", price: 650 },
        { name: "Smaltimento macerie e oneri di discarica", price: 1800 },
      ],
      subtotal: 5700,
    },
    {
      name: "Impianto elettrico",
      items: [
        { name: "Rifacimento completo impianto elettrico (95 mq)", price: 9500 },
        { name: "Quadro elettrico e certificazione", price: 1200 },
      ],
      subtotal: 10700,
    },
    {
      name: "Impianto idraulico e riscaldamento",
      items: [
        { name: "Rifacimento impianto idraulico", price: 7600 },
        { name: "Sostituzione caldaia a condensazione", price: 2800 },
        { name: "Predisposizione climatizzazione 3 split", price: 1900 },
      ],
      subtotal: 12300,
    },
    {
      name: "Bagni",
      items: [
        { name: "Bagno principale completo - finiture medio-alte", price: 8500 },
        { name: "Bagno di servizio completo", price: 6200 },
      ],
      subtotal: 14700,
    },
    {
      name: "Pavimenti e finiture",
      items: [
        { name: "Fornitura e posa parquet rovere (75 mq)", price: 6750 },
        { name: "Pittura pareti e soffitti", price: 2850 },
        { name: "Battiscopa in legno", price: 720 },
      ],
      subtotal: 10320,
    },
  ],
  total: 53720,
  notes: [
    "I prezzi indicati sono al netto di IVA al 22% (10% per ristrutturazioni con i requisiti di legge).",
    "Eventuali opere strutturali richiederanno pratica edilizia a parte.",
    "Il preventivo non include arredi, elettrodomestici e illuminazione.",
  ],
};

// Eval helpers in this scope
const code = helpers
  .replace(/import.*?from.*?;/g, '')
  .replace(/export /g, '');

// Build the module dynamically
const mod = new Function('PDFDocument', 'StandardFonts', 'rgb', `
${code}
return { drawHeader, drawClientBlock, drawTitleBlock, drawSections, drawTotals, drawNotesAndTerms, drawSignature, drawFooter, sanitize, PAGE_W, PAGE_H, MT };
`)(PDFDocument, StandardFonts, rgb);

const pdf = await PDFDocument.create();
const font = await pdf.embedFont(StandardFonts.Helvetica);
const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
const page = pdf.addPage([mod.PAGE_W, mod.PAGE_H]);
const ctx = { pdf, page, y: mod.PAGE_H - mod.MT, font, bold, studio: mockStudio };

await mod.drawHeader(ctx, null, null);
mod.drawClientBlock(ctx, {
  clientName: "Sig. Mario Bianchi",
  quoteNumber: "2026-0430-001",
  quoteDate: new Date(),
  validUntil: new Date(Date.now() + 30*24*60*60*1000),
  projectAddress: "Via Manzoni 12, 20121 Milano (MI)",
});
mod.drawTitleBlock(ctx, mockQuote);
mod.drawSections(ctx, mockQuote);
mod.drawTotals(ctx, mockQuote, 22);
mod.drawNotesAndTerms(ctx, mockQuote, mockStudio.default_terms);
mod.drawSignature(ctx);

const total = pdf.getPageCount();
for (let i = 0; i < total; i++) {
  ctx.page = pdf.getPage(i);
  mod.drawFooter(ctx, i+1, total);
}

const bytes = await pdf.save();
fs.writeFileSync('/tmp/pdftest/out.pdf', bytes);
console.log('written', bytes.length, 'pages:', total);
