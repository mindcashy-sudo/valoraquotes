import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const studioSchema = z.object({
  studio_name: z.string().trim().max(200).nullable().optional(),
  architect_name: z.string().trim().max(200).nullable().optional(),
  vat_number: z.string().trim().max(50).nullable().optional(),
  fiscal_code: z.string().trim().max(50).nullable().optional(),
  address: z.string().trim().max(300).nullable().optional(),
  city: z.string().trim().max(100).nullable().optional(),
  postal_code: z.string().trim().max(20).nullable().optional(),
  province: z.string().trim().max(10).nullable().optional(),
  phone: z.string().trim().max(50).nullable().optional(),
  email: z.string().trim().max(200).nullable().optional(),
  pec: z.string().trim().max(200).nullable().optional(),
  iban: z.string().trim().max(50).nullable().optional(),
  albo_number: z.string().trim().max(50).nullable().optional(),
  logo_url: z.string().trim().max(500).nullable().optional(),
  default_work_zone: z.string().trim().max(200).nullable().optional(),
  default_vat_percent: z.number().min(0).max(100).optional(),
  default_validity_days: z.number().int().min(1).max(365).optional(),
  default_terms: z.string().trim().max(5000).nullable().optional(),
  onboarding_completed: z.boolean().optional(),
});

export const getStudioProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("studio_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) return { profile: null, error: error.message };
    return { profile: data, error: null };
  });

export const upsertStudioProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => studioSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("studio_profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      const { data: row, error } = await supabase
        .from("studio_profiles")
        .update(data)
        .eq("user_id", userId)
        .select("*")
        .single();
      if (error) return { profile: null, error: error.message };
      return { profile: row, error: null };
    } else {
      const { data: row, error } = await supabase
        .from("studio_profiles")
        .insert({ user_id: userId, ...data })
        .select("*")
        .single();
      if (error) return { profile: null, error: error.message };
      return { profile: row, error: null };
    }
  });

// Returns a signed upload URL so the client can PUT the logo directly to storage.
export const createLogoUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { ext: string }) =>
    z.object({ ext: z.string().regex(/^(png|jpg|jpeg|webp|svg)$/i) }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const path = `${userId}/logo-${Date.now()}.${data.ext.toLowerCase()}`;
    const { data: signed, error } = await supabase.storage
      .from("studio-assets")
      .createSignedUploadUrl(path);
    if (error || !signed) return { error: error?.message ?? "Upload URL error" };
    return { path, token: signed.token, signedUrl: signed.signedUrl, error: null };
  });

// Returns a temporary signed URL so the browser can display the logo.
export const getLogoSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { path: string }) =>
    z.object({ path: z.string().min(1).max(500) }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Path must start with userId/ — RLS enforces this anyway
    if (!data.path.startsWith(`${userId}/`)) {
      return { url: null, error: "Forbidden" };
    }
    const { data: signed, error } = await supabase.storage
      .from("studio-assets")
      .createSignedUrl(data.path, 60 * 60); // 1h
    if (error || !signed) return { url: null, error: error?.message ?? "Signed URL error" };
    return { url: signed.signedUrl, error: null };
  });
