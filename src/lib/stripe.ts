/**
 * Stripe SDK singleton (server-side only).
 *
 * Use in Route Handlers, Server Actions, and webhook handlers. The publishable
 * key for client-side Stripe.js lives in NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
 * and is loaded on demand by checkout components.
 */
import "server-only";
import Stripe from "stripe";

import { env } from "@/lib/env";

// Lock the API version so future Stripe upgrades can't silently break us.
// Bump deliberately when migrating; check stripe.com/docs/upgrades for the diff.
export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  // Use the SDK's pinned default API version (matches the installed types).
  // To pin explicitly later: set apiVersion to whatever stripe types accept.
  appInfo: {
    name: "KeyLess Flow",
    url: env.SITE_URL,
  },
});

export const STRIPE_PRICES = {
  pro: env.STRIPE_PRICE_ID_PRO,
  team: env.STRIPE_PRICE_ID_TEAM,
} as const;

export type Plan = keyof typeof STRIPE_PRICES;
