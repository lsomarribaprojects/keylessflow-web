"use client";

import { useState } from "react";

type Props = { downloads: { win: string; mac: string } };

export function CommunityForm({ downloads }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErr("");
    try {
      const res = await fetch("/api/community", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, whatsapp, source: "comunidad" }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setErr(
          data.error === "invalid_email"
            ? "Revisá el email."
            : data.error === "invalid_name"
              ? "Poné tu nombre."
              : "No pudimos guardar tus datos. Intentá de nuevo.",
        );
        setStatus("error");
        return;
      }
      setStatus("done");
    } catch {
      setErr("Sin conexión. Intentá de nuevo.");
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="mt-10 rounded-lg border border-accent/30 bg-surface p-6">
        <p className="font-mono text-xs uppercase tracking-widest text-accent">listo</p>
        <h2 className="font-display mt-2 text-xl font-semibold">Descargá tu app</h2>
        <p className="mt-1 text-sm text-muted">
          Instalador único de ~40 MB. Doble-clic, Siguiente, listo.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <a href={downloads.win} className="btn-primary inline-flex items-center justify-center">
            ↓ Windows (.exe)
          </a>
          <a href={downloads.mac} className="btn-ghost inline-flex items-center justify-center">
            ↓ macOS (.dmg)
          </a>
        </div>
        <p className="mt-3 font-mono text-xs text-faint">
          Windows 10/11 · macOS 12+ · seguí los 3 pasos de abajo para tu API key gratis.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-10 rounded-lg border border-border bg-surface p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-muted">Nombre</span>
          <input
            required
            minLength={2}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-fg outline-none focus:border-accent"
            placeholder="Tu nombre"
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted">Email</span>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-fg outline-none focus:border-accent"
            placeholder="vos@ejemplo.com"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="text-muted">WhatsApp (opcional)</span>
          <input
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-fg outline-none focus:border-accent"
            placeholder="+505 ..."
          />
        </label>
      </div>
      {err && <p className="mt-3 text-sm text-red-400">{err}</p>}
      <button
        type="submit"
        disabled={status === "sending"}
        className="btn-primary mt-5 w-full sm:w-auto"
      >
        {status === "sending" ? "Guardando…" : "Quiero la app gratis →"}
      </button>
      <p className="mt-3 font-mono text-xs text-faint">
        Solo usamos tu contacto para avisarte de actualizaciones y del próximo workshop.
      </p>
    </form>
  );
}
