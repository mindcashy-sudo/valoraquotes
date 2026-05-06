import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function generateToken(): string {
  // 24-char URL-safe token (base36, ~125 bits when prefixed with random bytes)
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 24);
}

export const shareQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; expiresInDays?: number }) =>
    z
      .object({
        id: z.string().uuid(),
        expiresInDays: z.number().int().min(1).max(365).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: existing } = await supabase
      .from("quotes")
      .select("id, public_token, share_status")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();

    if (!existing) return { token: null, error: "Preventivo non trovato" };

    const token = existing.public_token ?? generateToken();
    const expiresAt = data.expiresInDays
      ? new Date(Date.now() + data.expiresInDays * 24 * 3600 * 1000).toISOString()
      : null;

    const { error } = await supabase
      .from("quotes")
      .update({
        public_token: token,
        share_status:
          existing.share_status === "accepted" || existing.share_status === "rejected"
            ? existing.share_status
            : "shared",
        shared_at: new Date().toISOString(),
        expires_at: expiresAt,
      })
      .eq("id", data.id)
      .eq("user_id", userId);

    if (error) return { token: null, error: error.message };
    return { token, error: null };
  });

export const unshareQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("quotes")
      .update({
        public_token: null,
        share_status: "private",
        shared_at: null,
        expires_at: null,
      })
      .eq("id", data.id)
      .eq("user_id", userId);
    return { error: error?.message ?? null };
  });

export const getQuoteShareInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row } = await supabase
      .from("quotes")
      .select(
        "public_token, share_status, shared_at, expires_at, first_viewed_at, last_viewed_at, view_count, accepted_at, rejected_at, client_message",
      )
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    return { share: row ?? null };
  });
