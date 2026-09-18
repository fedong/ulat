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
- **Zustand** for client state on both clients (an API/backend comes later)
- Fonts: **Gabarito** (display) and **Figtree** (body) via `next/font` /
  `@expo-google-fonts`

## Run

Web:

```bash
npm install
npm run dev
```

Open http://localhost:3000 — sign in with any email + password (demo auth), or
"Continue with Google Workspace" to jump straight in.

Mobile (Expo):

```bash
cd mobile
npm install
npx expo start        # scan the QR with Expo Go, or press w for the browser
```

The splash screen picks the role: Instructor (4b) records scores and
attendance on the go, Student (4c) is seeded as Ana Reyes across three
classes, Guardian (4d) is Mrs. Reyes following Ana and Miguel.

## Structure

| Path | What it is |
| --- | --- |
| `packages/grade-math` | Shared engine: `compute`, `periodOf`, `termOf`, `attRate`, transmutation, standing, `simulate`, plus types, presets and the CS101/MTEC305A seed. `src/lib/grading.ts` etc. re-export it for the web app |
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

Next milestone: wire both clients to the shared API.
