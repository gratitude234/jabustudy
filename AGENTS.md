# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server (localhost:3000)
npm run build    # Production build (also type-checks — run this to verify changes)
npm run start    # Start production server
npm run lint     # ESLint check
npx shadcn@latest add <component>  # Add a shadcn/ui component to components/ui/
```

No test suite is configured.

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=              # AI Study Plan / summarize features
AI_PROVIDER=gemini           # Primary AI provider: gemini or bedrock
AI_FALLBACK_PROVIDER=        # Leave blank while AWS Bedrock quota is unreliable
AI_ENABLE_BEDROCK=false      # Bedrock is ignored unless explicitly set to true
GEMINI_MODEL_GENERATION=gemini-2.5-flash       # MCQ/question-bank generation
GEMINI_MODEL_DOCUMENT=gemini-2.5-flash         # PDF/document chat and inline file generation
GEMINI_MODEL_FAST=gemini-2.5-flash-lite        # Parse/explain/summary/study-plan helpers
GEMINI_MODEL=gemini-2.5-flash-lite             # Legacy fallback if role-specific vars are absent
AWS_REGION=us-east-1         # Bedrock runtime region
AWS_BEARER_TOKEN_BEDROCK=    # Bedrock API key; alternative to IAM access key pair
AWS_ACCESS_KEY_ID=           # Optional IAM access key alternative
AWS_SECRET_ACCESS_KEY=
BEDROCK_MODEL_GENERATION=anthropic.claude-sonnet-4-6 # Dormant unless AI_PROVIDER or fallback is bedrock
BEDROCK_MODEL_FAST=anthropic.claude-haiku-4-5-20251001-v1:0
AI_QUESTION_TIMEOUT_MS=60000
VAPID_PUBLIC_KEY=            # Web Push (generate with: npx web-push generate-vapid-keys)
VAPID_PRIVATE_KEY=
NEXT_PUBLIC_VAPID_PUBLIC_KEY= # same value as VAPID_PUBLIC_KEY
VAPID_SUBJECT=               # mailto: or https: URI
WHATSAPP_TOKEN=              # Meta Cloud API token (streak reminder cron)
WHATSAPP_PHONE_NUMBER_ID=
CRON_SECRET=                 # Bearer token for /api/cron/* routes
NEXT_PUBLIC_SITE_URL=        # or VERCEL_URL — used to self-call internal API routes
```

## Architecture Overview

**Jabu Study** is a Next.js 16 (App Router) + Supabase platform for JABU university students focused on course materials, MCQ practice sets, Q&A, tutors, leaderboard, GPA calculator, and AI study plans.

### Supabase Client Pattern

Three distinct clients — always use the right one:

| Client | File | When to use |
|--------|------|-------------|
| Browser | `lib/supabase.ts` | Client components, `"use client"` hooks |
| Server | `lib/supabase/server.ts` → `createSupabaseServerClient()` | Server Components, Route Handlers (must `await`) |
| Admin / Service Role | `lib/supabase/admin.ts` → `createSupabaseAdminClient()` | Route Handlers that bypass RLS — **never import in client components** |

Session cookies are refreshed by `proxy.ts` — this file IS the Next.js middleware (named `proxy.ts` instead of `middleware.ts`, which is intentionally absent). It exports both `proxy` and `config` (with the standard `matcher`).

### Layout System

`AppChrome` (`components/layout/AppChrome.tsx`) wraps all non-admin pages with `TopNav`, `MobileTopBar`, and `BottomNav`. The page container class is `"mx-auto w-full max-w-6xl px-4 md:px-6 lg:max-w-7xl lg:px-8"`. Admin pages (`/admin/*`) and study-admin pages (`/study-admin/*`) render children directly via their own shells — **do not add AppChrome wrappers to admin routes**.

- `components/admin/AdminShell.tsx` — shell for `/admin/*`
- `components/studyAdmin/StudyAdminShell.tsx` — shell for `/study-admin/*`

### Authorization Guards

