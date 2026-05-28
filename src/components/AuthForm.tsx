"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "signup";

/**
 * Email + Google auth form, shared by /login and /signup.
 *
 * Magic-link goes through Supabase's signInWithOtp — same call works for
 * existing users (signs them in) and new ones (creates the auth.users row,
 * triggers our profile + subscription auto-seeding via DB triggers).
 *
 * After sign-in, /auth/callback figures out where to send the user:
 *   - explicit `next` query param wins (e.g. /pricing for "Subscribe Pro"
 *     button that redirected here)
 *   - otherwise: /account
 */
export function AuthForm({ mode }: { mode: Mode }) {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/account";

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("sending");
    setErrorMsg(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        shouldCreateUser: true,
      },
    });
    if (error) {
      setErrorMsg(error.message);
      setStatus("error");
      return;
    }
    setStatus("sent");
  }

  async function signInWithGoogle() {
    setStatus("sending");
    setErrorMsg(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setErrorMsg(error.message);
      setStatus("error");
    }
    // Successful OAuth redirects away; no UI update needed.
  }

  if (status === "sent") {
    return (
      <div className="rounded-lg border border-border bg-surface p-6 text-center">
        <p className="font-display text-xl font-semibold">📬 Revisa tu correo</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Te enviamos un link mágico a <span className="text-fg">{email}</span>. Ábrelo
          desde el mismo navegador donde estás ahora.
        </p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="mt-5 font-mono text-xs text-faint hover:text-fg"
        >
          ← Usar otro correo
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Google */}
      <button
        type="button"
        onClick={signInWithGoogle}
        disabled={status === "sending"}
        className="btn-ghost w-full justify-center"
        aria-disabled={status === "sending"}
      >
        <GoogleG />
        Continuar con Google
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="font-mono text-xs uppercase tracking-widest text-faint">o</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      {/* Magic link */}
      <form onSubmit={sendMagicLink} className="space-y-3">
        <label className="block">
          <span className="block text-sm text-muted">Tu correo</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            className="mt-1.5 block w-full rounded-md border border-border-2 bg-surface px-3.5 py-2.5 text-fg outline-none transition focus:border-accent"
          />
        </label>
        <button
          type="submit"
          disabled={status === "sending"}
          className="btn-primary w-full justify-center"
          aria-disabled={status === "sending"}
        >
          {status === "sending"
            ? "Enviando..."
            : mode === "signup"
              ? "Enviar magic link"
              : "Enviar magic link"}
        </button>
      </form>

      {errorMsg && (
        <p className="text-center text-sm text-red-400" role="alert">
          {errorMsg}
        </p>
      )}

      <p className="text-center font-mono text-xs text-faint">
        {mode === "signup" ? (
          <>
            ¿Ya tienes cuenta?{" "}
            <a href="/login" className="text-muted hover:text-fg">
              Iniciar sesión
            </a>
          </>
        ) : (
          <>
            ¿No tienes cuenta?{" "}
            <a href="/signup" className="text-muted hover:text-fg">
              Crear una
            </a>
          </>
        )}
      </p>
    </div>
  );
}

function GoogleG() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C33.6 6.1 29 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16.1 19 14 24 14c3 0 5.8 1.1 7.9 3l5.7-5.7C33.6 8.1 29 6 24 6 16.3 6 9.7 10.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5 0 9.5-1.9 12.9-5l-6-5c-2 1.5-4.4 2.5-6.9 2.5-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.7 39.7 16.3 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.3 5.5l6 5c-.4.4 6.5-4.7 6.5-14.5 0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}
