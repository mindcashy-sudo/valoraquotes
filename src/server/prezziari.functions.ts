import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const itemSchema = z.object({
  codice: z.string().trim().max(50).nullable().optional(),
  descrizione: z.string().trim().min(1).max(500),
  unita_misura: z.string().trim().min(1).max(20).default("cad"),
  prezzo: z.number().min(0).max(10_000_000),
  incidenza_manodopera: z.number().min(0).max(100).default(0),
  categoria: z.string().trim().max(120).nullable().optional(),
  sottocategoria: z.string().trim().max(120).nullable().optional(),
});

export const listPrezziari = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("price_lists")
      .select("id, nome, regione, anno, source, is_public, owner_id, created_at")
      .or(`is_public.eq.true,owner_id.eq.${userId}`)
      .order("is_public", { ascending: false })
      .order("nome", { ascending: true });
    if (error) return { lists: [], error: error.message };
    return { lists: data ?? [], error: null };
  });

export const searchPriceItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        priceListId: z.string().uuid().optional(),
        query: z.string().trim().max(200).default(""),
        limit: z.number().int().min(1).max(100).default(30),
      })
      .parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("price_list_items")
      .select("id, price_list_id, codice, descrizione, unita_misura, prezzo, incidenza_manodopera, categoria")
      .limit(data.limit);

    if (data.priceListId) q = q.eq("price_list_id", data.priceListId);

    if (data.query.length > 0) {
      // tsquery-safe: split words, prefix-match each
      const tsq = data.query
        .split(/\s+/)
        .filter((w) => w.length > 0)
        .map((w) => w.replace(/[^\p{L}\p{N}]/gu, "") + ":*")
        .filter((w) => w.length > 2)
        .join(" & ");
      if (tsq.length > 0) {
        q = q.textSearch("search_tsv", tsq, { config: "italian" });
      } else {
        q = q.ilike("descrizione", `%${data.query}%`);
      }
    } else {
      q = q.order("codice", { ascending: true });
    }

    const { data: rows, error } = await q;
    if (error) return { items: [], error: error.message };
    return { items: rows ?? [], error: null };
  });

export const createPersonalPrezziario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        nome: z.string().trim().min(1).max(150),
        regione: z.string().trim().max(80).nullable().optional(),
        anno: z.number().int().min(1990).max(2100).nullable().optional(),
      })
      .parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("price_lists")
      .insert({
        owner_id: userId,
        nome: data.nome,
        regione: data.regione ?? null,
        anno: data.anno ?? null,
        source: "manual",
        is_public: false,
      })
      .select("id")
      .single();
    if (error) return { id: null, error: error.message };
    return { id: row.id, error: null };
  });

export const importPriceItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        priceListId: z.string().uuid(),
        items: z.array(itemSchema).min(1).max(2000),
        replaceAll: z.boolean().default(false),
      })
      .parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Ownership check (RLS would also catch this; we return a nicer error)
    const { data: list } = await supabase
      .from("price_lists")
      .select("id, owner_id, is_public")
      .eq("id", data.priceListId)
      .maybeSingle();
    if (!list || list.owner_id !== userId || list.is_public) {
      return { inserted: 0, error: "Prezziario non modificabile" };
    }

    if (data.replaceAll) {
      await supabase.from("price_list_items").delete().eq("price_list_id", data.priceListId);
    }

    const rows = data.items.map((it) => ({
      price_list_id: data.priceListId,
      codice: it.codice ?? null,
      descrizione: it.descrizione,
      unita_misura: it.unita_misura,
      prezzo: it.prezzo,
      incidenza_manodopera: it.incidenza_manodopera,
      categoria: it.categoria ?? null,
      sottocategoria: it.sottocategoria ?? null,
    }));

    const { error } = await supabase.from("price_list_items").insert(rows);
    if (error) return { inserted: 0, error: error.message };
    return { inserted: rows.length, error: null };
  });

export const deletePrezziario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid() }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("price_lists")
      .delete()
      .eq("id", data.id)
      .eq("owner_id", userId);
    return { error: error?.message ?? null };
  });
