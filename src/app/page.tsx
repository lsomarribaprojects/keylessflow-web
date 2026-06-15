import Image from "next/image";
import Link from "next/link";
import Reveal from "@/components/Reveal";
import { WaitlistButton } from "@/components/WaitlistButton";
import {
  AmbientGlow,
  Counter,
  Magnetic,
  ParallaxFloat,
  Words,
} from "@/components/motion-primitives";

const REPO = "https://github.com/lsomarribaprojects/KeyLess-Flow";

export default function Home() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <Hero />
        <TrustBand />
        <Stats />
        <Features />
        <HowItWorks />
        <Compare />
        <Pricing />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}

/* ============================================================ Header (N: slim, non-default) */
function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3.5">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/brand/hummingbird.png" alt="" width={26} height={26} priority />
          <span className="font-display text-[1.05rem] font-semibold tracking-tight">
            KeyLess by Sinsajo
          </span>
        </Link>
        <span className="hidden font-mono text-[0.7rem] tracking-wide text-faint sm:inline">
          v1.0 · windows
        </span>
        <div className="ml-auto flex items-center gap-1 sm:gap-5">
          <a href="#precios" className="hidden text-sm text-muted transition-colors duration-150 hover:text-fg sm:inline">
            Precios
          </a>
          <a href="#faq" className="hidden text-sm text-muted transition-colors duration-150 hover:text-fg sm:inline">
            FAQ
          </a>
          <a
            href={REPO}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Repositorio en GitHub"
            className="hidden rounded-md p-2 text-muted transition-colors duration-150 hover:text-fg sm:inline-flex"
          >
            <GitHubIcon />
          </a>
          <a href="#download" className="btn-primary text-sm">
            Descargar
          </a>
        </div>
      </div>
    </header>
  );
}

/* ============================================================ Hero (asymmetric split — breaks center axis) */
function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <AmbientGlow />
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 pt-20 pb-24 md:grid-cols-[1.05fr_0.95fr] md:pt-28 md:pb-28">
        {/* Left — type-driven, left aligned */}
        <Reveal className="max-w-xl">
          <span className="inline-flex items-center gap-2.5 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted">
            <span className="live-dot" />
            Disponible para Windows · macOS pronto
          </span>
          <h1
            className="font-display mt-6 font-semibold leading-[1.02] tracking-tight"
            style={{ fontSize: "var(--text-display)" }}
          >
            <span className="block">
              <Words>Habla.</Words>
            </span>
            <span className="block">
              <Words start={0.25}>Aparece</Words>{" "}
              <span className="mark">
                <Words start={0.5}>donde escribes.</Words>
              </span>
            </span>
          </h1>
          <p className="mt-7 max-w-md text-lg leading-relaxed text-muted">
            Mantén un hotkey, dicta, suelta. El texto cae exacto donde está tu cursor —
            en Notepad, Chrome, Slack o VS&nbsp;Code.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Magnetic>
              <a href="/signup?plan=free" className="btn-primary">
                Empezar gratis 30 días
              </a>
            </Magnetic>
            <Magnetic strength={0.18}>
              <a href="#precios" className="btn-ghost">
                Ver precios
              </a>
            </Magnetic>
          </div>
          <p className="mt-5 font-mono text-xs text-faint">
            8h de dictado gratis · sin tarjeta · 9× más que Wispr Flow
          </p>
        </Reveal>

        {/* Right — the product itself, as CSS art (no fake browser chrome) */}
        <ParallaxFloat strength={50} className="md:justify-self-end">
          <Reveal i={2}>
            <PillMotif />
          </Reveal>
        </ParallaxFloat>
      </div>
    </section>
  );
}

/* The real app's floating pill, rebuilt in CSS. Motion that *means* something:
   it shows what dictation looks like. */
