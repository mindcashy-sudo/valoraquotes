## Obiettivo

Finalizzare Valora come SaaS commercializzabile:
1. **PDF preventivi** — riprogettato da zero con layout minimal stile Apple, zero testo tagliato, zero accavallamenti.
2. **Stripe LIVE** — passaggio da sandbox a chiavi reali, **piano unico Early Access €29/mese**.
3. **Polish commerciale** — pagina /pricing, gestione abbonamento (Customer Portal), badge Pro.

---

## Parte 1 — Redesign PDF (priorità massima)

### Problemi attuali
- Header pagina 1 con sidebar dark fissa 200pt + intro a destra → overflow su titoli lunghi.
- `drawFooterBlock` disegna in coordinate assolute (sidebar dark da y=0 a y=230) **sovrapponendosi** alla tabella → causa delle "frasi tagliate".
- Sidebar dark si ripete solo a pagina 1 ma il footer dark assume sempre pagina dedicata.
- Zebra striping + chip colorati = troppo "HTML grezzo", non Apple.

### Nuovo sistema (clean, Apple-style)

**Filosofia**: tutto bianco, una sola colonna principale, gerarchia data dalla tipografia. Nessuna sidebar dark. Un solo accent (nero ink) per la barra del totale.

```text
┌──────────────────────────────────────────┐
│  [logo]                      PREVENTIVO  │  ← header minimal 90pt
│  Studio Nome                  N° 2026-01 │
│  ─────────────────────────────────────── │
│  Cliente              Cantiere           │
│  Mario Rossi          Via Roma 12, MI    │
│                                          │
│  Ristrutturazione 95 mq                  │  ← title 24pt
│  Descrizione muted...                    │
│  Durata 12 sett · Finiture Medio-alto    │
│                                          │
│  ─────────────────────────────────────── │
│  01  DEMOLIZIONI                         │
│      Rimozione pavimenti        € 1.200  │
│      Smontaggio sanitari          € 450  │
│                      Subtotale  € 1.650  │
│  ...                                     │
│  ─────────────────────────────────────── │
│                      Imponibile € 85.000 │
│                       IVA 22%   € 18.700 │
│  ████████████████████████████████████████│  ← TOTALE bar nero 70pt
│  TOTALE              € 103.700 IVA incl. │
│  ─────────────────────────────────────── │
│  Note · Condizioni                       │
│  • ...                                   │
│  ─────────────────────────────────────── │
│  Per accettazione         Per lo studio  │
│  ___________________      _____________  │
│  Studio · P.IVA · IBAN              1/3  │
└──────────────────────────────────────────┘
```

### Regole tipografiche
- Helvetica + HelveticaBold.
- Scala: 7.5 (eyebrow tracked) · 9 (body) · 10.5 (item) · 12 (subtotal) · 14 (meta) · 24 (project title) · 28 (TOTALE).
- Colori: INK `(0.07,0.08,0.1)`, TEXT `(0.28,0.30,0.34)`, MUTED `(0.56,0.59,0.64)`, HAIRLINE `(0.90,0.92,0.94)`. **No zebra, no fondi colorati.**
- Margini 56pt laterali, 60pt top, 80pt bottom.
- Prezzi tabular nums right-aligned a `PAGE_W - MX`.

### Riscrittura `src/server/pdf.functions.ts`
Flusso lineare, ogni funzione avanza `ctx.y` e chiama `ensure()` PRIMA del blocco:

```typescript
drawHeader(ctx, logo, qNumber, qDate)
drawMetaStrip(ctx, clientName, address, validUntil)
drawProjectTitle(ctx, q)
drawSections(ctx, q)              // hairline tra item, no zebra
drawTotalsBlock(ctx, q, vat)      // imponibile + iva + BARRA NERA totale (intera, mai spezzata)
drawNotesAndTerms(ctx, q, vat, terms)
drawSignature(ctx, studio)
drawPageFooter(everyPage, studio) // 1 riga finale + numero pagina
```

**Garanzie anti-overflow**:
- Ogni `wrap()` usa `CONTENT_W - padding` reale.
- `ensure(needed)` prima di OGNI blocco logico.
- Barra TOTALE: `ensure(140)` → mai spezzata.
- Signature: `ensure(80)` → mai spezzata.
- `MB = 70` riservato per footer per-pagina.

### QA obbligatorio
Aggiornare `qa-render.mjs` con 3 scenari (corto/medio/lungo), `pdftoppm` → JPEG, ispezione di OGNI pagina per zero overlap/clipping. Iterare fino a clean.

