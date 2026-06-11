import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const itemSchema = z.object({
  code: z.string().trim().max(50).nullable().optional(),
  name: z.string().trim().min(1).max(300),
  category: z.string().trim().max(100).nullable().optional(),
  unit: z.string().trim().max(20).default("cad"),
  unit_price: z.number().min(0),
  notes: z.string().trim().max(500).nullable().optional(),
});

export const listPriceItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("studio_price_list")
      .select("*")
      .eq("user_id", userId)
      .order("category", { ascending: true })
      .order("name", { ascending: true });
    if (error) return { items: [], error: error.message };
    return { items: data ?? [], error: null };
  });

export const upsertPriceItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid().optional(), item: itemSchema }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.id) {
      const { error } = await supabase
        .from("studio_price_list")
        .update(data.item)
        .eq("id", data.id)
        .eq("user_id", userId);
      return { error: error?.message ?? null };
    }
    const { error } = await supabase
      .from("studio_price_list")
      .insert({ ...data.item, user_id: userId });
    return { error: error?.message ?? null };
  });

export const deletePriceItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid() }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("studio_price_list")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    return { error: error?.message ?? null };
  });

export const bulkImportPriceItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      items: z.array(itemSchema).min(1).max(2000),
      replaceAll: z.boolean().default(false),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.replaceAll) {
      await supabase.from("studio_price_list").delete().eq("user_id", userId);
    }
    const rows = data.items.map((it) => ({ ...it, user_id: userId }));
    const { error } = await supabase.from("studio_price_list").insert(rows);
    if (error) return { inserted: 0, error: error.message };
    return { inserted: rows.length, error: null };
  });
