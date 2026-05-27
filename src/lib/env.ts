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
  // Supabase
  SUPABASE_URL: required("NEXT_PUBLIC_SUPABASE_URL"),
  SUPABASE_ANON_KEY: required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  SUPABASE_SERVICE_ROLE_KEY: required("SUPABASE_SERVICE_ROLE_KEY"),

  // Stripe
  STRIPE_PUBLISHABLE_KEY: required("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"),
  STRIPE_SECRET_KEY: required("STRIPE_SECRET_KEY"),
  STRIPE_WEBHOOK_SECRET: optional("STRIPE_WEBHOOK_SECRET"), // optional in dev
  STRIPE_PRICE_ID_PRO: required("STRIPE_PRICE_ID_PRO"),
  STRIPE_PRICE_ID_TEAM: optional("STRIPE_PRICE_ID_TEAM"),

  // Groq (server-only — never exposed to browser)
  GROQ_API_KEY: required("GROQ_API_KEY"),

  // Site
  SITE_URL: optional("NEXT_PUBLIC_SITE_URL", "http://localhost:3000"),
} as const;
