## Tesi
Una chatbot AI "sputa testo". Valora deve diventare il **sistema operativo del preventivo** per architetti italiani: dati reali, integrazioni col mondo fisico (catasto, listini, firme, banche), memoria del singolo studio, output che hanno valore legale e operativo. Più Valora viene usato, più diventa difficile uscirne (lock-in sano fatto di dati, listino personale, storico clienti, firme raccolte).

Obiettivo strategico: passare da "genera un preventivo" a "**chiudi il contratto e gestisci il cantiere**".

---

## Le 4 cose che un Chatbot non può fare (e Valora sì)

1. **Avere accesso a dati reali e aggiornati** (listini DEI, prezzari regionali, catasto, OAM/CCIAA).
2. **Produrre artefatti con validità** (PDF firmati digitalmente, contratti, fatture pro-forma, marche da bollo, link di firma tracciabile).
3. **Imparare dallo studio** (listino personale dell'architetto, storico cantieri reali, coefficienti di markup propri, foto di cantiere geolocalizzate).
4. **Orchestrare il workflow** (CRM clienti, scadenziario, firma elettronica, pagamenti acconti, condivisione col committente, export verso software professionali).

Il piano qui sotto è organizzato per **fase** e **valore di lock-in**.

---

## Fase 1 — Le killer feature dei prossimi 60 giorni
Cose che, da sole, giustificano i €29/mese e che un architetto non trova in ChatGPT.

### 1.1 Listino personale dello studio (massima priorità)
- L'architetto carica/incolla il proprio listino (CSV, Excel, anche foto del prezzario cartaceo via OCR).
- Valora lo importa come **catalogo voci personali** con prezzo unitario, unità di misura, fornitore di riferimento.
- Ogni preventivo successivo viene generato **prima** dal listino dello studio, **poi** integrato dall'AI per le voci mancanti.
- Effetto: dopo 2 preventivi reali, il listino dello studio è dentro Valora. Cambiare strumento = ricostruire il listino. Lock-in fortissimo.

### 1.2 Prezzari ufficiali italiani integrati
- Importazione **Prezzario DEI**, **Prezzari regionali** (Lombardia, Lazio, Emilia-Romagna), **Tariffario CCIAA**.
- Quando l'AI genera una voce, mostra di fianco: "DEI 2025 dice €X/mq, tu vuoi usare questo?".
- Output: il preventivo cita la fonte ("voce conforme Prezzario Lombardia 2025 cod. E.01.10.20"). Per i cantieri pubblici e per i clienti diffidenti, è oro.

### 1.3 Da preventivo a contratto firmato in un click
- Generazione di **contratto d'opera** standard (template legale italiano) accanto al preventivo.
- **Firma elettronica integrata** (FEA con OTP via SMS o link pubblico tracciato). Provider tipo Yousign / Namirial.
- Stato del documento visibile in app: Inviato → Visualizzato → Firmato.
- Notifica automatica all'architetto quando il cliente firma.

### 1.4 Acconto online sul preventivo
- Bottone "Versa acconto del 30%" nel link pubblico del preventivo. Pagamento via Stripe.
- L'architetto vede in Valora: preventivo accettato + acconto incassato + ricevuta automatica.
- Questo è il momento "wow" che nessuna chatbot può replicare: chiudi il deal **dentro** lo strumento.

### 1.5 Link pubblico del preventivo (con branding studio)
- Ogni preventivo ha un URL `valora.it/p/abc123` con anteprima brandizzata, accetta/rifiuta, commenti del cliente, download PDF.
- Tracking: il cliente lo ha aperto? Quante volte? Quanto tempo? Notifica all'architetto.

---

## Fase 2 — Diventare indispensabile (giorni 60–120)

### 2.1 OCR planimetrie e computo automatico
- L'architetto trascina una **planimetria** (PDF / DWG export / foto). Valora estrae mq totali, mq per stanza, ml di pareti, n° aperture.
- Da lì genera computo metrico realistico, non più "stima". Differenza enorme rispetto al chatbot.
- Tecnicamente: pdf.js + visione (Gemini Pro Vision) + libreria CAD per DWG → backend.

### 2.2 Storico cantieri = AI personalizzata
- Ogni preventivo accettato diventa "training data privato": Valora impara il €/mq tipico **dello studio**, gli sconti applicati, le sezioni più frequenti.
- Suggerimento contestuale: "Sui cantieri 80–100 mq tu mediamente fatturi €1.150/mq. Questo è a €980. Vuoi rivedere?".
- Un chatbot non ha questa memoria longitudinale.

### 2.3 Varianti, SAL e contabilità di cantiere
- Una volta accettato il preventivo, l'architetto può creare **varianti in corso d'opera** (delta + giustificazione).
- **Stato Avanzamento Lavori (SAL)**: spunti le voci completate, Valora calcola % completata e fattura corrispondente.
- Output: report SAL in PDF, pronto per il committente o per la banca che eroga il mutuo.

### 2.4 Modulo clienti potenziato (mini-CRM)
- Già esiste `clients.tsx`. Espandere con: pipeline (Lead → Sopralluogo → Preventivo → Firmato → Cantiere → Chiuso), reminder automatici, log delle interazioni.
- Email transazionali in dominio dello studio ("[email protected]").

### 2.5 Esportazioni professionali
- Export verso: **PriMus / Str Vision CPM** (formato PXP / IFC), **Excel computo metrico**, **CSV per commercialista**, **Sage / TeamSystem** per fatturazione.
- Senza questa feature, lo studio "deve" comunque ribattere il preventivo nel suo software di sempre. Con questa feature, Valora diventa la **fonte unica**.

---

## Fase 3 — Moat di lungo periodo (giorni 120+)

### 3.1 Marketplace fornitori e quotazioni reali
- L'architetto chiede preventivo a **3 imprese reali** dentro Valora. Le imprese registrate ricevono un link, rispondono col loro prezzo.
- Valora confronta + propone all'architetto la combinazione migliore.
- Network effect: più studi ci sono, più imprese si iscrivono; più imprese, più valore per gli studi.

### 3.2 Verifica catastale e visure integrate
- Inserisci indirizzo cantiere → Valora recupera dati catastali (foglio/particella/subalterno), classe energetica, vincoli.
- Allegato automatico al preventivo: estratto di mappa.
- Integrazione con Visure Italia / Openapi.

### 3.3 Conformità e compliance
- Generazione automatica di:
  - **CILA / SCIA** precompilata (dati del progetto già presenti).
  - **POS / DUVRI** semplificato per cantieri sotto soglia.
  - **Dichiarazione conformità impianti** (modello CEI 64-8 ecc.).
- Un architetto stressato dalla burocrazia non lascia più Valora.

### 3.4 App mobile per cantiere
- Foto del cantiere geolocalizzata + datata → diario di cantiere automatico.
- Voice memo durante il sopralluogo → trascrizione + creazione bozza preventivo.
- Riconciliazione: foto del muro demolito = spunta voce "demolizione tramezzi".

### 3.5 Collaborazione di studio
- Più utenti per studio (titolare + collaboratori), permessi, commenti sui preventivi, revisioni con storico.
- Templati di studio condivisi (intestazioni, condizioni contrattuali, sezioni preferite).

### 3.6 Modulo "Dimostra il tuo valore al cliente"
- PDF del preventivo include una pagina opzionale **"Perché questo costo"**: render before/after, riferimenti al prezzario ufficiale, esempi di cantieri analoghi.
- Vende l'architetto, non solo il numero finale. Differenziale enorme dal "preventivo da chatbot".

---

## Quick-win che si possono fare in 1–2 settimane (anche prima della Fase 1)

1. **Numeri preventivo + revisioni**: già parziale, completare con storico revisioni e diff.
2. **Template di sezioni preferite per studio** (es. "il mio bagno tipo", "la mia ristrutturazione 100mq tipo").
3. **Duplica preventivo** come base per il prossimo cliente.
4. **Coefficienti di studio** (markup, sconto applicato) salvati nel profilo.
5. **Branding PDF avanzato**: logo, colori, font, intestazione, IBAN, P.IVA, REA.
6. **Email sending** dentro Valora con tracking apertura ("il cliente ha aperto il preventivo 3 volte").
7. **Scadenza automatica** preventivo dopo 30 giorni con notifica.
8. **Dashboard studio**: € fatturato in pipeline, % accettazione, tempo medio dalla creazione alla firma.

---

## Posizionamento di marketing (per copy landing/pricing)

Tre frasi che chiariscono la differenza vs ChatGPT:

- *"ChatGPT ti scrive un preventivo. Valora lo fa firmare, incassa l'acconto e lo trasforma in cantiere."*
- *"L'AI inventa i prezzi. Valora usa il tuo listino, il prezzario regionale e lo storico dei tuoi cantieri."*
- *"Una chat è una chat. Valora è il sistema operativo del tuo studio."*

---

## Ordine di esecuzione raccomandato

```text
Settimane 1-2  → Quick wins (template, duplica, branding PDF, dashboard)
Settimane 3-6  → Fase 1.1 + 1.2 (listino studio + prezzari) → killer commerciale
Settimane 7-10 → Fase 1.3 + 1.4 + 1.5 (firma + acconto + link pubblico) → chiusura deal in-app
Settimane 11+  → Fase 2 (OCR planimetrie, AI personalizzata, SAL, esportazioni)
Mese 4+        → Fase 3 (marketplace, catasto, compliance, mobile)
```

---

## Dettagli tecnici (rapidi)

- **Listino studio**: tabella `studio_price_list` (studio_id, code, name, unit, unit_price, category). Import CSV/Excel via SheetJS, OCR via Gemini Vision.
- **Prezzari ufficiali**: tabella read-only `public_price_books`, popolata via job di import; lookup full-text.
- **Firma elettronica**: integrazione Yousign API (REST), webhook per stato. Secret `YOUSIGN_API_KEY`.
- **Acconto online**: riuso Stripe già attivo; nuovo flusso `payment_intent` separato dall'abbonamento. Tabella `quote_payments`.
- **Link pubblico**: route `/p/$token` con SSR, RLS open su token, view tracking via tabella `quote_views`.
- **OCR planimetrie**: upload su Supabase Storage, server function chiama Gemini Pro Vision con prompt strutturato (output JSON: total_sqm, rooms[], walls_ml, openings).
- **Multi-utente per studio**: tabella `studio_members` + ruoli, RLS via `has_studio_role(uid, studio_id, role)` security definer.
- **Email tracking**: provider tipo Resend, pixel + redirect link.

Tutto resta dentro Lovable Cloud (Supabase) + AI Gateway, niente nuovi vendor pesanti tranne Yousign (firma) e Resend (email).