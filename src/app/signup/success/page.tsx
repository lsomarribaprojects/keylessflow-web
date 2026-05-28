/**
 * /signup/success?session_id=cs_test_...
 *
 * Landing page after Stripe Checkout succeeds. We don't trust the URL —
 * the actual subscription state gets written by the webhook handler. But
 * we can poll /account once the webhook lands (usually <2s).
 *
 * Practically: just show a thank-you + download + activation code, and
 * link to /account where everything is live.
 */
import Link from "next/link";

import { createServerClient } from "@/lib/supabase/server";

export const metadata = { title: "¡Bienvenido! — KeyLess Flow" };

export default async function SuccessPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto max-w-xl px-6 py-24 text-center">
      <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-ink">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M5 12l5 5 9-11"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <h1
        className="font-display mt-6 font-semibold tracking-tight"
        style={{ fontSize: "var(--text-display-s)" }}
      >
        ¡Bienvenido a Pro!
      </h1>
      <p className="mt-3 leading-relaxed text-muted">
        Pago recibido. Tu suscripción está activa{user?.email ? ` en ${user.email}` : ""}.
      </p>

      <div className="mt-10 space-y-4 text-left">
        <Link
          href="/account"
          className="block rounded-lg border border-accent/40 bg-surface p-5 transition hover:bg-surface-2"
        >
          <p className="eyebrow">paso 1</p>
          <p className="font-display mt-1 text-lg font-semibold">
            Abrir mi cuenta →
          </p>
          <p className="mt-1 text-sm text-muted">
            Tu código de activación + link de descarga directo te esperan ahí.
          </p>
        </Link>

        <div className="rounded-lg border border-border bg-bg-band p-5">
          <p className="eyebrow">paso 2</p>
          <p className="font-display mt-1 text-lg font-semibold">
            Descarga &amp; conecta la app
          </p>
          <p className="mt-1 text-sm text-muted">
            Si ya tienes KeyLess Flow instalada: tray icon → &ldquo;Conectar con
            cuenta Pro&rdquo; → pega tu código. Si no, descárgala desde tu cuenta.
          </p>
        </div>
      </div>

      <p className="mt-10 font-mono text-xs text-faint">
        Recibirás un email con el resumen de tu suscripción en los próximos
        minutos.
      </p>
    </main>
  );
}
