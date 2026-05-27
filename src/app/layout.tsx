import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "KeyLess Flow — Voice to text para Windows y Mac",
  description:
    "Dicta donde quieras con un hotkey. Whisper de Groq, paste automático, 25x más barato que Wispr Flow.",
  applicationName: "KeyLess Flow",
  authors: [{ name: "Sinsajo Creators" }],
  keywords: [
    "voice to text",
    "dictado por voz",
    "wispr flow alternative",
    "windows dictation",
    "groq whisper",
    "sinsajo creators",
  ],
  openGraph: {
    title: "KeyLess Flow — Voice to text para Windows y Mac",
    description:
      "Dicta donde quieras con un hotkey. Whisper de Groq, paste automático, 25x más barato que Wispr Flow.",
    siteName: "KeyLess Flow",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
