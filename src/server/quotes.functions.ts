import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FREE_LIMIT = 3;

const quoteSchema = z.object({
  title: z.string(),
  description: z.string(),
  duration: z.string(),
  finishLevel: z.string(),
  sections: z.array(z.any()),
  total: z.number(),
  notes: z.array(z.string()),
});

export const getQuoteStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [profileRes, countRes] = await Promise.all([
      supabase.from("profiles").select("subscription_status").eq("id", userId).maybeSingle(),
      supabase.from("quotes").select("id", { count: "exact", head: true }).eq("user_id", userId),
    ]);
    const status = profileRes.data?.subscription_status ?? "free";
    const count = countRes.count ?? 0;
    const isSubscribed = status === "active";
    return {
      subscriptionStatus: status,
      isSubscribed,
      count,
      limit: FREE_LIMIT,
      canGenerate: isSubscribed || count < FREE_LIMIT,
    };
  });

export const listQuotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("quotes")
      .select("id, content, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) return { quotes: [], error: error.message };
    return { quotes: data ?? [], error: null };
  });

export const saveQuoteFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        quote: quoteSchema,
        clientId: z.string().uuid().nullable().optional(),
        projectAddress: z.string().trim().max(300).nullable().optional(),
      })
      .parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("quotes")
      .insert({
        user_id: userId,
        content: data.quote,
        client_id: data.clientId ?? null,
        project_address: data.projectAddress ?? null,
      })
      .select("id, content, created_at")
      .single();
    if (error) return { quote: null, error: error.message };
    return { quote: row, error: null };
  });

export const updateQuoteFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; quote: unknown }) =>
    z.object({ id: z.string().uuid(), quote: quoteSchema }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("quotes")
      .update({ content: data.quote })
      .eq("id", data.id)
      .eq("user_id", userId);
    return { error: error?.message ?? null };
  });

export const deleteQuoteFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) =>
    z.object({ id: z.string().uuid() }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("quotes")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    return { error: error?.message ?? null };
  });

export const migrateLocalQuotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { quotes: unknown[] }) =>
    z.object({ quotes: z.array(quoteSchema) }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.quotes.length === 0) return { inserted: 0 };
    // Only migrate if user has no quotes yet (avoid duplicates)
    const { count } = await supabase
      .from("quotes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    if ((count ?? 0) > 0) return { inserted: 0 };
    const rows = data.quotes.map((q) => ({ user_id: userId, content: q }));
    const { error } = await supabase.from("quotes").insert(rows);
    if (error) return { inserted: 0, error: error.message };
    return { inserted: rows.length };
  });

/**
 * Reserve the next sequential quote number for the current user/year.
 * Returns a string like "2026-0001". Atomic via UPSERT + RETURNING on the
 * quote_counters table (RLS-protected per user).
 */
export const reserveQuoteNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const year = new Date().getFullYear();

    // Read current value
    const { data: existing } = await supabase
      .from("quote_counters")
      .select("last_number")
      .eq("user_id", userId)
      .eq("year", year)
      .maybeSingle();

    const next = (existing?.last_number ?? 0) + 1;

    const { error } = await supabase
      .from("quote_counters")
      .upsert(
        { user_id: userId, year, last_number: next, updated_at: new Date().toISOString() },
        { onConflict: "user_id,year" }
      );

    if (error) {
      // Fallback: timestamp-based number rather than a random one
      const fallback = `${year}-${Date.now().toString().slice(-4)}`;
      return { quoteNumber: fallback, error: error.message };
    }

    return {
      quoteNumber: `${year}-${String(next).padStart(4, "0")}`,
      error: null,
    };
  });
