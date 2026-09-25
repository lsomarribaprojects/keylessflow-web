"use client";

import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

/**
 * Student sign-up: name + email + password (+ WhatsApp) → /api/community
 * creates the account with that password → we sign in right here and land
 * on /account. No email round-trip on purpose (Supabase's built-in SMTP only
 * sends a few emails per hour; a whole class signing up at once would stall).
 */
export function StudentSignupForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [password, setPassword] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [status, setStatus] = useState<"idle" | "sending" | "exists" | "error">("idle");
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErr("");
    const cleanEmail = email.trim().toLowerCase();
    try {
      const res = await fetch("/api/community", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email: cleanEmail,
          whatsapp,
          password,
          website,
          source: "estudiantes",
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.status === 409 || data.error === "exists") {
        setStatus("exists");
        return;
      }
      if (!res.ok || !data.ok) {
        setErr(
          data.error === "invalid_email"
            ? "Revisa el correo."
            : data.error === "invalid_name"
              ? "Escribe tu nombre."
              : data.error === "weak_password"
                ? "La contraseña necesita al menos 8 caracteres."
                : "No pudimos crear tu cuenta ahora mismo. Intenta de nuevo en unos minutos.",
        );
        setStatus("error");
        return;
      }
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
      if (error) {
        // Account exists but auto-login failed: send them to log in by hand.
        window.location.href = `/login?next=/account&email=${encodeURIComponent(cleanEmail)}`;
        return;
      }
      window.location.href = "/account?bienvenida=1";
    } catch {
      setErr("Sin conexión. Intenta de nuevo.");
      setStatus("error");
    }
  }

  if (status === "exists") {
    return (
      <div className="rounded-lg border border-accent/30 bg-surface p-6">
        <p className="font-mono text-xs uppercase tracking-widest text-accent">ya estás registrado</p>
        <h2 className="font-display mt-2 text-xl font-semibold">Ese correo ya tiene cuenta</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Inicia sesión para entrar a tu cuenta. Si no recuerdas la contraseña (o te registraste
          antes sin una), déjala vacía y te enviamos un link de acceso al correo.
        </p>
        <a
          href={`/login?next=/account&email=${encodeURIComponent(email.trim().toLowerCase())}`}
          className="btn-primary mt-5 inline-flex items-center justify-center"
        >
          Iniciar sesión →
        </a>
      </div>
    );
  }

  const input =
    "mt-1 w-full rounded-md border border-border-2 bg-bg px-3 py-2.5 text-fg outline-none transition focus:border-accent";

  return (
    <form onSubmit={submit} className="rounded-lg border border-border bg-surface p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-muted">Nombre</span>
          <input
            required
            minLength={2}
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={input}
            placeholder="Tu nombre"
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted">Correo</span>
          <input
            required
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={input}
            placeholder="tu@correo.com"
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted">Crea una contraseña</span>
          <input
            required
            type="password"
            minLength={8}
            maxLength={72}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={input}
            placeholder="Mínimo 8 caracteres"
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted">WhatsApp (opcional)</span>
          <input
            type="tel"
            autoComplete="tel"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            className={input}
            placeholder="+505 ..."
          />
        </label>
        {/* Honeypot: invisible to people, bots fill it. */}
        <label aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
          Sitio web
          <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </label>
      </div>
      {err && (
        <p className="mt-3 text-sm text-red-400" role="alert">
          {err}
        </p>
      )}
      <button type="submit" disabled={status === "sending"} className="btn-primary mt-5 w-full sm:w-auto">
        {status === "sending" ? "Creando tu cuenta…" : "Crear mi cuenta gratis →"}
      </button>
      <p className="mt-3 font-mono text-xs text-faint">
        Sin tarjeta. Usamos tu contacto solo para avisarte de actualizaciones y del próximo taller.
        ¿Ya tienes cuenta?{" "}
        <a href="/login?next=/account" className="text-muted underline underline-offset-2 hover:text-fg">
          Inicia sesión
        </a>
      </p>
    </form>
  );
}
