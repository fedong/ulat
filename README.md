# Ulat — Philippine Gradebook

Instructors run classes on the web: define a grading system (weighted groups and
components, transmutation, scale, passing line), record assessments and scores,
take attendance, flag students for consultation, and control what students and
guardians see. Students and guardians use a companion mobile app (planned).

Built from the high-fidelity design handoff in `design_handoff_ulat_web`
(prototype `Ulat Web v2.dc.html`).

## Stack

- **Next.js** (App Router) + **TypeScript**
- **Tailwind CSS v4** with the handoff's design tokens (`src/app/globals.css`)
- **Zustand** for client state (seeded demo classes; an API/backend comes later)
- Fonts: **Gabarito** (display) and **Figtree** (body) via `next/font`

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000 — sign in with any email + password (demo auth), or
"Continue with Google Workspace" to jump straight in.

## Structure

| Path | What it is |
| --- | --- |
| `src/lib/grading.ts` | Grade math ported exactly from the prototype: `compute`, `periodOf`, `termOf`, `attRate`, transmutation, standing, outlook `simulate` |
| `src/lib/presets.ts` | Grading-system presets (University, Lecture/Lab, DepEd WW/PT/QA, Letter GPA) |
| `src/lib/seed.ts` | Demo classes CS101 and MTEC305A (seed content, not part of the design) |
| `src/lib/store.ts` | Zustand store: classes, shared period state, save indicator, dialogs |
| `src/app/signin` | Sign in / sign up split screen |
| `src/app/c/[clsId]/…` | App shell (sidebar + header) and the seven class pages: overview, gradebook, assessments, attendance, students, sharing, settings |
| `src/app/new` | Class wizard route (next milestone) |

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

Next milestones: the 4-step class wizard (roster import/parsing) and the
instructor/student/guardian mobile views.
