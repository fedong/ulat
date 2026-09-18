# Ulat — Philippine Gradebook

Instructors run classes on the web: define a grading system (weighted groups and
components, transmutation, scale, passing line), record assessments and scores,
take attendance, flag students for consultation, and control what students and
guardians see. Students and guardians use the companion mobile app in
`mobile/` — one Expo binary, three roles (Instructor · Student · Guardian).

Built from the high-fidelity design handoff in `design_handoff_ulat/`
(canonical reference `Ulat Web v3.dc.html`; the phones 4b/4c/4d beside the
web app are the mobile reference).

## Stack

- Web: **Next.js** (App Router) + **TypeScript**, **Tailwind CSS v4** with the
  handoff's design tokens (`src/app/globals.css`)
- Mobile: **React Native (Expo SDK 57, TypeScript)** in `mobile/` with
  `expo-router`, `react-native-svg` and plain `StyleSheet` tokens
- Shared: **`@ulat/grade-math`** (`packages/grade-math`) — the grade engine,
  domain types, grading presets and demo-class seed, imported by BOTH clients
  so every role sees identical numbers
- **Zustand** for client state on both clients
- API: **Next.js route handlers** under `src/app/api/v1/` with **Prisma 6 +
  PostgreSQL 16** and owned auth (bcryptjs + short-lived JWT access tokens +
  rotating opaque refresh tokens)
- Fonts: **Gabarito** (display) and **Figtree** (body) via `next/font` /
  `@expo-google-fonts`

## Run

Web:

```bash
npm install
npm run dev
```

Open http://localhost:3000 — the web app runs on the API (set up the database
below first). Sign in with the demo account, create your own with "New here?
Create an account", or hit "Continue with Google" to tour the seeded demo
instructor.

Mobile (Expo):

```bash
cd mobile
npm install
npx expo start        # scan the QR with Expo Go, or press w for the browser
```

