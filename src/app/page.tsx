import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <Hero />
        <SocialProof />
        <Features />
        <HowItWorks />
        <Pricing />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}

/* ---------------------------------------------------------------- Header */
function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/brand/hummingbird.png"
            alt="KeyLess Flow"
            width={28}
            height={28}
            priority
          />
          <span className="text-base font-semibold tracking-tight">
            KeyLess Flow
          </span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-[var(--muted)] md:flex">
          <a href="#features" className="hover:text-foreground transition">
            Features
          </a>
          <a href="#pricing" className="hover:text-foreground transition">
            Pricing
          </a>
          <a href="#faq" className="hover:text-foreground transition">
            FAQ
          </a>
          <a
            href="https://github.com/lsomarribaprojects/KeyLess-Flow"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition"
          >
            GitHub
          </a>
        </nav>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="hidden text-sm text-[var(--muted)] hover:text-foreground transition sm:inline"
          >
            Iniciar sesión
          </Link>
          <a
            href="#download"
            className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90"
          >
            Descargar
          </a>
        </div>
      </div>
    </header>
  );
}

/* ----------------------------------------------------------------- Hero */
function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="hero-glow absolute inset-0 -z-10" />
      <div className="mx-auto max-w-6xl px-6 pt-24 pb-20 text-center md:pt-32 md:pb-28">
        <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs text-[var(--muted)]">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-teal animate-pulse" />
          Disponible para Windows • macOS próximamente
        </span>
        <h1 className="mx-auto mt-6 max-w-4xl text-5xl font-semibold tracking-tight leading-[1.05] md:text-7xl">
          Habla. <span className="brand-text-gradient">Aparece donde escribes.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-[var(--muted)] md:text-xl">
          Mantén un hotkey, dicta, suelta. El texto aparece exacto donde está tu cursor.
          En cualquier app, en cualquier idioma, por <span className="text-foreground font-medium">25× menos costo</span> que Wispr Flow.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href="#download"
            className="brand-gradient rounded-full px-7 py-3.5 text-base font-semibold text-[var(--brand-navy)] shadow-[0_8px_32px_-8px_rgba(63,177,224,0.5)] transition hover:scale-[1.02]"
          >
            Descargar para Windows
          </a>
          <a
            href="#pricing"
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-7 py-3.5 text-base font-medium text-foreground transition hover:bg-[var(--surface-2)]"
          >
            Ver planes
          </a>
        </div>
        <p className="mt-5 text-xs text-[var(--muted)]">
          Gratis con tu propia Groq API key · Sin tarjeta de crédito requerida
        </p>

        {/* Visual placeholder for a future product GIF/video */}
        <div className="mx-auto mt-16 max-w-4xl">
          <div className="relative rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-1 shadow-[0_24px_64px_-32px_rgba(63,177,224,0.4)]">
            <div className="rounded-xl bg-[var(--surface-2)] aspect-video flex items-center justify-center">
              <span className="text-[var(--muted)] text-sm">
                [ Demo video coming soon · pill recording → paste en vivo ]
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ Social proof */
function SocialProof() {
  return (
    <section className="border-y border-[var(--border)] bg-[var(--surface)]/40">
      <div className="mx-auto max-w-6xl px-6 py-8 text-center">
        <p className="text-xs uppercase tracking-widest text-[var(--muted)]">
          Open source · Groq Whisper Large v3 Turbo · Privacy first
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- Features */
function Features() {
  const items = [
    {
      title: "Funciona en cualquier app",
      body: "Notepad, Chrome, Slack, VS Code, Word. Si tiene un campo de texto, KeyLess Flow escribe ahí.",
      icon: "✺",
    },
    {
      title: "Hotkeys configurables",
      body: "Ctrl+Alt para mantener-y-hablar, o doble Ctrl para modo manos libres.",
      icon: "⌘",
    },
    {
      title: "Multilenguaje",
      body: "Español, inglés, francés, portugués y los 90+ idiomas que soporta Whisper.",
      icon: "🌐",
    },
    {
      title: "Comandos por voz",
      body: '"Nueva línea", "punto", "coma" — atajos verbales se convierten en formato real.',
      icon: "▷",
    },
    {
      title: "Historial local + dashboard",
      body: "SQLite en tu máquina. Dashboard web para buscar, copiar y re-pegar transcripciones pasadas.",
      icon: "≡",
    },
    {
      title: "Tu data, tu control",
      body: "Audio nunca se almacena en nuestros servidores. Plan Free corre 100% en tu máquina.",
      icon: "✓",
    },
  ];

  return (
    <section id="features" className="mx-auto max-w-6xl px-6 py-24 md:py-32">
      <div className="max-w-2xl">
        <p className="text-sm font-medium text-brand-teal">Features</p>
        <h2 className="mt-2 text-4xl font-semibold tracking-tight md:text-5xl">
          Todo lo que esperas de un dictador moderno.
        </h2>
        <p className="mt-4 text-lg text-[var(--muted)]">
          Sin la mensualidad de Wispr Flow ni la complejidad de configurar Whisper a mano.
        </p>
      </div>
      <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <div
            key={item.title}
            className="group rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 transition hover:border-brand-teal/30 hover:bg-[var(--surface-2)]"
          >
            <div className="brand-text-gradient text-3xl">{item.icon}</div>
            <h3 className="mt-4 text-lg font-semibold">{item.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{item.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- How it works */
function HowItWorks() {
  const steps = [
    { n: "01", title: "Descarga e instala", body: "Un .exe de 40 MB. Doble click, listo." },
    { n: "02", title: "Pega tu Groq API key", body: "Gratis en console.groq.com/keys. O suscríbete al plan Pro y olvídate del setup." },
    { n: "03", title: "Mantén Ctrl+Alt y habla", body: "El texto aparece donde tu cursor está. En cualquier app." },
  ];

  return (
    <section className="border-y border-[var(--border)] bg-[var(--surface)]/40">
      <div className="mx-auto max-w-6xl px-6 py-24 md:py-32">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-brand-teal">Cómo funciona</p>
          <h2 className="mt-2 text-4xl font-semibold tracking-tight md:text-5xl">
            De cero a dictando en menos de 2 minutos.
          </h2>
        </div>
        <div className="mt-14 grid gap-8 md:grid-cols-3">
          {steps.map((step) => (
            <div key={step.n}>
              <div className="font-mono text-sm text-brand-teal">{step.n}</div>
              <h3 className="mt-3 text-xl font-semibold">{step.title}</h3>
              <p className="mt-2 text-[var(--muted)]">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- Pricing */
function Pricing() {
  return (
    <section id="pricing" className="mx-auto max-w-6xl px-6 py-24 md:py-32">
      <div className="text-center">
        <p className="text-sm font-medium text-brand-teal">Pricing</p>
        <h2 className="mt-2 text-4xl font-semibold tracking-tight md:text-5xl">
          Pagas hasta <span className="brand-text-gradient">25× menos</span> que Wispr Flow.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-[var(--muted)]">
          O cero — si trazes tu propia Groq API key.
        </p>
      </div>
      <div className="mx-auto mt-14 grid max-w-5xl gap-6 md:grid-cols-3">
        {/* Free */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8">
          <h3 className="text-lg font-semibold">Free</h3>
          <p className="mt-2 text-sm text-[var(--muted)]">Para devs y power users.</p>
          <div className="mt-6">
            <span className="text-5xl font-semibold">$0</span>
            <span className="ml-2 text-[var(--muted)]">/ siempre</span>
          </div>
          <a
            href="#download"
            className="mt-6 block rounded-full border border-[var(--border)] py-3 text-center text-sm font-medium transition hover:bg-[var(--surface-2)]"
          >
            Descargar
          </a>
          <ul className="mt-8 space-y-3 text-sm">
            {[
              "Dictado ilimitado",
              "Trae tu Groq API key (~$0.60/mes)",
              "100% local, sin login",
              "Open source · MIT",
            ].map((f) => (
              <li key={f} className="flex items-start gap-2">
                <span className="brand-text-gradient mt-0.5">✓</span>
                <span className="text-[var(--muted)]">{f}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Pro */}
        <div className="relative rounded-2xl border border-brand-teal/40 bg-[var(--surface)] p-8 shadow-[0_24px_64px_-32px_rgba(63,177,224,0.5)]">
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 brand-gradient rounded-full px-3 py-1 text-xs font-semibold text-[var(--brand-navy)]">
            Más popular
          </span>
          <h3 className="text-lg font-semibold">Pro</h3>
          <p className="mt-2 text-sm text-[var(--muted)]">Sin setup, sin API keys.</p>
          <div className="mt-6">
            <span className="text-5xl font-semibold">$9.99</span>
            <span className="ml-2 text-[var(--muted)]">/ mes</span>
          </div>
          <a
            href="/signup?plan=pro"
            className="brand-gradient mt-6 block rounded-full py-3 text-center text-sm font-semibold text-[var(--brand-navy)] transition hover:opacity-95"
          >
            Empezar Pro
          </a>
          <ul className="mt-8 space-y-3 text-sm">
            {[
              "Dictado ilimitado (50h soft cap)",
              "Sin API keys — login y listo",
              "Cloud sync de historial (próximamente)",
              "Soporte prioritario",
              "Cancelas cuando quieras",
            ].map((f) => (
              <li key={f} className="flex items-start gap-2">
                <span className="brand-text-gradient mt-0.5">✓</span>
                <span className="text-[var(--muted)]">{f}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Enterprise */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8">
          <h3 className="text-lg font-semibold">Team</h3>
          <p className="mt-2 text-sm text-[var(--muted)]">Para equipos pequeños.</p>
          <div className="mt-6">
            <span className="text-5xl font-semibold">$29</span>
            <span className="ml-2 text-[var(--muted)]">/ mes · 5 usuarios</span>
          </div>
          <a
            href="mailto:hello@sinsajocreators.com?subject=KeyLess%20Flow%20Team"
            className="mt-6 block rounded-full border border-[var(--border)] py-3 text-center text-sm font-medium transition hover:bg-[var(--surface-2)]"
          >
            Contactar
          </a>
          <ul className="mt-8 space-y-3 text-sm">
            {[
              "Todo lo de Pro",
              "Hasta 5 usuarios",
              "Diccionario compartido del equipo",
              "Facturación centralizada",
              "Onboarding 1-a-1",
            ].map((f) => (
              <li key={f} className="flex items-start gap-2">
                <span className="brand-text-gradient mt-0.5">✓</span>
                <span className="text-[var(--muted)]">{f}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="mt-10 text-center text-sm text-[var(--muted)]">
        ¿Curioso del costo real? Wispr Flow cobra <span className="text-foreground">$15/mes</span> ·
        Groq cobra <span className="text-foreground">$0.04/hora</span> de audio · KeyLess Flow Pro te
        cubre <span className="text-foreground">~50 horas/mes</span>.
      </p>
    </section>
  );
}

/* --------------------------------------------------------------- FAQ */
function FAQ() {
  const qa = [
    {
      q: "¿Mi audio se almacena en algún servidor?",
      a: "En el plan Free: no, todo corre local — el audio se sube directamente de tu máquina a Groq Whisper y se descarta. En el plan Pro: tampoco — nuestro backend proxy NO persiste audio, solo lo reenvía a Groq y registra el conteo de minutos para tu cuota.",
    },
    {
      q: "¿Funciona offline?",
      a: "El plan Free necesita internet porque usa Groq Whisper (cloud). Un modo local con mlx-whisper / faster-whisper está en roadmap para 2026.",
    },
    {
      q: "¿Por qué Windows primero si el proyecto original era de Mac?",
      a: "Sinsajo Creators ports the upstream macOS-only sflow to Windows. La validación de Mac viene después del MVP Windows + monetización.",
    },
    {
      q: "¿Qué pasa con mis transcripciones si cancelo Pro?",
      a: "El historial local en tu máquina sigue intacto para siempre. Si activamos cloud sync, exportamos tu data antes de cerrar la cuenta.",
    },
    {
      q: "¿Puedo hostearlo yo mismo?",
      a: "Sí — es open source (MIT). El repo está en github.com/lsomarribaprojects/KeyLess-Flow. Trae tu Groq key, corre el .exe y listo.",
    },
  ];

  return (
    <section id="faq" className="border-y border-[var(--border)] bg-[var(--surface)]/40">
      <div className="mx-auto max-w-3xl px-6 py-24 md:py-32">
        <div className="text-center">
          <p className="text-sm font-medium text-brand-teal">FAQ</p>
          <h2 className="mt-2 text-4xl font-semibold tracking-tight md:text-5xl">
            Preguntas frecuentes
          </h2>
        </div>
        <div className="mt-12 divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          {qa.map((item) => (
            <details key={item.q} className="group p-6">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-medium">
                {item.q}
                <span className="text-[var(--muted)] transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- Final CTA */
function FinalCTA() {
  return (
    <section id="download" className="mx-auto max-w-4xl px-6 py-24 text-center md:py-32">
      <h2 className="text-4xl font-semibold tracking-tight md:text-5xl">
        Tu próximo dictador <span className="brand-text-gradient">está a un click</span>.
      </h2>
      <p className="mx-auto mt-4 max-w-xl text-lg text-[var(--muted)]">
        Descarga el instalador para Windows. 40 MB. Sin Python, sin terminal, sin drama.
      </p>
      <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <a
          href="https://github.com/lsomarribaprojects/KeyLess-Flow/releases/latest"
          className="brand-gradient rounded-full px-8 py-4 text-base font-semibold text-[var(--brand-navy)] shadow-[0_8px_32px_-8px_rgba(63,177,224,0.5)] transition hover:scale-[1.02]"
        >
          ↓ Descargar para Windows
        </a>
        <span className="text-xs text-[var(--muted)]">
          macOS próximamente · Linux on demand
        </span>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- Footer */
function Footer() {
  return (
    <footer className="border-t border-[var(--border)]">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row md:items-start">
          <div className="flex items-center gap-2.5">
            <Image
              src="/brand/hummingbird.png"
              alt="Sinsajo Creators"
              width={24}
              height={24}
            />
            <span className="text-sm text-[var(--muted)]">
              KeyLess Flow · por{" "}
              <a
                href="https://github.com/lsomarribaprojects"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground hover:underline"
              >
                Sinsajo Creators
              </a>
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm text-[var(--muted)]">
            <a href="#pricing" className="hover:text-foreground transition">Pricing</a>
            <a href="#faq" className="hover:text-foreground transition">FAQ</a>
            <a
              href="https://github.com/lsomarribaprojects/KeyLess-Flow"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition"
            >
              GitHub
            </a>
            <a href="/legal/privacy" className="hover:text-foreground transition">
              Privacy
            </a>
            <a href="/legal/terms" className="hover:text-foreground transition">
              Terms
            </a>
          </div>
        </div>
        <p className="mt-8 text-center text-xs text-[var(--muted)] md:text-left">
          © 2026 Sinsajo Creators · Forked from{" "}
          <a
            href="https://github.com/daniel-carreon/sflow"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition"
          >
            daniel-carreon/sflow
          </a>{" "}
          · MIT License
        </p>
      </div>
    </footer>
  );
}
