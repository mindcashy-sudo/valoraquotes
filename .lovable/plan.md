## Obiettivo
Portare il progetto fuori da Lovable e farlo girare su **Render** mantenendo identico il funzionamento attuale: stessi route, stesse server functions, stesso database/auth/storage (Lovable Cloud = Supabase), stessi pagamenti Stripe, stesso AI Gateway.

## Cosa cambia rispetto a Lovable

Oggi il progetto gira su **Cloudflare Workers** (target preconfigurato da `@lovable.dev/vite-tanstack-config`). Render non esegue Workers: esegue **Node.js**. Quindi serve:

1. **Cambiare il target di build di TanStack Start** da `cloudflare` a `node-server`.
2. **Sostituire il backend "Lovable Cloud"** con il riferimento diretto al progetto Supabase sottostante (stesso DB, stessi dati — cambiano solo le env var).
3. **Spostare i secret** da Lovable a Render (Environment Variables).
4. **Aggiungere `package.json` scripts** `build` e `start` standard per Render.
5. **Esportare il codice** via GitHub (integrazione Lovable → GitHub).

Nessuna riga di logica applicativa va riscritta: server functions, route, RLS, pagamenti restano identici.

## Passi operativi

### 1. Esportare il codice
- Lovable → menu `+` in basso a sinistra → **GitHub** → "Transfer to GitHub". Crea un repo col codice attuale.
- Clonare il repo in locale per gli step 2–4.

### 2. Sostituire il target Cloudflare con Node
Modifiche minime:

- `vite.config.ts`: passare da `@lovable.dev/vite-tanstack-config` (che include il plugin Cloudflare e l'import-protection) alla configurazione standard di TanStack Start con target Node.
- `package.json`: aggiungere `@tanstack/react-start`, `vite`, `@vitejs/plugin-react`, `@tanstack/router-plugin` (se non già presenti come dipendenze dirette) e rimuovere `wrangler` / `@cloudflare/*` se presenti.
- Eliminare `wrangler.jsonc`.
- `tsr.config` / plugin TanStack: `target: 'node-server'`.

### 3. Script Render-friendly in `package.json`
```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "start": "node .output/server/index.mjs"
}
```
Su Render: **Build Command** `npm install && npm run build`, **Start Command** `npm start`, **Node Version** ≥ 20.

### 4. Variabili d'ambiente su Render
Da configurare in Render → Environment:

**Pubbliche (frontend):**
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

**Server-only:**
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` ← **non disponibile da Lovable Cloud**: va recuperata creando un account Supabase, facendo "claim" del progetto sottostante, oppure migrando i dati su un nuovo progetto Supabase tuo (vedi sezione "Punto critico").
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID`
- `LOVABLE_API_KEY` (per Lovable AI Gateway) — se vuoi continuare a usarlo; altrimenti sostituirlo con una chiave Gemini/OpenAI tua e aggiornare il client AI nelle server functions.

### 5. Webhook Stripe
Aggiornare l'endpoint webhook su Stripe Dashboard puntando al nuovo URL Render:
`https://<tuo-app>.onrender.com/api/public/stripe-webhook`

### 6. Dominio
- Render fornisce un URL `*.onrender.com` gratuito.
- Custom domain: configurabile da Render → Settings → Custom Domains.

## Punto critico: il database

Il progetto usa **Lovable Cloud**, cioè un progetto Supabase gestito da Lovable. Per usarlo da Render servono 3 scenari possibili — devi sceglierne uno:

**A. Tieni il DB su Lovable Cloud, sposta solo l'app su Render.**
Funziona finché Lovable Cloud espone URL + chiavi pubbliche del progetto Supabase. La `SUPABASE_SERVICE_ROLE_KEY` però **non è accessibile** da Lovable Cloud: senza di essa **non funzionano** le server functions che usano `supabaseAdmin` (es. `stripe.functions`, webhook, parti di `generate-quote`, admin queries). Senza service role, perdi una fetta importante di funzionalità.

**B. Migra il DB su un tuo progetto Supabase.**
Crei un progetto Supabase nuovo (free tier), esegui tutte le migration presenti in `supabase/migrations/`, copi i dati con `pg_dump` / `pg_restore`. Ottieni tutte e 3 le chiavi (URL, publishable, service_role) e tutto continua a funzionare 1:1. Soluzione consigliata.

**C. Mantieni doppia infra.**
Lovable per sviluppo, Render+Supabase tuo per produzione. Più complesso, ha senso solo se vuoi continuare a iterare su Lovable.

## Cosa NON serve fare
- Riscrivere route, componenti, server functions, RLS, pagamenti.
- Cambiare Tailwind/shadcn/UI.
- Modificare le migrazioni (sono già SQL standard, compatibili con qualsiasi Supabase).

## Riepilogo dettagli tecnici
- TanStack Start supporta nativamente il preset `node-server` (genera `.output/server/index.mjs`, eseguibile con `node`).
- L'**import-protection** che blocca `**/server/**` e `*.server.ts` è un plugin Vite del preset Lovable: rimuovendolo, va comunque mantenuta la disciplina di non importare `client.server.ts` dal codice client (altrimenti la `SUPABASE_SERVICE_ROLE_KEY` finisce nel bundle).
- Render esegue il container 24/7 sul piano a pagamento; sul piano free va in sleep dopo 15 min di inattività (cold start ~30s). Stripe webhook potrebbero timeoutare al cold start: valuta il piano Starter.

## Domanda prima di procedere
Confermi scenario **B** (migrazione DB su un tuo progetto Supabase)? È l'unico che garantisce il "funziona esattamente come ora" che hai chiesto. Se sì, in fase di implementazione genererò lo script di migrazione dati e l'elenco esatto delle modifiche ai file.
