/**
 * /account — authenticated user dashboard.
 *
 * Shows:
 *   - which plan they're on (Free / Pro / Team)
 *   - download link for the desktop installer
 *   - activation code (the desktop app pastes this to authenticate)
 *   - manage billing button (Stripe Customer Portal — only for paid plans)
 *   - sign-out
 *
 * Free users see an "Upgrade to Pro" CTA. Paid users see "Manage billing".
 */
import { redirect } from "next/navigation";
import Link from "next/link";

import { createServerClient, createAdminClient } from "@/lib/supabase/server";
import type { SubscriptionRow } from "@/lib/supabase/database.types";
import { SignOutButton } from "@/components/SignOutButton";
import { CopyButton } from "@/components/CopyButton";
import { BillingPortalButton } from "@/components/BillingPortalButton";
import { CheckoutButton } from "@/components/CheckoutButton";

export const metadata = { title: "Mi cuenta — KeyLess Flow" };

const INSTALLER_URL =
  "https://github.com/lsomarribaprojects/KeyLess-Flow/releases/latest/download/KeyLessFlow-Setup.exe";

export default async function AccountPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?next=/account");
  }

  // Service-role read so RLS doesn't matter (and we can grab the
  // activation_code field once we add it — for now we derive it from user.id).
  const admin = createAdminClient();
  const subResult = await admin
    .from("subscriptions")
    .select("plan,status,current_period_end,cancel_at_period_end")
    .eq("user_id", user.id)
    .single();
  const sub = subResult.data as
    | Pick<SubscriptionRow, "plan" | "status" | "current_period_end" | "cancel_at_period_end">
    | null;

  const plan = sub?.plan ?? "free";
  const isPaid = plan === "pro" || plan === "team";

  // Activation code: deterministic, derived from user.id so it's stable
  // across logins but unique per user. The /api/auth/activate endpoint
  // accepts this code from the desktop app.
  const activationCode = formatActivationCode(user.id);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      {/* Header */}
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="eyebrow">Mi cuenta</p>
          <h1
            className="font-display mt-2 font-semibold tracking-tight"
            style={{ fontSize: "var(--text-display-s)" }}
          >
            Hola, {user.email?.split("@")[0]}
          </h1>
        </div>
        <SignOutButton />
      </div>

      {/* Plan card */}
      <section className="mt-10 rounded-lg border border-border-2 bg-surface p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-faint">
              plan actual
            </p>
            <p className="font-display mt-1 text-2xl font-semibold capitalize">
              {plan === "free" ? "Free (BYOK)" : `${plan} · ${sub?.status}`}
            </p>
            {sub?.current_period_end && isPaid && (
              <p className="mt-1 text-sm text-muted">
                {sub.cancel_at_period_end ? "Termina" : "Se renueva"} el{" "}
                {new Date(sub.current_period_end).toLocaleDateString("es", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            )}
          </div>
          {isPaid ? (
            <BillingPortalButton />
          ) : (
            <CheckoutButton plan="pro" label="Upgrade a Pro $9.99/mo" />
          )}
        </div>
      </section>

      {/* Download */}
      <section className="mt-6 rounded-lg border border-border bg-surface p-6">
        <p className="font-mono text-xs uppercase tracking-widest text-faint">
          descarga
        </p>
        <h2 className="font-display mt-2 text-xl font-semibold">
          KeyLess Flow para Windows
        </h2>
        <p className="mt-1 text-sm text-muted">
          Instalador único de ~40 MB. Doble-click, Siguiente, listo.
        </p>
        <a href={INSTALLER_URL} className="btn-primary mt-4 inline-flex">
          ↓ Descargar KeyLessFlow-Setup.exe
        </a>
        <p className="mt-3 font-mono text-xs text-faint">
          macOS · próximamente · Linux on demand
        </p>
      </section>

      {/* Activation code (only useful for Pro/Team — Free uses their own Groq key) */}
      {isPaid && (
        <section className="mt-6 rounded-lg border border-accent/30 bg-surface p-6">
          <p className="font-mono text-xs uppercase tracking-widest text-accent">
            código de activación
          </p>
          <h2 className="font-display mt-2 text-xl font-semibold">
            Conecta tu app desktop al plan {plan}
          </h2>
          <p className="mt-1 text-sm text-muted">
            Cuando abras KeyLess Flow por primera vez, elige &ldquo;Conectar con
            cuenta&rdquo; y pega este código:
          </p>
          <div className="mt-4 flex items-center gap-3 rounded-md border border-border-2 bg-bg-band px-4 py-3">
            <code className="flex-1 font-mono text-base text-fg">{activationCode}</code>
            <CopyButton text={activationCode} />
          </div>
          <p className="mt-3 font-mono text-xs text-faint">
            El código es único, permanente y solo válido para tu cuenta.
          </p>
        </section>
      )}

      {/* Free → upsell */}
      {!isPaid && (
        <section className="mt-6 rounded-lg border border-border bg-bg-band p-6">
          <p className="font-mono text-xs uppercase tracking-widest text-accent">
            estás en Free (BYOK)
          </p>
          <h2 className="font-display mt-2 text-xl font-semibold">
            ¿Sin ganas de manejar tu Groq API key?
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Plan Pro: $9.99/mes, dictado ilimitado (hasta 50h soft cap), cero setup.
            Nosotros pagamos la API. Tú solo dictas.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <CheckoutButton plan="pro" label="Subscribe Pro · $9.99/mo" />
            <Link href="/#precios" className="btn-ghost">
              Ver todos los planes
            </Link>
          </div>
        </section>
      )}
    </main>
  );
}

/* ------------------------------------------------------------------ helpers */
function formatActivationCode(uuid: string): string {
  // KF-XXXX-XXXX-XXXX — pretty + short, derived deterministically from the
  // UUID so it's stable across logins. Backend validates by reversing.
  const clean = uuid.replace(/-/g, "").toUpperCase();
  return `KF-${clean.slice(0, 4)}-${clean.slice(4, 8)}-${clean.slice(8, 12)}`;
}
