/**
 * Centralised env access with type-safety + early failure.
 *
 * Instead of sprinkling `process.env.X!` across the codebase, we read each
 * variable once here, fail loudly if missing on the server, and re-export
 * typed constants. Browser-only files get a separate (narrower) bundle by
 * importing from `@/lib/env-client`.
 */

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    // Surface clearly during dev — production builds catch this at build time.
    throw new Error(
      `Missing required env var: ${name}. Copy .env.local.example to .env.local and fill it in.`,
    );
  }
  return v;
}

function optional(name: string, fallback = ""): string {
  return process.env[name] || fallback;
}

export const env = {
  // Supabase — required for the app to boot (auth + DB are core).
  SUPABASE_URL: required("NEXT_PUBLIC_SUPABASE_URL"),
  SUPABASE_ANON_KEY: required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  SUPABASE_SERVICE_ROLE_KEY: required("SUPABASE_SERVICE_ROLE_KEY"),

  // Stripe — optional at boot; the checkout/webhook routes validate at runtime
  // and return a clear error if not configured. Lets us ship auth before
  // billing is wired.
  STRIPE_PUBLISHABLE_KEY: optional("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"),
  STRIPE_SECRET_KEY: optional("STRIPE_SECRET_KEY"),
  STRIPE_WEBHOOK_SECRET: optional("STRIPE_WEBHOOK_SECRET"),
  STRIPE_PRICE_ID_PRO: optional("STRIPE_PRICE_ID_PRO"),
  STRIPE_PRICE_ID_TEAM: optional("STRIPE_PRICE_ID_TEAM"),

  // Groq (server-only) — optional at boot; /api/transcribe validates at runtime.
  GROQ_API_KEY: optional("GROQ_API_KEY"),

  // Site
  SITE_URL: optional("NEXT_PUBLIC_SITE_URL", "http://localhost:3000"),
} as const;

/** Throw a clear error from a route handler when an optional var is actually needed. */
export function requireEnv(key: keyof typeof env): string {
  const v = env[key];
  if (!v) throw new Error(`Env var ${key} is required for this operation but is not set.`);
  return v;
}
