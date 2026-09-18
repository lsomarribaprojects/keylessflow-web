import type { MetadataRoute } from "next";

/**
 * Web App Manifest — makes /movil installable ("Añadir a pantalla de inicio"
 * on iPhone, "Instalar app" on Android). Served at /manifest.webmanifest and
 * auto-linked from every page's <head>.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/movil",
    name: "KeyLess by Sinsajo",
    short_name: "KeyLess",
    description: "Dicta en el teléfono, transcribe con Whisper y copia el texto donde quieras.",
    start_url: "/movil",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#12141c",
    theme_color: "#12141c",
    lang: "es",
    categories: ["productivity", "utilities"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
