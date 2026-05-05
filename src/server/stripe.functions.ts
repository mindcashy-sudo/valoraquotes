import { createServerFn } from "@tanstack/react-start";
import Stripe from "stripe";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { origin: string }) => ({
    origin: String(input.origin || ""),
  }))
  .handler(async ({ data, context }) => {
    const secret = process.env.STRIPE_SECRET_KEY;
    const priceId = process.env.STRIPE_PRICE_ID;
    if (!secret || !priceId) {
      return { url: null, error: "Stripe not configured" };
    }

    const stripe = new Stripe(secret);
    const { userId, claims } = context;
    const email = (claims.email as string | undefined) ?? undefined;
    const origin = data.origin || "https://valoraquotes.lovable.app";

    // Reuse customer if exists
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", userId)
      .maybeSingle();

    let customerId = profile?.stripe_customer_id ?? undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        metadata: { user_id: userId },
      });
      customerId = customer.id;
      await supabaseAdmin
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", userId);
    } else {
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: "all",
        limit: 10,
      });
      const activeSub = subscriptions.data.find(
        (sub) => sub.status === "active" || sub.status === "trialing",
      );
      if (activeSub) {
        await supabaseAdmin
          .from("profiles")
          .update({ subscription_status: "active", stripe_subscription_id: activeSub.id })
          .eq("id", userId);
        return { url: `${origin}/app`, error: null };
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/app?upgraded=1&checkout_session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/app?canceled=1`,
      client_reference_id: userId,
      metadata: { user_id: userId },
      subscription_data: { metadata: { user_id: userId } },
      allow_promotion_codes: true,
    });

    return { url: session.url, error: null };
  });

export const syncCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sessionId: string }) => ({
    sessionId: String(input.sessionId || "").trim(),
  }))
  .handler(async ({ data, context }) => {
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret || !data.sessionId) {
      return { isSubscribed: false, error: "Checkout non configurato" };
    }

    const stripe = new Stripe(secret);
    const session = await stripe.checkout.sessions.retrieve(data.sessionId, {
      expand: ["subscription"],
    });
    const ownerId =
      (session.metadata?.user_id as string | undefined) ||
      (session.client_reference_id as string | undefined);

    if (ownerId !== context.userId) {
      return { isSubscribed: false, error: "Sessione checkout non valida" };
    }

    const subscription = session.subscription;
    const subId = typeof subscription === "string" ? subscription : (subscription?.id ?? null);
    const subStatus = typeof subscription === "string" ? null : (subscription?.status ?? null);
    const isSubscribed =
      session.status === "complete" &&
      (session.payment_status === "paid" || subStatus === "active" || subStatus === "trialing");

    if (isSubscribed) {
      const customerId =
        typeof session.customer === "string" ? session.customer : (session.customer?.id ?? null);
      await supabaseAdmin
        .from("profiles")
        .update({
          subscription_status: "active",
          stripe_customer_id: customerId,
          stripe_subscription_id: subId,
        })
        .eq("id", context.userId);
    }

    return { isSubscribed, error: null };
  });

export const createCustomerPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { origin: string }) => ({
    origin: String(input.origin || ""),
  }))
  .handler(async ({ data, context }) => {
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) return { url: null, error: "Stripe non configurato" };

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", context.userId)
      .maybeSingle();

    if (!profile?.stripe_customer_id) {
      return { url: null, error: "Nessun abbonamento attivo da gestire" };
    }

    const stripe = new Stripe(secret);
    const origin = data.origin || "https://valoraquotes.lovable.app";
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${origin}/settings`,
    });
    return { url: session.url, error: null };
  });

export const syncCurrentStripeSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) return { isSubscribed: false, error: "Stripe non configurato" };

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", context.userId)
      .maybeSingle();

    if (!profile?.stripe_customer_id) {
      return { isSubscribed: false, error: null };
    }

    const stripe = new Stripe(secret);
    const subscriptions = await stripe.subscriptions.list({
      customer: profile.stripe_customer_id,
      status: "all",
      limit: 10,
    });
    const activeSub = subscriptions.data.find(
      (sub) => sub.status === "active" || sub.status === "trialing",
    );

    if (!activeSub) return { isSubscribed: false, error: null };

    await supabaseAdmin
      .from("profiles")
      .update({
        subscription_status: "active",
        stripe_subscription_id: activeSub.id,
      })
      .eq("id", context.userId);

    return { isSubscribed: true, error: null };
  });
