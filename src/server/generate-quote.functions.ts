import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  transcription: z.string().min(1).max(2000),
  workZone: z.string().trim().max(200).optional(),
});

export const generateQuote = createServerFn({ method: "POST" })
  .inputValidator((input: { transcription: string; workZone?: string }) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { error: "AI service not configured" };
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Sei un cost estimator professionista per ristrutturazioni residenziali in Italia, al servizio di architetti.

Il tuo compito NON è generare testo: è SIMULARE LOGICA ECONOMICA REALE e produrre un preventivo che un architetto possa inviare a un cliente senza correzioni.

═══════════════════════════════════════════
BENCHMARK DI MERCATO (OBBLIGATORI)
═══════════════════════════════════════════
Ristrutturazione completa:
  • Standard: €700–€1.000 / mq
  • Milano / zone centrali / centro storico città principali: €900–€1.500 / mq
Impianto elettrico: €80–€120 / mq
Impianto idraulico: €70–€120 / mq
Bagno completo (sanitari + rivestimenti + impianti + posa): €5.000–€12.000 cad
Cucina (solo adeguamento impianti + finiture pareti, NO mobili): €2.500–€5.000
Pavimenti (fornitura + posa): €60–€150 / mq a seconda materiale
Serramenti (finestre): €600–€1.200 cad; porte interne: €350–€700 cad

Usa SEMPRE questi range come riferimento per il totale e per le singole voci.

═══════════════════════════════════════════
REGOLE STRETTE
═══════════════════════════════════════════

1) NUMERI REALISTICI E PULITI
   • Usa SOLO valori arrotondati e professionali: 300, 800, 1.200, 3.500, 6.500, 12.000
   • VIETATI valori tipo 2,15 — 48,30 — 4.857 — 10.283
   • Le cifre devono sembrare scritte da un capocantiere/computista, non generate

2) COERENZA ECONOMICA
   Ogni costo deriva da:
   • metratura (mq)
   • quantità reali (n° punti luce, n° bagni, ml di tracce, mq pavimento)
   • scopo lavoro effettivo
   MAI numeri casuali.

3) VALIDAZIONE TOTALE (CRITICA)
   Il totale finale DEVE rientrare nei benchmark €/mq.
   Esempi:
   • 80 mq Milano centro → minimo €60.000–€80.000 (full reno)
   • 95 mq Roma standard → €70.000–€95.000
   • 60 mq provincia, finiture base → €42.000–€60.000
   Se il calcolo voce-per-voce non raggiunge il minimo del range €/mq → AGGIUSTA AUTOMATICAMENTE prima di restituire.

4) NO UNDERPRICING
   Nel dubbio, alza leggermente. Mai sottostimare il costo reale di esecuzione.
   Includi sempre: ponteggi/protezioni, smaltimento macerie, imprevisti impiantistici quando pertinente.

5) SCOPE CORRETTO
   • NO mobili/arredi se non esplicitamente richiesti
   • Cucina: solo impianti + finiture pareti, NON mobili cucina
   • Bagno: sanitari, rubinetteria, rivestimenti, impianti
   • Separa sempre: opere edili / impianti / finiture / serramenti / servizi professionali
   • Terminologia tecnica corretta (massetto, tracce, derivazioni, punti presa, sottofondi)

6) STRUTTURA
   • TITOLO: tipologia + mq + zona/città (es. "Ristrutturazione Integrale 95 mq — Milano, Zona Porta Romana")
   • DESCRIZIONE: max 2 righe
   • DURATA: realistica (es. "10–12 settimane")
   • LIVELLO FINITURE: base / media / alta + nota
   • SEZIONI: usa solo quelle pertinenti tra: Opere edili, Impianti, Finiture interne, Serramenti, Arredo fisso (solo se richiesto), Servizi professionali

7) MATEMATICA
   • subtotale = somma esatta delle voci della sezione
   • total = somma esatta dei subtotali
   • Nessun errore aritmetico

