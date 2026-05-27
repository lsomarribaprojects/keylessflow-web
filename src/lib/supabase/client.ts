/**
 * Browser-side Supabase client.
 *
 * Use in Client Components ("use client") for things like:
 *   - signing in / out
 *   - reading the current session
 *   - subscribing to realtime channels
 *
 * For data fetches you control, prefer the server client — it runs closer to
 * Postgres and never ships keys to the browser.
 */
"use client";

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