function PillMotif() {
  const bars = [0.5, 0.9, 0.6, 1.05, 0.75, 1.2, 0.55, 0.95, 0.7, 1.1, 0.6];
  return (
    <div className="w-full max-w-sm">
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-4 rounded-full border border-border-2 bg-surface px-6 py-3.5 shadow-[0_24px_60px_-30px_oklch(0.72_0.12_233_/_0.6)]">
          <Image src="/brand/hummingbird.png" alt="" width={22} height={22} />
          <div className="wave" aria-hidden>
            {bars.map((d, idx) => (
              <i
                key={idx}
                style={{
                  animationDuration: `${900 + d * 360}ms`,
                  animationDelay: `${idx * -130}ms`,
                }}
              />
            ))}
          </div>
          <span className="font-mono text-xs text-muted">REC</span>
        </div>
      </div>
      <div className="mt-5 rounded-lg border border-border bg-bg-band p-4">
        <p className="font-mono text-[0.7rem] uppercase tracking-widest text-faint">transcrito</p>
        <p className="mt-2 leading-relaxed">
          Mándale el reporte a Ana antes de las cinco
          <span className="ml-0.5 inline-block h-[1.1em] w-[2px] translate-y-[0.18em] bg-accent" aria-hidden />
        </p>
      </div>
    </div>
  );
}

/* ============================================================ Trust band (colour shift = section ornament) */
function TrustBand() {
  return (
    <section className="border-b border-border bg-bg-band">
      <div className="mx-auto max-w-6xl px-6 py-7">
        <p className="text-center font-mono text-xs tracking-wide text-faint">
          OPEN SOURCE (MIT) &nbsp;·&nbsp; GROQ WHISPER LARGE V3 TURBO &nbsp;·&nbsp; EL AUDIO NUNCA SE GUARDA EN NUESTROS SERVIDORES
        </p>
      </div>
    </section>
  );
}