═══════════════════════════════════════════
CHECK INTERNO PRIMA DI RESTITUIRE
═══════════════════════════════════════════
Verifica MENTALMENTE prima di output:
  ☐ Tutti i valori sono arrotondati e realistici?
  ☐ Nessuna voce è sottoprezzata rispetto al mercato italiano?
  ☐ €/mq totale rientra nel benchmark per zona e tipologia?
  ☐ Subtotali e totale matematicamente corretti?
  ☐ Nessun arredo non richiesto?
  ☐ Tutte le componenti del progetto sono coperte?
Se anche solo UN check fallisce → CORREGGI prima di restituire.

═══════════════════════════════════════════
NOTE FINALI (sempre incluse)
═══════════════════════════════════════════
  • Variabilità prezzi in fase esecutiva
  • Dipendenza dalle scelte definitive dei materiali
  • Esclusione lavori non menzionati
  • Possibili imprevisti (stato impianti/strutture esistenti)
  • IVA esclusa ove applicabile

OUTPUT: solo JSON valido conforme allo schema della tool. Nessun testo extra.`,
          },
          {
            role: "user",
            content: data.workZone
              ? `Zona di lavoro dello studio (usa per i benchmark €/mq): ${data.workZone}\n\nRichiesta cliente:\n${data.transcription}`
              : data.transcription,
          },
        ],
        tools: [
          {
            type: "function" as const,
            function: {
              name: "generate_quote",
              description: "Generate a structured professional architectural quote",
              parameters: {
                type: "object",
                properties: {
                  title: {
                    type: "string",
                    description: "Titolo professionale del progetto (es. 'Ristrutturazione Integrale Appartamento 95mq — Roma, Zona Prati')",
                  },
                  description: {
                    type: "string",
                    description: "Descrizione sintetica del progetto (max 2 righe)",
                  },
                  duration: {
                    type: "string",
                    description: "Durata stimata realistica (es. '10-12 settimane')",
                  },
                  finishLevel: {
                    type: "string",
                    description: "Livello finiture con eventuali note (es. 'Fascia media con possibilità di upgrade su rivestimenti bagno')",
                  },
                  sections: {
                    type: "array",
                    description: "Sezioni del preventivo organizzate per categoria di lavoro",
                    items: {
                      type: "object",
                      properties: {
                        name: {
                          type: "string",
                          description: "Nome della sezione (es. 'Opere edili', 'Impianti', 'Finiture interne')",
                        },
                        items: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              name: {
                                type: "string",
                                description: "Descrizione tecnica dettagliata della voce, incluso cosa comprende (es. 'Demolizione pavimenti e massetto esistente, smaltimento macerie (85mq)')",
                              },
                              price: {
                                type: "number",
                                description: "Prezzo in EUR — SOLO valori arrotondati professionali (es. 300, 800, 1.200, 3.500, 6.500, 12.000). VIETATI valori tipo 4.857 o 2,15. Coerente con benchmark di mercato italiano (€/mq, €/cad).",
                              },
                            },
                            required: ["name", "price"],
                            additionalProperties: false,
                          },
                        },
                        subtotal: {
                          type: "number",
                          description: "Somma esatta dei prezzi delle voci nella sezione",
                        },
                      },
                      required: ["name", "items", "subtotal"],
                      additionalProperties: false,
                    },
                  },
                  total: {
                    type: "number",
                    description: "Somma esatta di tutti i subtotali delle sezioni",
                  },
                  notes: {
                    type: "array",
                    description: "Note professionali: variabilità prezzi, dipendenza materiali, esclusioni, IVA, lavori imprevisti",
                    items: {
                      type: "string",
                    },
                  },
                },
                required: ["title", "description", "duration", "finishLevel", "sections", "total", "notes"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function" as const, function: { name: "generate_quote" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return { error: "Rate limited. Please try again in a moment." };
      if (response.status === 402) return { error: "AI credits exhausted. Please try again later." };
      return { error: "Failed to generate quote." };
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return { error: "Failed to parse AI response." };

    try {
      const quote = JSON.parse(toolCall.function.arguments);
      return { quote };
    } catch {
      return { error: "Failed to parse quote data." };
    }
  });
