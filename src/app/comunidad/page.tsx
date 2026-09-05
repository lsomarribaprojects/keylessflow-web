/**
 * /comunidad — free access for workshop / community attendees.
 *
 * Flow: leave name + email (+ WhatsApp) → we capture the lead → the download
 * buttons + the 3-step "get your free Groq key" guide appear. The desktop app
 * itself is free in BYOK mode (their own key), so this page IS the gate.
 */
import type { Metadata } from "next";

import { CommunityForm } from "@/components/CommunityForm";

export const metadata: Metadata = {
  title: "Comunidad — KeyLess by Sinsajo gratis",
  description:
    "Acceso gratuito a KeyLess by Sinsajo para asistentes del workshop: dicta en cualquier app y transcribe el audio de tu PC con tu propia API key.",
};

const RELEASES = "https://github.com/lsomarribaprojects/KeyLess-Flow/releases/latest/download";
const DOWNLOADS = {
  win: `${RELEASES}/KeyLessFlow-Setup.exe`,
  mac: `${RELEASES}/KeyLess-by-Sinsajo.dmg`,
};

export default function ComunidadPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 md:py-24">
      <p className="font-mono text-xs uppercase tracking-widest text-faint">
        comunidad · workshop
      </p>
      <h1 className="font-display mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
        KeyLess by Sinsajo, gratis para vos
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-muted">
        Dictá en WhatsApp, correo, Word o cualquier app — y transcribí los audios
        que suenan en tu computadora. Usás <b>tu propia API key gratuita</b> de
        Groq: sin cuenta, sin pagos. Dejanos tu contacto y descargá.
      </p>

      <CommunityForm downloads={DOWNLOADS} />

      <section className="mt-14 rounded-lg border border-border bg-surface p-6">
        <h2 className="font-display text-xl font-semibold">Después de instalar</h2>
        <ol className="mt-4 space-y-3 text-sm leading-relaxed text-muted">
          <li>
            <b className="text-fg">1.</b> Entrá a{" "}
            <a
              className="underline underline-offset-2"
              href="https://console.groq.com/keys"
              target="_blank"
              rel="noopener noreferrer"
            >
              console.groq.com/keys
            </a>{" "}
            (creá cuenta con Google) → <b className="text-fg">Create API Key</b> → copiala
            (empieza con <code>gsk_</code>).
          </li>
          <li>
            <b className="text-fg">2.</b> Abrí KeyLess: abajo dice{" "}
            <i>“¿Workshop / tienes tu propia API key?”</i> → pegala → <b className="text-fg">Usar mi API key</b>.
          </li>
          <li>
            <b className="text-fg">3.</b> Mantené <b className="text-fg">Ctrl + Alt</b> y hablá. Soltá:
            el texto aparece donde esté tu cursor. Para el audio de la compu (WhatsApp, videos):{" "}
            <b className="text-fg">Ctrl + Shift</b>.
          </li>
        </ol>
        <p className="mt-4 font-mono text-xs text-faint">
          Windows: si aparece el aviso azul de SmartScreen → “Más información” → “Ejecutar de todas formas”.
          La referencia completa de atajos está en la app: Hub → Ajustes → “Ver comandos y atajos”.
        </p>
      </section>
    </main>
  );
}
