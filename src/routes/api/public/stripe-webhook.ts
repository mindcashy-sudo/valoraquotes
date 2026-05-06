import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function setStatus(userId: string | null, status: string, subId?: string | null) {
  if (!userId) return;
  await supabaseAdmin
    .from("profiles")
    .update({
      subscription_status: status,
      ...(subId !== undefined ? { stripe_subscription_id: subId } : {}),
    })
    .eq("id", userId);
}

async function setStatusByCustomer(customerId: string, status: string, subId?: string | null) {
  await supabaseAdmin
    .from("profiles")
    .update({
      subscription_status: status,
      ...(subId !== undefined ? { stripe_subscription_id: subId } : {}),
    })
    .eq("stripe_customer_id", customerId);
}

export const Route = createFileRoute("/api/public/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.STRIPE_SECRET_KEY;
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!secret || !webhookSecret) {
          console.error("Stripe webhook misconfigured: missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET");
          return new Response("Stripe not configured", { status: 500 });
        }

        const stripe = new Stripe(secret);
        const sig = request.headers.get("stripe-signature");
        if (!sig) return new Response("Missing signature", { status: 400 });
        const body = await request.text();

        let event: Stripe.Event;
        try {
          event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
        } catch (err) {
          console.error("Stripe webhook signature verification failed:", (err as Error).message);
          return new Response("Invalid signature", { status: 400 });
        }

        try {
          switch (event.type) {
            case "checkout.session.completed": {
              const s = event.data.object as Stripe.Checkout.Session;
              const userId =
                (s.metadata?.user_id as string | undefined) ||
                (s.client_reference_id as string | undefined) ||
                null;
              const subId =
                typeof s.subscription === "string" ? s.subscription : s.subscription?.id ?? null;
              if (userId) await setStatus(userId, "active", subId);
              else if (typeof s.customer === "string")
                await setStatusByCustomer(s.customer, "active", subId);
              break;
            }
            case "customer.subscription.updated":
            case "customer.subscription.created": {
              const sub = event.data.object as Stripe.Subscription;
              const status = sub.status === "active" || sub.status === "trialing" ? "active" : "free";
              const customerId =
                typeof sub.customer === "string" ? sub.customer : sub.customer.id;
              await setStatusByCustomer(customerId, status, sub.id);
              break;
            }
            case "customer.subscription.deleted": {
              const sub = event.data.object as Stripe.Subscription;
              const customerId =
                typeof sub.customer === "string" ? sub.customer : sub.customer.id;
              await setStatusByCustomer(customerId, "free", null);
              break;
            }
          }
        } catch (e) {
          console.error("Webhook handler error", e);
          return new Response("Handler error", { status: 500 });
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
