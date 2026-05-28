"use client";

import { useState } from "react";

import type { Plan } from "@/lib/stripe";

/**
 * Posts to /api/checkout and forwards the user to the Stripe Checkout URL.
 * Use anywhere a "subscribe" CTA needs to land in Stripe.
 */
export function CheckoutButton({
  plan,
  label,
  variant = "primary",
}: {
  plan: Plan;
  label: string;
  variant?: "primary" | "ghost";
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const body = await res.json();
      if (res.status === 401 && body.login_url) {
        // Not signed in — bounce through /login then back to /pricing.
        window.location.href = body.login_url;
        return;
      }
      if (!res.ok || !body.url) {
        throw new Error(body.error || "checkout_failed");
      }
      window.location.href = body.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setLoading(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-stretch gap-1">
      <button
        type="button"
        onClick={startCheckout}
        disabled={loading}
        aria-disabled={loading}
        className={variant === "primary" ? "btn-primary" : "btn-ghost"}
      >
        {loading ? "Conectando..." : label}
      </button>
      {error && (
        <span className="font-mono text-xs text-red-400" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
