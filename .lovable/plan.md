
# Valora → SaaS vendibile per architetti freelance

Obiettivo: un architetto deve poter (1) configurare il suo studio in 2 minuti, (2) generare un preventivo, (3) scaricare un PDF brandizzato pronto da inviare al cliente, (4) ritrovare tutto organizzato per cliente/progetto. Il piano è diviso in 4 fasi indipendenti — ognuna porta valore da sola.

---

## Fase 1 — Profilo studio (personalizzazione)

L'architetto, al primo accesso, configura una volta i suoi dati. Poi compaiono automaticamente in ogni preventivo e PDF.

**Cosa fa l'utente:**
- Imposta: nome studio, nome architetto, P.IVA, C.F., indirizzo, città, telefono, email, PEC, IBAN, n° iscrizione albo, logo.
- Imposta default: zona di lavoro (influenza i benchmark prezzi), validità offerta in giorni, IVA %, condizioni standard.
- Pagina `/settings` con tab "Studio", "Default preventivo", "Account".
- Onboarding obbligatorio dopo signup (wizard 2 step) prima di poter generare il primo preventivo.

**Effetti su preventivi:**
- I dati studio entrano nel PDF (header).
- La zona di lavoro viene passata al prompt AI come hint per i benchmark €/mq.
- Le condizioni standard sono pre-caricate nelle "note" del preventivo generato.

---

## Fase 2 — Clienti e progetti

L'architetto non gestisce "preventivi sciolti" ma clienti → progetti → preventivi (con revisioni).

**Modello:**
```text
Cliente (Mario Rossi)
 └─ Progetto (Ristrutturazione via Roma 12)
     ├─ Preventivo v1 (bozza)
     ├─ Preventivo v2 (inviato)
     └─ Preventivo v3 (accettato)
```

**Cosa fa l'utente:**
- `/clients` — lista clienti con ricerca, "+ Nuovo cliente".
- Scheda cliente: anagrafica + lista progetti.
- Scheda progetto: indirizzo cantiere, mq, tipologia, note + lista preventivi con stato.
- Ogni preventivo ha stato: `bozza`, `inviato`, `accettato`, `rifiutato`, numero progressivo automatico (`2026-001`), data, validità.
- Quando genera un nuovo preventivo: prima sceglie cliente+progetto (o li crea al volo), poi registra/scrive.
- La pagina `/saved` esistente diventa un "feed recenti"; la navigazione principale diventa Clienti.

---

## Fase 3 — PDF preventivo professionale

PDF pronto da inviare, non più "stampa browser".

**Layout PDF (1 file, multi-pagina A4):**
- **Header**: logo studio sx, dati studio dx (nome, P.IVA, indirizzo, contatti).
- **Blocco intestazione**: "Spett.le [Cliente]", indirizzo cliente, "Oggetto: [Progetto]", "Indirizzo cantiere", numero preventivo, data, validità ("Offerta valida fino al GG/MM/AAAA").
- **Corpo**: titolo, descrizione, durata, livello finiture, sezioni con voci e subtotali (layout attuale ma in PDF nativo).
- **Totali**: imponibile, IVA %, totale IVA inclusa.
- **Condizioni**: modalità pagamento (acconto/SAL/saldo configurabile), tempi, garanzie, esclusioni, clausole. Editabili dall'architetto sia come default sia per singolo preventivo.
- **Firma**: due box "Per accettazione cliente — data e firma" / "Lo studio". Spazio per firma manuale; in futuro link accettazione digitale (fuori scope ora).
- **Footer**: dati fiscali studio, n° pagina, "Documento generato con Valora".

**Generazione:**
- Server function `generate-pdf.functions.ts` che restituisce il PDF come `Response` (binario). L'utente clicca "Scarica PDF" → download diretto. Niente print del browser.
- Libreria edge-compatible: **pdf-lib** (pura JS, funziona in Cloudflare Workers — confermato dalla knowledge base sui Server Runtime).
- Logo studio caricato in Supabase Storage (bucket privato `studio-assets`), letto lato server.
- Tasto "Stampa / PDF" attuale rimpiazzato da "Scarica PDF" + "Copia testo".

---

## Fase 4 — Landing + conversione

La landing attuale è bella ma generica. Va orientata alla vendita per architetti.

