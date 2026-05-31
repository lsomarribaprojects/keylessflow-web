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
import type { SubscriptionRow, ProfileRow } from "@/lib/supabase/database.types";
import { SignOutButton } from "@/components/SignOutButton";
import { CopyButton } from "@/components/CopyButton";
import { BillingPortalButton } from "@/components/BillingPortalButton";
import { CheckoutButton } from "@/components/CheckoutButton";
import { FREE_QUOTA_SECONDS, PRO_SOFT_CAP_SECONDS } from "@/lib/quota";

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

  // Service-role read so RLS doesn't matter.
  const admin = createAdminClient();
  const [subResult, profileResult, usageResult] = await Promise.all([
    admin
      .from("subscriptions")
      .select("plan,status,current_period_end,cancel_at_period_end")
      .eq("user_id", user.id)
      .single(),
    admin
      .from("profiles")
      .select("trial_ends_at")
      .eq("id", user.id)
      .single(),
    admin
      .from("usage_current_month")
      .select("seconds_this_month")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const sub = subResult.data as
    | Pick<SubscriptionRow, "plan" | "status" | "current_period_end" | "cancel_at_period_end">
    | null;
  const profile = profileResult.data as Pick<ProfileRow, "trial_ends_at"> | null;
  const usageRow = usageResult.data as { seconds_this_month: number } | null;
  const secondsUsed = usageRow?.seconds_this_month ?? 0;

  const plan = sub?.plan ?? "free";
  const isPaid = plan === "pro" || plan === "team";
  const cap = isPaid ? PRO_SOFT_CAP_SECONDS : FREE_QUOTA_SECONDS;
  const pctUsed = Math.min(100, Math.round((secondsUsed / cap) * 100));
  const trialEndDate = profile?.trial_ends_at ? new Date(profile.trial_ends_at) : null;
  const trialActive = !isPaid && trialEndDate ? trialEndDate.getTime() > Date.now() : false;
  const trialDaysLeft = trialEndDate
    ? Math.max(0, Math.ceil((trialEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

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
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-xs uppercase tracking-widest text-faint">
              plan actual
            </p>
            <p className="font-display mt-1 text-2xl font-semibold capitalize">
              {isPaid ? `${plan} · ${sub?.status}` : "Free Trial"}
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
            {!isPaid && trialActive && (
              <p className="mt-1 text-sm text-muted">
                Tu trial termina en{" "}
                <span className="text-fg">
                  {trialDaysLeft} {trialDaysLeft === 1 ? "día" : "días"}
                </span>
              </p>
            )}
            {!isPaid && !trialActive && (
              <p className="mt-1 text-sm text-red-400">
                Tu trial terminó. Suscríbete para seguir dictando.
              </p>
            )}
          </div>
          {isPaid ? (
            <BillingPortalButton />
          ) : (
            <CheckoutButton plan="pro" label="Suscribirme a Pro" />
          )}
        </div>

        {/* Usage bar */}
        <div className="mt-6">
          <div className="flex items-baseline justify-between font-mono text-xs">
            <span className="text-muted">Uso este mes</span>
            <span className="text-fg">
              {formatHours(secondsUsed)} / {formatHours(cap)}
              {!isPaid && " (cap Free)"}
              {isPaid && " (soft cap)"}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-bg-band">
            <div
              className="h-full rounded-full bg-accent transition-all duration-500"
              style={{ width: `${pctUsed}%` }}
            />
          </div>
          {!isPaid && pctUsed >= 80 && (
            <p className="mt-2 font-mono text-xs text-accent">
              Casi llegas al cap mensual. Considera Pro para dictado ilimitado.
            </p>
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
function formatHours(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const totalMinutes = Math.round(seconds / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatActivationCode(uuid: string): string {
  // KF-XXXX-XXXX-XXXX — pretty + short, derived deterministically from the
  // UUID so it's stable across logins. Backend validates by reversing.
  const clean = uuid.replace(/-/g, "").toUpperCase();
  return `KF-${clean.slice(0, 4)}-${clean.slice(4, 8)}-${clean.slice(8, 12)}`;
}
