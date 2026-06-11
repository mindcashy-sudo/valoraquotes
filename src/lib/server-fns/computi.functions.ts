import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------- Projects ----------

export const listProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("projects")
      .select("id, nome, committente, indirizzo_cantiere, stato, client_id, updated_at, created_at")
      .order("updated_at", { ascending: false });
    if (error) return { projects: [], error: error.message };
    return { projects: data ?? [], error: null };
  });

export const getProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: project, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !project) return { project: null, computi: [], error: error?.message ?? "Progetto non trovato" };
    const { data: computi } = await supabase
      .from("computi")
      .select("id, nome, tipo, versione, stato, parent_computo_id, totale_imponibile, totale_manodopera, motivazione, updated_at")
      .eq("project_id", data.id)
      .order("created_at", { ascending: true });
    return { project, computi: computi ?? [], error: null };
  });

export const createProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        nome: z.string().trim().min(1).max(150),
        committente: z.string().trim().max(150).nullable().optional(),
        indirizzo_cantiere: z.string().trim().max(250).nullable().optional(),
        clientId: z.string().uuid().nullable().optional(),
      })
      .parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Insert project
    const { data: project, error } = await supabase
      .from("projects")
      .insert({
        user_id: userId,
        nome: data.nome,
        committente: data.committente ?? null,
        indirizzo_cantiere: data.indirizzo_cantiere ?? null,
        client_id: data.clientId ?? null,
      })
      .select("id")
      .single();
    if (error || !project) return { projectId: null, computoId: null, error: error?.message ?? "Errore" };

    // Auto-create base computo
    const { data: computo, error: e2 } = await supabase
      .from("computi")
      .insert({
        user_id: userId,
        project_id: project.id,
        nome: "Computo base",
        tipo: "base",
        versione: 0,
        stato: "bozza",
      })
      .select("id")
      .single();
    if (e2 || !computo) return { projectId: project.id, computoId: null, error: e2?.message ?? "Errore computo" };
    return { projectId: project.id, computoId: computo.id, error: null };
  });

export const deleteProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Delete voci → computi → project (no cascade defined)
    const { data: computi } = await supabase
      .from("computi")
      .select("id")
      .eq("project_id", data.id)
      .eq("user_id", userId);
    const ids = (computi ?? []).map((c) => c.id);
    if (ids.length > 0) {
      await supabase.from("computo_voci").delete().in("computo_id", ids);
      await supabase.from("computi").delete().in("id", ids);
    }
    const { error } = await supabase.from("projects").delete().eq("id", data.id).eq("user_id", userId);
    return { error: error?.message ?? null };
  });

// ---------- Computo + Voci ----------

export const getComputo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: computo, error } = await supabase
      .from("computi")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !computo) return { computo: null, voci: [], error: error?.message ?? "Computo non trovato" };
    const { data: voci } = await supabase
      .from("computo_voci")
      .select("*")
      .eq("computo_id", data.id)
      .order("ordine", { ascending: true })
      .order("created_at", { ascending: true });
    return { computo, voci: voci ?? [], error: null };
  });

const voceWriteSchema = z.object({
  descrizione: z.string().trim().min(1).max(500),
  unita_misura: z.string().trim().min(1).max(20).default("cad"),
  prezzo_unitario: z.number().min(0).max(10_000_000),
  quantita: z.number().min(0).max(10_000_000),
  incidenza_manodopera: z.number().min(0).max(100).default(0),
  codice: z.string().trim().max(50).nullable().optional(),
  capitolo: z.string().trim().max(120).nullable().optional(),
  formula_misura: z.string().trim().max(200).nullable().optional(),
  visibile_cliente: z.boolean().default(true),
  macro_categoria_cliente: z.string().trim().max(120).nullable().optional(),
  descrizione_cliente: z.string().trim().max(500).nullable().optional(),
});

