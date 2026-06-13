/**
 * Stripe SDK singleton (server-side only).
 *
 * Use in Route Handlers, Server Actions, and webhook handlers. The publishable
 * key for client-side Stripe.js lives in NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
 * and is loaded on demand by checkout components.
 */
import "server-only";
import Stripe from "stripe";

import { env, requireEnv } from "@/lib/env";

/**
 * Lazily-constructed Stripe singleton.
 *
 * We don't build it at import time because STRIPE_SECRET_KEY is optional at
 * boot (auth ships before billing). Routes that need Stripe call `getStripe()`,
 * which throws a clear error if the key is missing.
 */
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  _stripe = new Stripe(requireEnv("STRIPE_SECRET_KEY"), {
    appInfo: { name: "KeyLess by Sinsajo", url: env.SITE_URL },
  });
  return _stripe;
}

export const STRIPE_PRICES = {
  pro: env.STRIPE_PRICE_ID_PRO,
  team: env.STRIPE_PRICE_ID_TEAM,
} as const;

export type Plan = keyof typeof STRIPE_PRICES;
