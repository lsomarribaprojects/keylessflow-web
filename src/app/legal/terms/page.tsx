/**
 * /legal/terms — plain-English Terms of Service.
 *
 * Not legal advice. Working v1 to satisfy Stripe's requirement of a public
 * ToS URL; get reviewed by counsel before scaling. Adjust the trial and
 * quota numbers when the pricing changes.
 */
export const metadata = {
  title: "Términos de Servicio — KeyLess by Sinsajo",
  description:
    "Términos y condiciones de KeyLess by Sinsajo. Trial de 30 días, planes de suscripción, política de reembolsos.",
};

const UPDATED = "2 de julio de 2026";

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 md:py-24">
      <p className="eyebrow">Legal</p>
      <h1 className="font-display mt-3 font-semibold tracking-tight text-4xl md:text-5xl">
        Términos de Servicio
      </h1>
      <p className="mt-2 font-mono text-xs text-faint">Última actualización: {UPDATED}</p>

      <Section title="TL;DR">
        <p>
          Usar KeyLess by Sinsajo significa aceptar estos términos. Pruebas gratis 30 días con
          8 horas al mes. Después, si decides seguir, te suscribes por $9.99/mes o $79/año.
          Puedes cancelar cuando quieras. Si algo se rompe por nuestra culpa dentro de los primeros
          7 días de pago, te devolvemos el dinero completo.
        </p>
      </Section>

      <Section title="1. Servicio">
        <p>
          KeyLess by Sinsajo es una app de dictado por voz (Windows, macOS, Linux) que
          transcribe audio usando Groq Whisper vía nuestro backend proxy. Nos comprometemos
          a mantener disponibilidad razonable (target 99% mensual), pero no ofrecemos SLA
          formal en el tier Free / Pro individual (Team sí — ver contrato aparte).
        </p>
      </Section>

      <Section title="2. Free Trial">
        <p>
          Al crear cuenta obtienes 30 días con hasta 8 horas de dictado por mes calendario,
          sin tarjeta de crédito. Al día 25 te enviaremos un email con cupón opcional de 50%
          off para tu primer mes pagado. Al día 30, si no te has suscrito, la app dejará de
          transcribir pero tu cuenta y datos quedan intactos.
        </p>
      </Section>

      <Section title="3. Planes pagos">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <b>Pro Mensual — $9.99 USD/mes</b>. Renueva automáticamente cada mes.
          </li>
          <li>
            <b>Pro Anual — $79 USD/año</b>. Renueva automáticamente cada año.
          </li>
          <li>
            <b>Team — $29 USD/mes para 5 usuarios</b>. Contrato separado.
          </li>
        </ul>
        <p className="mt-3">
          Los planes Pro incluyen dictado ilimitado bajo un soft cap de 50 horas al mes. Si
          detectamos consumo abusivo (típicamente bots o transcripción industrial), nos
          reservamos el derecho de contactarte antes de aplicar límites duros.
        </p>
      </Section>

      <Section title="4. Pagos y facturación">
        <p>
          Los pagos son procesados por Stripe. Nunca vemos tu número de tarjeta. La
          facturación es en dólares estadounidenses, incluye impuestos si aplican. Puedes
          gestionar y cancelar tu suscripción en cualquier momento desde tu{" "}
          <a href="/account" className="underline">cuenta</a>.
        </p>
      </Section>

      <Section title="5. Reembolsos">
        <p>
          Si cancelas dentro de los primeros 7 días después de un pago y no has consumido
          más de 5 horas de dictado, te devolvemos el 100%. Después de 7 días o 5 horas
          usadas, no hay reembolsos parciales — puedes cancelar la renovación y seguir
          usando el servicio hasta que expire el periodo pagado.
        </p>
      </Section>

      <Section title="6. Uso aceptable">
        <p>Al usar la app te comprometes a NO:</p>
        <ul className="mt-3 list-disc space-y-2 pl-6">
          <li>Transcribir audio ilegal, difamatorio o que infrinja derechos de terceros.</li>
          <li>Automatizar el servicio para volumen industrial (contacta Team plan).</li>
          <li>
            Intentar romper, revertir, o abusar del servicio (bombardeo de requests,
            explotación de la cuota, etc.).
          </li>
          <li>Compartir tu cuenta con terceros o revender el servicio.</li>
        </ul>
      </Section>

      <Section title="7. Propiedad intelectual">
        <p>
          El cliente desktop de KeyLess by Sinsajo es open source bajo licencia MIT
          (github.com/lsomarribaprojects/KeyLess-Flow). El backend, la marca "KeyLess by
          Sinsajo", el logo, y el contenido de este sitio web son propiedad de Sinsajo
          Creators.
        </p>
      </Section>

      <Section title="8. Terminación">
        <p>
          Puedes borrar tu cuenta cuando quieras desde <code>/account</code>. Nos reservamos
          el derecho de suspender cuentas que violen estos términos, previo aviso por email
          cuando sea razonable.
        </p>
      </Section>

      <Section title="9. Limitación de responsabilidad">
        <p>
          El servicio se provee "as-is". No garantizamos precisión perfecta de la
          transcripción (dependemos de Groq Whisper). Nuestra responsabilidad total, por
          cualquier motivo, no supera la suma que nos pagaste en los últimos 12 meses. Nada
          en estos términos limita responsabilidades que no puedan limitarse por ley.
        </p>
      </Section>

      <Section title="10. Cambios a estos términos">
        <p>
          Si actualizamos estos términos de forma material, te avisaremos por email al menos
          14 días antes. Seguir usando el servicio después de esa fecha implica aceptación.
        </p>
      </Section>

      <Section title="11. Contacto">
        <p>
          Preguntas legales o de facturación:{" "}
          <a href="mailto:hello@sinsajocreators.com" className="underline">
            hello@sinsajocreators.com
          </a>
          .
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
