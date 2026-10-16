/**
 * Minimal in-memory rate limiter (per IP, fixed window) for public endpoints.
 *
 * Per serverless instance only: it slows down bursts from one client but is not
 * a global limit. For a hard limit use Upstash Redis or the Vercel Firewall
 * rate-limit rule.
 */
import "server-only";

import type { NextRequest } from "next/server";

const buckets = new Map<string, { count: number; resetAt: number }>();

export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

/** Returns true when the request is allowed, false when the limit was hit. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}
