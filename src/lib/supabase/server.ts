/**
 * Server-side Supabase clients.
 *
 * Two flavours:
 *   - `createServerClient()` — authenticated as the current user via cookies.
 *     Use in Server Components, Route Handlers, Server Actions.
 *   - `createAdminClient()` — service-role key, BYPASSES Row Level Security.
 *     Use ONLY in trusted server code (webhooks, cron, admin actions). Never
 *     return this client's results raw to a browser.
 */
import "server-only";
import { createServerClient as createSSRClient } from "@supabase/ssr";
import { createClient as createBaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { env } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Note on typing: we declare these as `any`-flavoured at the client boundary
 * because the hand-rolled `Database` interface doesn't satisfy supabase-js's
 * deeply-nested generic constraints (PostgrestVersion shape, etc.). The
 * Database type IS used by the typed helper functions below — call those
 * instead of `client.from(...)` for type safety until we replace this with
 * `supabase gen types typescript --project-id …` (runs once the Supabase
 * project exists; produces a 100% compatible Database type).
 */
export async function createServerClient() {
  const cookieStore = await cookies();
  return createSSRClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // setAll throws in pure Server Components; safe to ignore — the
          // session refresh middleware (when added) handles it via Response
          // cookies instead.
        }
      },
    },
  });
}

let _admin: ReturnType<typeof createBaseClient> | null = null;

export function createAdminClient() {
  if (_admin) return _admin;
  _admin = createBaseClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _admin;
}

// Re-export the schema types so route handlers can cast `.from()` results.
export type { Database };
