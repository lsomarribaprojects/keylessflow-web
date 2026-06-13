/**
 * /login — sign in (existing users).
 *
 * Same component as /signup but the strings frame it as "sign in" instead of
 * "create account". Supabase magic-link works for both — if the email doesn't
 * exist yet, a user row is created on first click. That's intentional: lower
 * friction, and we treat first-paid as the real "signup" event in our funnel.
 */
import { Suspense } from "react";

import { AuthForm } from "@/components/AuthForm";

export const metadata = { title: "Iniciar sesión — KeyLess by Sinsajo" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-md flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full">
        <h1
          className="font-display text-center font-semibold tracking-tight"
          style={{ fontSize: "var(--text-display-s)" }}
        >
          Iniciar sesión
        </h1>
        <p className="mt-3 text-center text-muted">
          Te enviamos un magic link al correo. Sin contraseña.
        </p>
        <div className="mt-10">
          <Suspense fallback={<div className="h-32" />}>
            <AuthForm mode="login" />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
