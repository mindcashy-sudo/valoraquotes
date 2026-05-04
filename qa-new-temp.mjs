// Mirror of new pdf.functions.ts for QA
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fs from "fs";

const PAGE_W = 595.28, PAGE_H = 841.89;
const SIDEBAR_W = 200, HEADER_H = 170, FOOTER_BLOCK_H = 230;
const MX = 40, MT = HEADER_H + 28, MB = FOOTER_BLOCK_H + 30;
const CONTENT_W = PAGE_W - 2 * MX;

const INK = rgb(0.09, 0.11, 0.14);
const TEXT = rgb(0.22, 0.24, 0.28);
const MUTED = rgb(0.5, 0.53, 0.58);
const HAIRLINE = rgb(0.86, 0.88, 0.91);
const ROW_ALT = rgb(0.957, 0.965, 0.972);
const WHITE = rgb(1, 1, 1);
const SOFT_WHITE = rgb(0.78, 0.82, 0.88);

const fmtPrice = (n)=>n.toLocaleString("it-IT",{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtDate = (d)=>d.toLocaleDateString("it-IT",{day:"2-digit",month:"short",year:"numeric"});
const eur = (n)=>`€ ${fmtPrice(n)}`;
const sanitize = (s)=>s? s.replace(/[\u2018\u2019]/g,"'").replace(/[\u2013\u2014]/g,"-").replace(/[^\x09\x0A\x0D\x20-\x7E\u00A1-\u00FF\u20AC]/g,""):"";
function wrap(text,font,size,maxW){const safe=sanitize(text);if(!safe)return [];const out=[];for(const para of safe.split("\n")){if(!para.trim()){out.push("");continue;}const words=para.split(/\s+/);let line="";for(const w of words){const t=line?`${line} ${w}`:w;if(font.widthOfTextAtSize(t,size)>maxW&&line){out.push(line);line=w;}else line=t;}if(line)out.push(line);}return out;}
const dText=(c,t,x,y,s,f,col=TEXT)=>c.page.drawText(sanitize(t),{x,y,size:s,font:f,color:col});
const dTextRight=(c,t,rx,y,s,f,col=TEXT)=>{const sa=sanitize(t);const w=f.widthOfTextAtSize(sa,s);c.page.drawText(sa,{x:rx-w,y,size:s,font:f,color:col});};
const dRect=(c,x,y,w,h,col)=>c.page.drawRectangle({x,y,width:w,height:h,color:col});
const dLine=(c,x1,y1,x2,y2,th,col)=>c.page.drawLine({start:{x:x1,y:y1},end:{x:x2,y:y2},thickness:th,color:col});

function drawContinuationHeader(ctx){
  const top=PAGE_H-30;
  dLine(ctx,MX,top-20,PAGE_W-MX,top-20,0.5,HAIRLINE);
  dText(ctx,ctx.studio.studio_name||"Preventivo",MX,top-14,9,ctx.bold,INK);
  dTextRight(ctx,"PREVENTIVO — segue",PAGE_W-MX,top-14,8,ctx.font,MUTED);
}
function newPage(ctx){ctx.page=ctx.pdf.addPage([PAGE_W,PAGE_H]);ctx.pageIndex+=1;drawContinuationHeader(ctx);ctx.y=PAGE_H-MT+40;}
function ensure(ctx,n){if(ctx.y-n<MB)newPage(ctx);}

async function drawPageOneHeader(ctx,quoteNumber,quoteDate,validUntil){
  const{font,bold,studio}=ctx;
  const headerTop=PAGE_H, headerBottom=PAGE_H-HEADER_H;
  dRect(ctx,0,headerBottom,SIDEBAR_W,HEADER_H,INK);
  const brandPad=22; let by=headerTop-36;
  if(studio.studio_name){const lines=wrap(studio.studio_name,bold,16,SIDEBAR_W-brandPad*2);for(const l of lines.slice(0,2)){dText(ctx,l,brandPad,by,16,bold,WHITE);by-=19;}by-=4;}
  if(studio.architect_name){dText(ctx,studio.architect_name.toUpperCase(),brandPad,by,7,bold,SOFT_WHITE);by-=12;}
  dLine(ctx,brandPad,by-2,brandPad+28,by-2,1,SOFT_WHITE);by-=14;
  const contactLines=[];
  if(studio.address)contactLines.push(studio.address);
  const cityLine=[studio.postal_code,studio.city].filter(Boolean).join(" ");
  if(cityLine)contactLines.push(cityLine);
  if(studio.phone)contactLines.push(studio.phone);
  if(studio.email)contactLines.push(studio.email);
  for(const line of contactLines.slice(0,5)){if(by<headerBottom+14)break;const fitted=wrap(line,font,7.5,SIDEBAR_W-brandPad*2)[0]||line;dText(ctx,fitted,brandPad,by,7.5,font,SOFT_WHITE);by-=11;}
  const rx=SIDEBAR_W+40, rRight=PAGE_W-MX;
  dText(ctx,"PREVENTIVO",rx,headerTop-70,36,bold,INK);
  const metaY1=headerTop-110,metaY2=headerTop-128;
  dText(ctx,"Numero",rx,metaY1,9,bold,INK);
  dTextRight(ctx,quoteNumber,rRight,metaY1,10,font,INK);
  dText(ctx,"Data",rx,metaY2,9,bold,INK);
  dTextRight(ctx,fmtDate(quoteDate),rRight,metaY2,10,font,INK);
  dText(ctx,`Valido fino al ${fmtDate(validUntil)}`,rx,headerBottom+18,8,font,MUTED);
  ctx.y=headerBottom-28;
}

function drawProjectIntro(ctx,q,clientName,projectAddress){
  const{font,bold}=ctx;ensure(ctx,100);
  const leftW=SIDEBAR_W-MX-8;
  const rightX=SIDEBAR_W+40;
  const rightW=PAGE_W-MX-rightX;
  const top=ctx.y;
  dText(ctx,"INTESTATO A",MX,top,7.5,bold,MUTED);
  let ly=top-14;
  const cLines=wrap(clientName,bold,11,leftW);
  for(const l of cLines.slice(0,2)){dText(ctx,l,MX,ly,11,bold,INK);ly-=14;}
  if(projectAddress){ly-=4;dText(ctx,"CANTIERE",MX,ly,7.5,bold,MUTED);ly-=12;const aLines=wrap(projectAddress,font,9,leftW);for(const l of aLines.slice(0,3)){dText(ctx,l,MX,ly,9,font,TEXT);ly-=12;}}
  const leftBottom=ly;
  let ry=top;
  dText(ctx,"PROGETTO",rightX,ry,7.5,bold,MUTED);ry-=16;
  const tLines=wrap(q.title,bold,16,rightW);
  for(const l of tLines.slice(0,3)){dText(ctx,l,rightX,ry,16,bold,INK);ry-=19;}
  if(q.description){ry-=4;const dl=wrap(q.description,font,9.5,rightW);for(const l of dl.slice(0,4)){dText(ctx,l,rightX,ry,9.5,font,TEXT);ry-=13;}}
  ry-=6;
  const chip=(label,val,x)=>{const labelText=label.toUpperCase();const labelW=bold.widthOfTextAtSize(labelText,7);const valW=bold.widthOfTextAtSize(val,9);const w=Math.max(labelW,valW)+22;dRect(ctx,x,ry-26,w,28,ROW_ALT);dText(ctx,labelText,x+10,ry-8,7,bold,MUTED);dText(ctx,val,x+10,ry-22,9,bold,INK);return x+w+10;};
  let cx=rightX; cx=chip("Durata",q.duration,cx); chip("Finiture",q.finishLevel,cx); ry-=32;
  ctx.y=Math.min(leftBottom,ry)-18;
}

function drawSections(ctx,q){
  const{font,bold}=ctx;
  const COL_NUM_X=MX+6,COL_NUM_W=28,COL_DESC_X=COL_NUM_X+COL_NUM_W;
  const COL_PRICE_RIGHT=PAGE_W-MX-12,COL_PRICE_LABEL_W=90;
  const COL_DESC_W=COL_PRICE_RIGHT-COL_PRICE_LABEL_W-COL_DESC_X-8;
  ensure(ctx,40);
  const headerY=ctx.y;
  dRect(ctx,MX,headerY-26,CONTENT_W,26,INK);
  dText(ctx,"N.",COL_NUM_X,headerY-17,8,bold,WHITE);
  dText(ctx,"DESCRIZIONE LAVORAZIONE",COL_DESC_X,headerY-17,8,bold,WHITE);
  dTextRight(ctx,"IMPORTO",COL_PRICE_RIGHT,headerY-17,8,bold,WHITE);
  ctx.y=headerY-26-14;
  let rowCounter=0;
  q.sections.forEach((section,si)=>{
    ensure(ctx,30);
    const stTop=ctx.y;
    dText(ctx,`${String(si+1).padStart(2,"0")}  ${section.name.toUpperCase()}`,MX+6,stTop-6,9,bold,INK);
    dLine(ctx,MX,stTop-14,PAGE_W-MX,stTop-14,0.6,INK);
    ctx.y=stTop-22;
    section.items.forEach((item)=>{
      rowCounter+=1;
      const priceStr=eur(item.price);
      const nameLines=wrap(item.name,font,9.5,COL_DESC_W);
      const rowH=Math.max(nameLines.length*13,13)+16;
      ensure(ctx,rowH+2);
      const rowTop=ctx.y;
      if(rowCounter%2===0)dRect(ctx,MX,rowTop-rowH,CONTENT_W,rowH,ROW_ALT);
      dText(ctx,String(rowCounter),COL_NUM_X,rowTop-13,9,bold,MUTED);
      let ily=rowTop-13;let first=true;
      for(const line of nameLines){dText(ctx,line,COL_DESC_X,ily,9.5,font,TEXT);if(first){dTextRight(ctx,priceStr,COL_PRICE_RIGHT,ily,10,bold,INK);first=false;}ily-=13;}
      ctx.y=rowTop-rowH;
    });
    ensure(ctx,26);
    const stbY=ctx.y;
    dText(ctx,`Subtotale ${section.name}`.toUpperCase(),COL_DESC_X,stbY-14,8,bold,MUTED);
    dTextRight(ctx,eur(section.subtotal),COL_PRICE_RIGHT,stbY-14,11,bold,INK);
    dLine(ctx,MX,stbY-22,PAGE_W-MX,stbY-22,0.4,HAIRLINE);
    ctx.y=stbY-32;
  });
}

function drawNotes(ctx,q,vatPercent){
  const{font,bold}=ctx;
  const cleaned=(q.notes||[]).filter(n=>!/iva\s+esclusa/i.test(n)&&!/oltre\s+iva/i.test(n));
  const defaults=[`Importi comprensivi di IVA al ${vatPercent}%.`,"Varianti in corso d'opera contabilizzate previa accettazione scritta.","Tempi indicativi soggetti a verifica in fase esecutiva."];
  const notes=cleaned.length>=2?cleaned:defaults;
  if(!notes.length)return;
  ensure(ctx,40);
  dText(ctx,"NOTE",MX+6,ctx.y,8,bold,MUTED);
  dLine(ctx,MX,ctx.y-6,PAGE_W-MX,ctx.y-6,0.4,HAIRLINE);
  ctx.y-=16;
  notes.forEach((note)=>{
    const lines=wrap(note,font,8.5,CONTENT_W-18);
    ensure(ctx,lines.length*12+6);
    dText(ctx,"·",MX+6,ctx.y,9,bold,INK);
    let ly=ctx.y;for(const l of lines){dText(ctx,l,MX+18,ly,8.5,font,TEXT);ly-=12;}
    ctx.y=ly-4;
  });
  ctx.y-=6;
}

function drawFooterBlock(ctx,q,vatPercent,studio,clientName,projectAddress,termsText){
  const{font,bold}=ctx;
  if(ctx.y<MB+40)newPage(ctx);
  const blockHeight=FOOTER_BLOCK_H;
  dRect(ctx,0,0,SIDEBAR_W,blockHeight,INK);
  const sx=22; let sy=blockHeight-24;
  dText(ctx,"INTESTATO A",sx,sy,8,bold,SOFT_WHITE);sy-=14;
  const cLines=wrap(clientName,bold,11,SIDEBAR_W-sx*2);
  for(const l of cLines.slice(0,2)){dText(ctx,l,sx,sy,11,bold,WHITE);sy-=14;}
  if(projectAddress){sy-=4;const aLines=wrap(projectAddress,font,8.5,SIDEBAR_W-sx*2);for(const l of aLines.slice(0,3)){dText(ctx,l,sx,sy,8.5,font,SOFT_WHITE);sy-=11;}}
  sy-=10;dLine(ctx,sx,sy,sx+28,sy,1,SOFT_WHITE);sy-=12;
  dText(ctx,"CONDIZIONI",sx,sy,8,bold,SOFT_WHITE);sy-=12;
  const defaultTerms=termsText&&termsText.trim()?termsText:`Importi comprensivi di IVA al ${vatPercent}%. Eventuali varianti saranno contabilizzate previa accettazione scritta. Tempi indicativi soggetti a verifica in fase esecutiva.`;
  const tLines=wrap(defaultTerms,font,7.5,SIDEBAR_W-sx*2);
  for(const l of tLines){if(sy<14)break;dText(ctx,l,sx,sy,7.5,font,SOFT_WHITE);sy-=10;}
  const rx=SIDEBAR_W+30,rRight=PAGE_W-MX;
  let ry=blockHeight-24;
  dText(ctx,"Grazie per la fiducia",rx,ry,11,bold,INK);ry-=18;
  if(studio.iban||studio.email){
    dText(ctx,"DATI PAGAMENTO",rx,ry,7.5,bold,MUTED);ry-=12;
    if(studio.iban){dText(ctx,"IBAN",rx,ry,8,bold,INK);dText(ctx,studio.iban,rx+50,ry,8,font,TEXT);ry-=11;}
    if(studio.studio_name){dText(ctx,"Beneficiario",rx,ry,8,bold,INK);dText(ctx,studio.studio_name,rx+64,ry,8,font,TEXT);ry-=11;}
    ry-=6;
  }
  const imp=q.total, iva=imp*(vatPercent/100), tot=imp+iva;
  const totRow=(label,val,size=9,color=INK,weight=bold)=>{dText(ctx,label,rx,ry,size,bold,MUTED);dTextRight(ctx,val,rRight,ry,size+1,weight,color);ry-=16;};
  totRow("Imponibile",eur(imp));
  totRow(`IVA ${vatPercent}%`,eur(iva));
  dLine(ctx,rx,ry+6,rRight,ry+6,0.5,HAIRLINE);ry-=6;
  dText(ctx,"TOTALE",rx,ry-6,11,bold,INK);
  dTextRight(ctx,eur(tot),rRight,ry-10,20,bold,INK);
  ry-=32;
  const sigY=38;
  dLine(ctx,rx,sigY+14,rx+180,sigY+14,0.6,INK);
  dText(ctx,"Firma per accettazione",rx,sigY,8,bold,MUTED);
  if(studio.architect_name){dTextRight(ctx,studio.architect_name,rRight,sigY,8,bold,INK);dTextRight(ctx,"Per lo studio",rRight,sigY-11,7.5,font,MUTED);}
}

const studio={studio_name:"Studio Marini Architetti",architect_name:"Arch. Lorenzo Marini",vat_number:"12345678901",fiscal_code:"MRNLNZ80A01H501Z",address:"Via della Spiga 18",city:"Milano",postal_code:"20121",province:"MI",phone:"+39 02 7600 4521",email:"studio@marini-architetti.it",pec:"marini@pec.architettimi.it",iban:"IT60 X054 2811 1010 0000 0123 456",albo_number:"12345",logo_url:null,default_vat_percent:22,default_validity_days:30,default_terms:null};
const quote={title:"Ristrutturazione Integrale Appartamento - 95 mq - Milano, Porta Romana",description:"Ristrutturazione completa di appartamento residenziale al terzo piano. Rifacimento totale impianti, pavimenti, due bagni e cucina. Finiture di fascia media-alta.",duration:"10-12 settimane",finishLevel:"Fascia media",sections:[
{name:"Opere edili",items:[{name:"Demolizione tramezzi interni e smaltimento macerie, 45 mq",price:4200},{name:"Rimozione pavimenti e massetto esistenti, 95 mq",price:3800},{name:"Tracce per impianti elettrici e idraulici, 180 ml",price:2700},{name:"Massetto autolivellante, 95 mq",price:5200},{name:"Costruzione nuovi tramezzi in cartongesso, 32 mq",price:3600},{name:"Ponteggi, protezioni cantiere e oneri sicurezza",price:2400}],subtotal:21900},
{name:"Impianti",items:[{name:"Impianto elettrico completo, certificazione inclusa, 95 mq",price:11400},{name:"Impianto idraulico, adeguamento e nuove derivazioni, 95 mq",price:9500},{name:"Punti luce comandati e prese, 42 cad",price:3200},{name:"Caldaia a condensazione + termoarredi bagni, 6 cad",price:5800}],subtotal:29900},
{name:"Finiture interne",items:[{name:"Posa parquet rovere prefinito, fornitura inclusa, 70 mq",price:9800},{name:"Rivestimento bagno padronale h.220, 28 mq",price:4600},{name:"Rivestimento secondo bagno h.220, 22 mq",price:3400},{name:"Sanitari sospesi e rubinetteria, 2 bagni completi",price:6800},{name:"Tinteggiatura pareti e soffitti, 280 mq",price:3200}],subtotal:27800},
{name:"Serramenti",items:[{name:"Porte interne in laminato premium, 7 cad",price:4900},{name:"Porta blindata classe 3 con rivestimento, 1 cad",price:2800}],subtotal:7700},
],total:87300,notes:["Prezzi soggetti a verifica delle quantita' a misura.","Varianti in corso d'opera contabilizzate previa accettazione scritta.","Non inclusi pratiche edilizie, oneri comunali e direzione lavori.","L'offerta non comprende arredi e mobili cucina."]};

(async()=>{
  const pdf=await PDFDocument.create();
  const font=await pdf.embedFont(StandardFonts.Helvetica);
  const bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  const page=pdf.addPage([PAGE_W,PAGE_H]);
  const ctx={pdf,page,y:PAGE_H-MT,font,bold,studio,pageIndex:0};
  await drawPageOneHeader(ctx,"2026-0042",new Date(2026,3,30),new Date(2026,4,30));
  drawProjectIntro(ctx,quote,"Famiglia Bianchi - Sig. Andrea Bianchi","Via Vincenzo Monti 14, 20123 Milano (MI)");
  drawSections(ctx,quote);
  drawNotes(ctx,quote,22);
  if(ctx.y<MB+30){ctx.page=pdf.addPage([PAGE_W,PAGE_H]);ctx.pageIndex+=1;drawContinuationHeader(ctx);ctx.y=PAGE_H-70;}
  drawFooterBlock(ctx,quote,22,studio,"Famiglia Bianchi - Sig. Andrea Bianchi","Via Vincenzo Monti 14, 20123 Milano (MI)",null);
  const total=pdf.getPageCount();
  for(let i=1;i<total;i++){const p=pdf.getPage(i);const txt=`${i+1} / ${total}`;const w=font.widthOfTextAtSize(txt,7.5);p.drawText(txt,{x:(PAGE_W-w)/2,y:18,size:7.5,font,color:MUTED});}
  const bytes=await pdf.save();
  fs.writeFileSync("/tmp/qa-new.pdf",bytes);
  console.log("OK pages:",total);
})();