- **`lib/admin/requireAdmin.ts`** — checks `admins` table via service-role client; throws 401/403
- **`lib/studyAdmin/requireStudyModerator.ts`** — checks `study_admins` (super) or `study_reps` (scoped); returns `{ userId, scope }`
- **`lib/studyAdmin/requireStudyModeratorFromRequest.ts`** — same but takes a `Request` object (for route handlers that don't use Next.js cookies)
- **`lib/studyAdmin/scope.ts` → `isWithinScope(scope, entity)`** — enforces department/level restrictions

Study moderator roles: `super` (unrestricted), `dept_librarian` (department-wide), `course_rep` (department + specific levels array). A user can be both a super admin and a rep — rep scope takes priority for scoped actions.

### Study Hub — Student Preferences Context

`app/study/_components/StudyPrefsContext.tsx` provides `StudyPrefsProvider` and `useStudyPrefs()`. Every Study Hub page is wrapped in this provider. It exposes:
- `prefs` — faculty/department/level/semester saved in `study_preferences`
- `hasPrefs` — true if at least one meaningful pref is set
- `userId`, `userEmail`, `displayName` — from Supabase auth
- `rep` — rep application status and scope (`RepState`)

On mount it redirects unauthenticated users to `/login`.

### Study Hub — Practice Engine

`app/study/practice/[setId]/usePracticeEngine.ts` is a large client-side hook managing the full quiz lifecycle: parallel data loading, attempt creation/restore, localStorage draft autosave, countdown timer, answer persistence via Supabase upsert, and soft-reset without page navigation.

Key tables: `study_quiz_sets`, `study_quiz_questions`, `study_quiz_options`, `study_practice_attempts`, `study_attempt_answers`, `study_daily_activity`.

### Study Hub — Material Upload Flow

Two-step signed-upload flow:
1. `POST /api/study/materials/upload` — validates scope, inserts pending row (`approved: false`), returns a Supabase Storage signed upload token. Also populates denormalized columns (`course_code`, `department`, `faculty`, `level`, `semester`) directly on the row.
2. `POST /api/study/materials/upload/complete` — client calls after direct-to-storage upload to finalize the row.

Storage bucket: `study-materials`. Path: `materials/{dept_id}/{course_code}/{material_id}-{filename}`.

Rep uploads go through a separate admin upload path (`/api/study-admin/upload/*`) and are auto-approved. Student uploads go to the queue.

### AI Integration

`lib/ai/index.ts` is the provider-aware server-only AI wrapper. Production currently uses Gemini by default (`AI_PROVIDER=gemini`) with Bedrock hard-disabled unless `AI_ENABLE_BEDROCK=true`. `lib/ai/gemini.ts` routes by model role: `generation` and `document` use Gemini 2.5 Flash, while `fast` uses Gemini 2.5 Flash-Lite. `lib/ai/bedrock.ts` remains available for later reactivation via env. **Never import AI wrappers in client components.**

AI routes under `app/api/ai/`: `generate-questions`, `generate-questions-course`, material chat, and rep question-bank generation use Gemini 2.5 Flash for document/question quality; `parse-mcq`, answer explanations, material summaries, and study plans use the `fast` role (Gemini 2.5 Flash-Lite). Bedrock should not be called in production unless `AI_ENABLE_BEDROCK=true` and `AI_PROVIDER=bedrock` or `AI_FALLBACK_PROVIDER=bedrock` is explicitly set.

### Notifications

Two parallel notification systems:
- **In-app**: `lib/studyNotify.ts` inserts rows into `notifications` table. Fire-and-forget — errors swallowed. Self-notifications are skipped.
- **Web Push**: `lib/webPush.ts` — `sendUserPush(userId, payload)`. Requires VAPID env vars. Auto-removes expired subscriptions (410/404). Fire-and-forget — never throws.
- **WhatsApp**: `lib/whatsapp.ts` + cron at `app/api/cron/streak-reminder/route.ts` (runs 19:00 UTC daily via Vercel Cron).

`lib/studyAdmin/notifyUploader.ts` — helpers for notifying uploaders on material approval/rejection.

### PWA

The app is a full PWA. `public/sw.js` is the service worker (registered by `components/ServiceWorkerRegister.tsx`). `public/manifest.json` defines the install metadata. `components/PWAInstallProvider.tsx` captures the `beforeinstallprompt` event (also captured early in `app/layout.tsx` via an inline script before React hydrates) and exposes it via context. `components/PWAInstallBanner.tsx` renders the install prompt. SW update detection fires a custom `sw-update-available` event handled in `AppChrome`.

### Cron Jobs

`app/api/cron/streak-reminder/route.ts` — streak reminder via WhatsApp (19:00 UTC daily).
Both are configured in `vercel.json` and authenticated with `CRON_SECRET` Bearer token (support GET and POST).

### API Response Convention

Route Handlers return `{ ok: true, ...data }` on success and `{ ok: false, code, message }` on error. Error helper: `jsonError(message, status, code)`.

### UI Components & Utilities

- shadcn/ui components in `components/ui/` (Tailwind CSS v4 + `tw-animate-css`). Style: `new-york`, base color: `neutral`, CSS variables enabled.
- `lib/utils.ts` — `cn()`, `normalizeStr()`, `safeSearchTerm()`, `buildHref()`, `timeAgo()` / `formatWhen()`, `msToClock()`, `formatNaira()`, `asInt()`, `clamp()`, `pctToColor()`, `pctToBg()`, `formatDuration()`, `fmtPct()`, `safePushRecent()`, `currentAcademicSessionFallback()`
- `lib/types.ts` — shared Study quiz/practice types

### WAT Timezone

All date calculations use WAT (UTC+1) — `new Date(Date.now() + 3_600_000).toISOString().slice(0, 10)` — not raw `toISOString()` (which returns UTC). The shared helper `watToday()` lives in `lib/studyPractice.ts`.

### DB Migrations

SQL migration files are in `supabase/migrations/`. Run them manually in the Supabase SQL editor in filename order. There is no CLI migration runner configured.
