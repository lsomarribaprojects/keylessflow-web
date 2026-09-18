/**
 * /movil — KeyLess on the phone (PWA).
 *
 * iPhone has no way to run the desktop app (Python/Qt, global hotkeys, paste
 * into other apps are all impossible on iOS), and a native App Store build
 * would mean a Swift rewrite + a Mac + a developer account. What CAN work on
 * iOS is a web app installed from Safari ("Compartir → Añadir a pantalla de
 * inicio"): microphone via MediaRecorder, the same Groq Whisper + LLM cleanup
 * as the desktop, and the text copied/shared into WhatsApp, Notes, Mail…
 *
 * This page is a thin server wrapper (metadata + viewport); the app itself is
 * the client component <MobileDictation />.
 */
import type { Metadata, Viewport } from "next";

import { MovilClient } from "@/components/movil/MovilClient";

export const metadata: Metadata = {
  title: "KeyLess móvil — dicta desde tu iPhone",
  description:
    "Graba en el teléfono, transcribe con Whisper de Groq, limpia con IA y copia el texto donde quieras.",
  appleWebApp: {
    capable: true,
    title: "KeyLess",
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#12141c",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1, // iOS zooms inputs < 16px; we keep inputs ≥ 16px and lock zoom for an app feel
  viewportFit: "cover", // safe-area insets on notched iPhones
};

export default function MovilPage() {
  return <MovilClient apiBase="" />;
}