---

## Parte 2 — Stripe LIVE + piano €29/mese

### Cosa c'è ora
- Stripe in modalità **test/sandbox** (chiavi `sk_test_...`).
- `STRIPE_PRICE_ID` è un price di test a €35/mese.
- Webhook `/api/public/stripe-webhook` esistente, `STRIPE_WEBHOOK_SECRET` di test.

### Cosa va fatto

**1. Creare in Stripe LIVE (manuale dall'utente, lato dashboard Stripe):**
- Prodotto: **Valora — Early Access**
- Prezzo ricorrente: **€29 / mese**, EUR
- Endpoint webhook LIVE: `https://valoraquotes.lovable.app/api/public/stripe-webhook` (eventi: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`)

**2. Aggiornare i 3 secrets esistenti con i valori LIVE** (richiederò all'utente con `add_secret`/`update_secret` quando inizio l'implementazione):
- `STRIPE_SECRET_KEY` → `sk_live_...`
- `STRIPE_PRICE_ID` → price ID del nuovo €29/mese live
- `STRIPE_WEBHOOK_SECRET` → secret del webhook live

Niente codice da cambiare per il prezzo: il `PRICE_ID` è già letto dall'env. **Il piano resta unico (mensile €29)**.

**3. Aggiornare prezzo visualizzato nella UI** (da €35 → €29):
- `src/components/Paywall.tsx` (riga "€35/mese")
- Eventuali menzioni in landing/pricing

**4. Customer Portal** (per permettere cancellazione/aggiornamento carta da soli):
- Nuova server function `createCustomerPortalSession` in `src/server/stripe.functions.ts`:
  ```typescript
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${origin}/settings`,
  });
  ```
- Bottone "Gestisci abbonamento" in `/settings` per utenti con `subscription_status = active`.

**5. Verifica webhook live**:
- Dopo passaggio chiavi, fare un acquisto reale di test (carta vera, poi rimborsare) o usare `stripe trigger` per validare che i webhook LIVE arrivino e aggiornino `profiles.subscription_status`.

---

## Parte 3 — Polish commerciale finale

**1. Nuova pagina `/pricing`** (`src/routes/pricing.tsx`):
- Hero: "Prezzo trasparente. Cancelli quando vuoi."
- 2 card: **Free** (3 preventivi) vs **Early Access €29/mese** (illimitati, PDF brandizzati, clienti, supporto).
- Banner "Prezzo bloccato per i primi 100 utenti".
- FAQ: fatturazione, cancellazione, esportazione dati.
- CTA → checkout (signup + checkout).

**2. Landing `src/routes/index.tsx`**:
- Aggiungere link "Prezzi" in nav.
- Sezione pricing inline (1 card €29/mese) sopra il footer con CTA "Inizia gratis".
- Aggiornare ogni "€35" → "€29".

**3. Badge "Pro"** in `src/routes/app.tsx` per utenti con `subscription_status = active`.

**4. Footer landing**: link Privacy / Termini / Contatti (placeholder se mancano).

---

## Ordine di esecuzione

1. **Redesign PDF completo** + QA visivo iterativo (parte 1).
2. **Switch Stripe LIVE**: richiedo i 3 secrets aggiornati + aggiungo Customer Portal + aggiorno prezzo €29 ovunque (parte 2).
3. **Pagina /pricing + sezione landing + badge Pro** (parte 3).

---

## File toccati

- `src/server/pdf.functions.ts` — **riscrittura completa**
- `qa-render.mjs` — 3 scenari di QA
- `src/server/stripe.functions.ts` — aggiunta `createCustomerPortalSession`
- `src/components/Paywall.tsx` — €35 → €29
- `src/routes/pricing.tsx` — **nuovo**
- `src/routes/settings.tsx` — sezione "Abbonamento" con bottone Customer Portal
- `src/routes/app.tsx` — badge Pro
- `src/routes/index.tsx` — sezione pricing + nav + €29

## Cosa farai TU manualmente prima/durante l'esecuzione

1. In **Stripe Dashboard (modalità Live)**: crea Prodotto + Prezzo €29/mese ricorrente.
2. In Stripe Dashboard: crea Webhook live verso `https://valoraquotes.lovable.app/api/public/stripe-webhook`.
3. Mi passerai i 3 valori LIVE (`sk_live_...`, `price_...`, `whsec_...`) quando te li chiederò via prompt secret.
