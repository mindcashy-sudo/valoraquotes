import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fs from 'fs';
import { transform } from 'sucrase';

const src = fs.readFileSync('src/server/pdf.functions.ts', 'utf8');
const start = src.indexOf('// === Layout');
const end = src.indexOf('const inputSchema');
let helpers = src.slice(start, end);
helpers = transform(helpers, { transforms: ['typescript'] }).code;
helpers = helpers.replace(/export /g, '');

const mockStudio = {
  studio_name: "Studio Architettura Rossi & Associati",
  architect_name: "Arch. Marco Rossi",
  vat_number: "12345678901", fiscal_code: null,
  address: "Via Giuseppe Verdi 42", city: "Milano", postal_code: "20121", province: "MI",
  phone: "+39 02 1234567", email: "info@studiorossi.it", pec: null, iban: null,
  albo_number: "A1234", logo_url: null,
  default_vat_percent: 22, default_validity_days: 30,
  default_terms: "Il presente preventivo ha validita' di 30 giorni. Acconto 30%, 40% a meta', saldo a fine lavori. Variazioni in corso d'opera saranno oggetto di preventivo separato.",
};
const mockQuote = {
  title: "Ristrutturazione completa appartamento 95 mq - Milano centro",
  description: "Ristrutturazione integrale con rifacimento impianti, sostituzione pavimenti, ridistribuzione interna, rifacimento bagni e cucina.",
  duration: "14-16 settimane", finishLevel: "Medio-alto",
  sections: [
    { name: "Demolizioni e opere preliminari", items: [
      { name: "Smontaggio sanitari e arredi bagno", price: 850 },
      { name: "Demolizione pavimenti esistenti (95 mq)", price: 2400 },
      { name: "Demolizione tramezza tra cucina e soggiorno", price: 650 },
      { name: "Smaltimento macerie e oneri di discarica", price: 1800 },
    ], subtotal: 5700 },
    { name: "Impianto elettrico", items: [
      { name: "Rifacimento completo impianto elettrico (95 mq)", price: 9500 },
      { name: "Quadro elettrico e certificazione", price: 1200 },
    ], subtotal: 10700 },
    { name: "Bagni", items: [
      { name: "Bagno principale completo - finiture medio-alte", price: 8500 },
      { name: "Bagno di servizio completo", price: 6200 },
    ], subtotal: 14700 },
    { name: "Pavimenti e finiture", items: [
      { name: "Fornitura e posa parquet rovere (75 mq)", price: 6750 },
      { name: "Pittura pareti e soffitti", price: 2850 },
    ], subtotal: 9600 },
  ],
  total: 40700,
  notes: ["IVA 22% (10% per ristrutturazioni con requisiti di legge).", "Opere strutturali a parte.", "Non include arredi ed elettrodomestici."],
};

const mod = new Function('PDFDocument', 'StandardFonts', 'rgb', `
${helpers}
return { drawHeader, drawClientBlock, drawTitleBlock, drawSections, drawTotals, drawNotesAndTerms, drawSignature, drawFooter, PAGE_W, PAGE_H, MT };
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
  validUntil: new Date(Date.now() + 30*86400000),
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
console.log('OK pages:', total);
