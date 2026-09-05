@AGENTS.md

# keylessflow-web (landing + backend de KeyLess by Sinsajo)

Next.js (App Router) en Vercel + Supabase (auth, perfiles, suscripciones, uso) +
Stripe (checkout/portal, aún sin keys en prod). Es el backend de la app de
escritorio (`../Keyless Flow`): activación, transcripción managed, proxy LLM, y
las páginas de venta/descarga. Producción: **https://keylessflow-web.vercel.app**
(`keylessflow.app` NO existe en DNS — nunca se compró).

## Cómo correrlo
```bash
npm run dev                      # local (usa .env.local → apunta al Supabase de PROD)
npx tsc --noEmit -p tsconfig.json   # typecheck (gate antes de push)
npm run build                    # build de producción (lo que corre Vercel)
git push origin main             # = deploy a producción (git integration). Rollback: vercel rollback
node scripts/community_e2e.mjs   # E2E real de /api/community (crea y BORRA un usuario de prueba)
```
Env: `.env.local` (gitignored) — ver `.env.local.example`. Prod: Vercel → Settings → Env.

## Arquitectura en 5 líneas
1. `src/app/api/transcribe` — el desktop sube MP3 con token `kfd_…` (HMAC, `lib/desktop-token.ts`);
   `lib/quota.ts` decide plan/trial/cuota; reenvía a Groq Whisper con `GROQ_API_KEY`; loguea `usage_logs`.
2. `src/app/api/llm` — proxy de chat para limpieza/transforms/Redactor de usuarios managed;
   lista de modelos con fallback (espejo de `config.LLM_MODEL_CANDIDATES` del desktop).
3. `src/app/api/auth/activate` — código `KF-…` → token desktop. `api/checkout`, `api/billing/portal`,
   `api/stripe/webhook` — Stripe (inactivo hasta poner keys).
4. `src/app/api/community` + `/comunidad` — captura de leads del workshop (crea usuario Supabase
   Auth con metadata; insert opcional en `community_leads`). `api/waitlist` — Mac/Linux.
5. Páginas: `/` landing (pinea `APP_VERSION` a assets del release), `/signup`, `/login`,
   `/account` (descargas Win/Mac + código de activación), `/pricing`. Schema: `supabase/schema.sql`.

## Decisiones y por qué
- **Descarga libre, cuenta obligatoria para USAR** (la app exige cuenta o key BYOK al abrir):
  gatear la descarga mata instalaciones; el lead se captura en el signup o en `/comunidad`.
- **Leads de comunidad = usuarios de Auth** (sin migración): caen en el mismo funnel (perfil +
  trial). La tabla `community_leads` es opcional; el API tolera que no exista.
- **`/api/llm` no consume cuota de audio** (`checkAccess`, no `checkQuotaAndConsume`).
- **Modelo LLM nunca hardcodeado**: Groq rota su catálogo (retiró llama-3.3 en 2026-08).
- **`NEXT_PUBLIC_SITE_URL` = vercel.app** hasta que exista dominio propio.

## Estado actual (2026-09-05)
- Verificado en prod: `/` (v1.3.1), `/comunidad` 200, `/api/llm` 401 sin token (gate OK).
- **BLOQUEADO — acción de Luis**: el proyecto Supabase `aaiqjtgrsogknmngvjxu` está **pausado**
  (free tier, inactividad) → `getaddrinfo ENOTFOUND` desde Vercel → todo endpoint admin da 500
  (`store_failed`). Restaurar en supabase.com → luego `POST /api/waitlist` debe dar 200 y
  `node scripts/community_e2e.mjs` debe imprimir `E2E_COMMUNITY_OK`.
- Pendiente: correr el bloque `community_leads` de `supabase/schema.sql` en el SQL Editor;
  Stripe keys + price IDs en prod (Basic $8 / Pro $14 / BYOK $49); dominio; panel `/admin/usage`
  + alertas de gasto (plan en bitácora del desktop); página `/byok`.

## Trampas
- **Setear env vars de Vercel SOLO con `printf '%s' | npx vercel env add NAME production`**.
  `Out-File`/`echo` de PowerShell meten un BOM (U+FEFF) → `TypeError: Cannot convert argument to
  a ByteString` en cada llamada a Supabase (pasó con `SUPABASE_SERVICE_ROLE_KEY`).
- **`vercel env pull` devuelve vacío para variables sensibles** — no sirve para inspeccionar prod.
- **Los logs de Vercel se leen con `npx vercel logs <deployment-url> --json`** iniciando el stream
  ANTES de provocar el error (solo muestra lo nuevo). `vercel ls` da la URL del deployment.
- **Esta máquina de dev no resuelve DNS de Supabase ni de `keylessflow.app`** a ratos: un
  `ENOTFOUND` local no significa que prod esté caído — confirmar desde los logs de Vercel.
- **`page.tsx` en App Router no puede exportar constantes arbitrarias** (rompe el build).
- Env `NEXT_PUBLIC_*` se hornea en build: tras cambiarlas hay que redeployar.

Historial de decisiones y evidencia: `../Keyless Flow/docs/BITACORA-2026-07.md`.
