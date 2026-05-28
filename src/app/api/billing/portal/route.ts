/**
 * POST /api/billing/portal
 *
 * Creates a Stripe Billing Portal session for the signed-in user and
 * returns the redirect URL. Stripe Portal handles all "I want to change
 * payment method / cancel / see invoices" flows out of the box — we don't
 * have to build any of that ourselves.
 */
import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { getStripe } from "@/lib/stripe";
import { createServerClient, createAdminClient } from "@/lib/supabase/server";
import type { SubscriptionRow } from "@/lib/supabase/database.types";

export const runtime = "nodejs";

export async function POST() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  const admin = createAdminClient();
  const subResult = await admin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .single();
  const sub = subResult.data as Pick<SubscriptionRow, "stripe_customer_id"> | null;

  if (!sub?.stripe_customer_id) {
    return NextResponse.json(
      { error: "no_billing_history", hint: "Aún no has suscrito ningún plan." },
      { status: 400 },
    );
  }

  const portal = await getStripe().billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${env.SITE_URL}/account`,
  });

  return NextResponse.json({ url: portal.url });
}
