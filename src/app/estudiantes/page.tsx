/**
 * /estudiantes — the hook for Sinsajo students / workshop attendees.
 *
 * Leave name + email + password → account created and signed in on the spot
 * → /account, where the student finds the downloads (Windows/Mac), the phone
 * app and the step-by-step guide (/guia). Students use the app FREE in BYOK
 * mode (their own Groq key), so the account is the gate, not a paywall.
 * /comunidad redirects here (old workshop links keep working).
 */
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { StudentSignupForm } from "@/components/StudentSignupForm";

export const metadata: Metadata = {
  title: "Estudiantes — KeyLess by Sinsajo gratis",
  description:
    "Acceso gratuito a KeyLess by Sinsajo para estudiantes: crea tu cuenta y descarga la app para Windows o Mac, la app del teléfono y la guía de uso paso a paso.",
};

const PERKS: { t: string; d: string }[] = [
  {
    t: "La app para Windows y Mac",
    d: "Mantén Ctrl + Alt, habla y suelta: el texto aparece donde está tu cursor, en cualquier programa.",
  },
  {
    t: "Transcribe el audio de tu PC",
    d: "Audios de WhatsApp, videos, clases y reuniones: Ctrl + Shift y lo tienes en texto.",
  },
  {
    t: "La app del teléfono",
    d: "Graba en tu iPhone o Android, transcribe y copia el texto a WhatsApp o Notas.",
  },
  {
    t: "Guía de uso paso a paso",
    d: "Instalación, tu API key gratis, atajos, comandos de voz y soluciones a problemas comunes.",
  },
];

export default function EstudiantesPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-14 md:py-20">
      <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted hover:text-fg">
        <Image src="/brand/hummingbird.png" alt="" width={20} height={20} />
        KeyLess by Sinsajo
      </Link>

      <div className="mt-10 grid gap-12 md:grid-cols-[1fr_1.05fr] md:items-start">
        <div>
          <p className="eyebrow">Estudiantes Sinsajo</p>
          <h1
            className="font-display mt-3 font-semibold leading-[1.05] tracking-tight"
            style={{ fontSize: "var(--text-display-s)" }}
          >
            Tu cuenta gratis: la app y la guía para dictar en cualquier programa
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-muted">
            Crea tu cuenta en 30 segundos. Adentro tienes todo listo para instalar y empezar a
            dictar hoy. Gratis para siempre con tu propia API key de Groq (también gratis).
          </p>

          <ul className="mt-8 space-y-5">
            {PERKS.map((p) => (
              <li key={p.t} className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                <div>
                  <p className="font-medium text-fg">{p.t}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-muted">{p.d}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="md:sticky md:top-8">
          <StudentSignupForm />
          <p className="mt-4 text-center font-mono text-xs text-faint">
            Windows 10/11 · macOS 12+ · iPhone y Android desde el navegador
          </p>
        </div>
      </div>
    </main>
  );
}