**Modifiche:**
- **Hero più specifico**: H1 "Preventivi professionali per architetti, in 2 minuti dalla voce." Sottotitolo che parla del dolore (3-4 ore a preventivo, perdere clienti per lentezza). CTA "Inizia gratis — 3 preventivi". CTA secondaria "Vedi un preventivo di esempio" → modale con PDF demo.
- **Sezione "Come funziona"**: 3 step con screenshot (Registra → Genera → Scarica PDF brandizzato).
- **Sezione "Per chi è"**: architetto freelance, geometra, piccolo studio.
- **Sezione output di esempio**: anteprima del PDF reale brandizzato (non testo).
- **Pricing trasparente in homepage**: card €35/mese Early Access con bullet (illimitati, PDF brandizzati, clienti/progetti, cancellazione libera). "Prezzo bloccato per i primi 100 utenti".
- **FAQ**: come si fattura, posso esportare i miei dati (sì, sempre), serve installare nulla, supporta P.IVA estere, chi vede i miei dati.
- **Prova sociale leggera**: spazio per 2-3 testimonial (placeholder per ora con label "Beta tester").
- **Pagine separate** (richieste dalla guida TanStack): `/pricing`, `/come-funziona`, `/per-architetti`, `/faq` con head/meta dedicati per SEO. Link nel footer.
- **Tracking conversione**: evento "signup", "first_quote_generated", "subscribed" via console + tabella `analytics_events` (per ora basta loggare lato server).

---

## Dettagli tecnici (per riferimento)

**Database — nuove tabelle:**
- `studio_profiles` (1:1 con user): tutti i campi studio + logo_url + zona_default + iva_percent + validita_giorni_default + condizioni_default (jsonb). RLS: owner only.
- `clients`: id, user_id, nome, email, telefono, indirizzo, citta, p_iva, cf, note. RLS: owner only.
- `projects`: id, user_id, client_id, nome, indirizzo_cantiere, mq, tipologia, note, status. RLS: owner only.
- Modifica `quotes`: aggiunta `project_id` (nullable per retrocompatibilità), `numero` (text), `status` (enum), `valid_until` (date), `iva_percent` (numeric). Backfill: i preventivi esistenti restano "sciolti", visibili in `/saved`.
- `analytics_events`: id, user_id, event, props jsonb, created_at. Insert-only via RLS.
- Storage bucket privato `studio-assets` per loghi.

**Server functions nuove:**
- `studio.functions.ts`: get/upsert profilo studio, upload logo (signed URL).
- `clients.functions.ts`: CRUD clienti.
- `projects.functions.ts`: CRUD progetti.
- `quotes.functions.ts`: estesa con `project_id`, `status`, numerazione progressiva server-side.
- `generate-pdf.functions.ts`: prende quote_id → restituisce PDF (pdf-lib, logo da storage, dati da studio_profiles).
- `generate-quote.functions.ts`: passa `studio_profile.zona_default` come hint nel prompt AI.

**Routing:**
- `/onboarding` — wizard primo accesso
- `/settings` (tab studio/default/account)
- `/clients`, `/clients/$clientId`
- `/projects/$projectId`
- `/app` — flusso esistente, con selezione cliente/progetto prima di generare
- `/pricing`, `/come-funziona`, `/per-architetti`, `/faq` — pagine marketing

**Dipendenze nuove:** `pdf-lib`, `@pdf-lib/fontkit` (per font custom se serve). Entrambe pure-JS, edge-safe.

**Pricing:** invariato (€35/mese illimitato), confermato.

---

## Ordine di esecuzione consigliato

Ogni fase è rilasciabile in modo indipendente. Suggerisco questa sequenza:

1. **Fase 1 (Studio)** — sblocca tutto il resto.
2. **Fase 3 (PDF)** — è ciò che l'architetto vede e mostra al cliente: massimo valore percepito.
3. **Fase 2 (Clienti/Progetti)** — organizzazione, fidelizza l'utente.
4. **Fase 4 (Landing)** — quando il prodotto è davvero pronto da mostrare, allora vale spingere sull'acquisizione.

Posso partire in autonomia con le 4 fasi nell'ordine sopra, oppure dimmi tu se vuoi cambiare l'ordine o tagliare qualcosa.
