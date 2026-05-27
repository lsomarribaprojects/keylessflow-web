/**
 * POST /api/checkout
 *
 * Creates a Stripe Checkout session for the current authenticated user and
 * returns the redirect URL. The landing page's pricing CTAs POST to this
 * with { plan: "pro" | "team" }.
 *
 * After successful payment, Stripe redirects to /signup/success?session_id=...
 * and fires the `checkout.session.completed` webhook to /api/stripe/webhook
 * which mirrors the subscription state into our DB.
 */
import { NextRequest, NextResponse } from "next/server";

import { env } from "@/lib/env";
import { stripe, STRIPE_PRICES, type Plan } from "@/lib/stripe";
import { createServerClient, createAdminClient } from "@/lib/supabase/server";
import type { SubscriptionRow } from "@/lib/supabase/database.types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { plan } = (await req.json().catch(() => ({}))) as { plan?: Plan };
  if (plan !== "pro" && plan !== "team") {
    return NextResponse.json({ error: "invalid_plan" }, { status: 400 });
  }

  const priceId = STRIPE_PRICES[plan];
  if (!priceId) {
    return NextResponse.json(
      { error: "plan_not_configured", plan },
      { status: 500 },
    );
  }

  // Require an authenticated user — landing's "Empezar Pro" button must route
  // through /signup first if no session exists.
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "auth_required", login_url: `${env.SITE_URL}/login?next=/pricing` },
      { status: 401 },
    );
  }

  // Reuse the existing Stripe customer if we've billed this user before.
  const admin = createAdminClient();
  const subResult = await admin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .single();
  const sub = subResult.data as Pick<SubscriptionRow, "stripe_customer_id"> | null;

  let customerId = sub?.stripe_customer_id ?? undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email!,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;
    await admin
      .from("subscriptions")
      .update({ stripe_customer_id: customerId } as never)
      .eq("user_id", user.id);
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${env.SITE_URL}/signup/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.SITE_URL}/pricing?canceled=1`,
    allow_promotion_codes: true,
    metadata: { supabase_user_id: user.id, plan },
    subscription_data: {
      metadata: { supabase_user_id: user.id, plan },
    },
  });

  return NextResponse.json({ url: session.url });
}