The splash screen picks the role: Instructor (4b) signs in with a real Ulat
account (or tours the seeded demo) and works on live API data — scores,
attendance and settings sync optimistically to the cloud. Student (4c) and
Guardian (4d) remain seeded showcases (Ana Reyes / Mrs. Reyes) until their
roles get accounts. Point `EXPO_PUBLIC_API_URL` at the API server (your
machine's LAN IP when testing on a device); it defaults to
`http://localhost:3100`.

API (the web client runs on it; mobile wiring is next):

```bash
# PostgreSQL must be running; copy .env.example to .env and fill it in
cp .env.example .env
npx prisma migrate dev        # create/update the schema
npx prisma db seed            # demo instructor + CS101/MTEC305A
npm run dev                   # API lives beside the web app under /api/v1
npm run api:test              # HTTP-level test against a running server
node scripts/web-e2e.mjs      # browser E2E (Playwright): sign-in, writes, persistence
node scripts/mobile-e2e.mjs   # browser E2E for the mobile web export (see its header)
```

Demo account: `d.rivera@univ.edu.ph` / `ulat-demo-2026` (Pro trial).

Endpoints (all JSON, `Authorization: Bearer <access>` after auth):

| Route | What it does |
| --- | --- |
| `POST /api/v1/auth/register` · `login` · `refresh` · `logout` | Owned auth: bcrypt passwords, 15-minute JWT access tokens, rotating 30-day opaque refresh tokens (revocable, sha256-hashed at rest) |
| `GET/PATCH /api/v1/auth/me` | Profile + entitlement (`Trialing / Active / Past due / Grace / Free`, GCash never auto-renews) |
| `GET/POST /api/v1/classes` | Class summaries; create from the wizard payload (Free plan: 2 active classes → `403 free_limit`) |
| `GET/PATCH /api/v1/classes/[id]` | Full class in the exact `Klass` shape both clients consume; settings updates |
| `PUT /api/v1/classes/[id]/scores` | One score cell (`number \| "MISSED" \| "EXC" \| null`), clamped to max; closed period → `409 period_final` |
| `POST/PATCH/DELETE /api/v1/classes/[id]/assessments` | Create with validation + attendance-linked MISSED/EXC prefill; edit; archive/restore; delete (scores cascade) |
| `POST/PATCH/DELETE /api/v1/classes/[id]/students` | Add to roster (client ids accepted), edit fields/flag/remark/consultation, soft remove |
| `POST/PATCH/DELETE /api/v1/classes/[id]/sessions` | Start today's session (idempotent, everyone Present), set one mark (A/E carry into same-day assessments unless hand-edited), discard (reverses only auto-carried scores) — addressed by id or `(date, groupId)` |

## Structure

| Path | What it is |
| --- | --- |
| `packages/grade-math` | Shared engine: `compute`, `periodOf`, `termOf`, `attRate`, transmutation, standing, `simulate`, plus types, presets and the CS101/MTEC305A seed. `src/lib/grading.ts` etc. re-export it for the web app |
| `prisma/` | PostgreSQL schema, migrations and the demo seed (`prisma/seed.ts`) |
| `src/server/` | API internals: Prisma client, auth (tokens, guards), entitlement DTO, `toKlass` serializer, ownership checks |
| `src/app/api/v1/…` | The route handlers (see the API table above) |
| `scripts/api-test.ts` | End-to-end API test: auth lifecycle, free-plan limit, score clamp + closed-period 409, attendance carry/discard, and grade-math parity between server payloads and the local seeds |
| `mobile/` | Expo app: `app/` routes (onboarding, instructor, student, guardian), `src/` (theme tokens, store, shared UI, demo content) |
| `src/lib/store.ts` | Zustand store: classes, shared period state, save indicator, dialogs |
| `src/app/signin` | Sign in / sign up split screen |
| `src/app/c/[clsId]/…` | App shell (sidebar + header) and the seven class pages: overview, gradebook, assessments, attendance, students, sharing, settings |
| `src/app/new` | 4-step class wizard (details, grading, roster import, review) |

## Status

Instructor web app pages are implemented against the handoff: Overview
analytics, Gradebook with keyboard entry (arrows/Tab, digits, `m`/`e`, undo,
closed periods), Assessments with archive + attendance-linked prefill,
Attendance with P/L/A/E cycling linked to scores, Students with the full detail
panel (record, work, remarks, shared view, flags), Sharing (v2.1 account-level
guardian links: class policy bar, role chips, invite flow), Settings (grading
editor, scale/passing, transmutation, periods, term grade, consultation hours,
co-instructors, archive/delete), the guided product tour (auto-starts once;
replay from the ? Tour button), the v3 visual skin (gradient sidebar, frosted
header, animated logo), real exports (styled XLSX via xlsx-js-style and an A4
PDF grade report via html2pdf.js, both with a scope dropdown), and the Profile
page (draft-based edits applied system-wide), and the v3.1 payments &
entitlement UI: sidebar account menu with plan status, site-wide trial/grace/
past-due banners, Plan & billing with Monthly|Yearly pricing and a simulated
PayMongo checkout (Card / Maya / GCash, referral credit), Invoices, Refer a
colleague, and Free-plan limits (2-class gate, choose-2-editable modal,
read-only classes with dropped writes). Entitlement is a demo stand-in for
`/v1/auth/me` — preview other states via
`localStorage.setItem("ulat_ent", "Free" /* Trialing | Active | Past due | Grace */)`
and reload.

The 4-step class wizard is live at `/new`: class details (level presets drive
terms and periods, schedule slots with validation, join code), grading-system
editors, roster import (CSV/TXT/XLSX/PDF file parsing plus paste, with issue
flags, inline fixes and sorting), and review/create.

The mobile app implements the three phones from the handoff: Instructor 4b
(class carousel + plan status, New assessment with component/period chips and
attendance-linked prefill, per-assessment gradebook entry with M/E markers,
sessions with P/L/A/E cycling that carries into same-day assessments, Needs
attention, Me), Student 4c (Home with expanded class card + tiles + merged
Upcoming, Class detail with period strip, weighted bar, component breakdown,
consultation hours and remarks, Alerts, Me with guardian sharing), and
Guardian 4d (Needs-attention digest, Children → classes → scope-gated Shared
view, merged Alerts with the weekly report, Me). Tab titles, copy, tokens and
spacing follow `Ulat Web v3.dc.html`.

The backend is in and the web client runs on it. Phase 1: Prisma schema +
migrations, owned auth (register/login/refresh/logout/me with the entitlement
DTO), and the core class/scores/assessments/attendance endpoints returning
`Klass`-shaped payloads, seeded with the demo classes. Phase 2: the web app is
fully wired — real sign-in/sign-up with session restore on reload, classes
hydrated from the API, and every edit synced optimistically (instant UI, then
a diff of the store patch becomes granular API calls on an ordered retrying
queue; the header indicator turns red if a save ultimately fails). Roster,
remarks/flags/consults, assessment archive, co-instructors, join codes and
class deletion gained endpoints along the way, and entitlement now comes from
`/v1/auth/me` (the simulated checkout still overrides it locally until
payments land). Covered by `npm run api:test` (63 HTTP checks) and
`scripts/web-e2e.mjs` (browser: sign-in, persistence across reloads, wizard
class creation on a fresh account).

Phase 3: the mobile instructor role runs on the API too. The role splash
routes instructors through a branded sign-in (with session restore from
AsyncStorage and a demo-account tour button); classes, identity and the plan
banner hydrate from `/v1`, and every edit goes through the same shared diff
engine (`packages/grade-math/src/apiops.ts`, extracted from the web sync so
both clients literally run one implementation) on a retrying queue — a save
that ultimately fails raises a toast and keeps your on-screen state. Accounts
with no classes get a friendly empty state; student/guardian showcases keep
their own fixed demo data. The API gained permissive CORS on `/api/v1` for
the mobile web build. Covered by `scripts/mobile-e2e.mjs` (browser over the
Expo web export: sign-in, live classes, attendance session started, persisted
across reload + session restore, discarded, and the demo roles intact).

Next milestone: student/guardian accounts + sharing and guardian invites.
