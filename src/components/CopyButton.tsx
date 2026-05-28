"use client";

import { useState } from "react";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Older browsers or permission denied — fall back to manual.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded-md border border-border-2 bg-surface px-3 py-1.5 font-mono text-xs text-muted transition hover:text-fg"
      aria-label="Copiar al portapapeles"
    >
      {copied ? "✓ copiado" : "Copiar"}
    </button>
  );
}
