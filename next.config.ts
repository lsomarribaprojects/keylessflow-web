import type { NextConfig } from "next";

// Minimum safe headers for every route (no full CSP on purpose: it would break
// Stripe/embeds). frame-ancestors blocks clickjacking.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // /movil records dictation from the phone mic → microphone allowed for self.
  { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        // Everything except the service worker, which keeps its own strict CSP below.
        source: "/((?!sw\\.js$).*)",
        headers: securityHeaders,
      },
      {
        // PWA service worker for /movil: never cache the worker itself so a
        // deploy replaces it on the next open; restrict it to a plain script.
        source: "/sw.js",
        headers: [
          ...securityHeaders.filter((h) => h.key !== "Content-Security-Policy"),
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
