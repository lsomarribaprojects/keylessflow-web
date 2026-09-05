/**
 * E2E for /api/community against PRODUCTION, leaving no junk behind:
 *   1. POST a throwaway lead → expect { ok: true }
 *   2. Confirm the auth user exists (service role) → delete it
 *   3. Delete the community_leads row if the table exists
 *
 * Run from the web repo:  node scripts/community_e2e.mjs
 * Reads SUPABASE url + service role from .env.local (never printed).
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
    }),
);

const BASE = process.env.BASE_URL || "https://keylessflow-web.vercel.app";
const email = `kf-e2e-${Date.now()}@example.com`;

// 1. POST lead
const r = await fetch(`${BASE}/api/community`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ name: "E2E Test", email, whatsapp: "+000", source: "e2e" }),
});
const body = await r.json().catch(() => ({}));
console.log("POST /api/community ->", r.status, JSON.stringify(body));
if (!r.ok || !body.ok) {
  console.error("FAIL: lead not captured");
  process.exit(1);
}

// 2. Verify + cleanup auth user
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const { data: list, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
if (listErr) {
  console.error("listUsers failed:", listErr.message);
  process.exit(1);
}
const user = list.users.find((u) => u.email === email);
console.log("auth user created:", Boolean(user), user ? `metadata=${JSON.stringify(user.user_metadata)}` : "");
if (!user) {
  console.error("FAIL: auth user missing");
  process.exit(1);
}
const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
console.log("auth user deleted:", !delErr, delErr ? delErr.message : "");

// 3. Cleanup leads row (table may not exist yet — that's fine)
const { error: leadErr } = await admin.from("community_leads").delete().eq("email", email);
console.log("community_leads row:", leadErr ? `skipped (${leadErr.message.slice(0, 60)})` : "deleted");

console.log("E2E_COMMUNITY_OK");
