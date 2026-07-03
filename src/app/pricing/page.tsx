/**
 * /pricing — standalone page mirroring the pricing section on /.
 *
 * Deep-linked from emails, ads, and the "Ver precios" links throughout the
 * app. Rendered independently so we can iterate copy without touching the
 * hero-heavy homepage.
 */
import Link from "next/link";
import { CheckoutButton } from "@/components/CheckoutButton";

export const metadata = {
  title: "Precios — KeyLess by Sinsajo",
  description:
    "Empieza gratis con 8 horas al mes. Suscribete Pro Mensual $9.99, Pro Anual $79 (34% off), o Team $29 · 5 usuarios.",
};

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-20 md:py-28">
      <header className="max-w-2xl">
        <p className="eyebrow">Precios</p>
        <h1
          className="font-display mt-3 font-semibold tracking-tight"
          style={{ fontSize: "var(--text-h2)" }}
        >
          Precios simples. Sin sorpresas al mes 2.
        </h1>
        <p className="mt-5 leading-relaxed text-muted">
          Todo mundo empieza en el <b>Free Trial de 30 días</b> con 8 horas de
          dictado al mes — 9× más que Wispr Flow. Al día 25 te mandamos un
          cupón de 50% off para tu primer mes pagado si decides continuar.
        </p>
      </header>

      <section className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {/* Free Trial */}
        <article className="rounded-lg border border-border bg-surface p-8">
          <h2 className="font-display text-lg font-semibold">Free Trial</h2>
          <p className="mt-1.5 text-sm text-muted">30 días completos.</p>
          <div className="mt-6 flex items-baseline gap-2">
            <span className="font-display text-5xl font-semibold tracking-tight">$0</span>
            <span className="text-sm text-faint">/ 30 días</span>
          </div>
          <Link href="/signup?plan=free" className="btn-ghost mt-7 block w-full text-center">
            Empezar gratis
          </Link>
          <ul className="mt-8 space-y-3 text-sm text-muted">
            <li>✓ 8 horas de dictado al mes</li>
            <li>✓ Todas las features de Pro</li>
            <li>✓ Sin tarjeta de crédito</li>
            <li>✓ 9× más que Wispr Flow Free</li>
          </ul>
        </article>

        {/* Pro Mensual */}
        <article className="rounded-lg border border-border bg-surface p-8">
          <h2 className="font-display text-lg font-semibold">Pro Mensual</h2>
          <p className="mt-1.5 text-sm text-muted">Mes a mes.</p>
          <div className="mt-6 flex items-baseline gap-2">
            <span className="font-display text-5xl font-semibold tracking-tight">$9.99</span>
            <span className="text-sm text-faint">/ mes</span>
          </div>
          <div className="mt-7">
            <CheckoutButton plan="pro" label="Suscribirme mensual" variant="ghost" />
          </div>
          <ul className="mt-8 space-y-3 text-sm text-muted">
            <li>✓ Dictado ilimitado (50h soft cap)</li>
            <li>✓ Sin API keys, login y listo</li>
            <li>✓ Soporte prioritario</li>
            <li>✓ Cancela cuando quieras</li>
          </ul>
        </article>

        {/* Pro Anual (highlighted) */}
        <article className="relative rounded-lg border border-accent/40 bg-surface p-8 shadow-[0_30px_70px_-40px_oklch(0.83_0.13_184_/_0.6)]">
          <span className="absolute -top-3 left-8 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-ink">
            34% off · Recomendado
          </span>
          <h2 className="font-display text-lg font-semibold">Pro Anual</h2>
          <p className="mt-1.5 text-sm text-muted">$6.58 efectivo/mes.</p>
          <div className="mt-6 flex items-baseline gap-2">
            <span className="font-display text-5xl font-semibold tracking-tight">$79</span>
            <span className="text-sm text-faint">/ año</span>
          </div>
          <div className="mt-7">
            <CheckoutButton plan="pro" label="Mejor valor" variant="primary" />
          </div>
          <ul className="mt-8 space-y-3 text-sm text-muted">
            <li>✓ Todo lo de Pro Mensual</li>
            <li>✓ Ahorra $41 al año vs mensual</li>
            <li>✓ Locked-in price (sin subidas)</li>
            <li>✓ Cloud sync de historial (pronto)</li>
          </ul>
        </article>

        {/* Team */}
        <article className="rounded-lg border border-border bg-surface p-8">
          <h2 className="font-display text-lg font-semibold">Team</h2>
          <p className="mt-1.5 text-sm text-muted">Hasta 5 usuarios.</p>
          <div className="mt-6 flex items-baseline gap-2">
            <span className="font-display text-5xl font-semibold tracking-tight">$29</span>
            <span className="text-sm text-faint">/ mes</span>
          </div>
          <a
            href="mailto:hello@sinsajocreators.com?subject=KeyLess%20by%20Sinsajo%20Team"
            className="btn-ghost mt-7 block w-full text-center"
          >
            Contactar
          </a>
          <ul className="mt-8 space-y-3 text-sm text-muted">
            <li>✓ Todo lo de Pro Anual</li>
            <li>✓ Diccionario del equipo</li>
            <li>✓ Facturación centralizada</li>
            <li>✓ Onboarding 1-a-1</li>
          </ul>
        </article>
      </section>

      <p className="mt-14 text-center font-mono text-xs text-faint">
        Todos los planes incluyen: hotkey global · idioma multilenguaje · comandos por voz ·
        historial local · sin almacenamiento de audio.
      </p>
    </main>
  );
}
