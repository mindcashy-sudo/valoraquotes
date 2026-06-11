import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const clientSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().max(200).nullable().optional(),
  phone: z.string().trim().max(50).nullable().optional(),
  address: z.string().trim().max(300).nullable().optional(),
  city: z.string().trim().max(100).nullable().optional(),
  vat_number: z.string().trim().max(50).nullable().optional(),
  fiscal_code: z.string().trim().max(50).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export const listClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) return { clients: [], error: error.message };
    return { clients: data ?? [], error: null };
  });

export const getClient = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) =>
    z.object({ id: z.string().uuid() }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("clients")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) return { client: null, error: error.message };
    return { client: row, error: null };
  });

export const createClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => clientSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("clients")
      .insert({ user_id: userId, ...data })
      .select("*")
      .single();
    if (error) return { client: null, error: error.message };
    return { client: row, error: null };
  });

export const updateClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid() }).merge(clientSchema).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { id, ...payload } = data;
    const { data: row, error } = await supabase
      .from("clients")
      .update(payload)
      .eq("id", id)
      .eq("user_id", userId)
      .select("*")
      .single();
    if (error) return { client: null, error: error.message };
    return { client: row, error: null };
  });

export const deleteClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) =>
    z.object({ id: z.string().uuid() }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("clients")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    return { error: error?.message ?? null };
  });

// Quotes for a single client
export const listClientQuotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { clientId: string }) =>
    z.object({ clientId: z.string().uuid() }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("quotes")
      .select("id, content, created_at, status, project_address")
      .eq("user_id", userId)
      .eq("client_id", data.clientId)
      .order("created_at", { ascending: false });
    if (error) return { quotes: [], error: error.message };
    return { quotes: rows ?? [], error: null };
  });
