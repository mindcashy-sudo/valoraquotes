import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fs from 'fs';
import { transform } from 'sucrase';

const src = fs.readFileSync('src/server/pdf.functions.ts', 'utf8');
const start = src.indexOf('// === Layout');
const end = src.indexOf('const inputSchema');
let helpers = src.slice(start, end);
helpers = transform(helpers, { transforms: ['typescript'] }).code;
helpers = helpers.replace(/export /g, '');
helpers = helpers.replace(
  'function newPage(ctx) {\n  ctx.page = ctx.pdf.addPage([PAGE_W, PAGE_H]);\n  ctx.y = PAGE_H - MT;\n}',
  'function newPage(ctx) {\n  console.log("NEW PAGE; before count:", ctx.pdf.getPageCount());\n  ctx.page = ctx.pdf.addPage([PAGE_W, PAGE_H]);\n  ctx.y = PAGE_H - MT;\n  console.log("after count:", ctx.pdf.getPageCount(), "y:", ctx.y);\n}'
);
helpers = helpers.replace(
  'function drawTotals(ctx, q, vatPercent) {',
  'function drawTotals(ctx, q, vatPercent) { console.log("drawTotals ENTER y=", ctx.y);'
);
helpers = helpers.replace(
  'function drawSections(ctx, q) {',
  'function drawSections(ctx, q) { console.log("drawSections ENTER y=", ctx.y);'
);

const mockStudio = { studio_name: "Studio Architettura Rossi & Associati", architect_name: "Arch. Marco Rossi", vat_number: "12345678901", fiscal_code: null, address: "Via Giuseppe Verdi 42", city: "Milano", postal_code: "20121", province: "MI", phone: "+39 02 1234567", email: "info@studiorossi.it", pec: null, iban: null, albo_number: "A1234", logo_url: null, default_vat_percent: 22, default_validity_days: 30, default_terms: "Validita' 30 giorni." };
const mockQuote2 = { title: "Test", description: "desc", duration: "14 sett", finishLevel: "Medio", sections: [
  { name: "S1", items: [{name:"a",price:100},{name:"b",price:200}], subtotal: 300 },
  { name: "S2", items: [{name:"c",price:100}], subtotal: 100 },
  { name: "S3", items: [{name:"d",price:100}], subtotal: 100 },
  { name: "S4", items: [{name:"e",price:100}], subtotal: 100 },
], total: 600, notes: ["n1"] };

const mod = new Function('PDFDocument', 'StandardFonts', 'rgb', `
${helpers}
return { drawHeader, drawClientBlock, drawTitleBlock, drawSections, drawTotals, drawNotesAndTerms, drawSignature, drawFooter, PAGE_W, PAGE_H, MT };
`)(PDFDocument, StandardFonts, rgb);

const pdf = await PDFDocument.create();
const font = await pdf.embedFont(StandardFonts.Helvetica);
const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
const page = pdf.addPage([mod.PAGE_W, mod.PAGE_H]);
const ctx = { pdf, page, y: mod.PAGE_H - mod.MT, font, bold, studio: mockStudio };
console.log("INIT y=", ctx.y);
await mod.drawHeader(ctx, null, null);
console.log("after header y=", ctx.y);
mod.drawClientBlock(ctx, { clientName: "X", quoteNumber: "1", quoteDate: new Date(), validUntil: new Date() });
console.log("after client y=", ctx.y);
mod.drawTitleBlock(ctx, mockQuote);
console.log("after title y=", ctx.y);
mod.drawSections(ctx, mockQuote);
console.log("after sections y=", ctx.y, "pages=", pdf.getPageCount());
mod.drawTotals(ctx, mockQuote, 22);
console.log("after totals y=", ctx.y, "pages=", pdf.getPageCount());

const mockQuoteBig = { title: "Ristrutturazione completa appartamento 95 mq - Milano centro", description: "Ristrutturazione integrale.", duration: "14-16 settimane", finishLevel: "Medio-alto", sections: [
  { name: "Demolizioni e opere preliminari", items: [{name:"Smontaggio sanitari e arredi bagno",price:850},{name:"Demolizione pavimenti esistenti (95 mq)",price:2400},{name:"Demolizione tramezza tra cucina e soggiorno",price:650},{name:"Smaltimento macerie",price:1800}], subtotal: 5700 },
  { name: "Impianto elettrico", items: [{name:"Rifacimento completo impianto elettrico (95 mq)",price:9500},{name:"Quadro elettrico e certificazione",price:1200}], subtotal: 10700 },
  { name: "Bagni", items: [{name:"Bagno principale completo - finiture medio-alte",price:8500},{name:"Bagno di servizio completo",price:6200}], subtotal: 14700 },
  { name: "Pavimenti e finiture", items: [{name:"Fornitura e posa parquet rovere (75 mq)",price:6750},{name:"Pittura pareti e soffitti",price:2850}], subtotal: 9600 },
], total: 40700, notes: ["n1","n2","n3"] };

const pdf2 = await PDFDocument.create();
const f2 = await pdf2.embedFont(StandardFonts.Helvetica);
const b2 = await pdf2.embedFont(StandardFonts.HelveticaBold);
const pg2 = pdf2.addPage([mod.PAGE_W, mod.PAGE_H]);
const ctx2 = { pdf: pdf2, page: pg2, y: mod.PAGE_H - mod.MT, font: f2, bold: b2, studio: mockStudio };
console.log("\n=== BIG ===");
console.log("INIT y=", ctx2.y);
await mod.drawHeader(ctx2, null, null);
console.log("after header y=", ctx2.y);
mod.drawClientBlock(ctx2, { clientName: "Sig. Mario Bianchi", quoteNumber: "2026-001", quoteDate: new Date(), validUntil: new Date(), projectAddress: "Via Manzoni 12, Milano" });
console.log("after client y=", ctx2.y);
mod.drawTitleBlock(ctx2, mockQuoteBig);
console.log("after title y=", ctx2.y);
mod.drawSections(ctx2, mockQuoteBig);
console.log("after sections y=", ctx2.y, "pages=", pdf2.getPageCount(), "current page index in pdf:", pdf2.getPages().indexOf(ctx2.page));
mod.drawTotals(ctx2, mockQuoteBig, 22);
console.log("after totals y=", ctx2.y, "pages=", pdf2.getPageCount(), "current page index:", pdf2.getPages().indexOf(ctx2.page));
