/**
 * Desktop client tokens.
 *
 * The desktop app authenticates with our /api/transcribe via a long-lived
 * HMAC-signed token instead of a Supabase JWT. Why:
 *   - Supabase sessions are designed for browsers (cookies, refresh tokens)
 *     and don't refresh cleanly from a native client.
 *   - Our backend fully controls the desktop client — we don't need a
 *     generic OAuth-style flow.
 *   - HMAC verification is cheap and stateless.
 *
 * Format: kfd_<base64url(userId|exp)>.<base64url(hmac-sha256(payload, secret))>
 *   - prefix `kfd_` lets /api/transcribe distinguish from Supabase JWTs at
 *     a glance (Supabase tokens start with `eyJ`).
 *   - secret is SUPABASE_SERVICE_ROLE_KEY — never leaves the backend.
 */
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";

export const DESKTOP_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export function mintDesktopToken(userId: string): string {
  const exp = Math.floor(Date.now() / 1000) + DESKTOP_TOKEN_TTL_SECONDS;
  const payload = b64url(`${userId}|${exp}`);
  const sig = sign(payload);
  return `kfd_${payload}.${sig}`;
}

export function verifyDesktopToken(
  token: string,
): { userId: string; exp: number } | null {
  if (!token.startsWith("kfd_")) return null;
  const body = token.slice(4);
  const [payload, sig] = body.split(".");
  if (!payload || !sig) return null;

  const expected = sign(payload);
  if (!constantTimeEquals(sig, expected)) return null;

  let decoded: string;
  try {
    decoded = Buffer.from(payload, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const [userId, expStr] = decoded.split("|");
  const exp = Number(expStr);
  if (!userId || !Number.isFinite(exp)) return null;
  if (exp < Math.floor(Date.now() / 1000)) return null;
  return { userId, exp };
}

function sign(payload: string): string {
  return b64url(
    createHmac("sha256", env.SUPABASE_SERVICE_ROLE_KEY)
      .update(payload)
      .digest(),
  );
}

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function b64url(data: string | Buffer): string {
  return Buffer.from(data).toString("base64url");
}
