import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fs from 'fs';
import { transform } from 'sucrase';

const src = fs.readFileSync('src/server/pdf.functions.ts', 'utf8');
const start = src.indexOf('// === Layout');
const end = src.indexOf('const inputSchema');
let helpers = src.slice(start, end);
helpers = transform(helpers, { transforms: ['typescript'] }).code;
helpers = helpers.replace(/export /g, '');
// Patch: add logging
helpers = helpers.replace('function newPage(ctx)', 'function newPage(ctx) { console.log("NEW PAGE, prev pages:", ctx.pdf.getPageCount());');
