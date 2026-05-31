"use client";

import { useState } from "react";

type Platform = "mac" | "linux";

/**
 * Inline email capture for platforms we haven't shipped yet. Renders as a
 * button by default; expands to an email input on click. Stays inside the
 * card layout — no full-screen modal needed for one field.
 */
export function WaitlistButton({
  platform,
  label = "Avísame",
  source = "landing",
  className = "btn-ghost",
}: {
  platform: Platform;
  label?: string;
  source?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("sending");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), platform, source }),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) {
        throw new Error(body.error || "waitlist_failed");
      }
      setStatus("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="rounded-md border border-accent/40 bg-bg-band px-3 py-2.5 text-center text-sm">
        <span className="text-accent">✓</span>{" "}
        <span className="text-fg">Listo,</span>{" "}
        <span className="text-muted">te avisamos en cuanto salga.</span>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${className} w-full`}
      >
        {label}
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <input
        type="email"
        required
        autoFocus
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="tu@email.com"
        className="block w-full rounded-md border border-border-2 bg-bg-band px-3 py-2 text-sm text-fg outline-none focus:border-accent"
      />
      <button
        type="submit"
        disabled={status === "sending"}
        aria-disabled={status === "sending"}
        className="btn-primary w-full"
      >
        {status === "sending" ? "Enviando…" : "Apuntarme a la waitlist"}
      </button>
      {errorMsg && (
        <p className="text-xs text-red-400" role="alert">
          {errorMsg}
        </p>
      )}
    </form>
  );
}
