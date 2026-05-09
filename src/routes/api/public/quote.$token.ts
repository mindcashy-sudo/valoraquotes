import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

const ParamsSchema = z.object({ token: z.string().min(8).max(64) });

async function hashIp(ip: string | null): Promise<string | null> {
  if (!ip) return null;
  const data = new TextEncoder().encode(ip);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const Route = createFileRoute("/api/public/quote/$token")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const parsed = ParamsSchema.safeParse(params);
        if (!parsed.success) return new Response("Invalid token", { status: 400 });

        const { data: quote, error } = await supabaseAdmin
          .from("quotes")
          .select(
            "id, content, quote_number, project_address, share_status, expires_at, accepted_at, rejected_at, view_count, user_id, client_id",
          )
          .eq("public_token", parsed.data.token)
          .maybeSingle();

        if (error || !quote) return new Response("Not found", { status: 404 });
        if (
          quote.share_status === "private" ||
          (quote.expires_at && new Date(quote.expires_at).getTime() < Date.now())
        ) {
          return new Response("Expired", { status: 410 });
        }

        const { data: studio } = await supabaseAdmin
          .from("studio_profiles")
          .select(
            "studio_name, architect_name, logo_url, city, address, vat_number, email, phone, iban, albo_number, default_vat_percent",
          )
          .eq("user_id", quote.user_id)
          .maybeSingle();

        // logo_url is stored as a storage path inside the private "studio-assets"
        // bucket. Resolve a long-lived signed URL so the public page can render it.
        let logoSignedUrl: string | null = null;
        if (studio?.logo_url) {
          const { data: signed } = await supabaseAdmin.storage
            .from("studio-assets")
            .createSignedUrl(studio.logo_url, 60 * 60 * 24 * 7); // 7 days
          logoSignedUrl = signed?.signedUrl ?? null;
        }

        const { data: client } = quote.client_id
          ? await supabaseAdmin
              .from("clients")
              .select("name, city, address")
              .eq("id", quote.client_id)
              .maybeSingle()
          : { data: null };

        // Track view (fire and forget)
        const ip =
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          request.headers.get("cf-connecting-ip") ||
          null;
        const ua = request.headers.get("user-agent") || null;
        const ipHash = await hashIp(ip);
        const now = new Date().toISOString();

        await supabaseAdmin.from("quote_views").insert({
          quote_id: quote.id,
          user_agent: ua,
          ip_hash: ipHash,
        });

        await supabaseAdmin
          .from("quotes")
          .update({
            view_count: (quote.view_count ?? 0) + 1,
            last_viewed_at: now,
            ...(quote.share_status === "shared"
              ? { first_viewed_at: now, share_status: "viewed" }
              : {}),
          })
          .eq("id", quote.id);

        return Response.json({
          quote: {
            content: quote.content,
            quote_number: quote.quote_number,
            project_address: quote.project_address,
            share_status:
              quote.share_status === "shared" ? "viewed" : quote.share_status,
            accepted_at: quote.accepted_at,
            rejected_at: quote.rejected_at,
          },
          studio: studio ? { ...studio, logo_url: logoSignedUrl } : null,
          client,
        });
      },
      POST: async ({ params, request }) => {
        const parsed = ParamsSchema.safeParse(params);
        if (!parsed.success) return new Response("Invalid token", { status: 400 });

        let body: { action?: string; message?: string } = {};
        try {
          body = await request.json();
        } catch {
          return new Response("Invalid body", { status: 400 });
        }

        const action = body.action;
        if (action !== "accept" && action !== "reject") {
          return new Response("Invalid action", { status: 400 });
        }

        const { data: quote } = await supabaseAdmin
          .from("quotes")
          .select("id, share_status, expires_at")
          .eq("public_token", parsed.data.token)
          .maybeSingle();

        if (!quote) return new Response("Not found", { status: 404 });
        if (
          quote.share_status === "private" ||
          (quote.expires_at && new Date(quote.expires_at).getTime() < Date.now())
        ) {
          return new Response("Expired", { status: 410 });
        }

        const now = new Date().toISOString();
        const update =
          action === "accept"
            ? {
                share_status: "accepted",
                accepted_at: now,
                client_message: body.message?.slice(0, 1000) ?? null,
              }
            : {
                share_status: "rejected",
                rejected_at: now,
                client_message: body.message?.slice(0, 1000) ?? null,
              };

        const { error } = await supabaseAdmin
          .from("quotes")
          .update(update)
          .eq("id", quote.id);

        if (error) {
          console.error("[public-quote-action]:", error);
          return new Response("Internal server error", { status: 500 });
        }
        return Response.json({ ok: true });
      },
    },
  },
});
