# Deploy su Render

Guida operativa per portare questo progetto fuori da Lovable e farlo girare su **Render** mantenendo lo stesso comportamento. Le modifiche a `vite.config.ts` e `package.json` vanno fatte **dopo** l'export su GitHub (se applicate qui dentro rompono la preview Lovable).

---

## 1. Esportare il codice su GitHub

Da Lovable: menu `+` in basso a sinistra → **GitHub** → *Transfer to GitHub* → crea un nuovo repo.
Clona il repo in locale: tutti gli step successivi si fanno lì, non in Lovable.

---

## 2. Migrare il database (scenario consigliato)

Lovable Cloud è un progetto Supabase gestito: la `SUPABASE_SERVICE_ROLE_KEY` non è accessibile. Senza, le server functions che usano `supabaseAdmin` (Stripe webhook, generate-quote, admin queries) non funzionano. Soluzione: progetto Supabase tuo.

1. Crea un progetto Supabase nuovo su https://supabase.com (free tier va bene).
2. Recupera dal nuovo progetto: `Project URL`, `anon/publishable key`, `service_role key`.
3. Applica tutte le migration esistenti:
   ```bash
   # Da locale, dentro il repo
   npx supabase link --project-ref <NUOVO_PROJECT_REF>
   npx supabase db push
   ```
   Le migration in `supabase/migrations/` sono SQL standard, compatibili 1:1.
4. (Opzionale) Migra i dati esistenti da Lovable Cloud: contatta il supporto Lovable per ottenere un dump del DB, poi `psql < dump.sql` sul nuovo progetto. Se parti da zero, salta questo step.
5. Configura su Supabase → Authentication → URL Configuration:
   - **Site URL**: `https://<tuo-app>.onrender.com`
   - **Redirect URLs**: aggiungi lo stesso URL + eventuale custom domain.
6. Riabilita i provider auth che usavi (Google, ecc.) dal pannello Supabase.
7. Ricrea lo storage bucket `studio-assets` (Storage → New bucket, privato).

---

## 3. Adattare il progetto per Node (Render non esegue Cloudflare Workers)

Nel repo clonato, **non in Lovable**, modifica:

### `vite.config.ts`
Il preset `@lovable.dev/vite-tanstack-config` include il plugin Cloudflare. Sostituisci con configurazione TanStack Start standard:

```ts
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    tanstackStart({ target: "node-server" }),
    viteReact(),
  ],
});
```

### `package.json`
- Rimuovi: `@cloudflare/vite-plugin`, `@lovable.dev/vite-tanstack-config`, `wrangler` (se presente).
- Aggiungi: `@tanstack/react-start`, `@vitejs/plugin-react`, `@tailwindcss/vite`, `vite-tsconfig-paths` (alle dipendenze dirette se mancano).
- Sostituisci gli script:
  ```json
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "start": "node .output/server/index.mjs",
    "lint": "eslint .",
    "format": "prettier --write ."
  }
  ```
- Aggiungi `"engines": { "node": ">=20" }`.

### Elimina
- `wrangler.jsonc`
- `bunfig.toml` (se vuoi usare npm invece di bun su Render)

### Verifica in locale
```bash
npm install
npm run build
npm start
# apri http://localhost:3000
```

---

## 4. Creare il servizio su Render

1. https://dashboard.render.com → **New** → **Web Service** → collega il repo GitHub.
2. Render rileva `render.yaml` (incluso in questo progetto) e propone:
   - Runtime: Node
   - Build: `npm install && npm run build`
   - Start: `node .output/server/index.mjs`
3. Conferma e crea.

### Variabili d'ambiente
In Render → Environment, popola i valori (sono marcati `sync: false` nel `render.yaml`, vanno inseriti a mano):

**Frontend (build-time):**
- `VITE_SUPABASE_URL` → Project URL del nuovo progetto Supabase
- `VITE_SUPABASE_PUBLISHABLE_KEY` → anon/publishable key
- `VITE_SUPABASE_PROJECT_ID` → project ref (la parte iniziale dell'URL)

**Server-only:**
- `SUPABASE_URL` → stesso valore di `VITE_SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY` → stesso valore della publishable
- `SUPABASE_SERVICE_ROLE_KEY` → service_role key (dal pannello Supabase, sezione API)
- `STRIPE_SECRET_KEY` → da Stripe Dashboard → Developers → API keys
- `STRIPE_WEBHOOK_SECRET` → vedi step 5
- `STRIPE_PRICE_ID` → ID del prezzo della subscription
- `LOVABLE_API_KEY` → **non più disponibile fuori da Lovable**: sostituisci con `GEMINI_API_KEY` o `OPENAI_API_KEY` tua e adatta `src/lib/server-fns/generate-quote.functions.ts` per usare il provider scelto direttamente (1 modifica, ~5 righe).

---

## 5. Stripe webhook

Su Stripe Dashboard → Developers → Webhooks → **Add endpoint**:
- URL: `https://<tuo-app>.onrender.com/api/public/stripe-webhook`
- Eventi: gli stessi che hai configurati ora (in genere `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`).
- Copia il **Signing secret** generato e mettilo in Render come `STRIPE_WEBHOOK_SECRET`.

---

## 6. Custom domain (opzionale)

Render → Settings → Custom Domains → aggiungi il dominio → segui le istruzioni DNS (CNAME o A record). Aggiorna poi anche `Site URL` su Supabase e l'URL del webhook su Stripe se cambi dominio.

---

## 7. Note operative

- **Piano free Render**: il servizio va in sleep dopo 15 min di inattività (cold start ~30s). Per i webhook Stripe, usa almeno il piano **Starter** ($7/mese) altrimenti rischi timeout.
- **Logs**: Render → Logs (live).
- **Rollback**: Render → Deploys → Rollback su deploy precedente.
- **Bun vs npm**: Render supporta entrambi. Se preferisci bun, cambia `buildCommand` in `bun install && bun run build` e `startCommand` in `bun .output/server/index.mjs`.
- **Migration future**: lavori in locale, fai `npx supabase db push` per applicarle a produzione. Lovable non è più la source of truth.

---

## Checklist finale prima del go-live

- [ ] Repo su GitHub esportato
- [ ] Nuovo progetto Supabase con tutte le migration applicate
- [ ] Storage bucket `studio-assets` ricreato
- [ ] Auth providers (Google) riconfigurati su Supabase
- [ ] `vite.config.ts` adattato a `node-server`
- [ ] `package.json` con script `start` e `engines.node ≥ 20`
- [ ] Build locale `npm run build && npm start` funzionante
- [ ] Servizio Render creato, env var popolate
- [ ] Webhook Stripe aggiornato col nuovo URL
- [ ] (Se serve) Custom domain configurato e Site URL Supabase aggiornato
- [ ] LOVABLE_API_KEY sostituita con provider AI proprio
