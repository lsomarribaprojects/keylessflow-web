/**
 * The step-by-step usage guide shown at /guia (signed-in only). Source of
 * truth for the steps is the desktop repo's docs/WORKSHOP.md — keep in sync.
 */
import Link from "next/link";

const RELEASES = "https://github.com/lsomarribaprojects/KeyLess-Flow/releases/latest/download";
export const INSTALLER_WIN = `${RELEASES}/KeyLessFlow-Setup.exe`;
export const INSTALLER_MAC = `${RELEASES}/KeyLess-by-Sinsajo.dmg`;

const SHORTCUTS: [string, string][] = [
  ["Ctrl + Alt (mantener)", "Dicta con el micrófono. Al soltar, el texto se pega donde está tu cursor."],
  ["Doble toque a Ctrl", "Dictado manos libres. Un toque a Ctrl para terminar."],
  ["Ctrl + Shift (mantener)", "Transcribe lo que SUENA en tu PC: audio de WhatsApp, videos, reuniones."],
  ["Triple toque a Ctrl", "Lo mismo, manos libres (clases o reuniones largas). Un toque para terminar."],
  ["Alt + 1…8", "Transforma el texto que tengas seleccionado: conciso, formal, traducir…"],
];

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="guide-step rounded-lg border border-border bg-surface p-6">
      <p className="font-mono text-xs uppercase tracking-widest text-accent">paso {n}</p>
      <h2 className="font-display mt-1.5 text-xl font-semibold">{title}</h2>
      <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted">{children}</div>
    </section>
  );
}

export function GuideContent() {
  return (
    <div className="space-y-6">
      <Step n={1} title="Instala la app (2 minutos)">
        <p>
          <b className="text-fg">Windows:</b>{" "}
          <a href={INSTALLER_WIN} className="text-accent underline underline-offset-2">
            descarga el instalador
          </a>{" "}
          → doble clic → Siguiente → listo. La app queda junto al reloj (bandeja del sistema).
        </p>
        <p className="rounded-md border border-border-2 bg-bg-band px-4 py-3">
          Si aparece el aviso azul de <b className="text-fg">SmartScreen</b>: “Más información” →
          “Ejecutar de todas formas”. Sale porque el instalador todavía no está firmado; es la
          app oficial.
        </p>
        <p>
          <b className="text-fg">Mac:</b>{" "}
          <a href={INSTALLER_MAC} className="text-accent underline underline-offset-2">
            descarga el .dmg
          </a>{" "}
          → arrastra KeyLess a Aplicaciones. La primera vez: clic derecho → Abrir. Dale permiso de{" "}
          <b className="text-fg">Micrófono</b> y de <b className="text-fg">Accesibilidad</b>{" "}
          (Ajustes del Sistema → Privacidad y seguridad). En Mac los atajos usan Control + Option.
        </p>
      </Step>

      <Step n={2} title="Consigue tu API key gratis (1 minuto)">
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            Entra a{" "}
            <a
              href="https://console.groq.com/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline underline-offset-2"
            >
              console.groq.com/keys
            </a>{" "}
            y crea tu cuenta con Google.
          </li>
          <li>
            Botón <b className="text-fg">Create API Key</b> → cópiala completa (empieza con{" "}
            <code className="text-fg">gsk_</code>).
          </li>
          <li>
            Abre KeyLess. Abajo del todo dice{" "}
            <i className="text-fg">“¿Workshop / tienes tu propia API key?”</i> → pégala →{" "}
            <b className="text-fg">Usar mi API key</b>.
          </li>
        </ol>
        <p>
          La key se guarda solo en tu computadora. El nivel gratuito de Groq alcanza de sobra para
          dictado personal. No la compartas con nadie: es como una contraseña.
        </p>
      </Step>

      <Step n={3} title="Dicta">
        <div className="overflow-hidden rounded-md border border-border-2">
          <table className="w-full text-left text-sm">
            <tbody>
              {SHORTCUTS.map(([k, v]) => (
                <tr key={k} className="border-b border-border last:border-0">
                  <th scope="row" className="w-2/5 bg-bg-band px-4 py-3 align-top font-medium text-fg">
                    {k}
                  </th>
                  <td className="px-4 py-3 align-top">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          <b className="text-fg">Comandos de voz</b> (dilos mientras dictas): “nueva línea”, “punto y
          aparte”, “coma”, “dos puntos”… y <b className="text-fg">“dale enter”</b> al final para que
          el mensaje se envíe solo.
        </p>
        <p>
          <b className="text-fg">El Hub</b> (clic en el ícono junto al reloj): historial de todo lo
          que dictaste, diccionario personal para nombres que la app confunde, snippets y el{" "}
          <b className="text-fg">Redactor</b>: escribes una idea en bruto y te la devuelve redactada
          en el tono y el largo que elijas. La lista completa de atajos está en Hub → Ajustes → “Ver
          comandos y atajos”.
        </p>
      </Step>

      <Step n={4} title="También en tu teléfono">
        <p>
          Abre{" "}
          <Link href="/movil" className="text-accent underline underline-offset-2">
            keylessflow-web.vercel.app/movil
          </Link>{" "}
          en Safari (iPhone) o Chrome (Android) → Compartir → “Añadir a pantalla de inicio”. En
          Ajustes pega la misma API key. Graba, transcribe y copia el texto a WhatsApp o Notas.
        </p>
        <p>En el iPhone la grabación se corta si bloqueas la pantalla o cambias de app.</p>
      </Step>

      <section className="guide-step rounded-lg border border-border bg-bg-band p-6">
        <h2 className="font-display text-xl font-semibold">¿Algo no funciona?</h2>
        <ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted">
          <li>
            <b className="text-fg">No pega el texto</b> → el cursor tiene que estar en un campo de
            texto (clic donde quieres escribir antes de dictar).
          </li>
          <li>
            <b className="text-fg">“No se detectó audio” con Ctrl + Shift</b> → el sonido tiene que
            salir por el dispositivo de salida predeterminado (el que suena de verdad).
          </li>
          <li>
            <b className="text-fg">La key no valida</b> → cópiala completa, sin espacios, empieza
            con <code className="text-fg">gsk_</code>.
          </li>
          <li>
            <b className="text-fg">Se dispara sola o no responde</b> → clic derecho en el ícono
            junto al reloj → Salir, y ábrela de nuevo.
          </li>
        </ul>
      </section>
    </div>
  );
}
