/**
 * /legal/privacy — plain-English privacy policy.
 *
 * Not legal advice. This is a working v1 to unblock Stripe's requirement of
 * "public Privacy Policy URL"; replace with something reviewed by a lawyer
 * before scaling revenue past hobby project levels.
 */
export const metadata = {
  title: "Privacidad — KeyLess by Sinsajo",
  description:
    "Política de privacidad de KeyLess by Sinsajo. Qué datos guardamos, qué NO guardamos, y por qué.",
};

const UPDATED = "2 de julio de 2026";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 md:py-24">
      <p className="eyebrow">Legal</p>
      <h1 className="font-display mt-3 font-semibold tracking-tight text-4xl md:text-5xl">
        Política de Privacidad
      </h1>
      <p className="mt-2 font-mono text-xs text-faint">Última actualización: {UPDATED}</p>

      <Section title="TL;DR (versión honesta)">
        <p>
          Tu audio <b>nunca se guarda</b>. Solo registramos cuántos segundos de audio
          transcribiste (para la cuota), tu email, tu plan, y el estado de tu suscripción.
          Nada más. No vendemos tus datos, no los usamos para entrenar modelos, no los
          compartimos con terceros salvo los que estrictamente necesitamos para operar
          (Supabase, Groq, Stripe).
        </p>
      </Section>

      <Section title="1. Qué datos personales recopilamos">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <b>Email + nombre</b> (si lo provees) — para autenticación y comunicación.
          </li>
          <li>
            <b>Plan de suscripción + estado de facturación</b> — nos lo pasa Stripe.
          </li>
          <li>
            <b>Segundos de audio dictados y bytes subidos</b> — para calcular tu cuota
            mensual. No incluimos el audio ni el texto transcrito.
          </li>
          <li>
            <b>Token de sesión desktop</b> — HMAC generado en tu computadora, no reversible
            a datos personales.
          </li>
        </ul>
      </Section>

      <Section title="2. Qué NO recopilamos">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <b>Tu audio</b>. Va directo de tu computadora a Groq Whisper vía nuestro
            backend proxy, y se descarta en cuanto termina la transcripción.
          </li>
          <li>
            <b>El texto transcrito</b>. Nunca se persiste en nuestros servidores.
          </li>
          <li>
            <b>Contenido de tus otras aplicaciones</b>. La app desktop no lee ni monitorea
            nada más que el hotkey global.
          </li>
        </ul>
      </Section>

      <Section title="3. Cookies y almacenamiento local">
        <p>
          El sitio web usa cookies solo para mantener tu sesión (Supabase Auth). No usamos
          cookies de tracking, ni de terceros para publicidad.
        </p>
        <p className="mt-3">
          La app desktop guarda localmente en tu equipo un archivo{" "}
          <code className="rounded bg-surface px-1 text-xs">auth.json</code> con tu token
          HMAC y tu email. Puedes borrarlo cuando quieras cerrando sesión desde la app.
        </p>
      </Section>

      <Section title="4. Proveedores que procesan tus datos">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <b>Supabase</b> — auth + base de datos (US East). Sub-encargado.
          </li>
          <li>
            <b>Groq</b> — transcribe el audio. No firmamos DPA formal; su política dice que
            no persisten audio ni usan para entrenamiento.
          </li>
          <li>
            <b>Stripe</b> — procesa pagos y almacena método de pago. Nunca vemos tu tarjeta.
          </li>
          <li>
            <b>Vercel</b> — hosting del backend y sitio web.
          </li>
          <li>
            <b>Resend</b> — emails transaccionales (bienvenida, recordatorios de trial,
            recibos).
          </li>
        </ul>
      </Section>

      <Section title="5. Tus derechos">
        <p>
          Puedes en cualquier momento:
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-6">
          <li>Descargar todos tus datos escribiéndonos a <EmailLink />.</li>
          <li>
            Borrar tu cuenta y todos los datos asociados desde{" "}
            <a href="/account" className="underline">
              /account
            </a>{" "}
            → "Eliminar cuenta" (o pidiéndolo por email).
          </li>
          <li>Cancelar tu suscripción desde Stripe Portal en{" "}
            <a href="/account" className="underline">
              /account
            </a>.
          </li>
        </ul>
      </Section>

      <Section title="6. Contacto">
        <p>
          ¿Preguntas sobre privacidad, un pedido de datos, o cualquier otra cosa? Escríbenos a{" "}
          <EmailLink />. Respondemos en menos de 72 horas.
        </p>
      </Section>

      <p className="mt-16 font-mono text-xs text-faint">
        KeyLess by Sinsajo es un producto de Sinsajo Creators.
      </p>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="font-display text-2xl font-semibold">{title}</h2>
      <div className="mt-4 space-y-3 leading-relaxed text-muted">{children}</div>
    </section>
  );
}

function EmailLink() {
  return (
    <a href="mailto:hello@sinsajocreators.com" className="underline">
      hello@sinsajocreators.com
    </a>
  );
}
