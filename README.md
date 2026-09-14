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
panel (record, work, remarks, shared view, flags), Sharing consent table, and
Settings (grading editor, scale/passing, transmutation, periods, term grade,
consultation hours, co-instructors, archive/delete).

Next milestones: the 4-step class wizard (roster import/parsing), XLSX export,
and the student/guardian mobile views.
