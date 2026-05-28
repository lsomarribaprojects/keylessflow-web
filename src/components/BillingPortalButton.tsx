"use client";

import { useState } from "react";

/**
 * Sends the signed-in user to Stripe's hosted Customer Portal.
 * Backend (/api/billing/portal) looks up the user's stripe_customer_id
 * and creates a one-shot portal session.
 */
export function BillingPortalButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openPortal() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const body = await res.json();
      if (!res.ok || !body.url) throw new Error(body.error || "portal_failed");
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
        onClick={openPortal}
        disabled={loading}
        aria-disabled={loading}
        className="btn-ghost"
      >
        {loading ? "Abriendo..." : "Gestionar facturación"}
      </button>
      {error && (
        <span className="font-mono text-xs text-red-400" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
