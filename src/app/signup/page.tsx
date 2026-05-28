/**
 * /signup — create account.
 *
 * Sister to /login, framed as account creation. Same auth backend:
 * magic-link via Supabase. After the user clicks the link in their inbox,
 * /auth/callback handles the redirect and they land on /account (if they
 * arrived here without plan) or /pricing (if they want to upgrade).
 */
import { Suspense } from "react";

import { AuthForm } from "@/components/AuthForm";

export const metadata = { title: "Crear cuenta — KeyLess Flow" };

export default function SignupPage() {
  return (
    <main className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-md flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full">
        <h1
          className="font-display text-center font-semibold tracking-tight"
          style={{ fontSize: "var(--text-display-s)" }}
        >
          Crea tu cuenta
        </h1>
        <p className="mt-3 text-center text-muted">
          Magic link al correo. Cero contraseñas, cero fricción.
        </p>
        <div className="mt-10">
          <Suspense fallback={<div className="h-32" />}>
            <AuthForm mode="signup" />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