export const addVoce = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        computoId: z.string().uuid(),
        priceItemId: z.string().uuid().optional(),
        voce: voceWriteSchema.partial().optional(),
        quantita: z.number().min(0).max(10_000_000).default(1),
      })
      .parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Compute next ordine
    const { data: lastRow } = await supabase
      .from("computo_voci")
      .select("ordine")
      .eq("computo_id", data.computoId)
      .order("ordine", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrdine = (lastRow?.ordine ?? -1) + 1;

    // Snapshot from price list item
    if (data.priceItemId) {
      const { data: item, error: itemErr } = await supabase
        .from("price_list_items")
        .select("id, codice, descrizione, unita_misura, prezzo, incidenza_manodopera, categoria")
        .eq("id", data.priceItemId)
        .maybeSingle();
      if (itemErr || !item) return { voceId: null, error: "Voce prezziario non trovata" };

      const prezzo = Number(item.prezzo);
      const importo = Math.round(prezzo * data.quantita * 100) / 100;

      const { data: row, error } = await supabase
        .from("computo_voci")
        .insert({
          user_id: userId,
          computo_id: data.computoId,
          source_price_item_id: item.id,
          ordine: nextOrdine,
          codice: item.codice,
          descrizione: item.descrizione,
          unita_misura: item.unita_misura,
          prezzo_unitario: prezzo,
          quantita: data.quantita,
          importo,
          incidenza_manodopera: Number(item.incidenza_manodopera),
          capitolo: item.categoria,
          visibile_cliente: true,
        })
        .select("id")
        .single();
      if (error || !row) return { voceId: null, error: error?.message ?? "Errore" };
      return { voceId: row.id, error: null };
    }

    // Manual voce
    const parsed = voceWriteSchema.parse(data.voce ?? { descrizione: "Nuova voce", prezzo_unitario: 0, quantita: 0 });
    const importo = Math.round(parsed.prezzo_unitario * parsed.quantita * 100) / 100;
    const { data: row, error } = await supabase
      .from("computo_voci")
      .insert({
        user_id: userId,
        computo_id: data.computoId,
        ordine: nextOrdine,
        descrizione: parsed.descrizione,
        unita_misura: parsed.unita_misura,
        prezzo_unitario: parsed.prezzo_unitario,
        quantita: parsed.quantita,
        importo,
        incidenza_manodopera: parsed.incidenza_manodopera,
        codice: parsed.codice ?? null,
        capitolo: parsed.capitolo ?? null,
        formula_misura: parsed.formula_misura ?? null,
        visibile_cliente: parsed.visibile_cliente,
        macro_categoria_cliente: parsed.macro_categoria_cliente ?? null,
        descrizione_cliente: parsed.descrizione_cliente ?? null,
      })
      .select("id")
      .single();
    if (error || !row) return { voceId: null, error: error?.message ?? "Errore" };
    return { voceId: row.id, error: null };
  });

export const updateVoce = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        patch: voceWriteSchema.partial(),
      })
      .parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Get current row to compute new importo
    const { data: current } = await supabase
      .from("computo_voci")
      .select("prezzo_unitario, quantita")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!current) return { error: "Voce non trovata" };

    const prezzo = data.patch.prezzo_unitario ?? Number(current.prezzo_unitario);
    const quantita = data.patch.quantita ?? Number(current.quantita);
    const importo = Math.round(prezzo * quantita * 100) / 100;

    const { error } = await supabase
      .from("computo_voci")
      .update({ ...data.patch, importo, updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", userId);
    return { error: error?.message ?? null };
  });

export const deleteVoce = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("computo_voci")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    return { error: error?.message ?? null };
  });

export const reorderVoci = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        computoId: z.string().uuid(),
        orderedIds: z.array(z.string().uuid()).min(1).max(2000),
      })
      .parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Sequential updates; small lists expected. Could be optimized with rpc later.
    for (let i = 0; i < data.orderedIds.length; i++) {
      await supabase
        .from("computo_voci")
        .update({ ordine: i })
        .eq("id", data.orderedIds[i])
        .eq("user_id", userId)
        .eq("computo_id", data.computoId);
    }
    return { error: null };
  });

export const renameComputo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), nome: z.string().trim().min(1).max(150) }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("computi")
      .update({ nome: data.nome })
      .eq("id", data.id)
      .eq("user_id", userId);
    return { error: error?.message ?? null };
  });