/* ============================================================ Stat-led row (honest numbers only) */
function Stats() {
  const stats: { node: React.ReactNode; u: string }[] = [
    {
      node: <Counter to={8} suffix="h" />,
      u: "dictado gratis / mes · 9× más que Wispr Flow",
    },
    { node: <Counter to={40} suffix=" MB" />, u: "instalador · sin Python ni terminal" },
    { node: <Counter to={90} suffix="+" />, u: "idiomas vía Whisper" },
    { node: <span>0</span>, u: "audio almacenado por nosotros" },
  ];
  return (
    <section className="mx-auto max-w-6xl px-6 py-16 md:py-20">
      <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s, idx) => (
          <Reveal as="div" i={idx} key={s.u} className="bg-bg p-6">
            <div className="font-display text-4xl font-semibold tracking-tight">{s.node}</div>
            <p className="mt-2 text-sm leading-snug text-muted">{s.u}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ============================================================ Features (Bento — varied tile sizes, custom SVG icons) */
function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-6 py-20 md:py-28">
      <Reveal className="max-w-2xl">
        <p className="eyebrow">Lo que hace</p>
        <h2 className="font-display mt-3 font-semibold tracking-tight" style={{ fontSize: "var(--text-h2)" }}>
          Un dictador que vive donde ya trabajas.
        </h2>
      </Reveal>

      <div className="mt-12 grid auto-rows-[180px] gap-5 md:grid-cols-3">
        {/* wide feature */}
        <Reveal as="article" className="bento md:col-span-2 md:row-span-1">
          <WindowIcon />
          <div>
            <h3 className="bento-title">Funciona en cualquier app</h3>
            <p className="bento-body">
              Notepad, Chrome, Slack, Word, tu terminal. Si tiene un campo de texto,
              KeyLess by Sinsajo escribe ahí — vía paste nativo, no macros frágiles.
            </p>
          </div>
        </Reveal>

        <Reveal as="article" i={1} className="bento">
          <KeyIcon />
          <div>
            <h3 className="bento-title">Hotkeys a tu gusto</h3>
            <p className="bento-body">Ctrl+Alt para mantener-y-hablar, o doble Ctrl manos libres.</p>
          </div>
        </Reveal>

        <Reveal as="article" i={2} className="bento">
          <GlobeIcon />
          <div>
            <h3 className="bento-title">Multilenguaje real</h3>
            <p className="bento-body">Español, inglés, portugués, francés y 90+ idiomas de Whisper.</p>
          </div>
        </Reveal>

        <Reveal as="article" i={3} className="bento">
          <CommandIcon />
          <div>
            <h3 className="bento-title">Comandos por voz</h3>
            <p className="bento-body">&ldquo;Nueva línea&rdquo;, &ldquo;coma&rdquo;, &ldquo;punto&rdquo; se vuelven formato real.</p>
          </div>
        </Reveal>

        {/* tall/wide feature */}
        <Reveal as="article" i={4} className="bento md:row-span-1">
          <ShieldIcon />
          <div>
            <h3 className="bento-title">Tu data, tu control</h3>
            <p className="bento-body">
              El plan Free corre 100% en tu máquina. Historial en SQLite local,
              dashboard web para buscar y re-pegar transcripciones pasadas.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ============================================================ How it works (numbered + connecting rule) */
function HowItWorks() {
  const steps = [
    { n: "01", title: "Descarga e instala", body: "Un .exe de 40 MB. Doble click y listo — sin Python, sin terminal." },
    { n: "02", title: "Inicia sesión y conecta", body: "Crea tu cuenta, copia tu código de activación y pégalo en la app. 30 días gratis, sin tarjeta — sin API keys ni configuración." },
    { n: "03", title: "Mantén Ctrl+Alt y habla", body: "El texto aparece donde está tu cursor. En cualquier app, al instante." },
  ];
  return (
    <section className="border-y border-border bg-bg-band">
      <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <Reveal className="max-w-2xl">
          <p className="eyebrow">Cómo funciona</p>
          <h2 className="font-display mt-3 font-semibold tracking-tight" style={{ fontSize: "var(--text-h2)" }}>
            De cero a dictando en menos de dos minutos.
          </h2>
        </Reveal>
        <div className="mt-14 grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-3">
          {steps.map((s, idx) => (
            <Reveal as="div" i={idx} key={s.n} className="bg-bg-band p-7">
              <div className="font-mono text-sm text-accent">{s.n}</div>
              <h3 className="font-display mt-4 text-xl font-semibold">{s.title}</h3>
              <p className="mt-2 leading-relaxed text-muted">{s.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================ Compare (honest, sourced cost claim) */
function Compare() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20 md:py-28">
      <div className="grid items-center gap-12 md:grid-cols-2">
        <Reveal>
          <p className="eyebrow">Comparativa Free vs Free</p>
          <h2 className="font-display mt-3 font-semibold leading-tight tracking-tight" style={{ fontSize: "var(--text-h2)" }}>
            <span className="mark">9×</span> más dictado gratis que Wispr Flow.
          </h2>
          <p className="mt-5 max-w-md leading-relaxed text-muted">
            Wispr Flow Free te limita a <strong className="text-fg">~3.5 horas/mes</strong> y bloquea
            las AI Commands. KeyLess by Sinsajo Free Trial te da <strong className="text-fg">8 horas/mes</strong>{" "}
            con TODAS las features de Pro durante 30 días — sin tarjeta.
          </p>
        </Reveal>
        <Reveal i={1} className="grid gap-4">
          <div className="rounded-lg border border-border bg-surface p-5">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted">Wispr Flow Free</span>
              <span className="font-display text-2xl font-semibold">3.5h<span className="text-base text-faint">/mes</span></span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-faint" style={{ width: "11%" }} />
            </div>
            <p className="mt-2 font-mono text-[0.7rem] text-faint">2,000 palabras/sem · sin AI Commands</p>
          </div>
          <div className="rounded-lg border border-accent/40 bg-surface p-5 shadow-[0_24px_60px_-34px_oklch(0.83_0.13_184_/_0.6)]">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-fg">KeyLess by Sinsajo Free Trial</span>
              <span className="font-display text-2xl font-semibold">8h<span className="text-base text-faint">/mes</span></span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-accent" style={{ width: "100%" }} />
            </div>
            <p className="mt-2 font-mono text-[0.7rem] text-faint">~72,000 palabras/mes · AI Commands incluidos</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ============================================================ Pricing */
function Pricing() {
  return (
    <section id="precios" className="border-y border-border bg-bg-band">
      <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <Reveal className="max-w-2xl">
          <p className="eyebrow">Precios</p>
          <h2 className="font-display mt-3 font-semibold tracking-tight" style={{ fontSize: "var(--text-h2)" }}>
            Empieza gratis. Sube a Pro cuando quieras dejar de configurar.
          </h2>
        </Reveal>

        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <Reveal as="div">
            <PlanCard
              name="Free Trial"
              tagline="Para probarlo en serio."
              price="$0"
              unit="/ 30 días"
              cta="Empezar gratis"
              href="/signup?plan=free"
              variant="ghost"
              features={[
                "8 horas de dictado al mes",
                "Todas las features de Pro",
                "Sin tarjeta de crédito",
                "9× más que Wispr Flow Free",
              ]}
            />
          </Reveal>
          <Reveal as="div" i={1}>
            <PlanCard
              name="Pro Mensual"
              tagline="Flexibilidad mes a mes."
              price="$9.99"
              unit="/ mes"
              cta="Suscribirme"
              href="/signup?plan=pro_monthly"
              variant="ghost"
              features={[
                "Dictado ilimitado (50h soft cap)",
                "Sin caducidad — no expira a los 30 días",
                "Soporte prioritario",
                "Cancelas cuando quieras",
              ]}
            />
          </Reveal>
          <Reveal as="div" i={2}>
            <PlanCard
              name="Pro Anual"
              tagline="$6.58 efectivo al mes."
              price="$79"
              unit="/ año"
              cta="Mejor valor"
              href="/signup?plan=pro_annual"
              variant="primary"
              badge="34% off · Recomendado"
              features={[
                "Todo lo de Pro Mensual",
                "Ahorra $41 vs mensual",
                "Cloud sync de historial (pronto)",
                "Locked-in price (sin subidas)",
                "Cancelas cuando quieras",
              ]}
            />
          </Reveal>
          <Reveal as="div" i={3}>
            <PlanCard
              name="Team"
              tagline="Para equipos pequeños."
              price="$29"
              unit="/ mes · 5 users"
              cta="Contactar"
              href="mailto:hello@sinsajocreators.com?subject=KeyLess%20Flow%20Team"
              variant="ghost"
              features={[
                "Todo lo de Pro Anual",
                "Hasta 5 usuarios",
                "Diccionario del equipo",
                "Facturación centralizada",
              ]}
            />
          </Reveal>
        </div>
        <p className="mt-8 text-center font-mono text-xs text-faint">
          ¿Probaste el trial y aún no estás listo? Te mandamos un cupón de <strong className="text-fg">50% off</strong> al final del mes para que sigas a $4.99 tu primer mes pagado.
        </p>
      </div>
    </section>
  );
}

function PlanCard({
  name, tagline, price, unit, cta, href, variant, badge, features,
}: {
  name: string; tagline: string; price: string; unit: string;
  cta: string; href: string; variant: "primary" | "ghost"; badge?: string;
  features: string[];
}) {
  const isPrimary = variant === "primary";
  return (
    <div
      className={`relative flex h-full flex-col rounded-lg border p-8 ${
        isPrimary
          ? "border-accent/40 bg-surface shadow-[0_30px_70px_-40px_oklch(0.83_0.13_184_/_0.6)]"
          : "border-border bg-surface"
      }`}
    >
      {badge && (
        <span className="absolute -top-3 left-8 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-ink">
          {badge}
        </span>
      )}
      <h3 className="font-display text-lg font-semibold">{name}</h3>
      <p className="mt-1.5 text-sm text-muted">{tagline}</p>
      <div className="mt-6 flex items-baseline gap-2">
        <span className="font-display text-5xl font-semibold tracking-tight">{price}</span>
        <span className="text-sm text-faint">{unit}</span>
      </div>
      <a href={href} className={`mt-7 text-center ${isPrimary ? "btn-primary" : "btn-ghost"}`}>
        {cta}
      </a>
      <ul className="mt-8 space-y-3 text-sm">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2.5">
            <CheckIcon />
            <span className="text-muted">{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ============================================================ FAQ */
function FAQ() {
  const qa = [
    {
      q: "¿Qué pasa después de los 30 días gratis?",
      a: "Al día 25 te llegará un email con un cupón de 50% off — si decides quedarte, tu primer mes Pro es $4.99 (en vez de $9.99). Si no actúas, la app deja de transcribir hasta que te suscribas. Cero cargos automáticos sorpresa.",
    },
    {
      q: "¿Cuánto es 8 horas de dictado realmente?",
      a: "A ritmo conversacional son ~72,000 palabras al mes — aprox. 240 emails largos, 8 reuniones documentadas, o 60 sesiones de brainstorm. Wispr Flow Free apenas te da 8,000 palabras al mes; nosotros 9× más.",
    },
    {
      q: "¿Mi audio se guarda en algún servidor?",
      a: "No. Nuestro backend recibe el audio, lo reenvía a Groq Whisper, devuelve el texto y descarta el audio. Solo registramos el conteo de segundos para tu cuota — nunca el audio ni el texto.",
    },
    {
      q: "¿Funciona offline?",
      a: "Hoy no — usamos Groq Whisper en la nube por velocidad y calidad. Un modo 100% local con mlx-whisper / faster-whisper está en el roadmap 2026 para usuarios Pro.",
    },
    {
      q: "¿Por qué Windows primero si el original era de Mac?",
      a: "Sinsajo Creators porta el sflow original (solo-macOS) a Windows. El instalador para macOS está en waitlist — registra tu email y te avisamos cuando salga.",
    },
    {
      q: "¿Qué pasa con mis transcripciones si cancelo?",
      a: "El historial local en tu máquina queda intacto para siempre. Si activamos cloud sync, exportamos tu data antes de cerrar la cuenta.",
    },
    {
      q: "¿Es open source?",
      a: "Sí, el cliente desktop es MIT open source: github.com/lsomarribaprojects/KeyLess-Flow. El backend (proxy + billing) es propietario porque procesa pagos y datos de clientes.",
    },
  ];
  return (
    <section id="faq" className="mx-auto max-w-3xl px-6 py-20 md:py-28">
      <Reveal>
        <p className="eyebrow">FAQ</p>
        <h2 className="font-display mt-3 font-semibold tracking-tight" style={{ fontSize: "var(--text-h2)" }}>
          Preguntas frecuentes
        </h2>
      </Reveal>
      <Reveal i={1} className="mt-10 divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
        {qa.map((item) => (
          <details key={item.q} className="group p-6">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-medium">
              {item.q}
              <span className="shrink-0 text-muted transition-transform duration-200 ease-out group-open:rotate-45">
                <PlusIcon />
              </span>
            </summary>
            <p className="mt-3 leading-relaxed text-muted">{item.a}</p>
          </details>
        ))}
      </Reveal>
    </section>
  );
}

/* ============================================================ Final CTA */
function FinalCTA() {
  return (
    <section id="download" className="border-t border-border">
      <div className="mx-auto max-w-4xl px-6 py-24 text-center md:py-32">
        <Reveal>
          <h2 className="font-display font-semibold leading-[1.04] tracking-tight" style={{ fontSize: "var(--text-display-s)" }}>
            Tu próximo dictador está a <span className="mark">un click</span>.
          </h2>
          <p className="mx-auto mt-5 max-w-md leading-relaxed text-muted">
            Empieza gratis con 8 horas/mes. Sin tarjeta, sin Python, sin drama.
          </p>
          <div className="mt-9 grid gap-4 sm:grid-cols-2">
            {/* Windows — disponible HOY */}
            <div className="rounded-lg border border-accent/40 bg-surface p-6 text-left shadow-[0_24px_60px_-34px_oklch(0.83_0.13_184_/_0.6)]">
              <div className="flex items-center gap-2 font-mono text-[0.7rem] uppercase tracking-widest text-accent">
                <span className="live-dot" />
                Disponible
              </div>
              <h3 className="font-display mt-3 text-lg font-semibold">Windows 10 / 11</h3>
              <p className="mt-1 text-sm text-muted">Instalador 40 MB. Crea tu cuenta y descarga.</p>
              <a href="/signup?plan=free" className="btn-primary mt-5 w-full">
                <DownloadIcon /> Empezar gratis
              </a>
            </div>

            {/* macOS — waitlist */}
            <div className="rounded-lg border border-border bg-surface p-6 text-left">
              <div className="font-mono text-[0.7rem] uppercase tracking-widest text-faint">
                Próximamente
              </div>
              <h3 className="font-display mt-3 text-lg font-semibold">macOS</h3>
              <p className="mt-1 text-sm text-muted">Te avisamos por email cuando esté listo.</p>
              <div className="mt-5">
                <WaitlistButton platform="mac" source="landing_finalcta" />
              </div>
            </div>
          </div>
          <p className="mt-7 font-mono text-xs text-faint">
            Linux on demand · escríbenos a hello@sinsajocreators.com si lo quieres
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ============================================================ Footer (Ft: statement, not 4-column grid) */
function Footer() {
  return (
    <footer className="border-t border-border bg-bg-band">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <Image src="/brand/hummingbird.png" alt="" width={26} height={26} />
              <span className="font-display text-lg font-semibold">KeyLess by Sinsajo</span>
            </div>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">
              Dictado por voz que aparece donde escribes. Por{" "}
              <a href="https://github.com/lsomarribaprojects" target="_blank" rel="noopener noreferrer" className="text-fg hover:underline">
                Sinsajo Creators
              </a>.
            </p>
          </div>
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-muted">
            <a href="#precios" className="transition-colors duration-150 hover:text-fg">Precios</a>
            <a href="#faq" className="transition-colors duration-150 hover:text-fg">FAQ</a>
            <a href={REPO} target="_blank" rel="noopener noreferrer" className="transition-colors duration-150 hover:text-fg">GitHub</a>
            <a href="/legal/privacy" className="transition-colors duration-150 hover:text-fg">Privacidad</a>
            <a href="/legal/terms" className="transition-colors duration-150 hover:text-fg">Términos</a>
          </nav>
        </div>
        <p className="mt-10 border-t border-border pt-6 font-mono text-xs text-faint">
          © 2026 Sinsajo Creators · fork de{" "}
          <a href="https://github.com/daniel-carreon/sflow" target="_blank" rel="noopener noreferrer" className="hover:text-muted">
            daniel-carreon/sflow
          </a>{" "}
          · MIT
        </p>
      </div>
    </footer>
  );
}

/* ============================================================ Icons (one consistent stroke set — no emoji, no mixed libs) */
function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.1.1 1.7 1.2 1.7 1.2 1 1.7 2.7 1.2 3.3.9.1-.7.4-1.2.7-1.5-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.7 18.3 5 18.3 5c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5Z" />
    </svg>
  );
}
function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg className="mt-0.5 shrink-0 text-accent" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m20 6-11 11-5-5" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function WindowIcon() {
  return (
    <svg className="feat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M7 6.5h.01M10 6.5h.01" />
    </svg>
  );
}
function KeyIcon() {
  return (
    <svg className="feat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" />
    </svg>
  );
}
function GlobeIcon() {
  return (
    <svg className="feat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18Z" />
    </svg>
  );
}
function CommandIcon() {
  return (
    <svg className="feat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6Z" />
    </svg>
  );
}
function ShieldIcon() {
  return (
    <svg className="feat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3 5 6v5c0 4.4 3 7.6 7 9 4-1.4 7-4.6 7-9V6l-7-3Z" />
      <path d="m9.5 12 1.8 1.8L15 10" />
    </svg>
  );
}
