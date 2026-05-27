/**
 * POST /api/stripe/webhook
 *
 * Receives every Stripe event and mirrors subscription state into Supabase.
 *
 * Stripe webhook setup:
 *   1. Add this URL (https://<your-domain>/api/stripe/webhook) under
 *      Developers → Webhooks → Add endpoint.
 *   2. Select events: checkout.session.completed,
 *      customer.subscription.{created,updated,deleted},
 *      invoice.{paid,payment_failed}.
 *   3. Copy the Signing secret → STRIPE_WEBHOOK_SECRET in .env.local.
 *
 * Local dev: `stripe listen --forward-to localhost:3000/api/stripe/webhook`
 * prints the signing secret to paste into .env.local.
 */
import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";

import { env } from "@/lib/env";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }
  if (!env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "webhook_secret_not_configured" },
      { status: 500 },
    );
  }

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    return NextResponse.json(
      { error: "invalid_signature", detail: String(err) },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.supabase_user_id;
      const subId = session.subscription as string | null;
      if (userId && subId) {
        await mirrorSubscription(admin, userId, subId);
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.supabase_user_id;
      if (userId) {
        await mirrorSubscriptionFromObject(admin, userId, sub);
      }
      break;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      // Stripe will retry; we just mark the local row.
      const subId =
        typeof (invoice as { subscription?: string | null }).subscription === "string"
          ? ((invoice as { subscription?: string | null }).subscription as string)
          : null;
      if (subId) {
        await admin
          .from("subscriptions")
          .update({ status: "past_due", updated_at: new Date().toISOString() } as never)
          .eq("stripe_subscription_id", subId);
      }
      break;
    }
    default:
      // No-op — many events arrive that we don't need (charge.succeeded etc.)
      break;
  }

  return NextResponse.json({ received: true });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function mirrorSubscription(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  subscriptionId: string,
) {
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  await mirrorSubscriptionFromObject(admin, userId, sub);
}

async function mirrorSubscriptionFromObject(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  sub: Stripe.Subscription,
) {
  const plan = (sub.metadata?.plan as "pro" | "team") ?? "pro";
  // Stripe moved `current_period_end` from Subscription to SubscriptionItem
  // in recent API versions; read from the first item to stay compatible.
  const rawEnd =
    sub.items?.data?.[0]?.current_period_end ??
    (sub as unknown as { current_period_end?: number }).current_period_end;
  const periodEnd =
    typeof rawEnd === "number"
      ? new Date(rawEnd * 1000).toISOString()
      : null;
  await admin
    .from("subscriptions")
    .update({
      plan: sub.status === "canceled" ? "free" : plan,
      status: sub.status,
      stripe_subscription_id: sub.id,
      stripe_customer_id:
        typeof sub.customer === "string" ? sub.customer : sub.customer.id,
      current_period_end: periodEnd,
      cancel_at_period_end: sub.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("user_id", userId);
}
