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
const mockQuote = { title: "Test", description: "desc", duration: "14 sett", finishLevel: "Medio", sections: [
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
