/**
 * /guia — step-by-step usage guide. Signed-in only: it's part of what the
 * student gets for registering at /estudiantes. "Guardar como PDF" prints it.
 */
import Link from "next/link";
import { redirect } from "next/navigation";

import { GuideContent } from "@/components/GuideContent";
import { PrintButton } from "@/components/PrintButton";
import { createServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Guía de uso — KeyLess by Sinsajo" };

export default async function GuiaPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?next=/guia");
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-14 md:py-16">
      <Link href="/account" className="font-mono text-xs text-faint hover:text-fg print:hidden">
        ← Mi cuenta
      </Link>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Guía de uso</p>
          <h1
            className="font-display mt-2 font-semibold tracking-tight"
            style={{ fontSize: "var(--text-display-s)" }}
          >
            KeyLess en 4 pasos
          </h1>
        </div>
        <PrintButton />
      </div>
      <div className="mt-10">
        <GuideContent />
      </div>
    </main>
  );
}
