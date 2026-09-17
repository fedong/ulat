# Handoff: Ulat — Instructor Web App (with synced Student / Guardian phone views)

## Overview
Ulat is a Philippine gradebook. Instructors run classes on the web: create a class through a wizard, import a roster, define a grading system (weighted groups and components, transmutation, scale, passing line), record assessments and scores, take attendance, flag students for consultation, and control what students and guardians see. Students and guardians use a mobile app; the prototype renders three phone views next to the web app so the same data can be checked from every role.

This package covers the **web app** (screen 4a) and the three **phone views** (4b instructor, 4c student, 4d guardian) that read from the same state.


## What changed in v3 (Sep 17, 2026) — see `Ulat Web v3.dc.html` (canonical; v2 kept for reference)
1. **Export scope dropdown** on the Export button: Whole gradebook · Current period · Grading groups · Term grades · Attendance. XLSX styling (SheetJS): teal brand header row, class title with instructor name, meta line (section · term · scope · date · passing), dark column headers with white text, alternating row fills, frozen student columns.
2. **PDF export** (A4 landscape, print-ready, official grade-report styling): school header, meta block, grade table, signature block (Prepared by / Noted by / Approved by). Free tier shows the Ulat mark + footer; paid plans have branding removed.
3. **Profile settings** (Settings → Profile): title dropdown (Prof. / Dr. / Mr. / Ms. / Mrs. / Engr. / Atty. / none), first name, last name, suffix; Institution card (school, college/department, position, faculty ID, PRC license); Contact card (email, mobile, office); Preferences (language English | Filipino, alerts, weekly digest, co-instructor activity). Edits are **draft-based**: Save / Discard bar under the Contact card; saved values apply system-wide (sidebar user card, header "with …" line, XLSX/PDF headers and signature block, student-facing alerts).
4. **Visual upgrade (v3 skin)**: sidebar deep-navy gradient with teal aura and amber glow; frosted-glass header with gradient class title; cards use gradient fill + hairline border + two-stage shadow; primary buttons gradient teal with glow and hover lift; row/tile hover feedback. Tokens unchanged otherwise.
5. **Animated logo** (sign-in panel and sidebar): bubble springs in, trend line draws, arrowhead pops, mark glows. Sign-in hero shows the single line "Built for Philippine grading systems"; button reads **Continue with Google** with the Google "G" mark; email placeholder unchanged.

## Feature inventory (everything in this package)
Web (instructor)
- Sign in / sign up (Google, email) · animated brand panel
- Class wizard: details, schedule slots, level → terms/periods, join code; grading presets (University · Lecture/Lab · DepEd WW/PT/QA · Letter/GPA); groups, components, exam flag, weights validation; scale (1.00–5.00 / % / Letter / GPA), passing mark, at-risk band, transmutation table + base; roster import CSV / XLSX / TXT / PDF + paste, issue flags, dedupe
- Multi-class sidebar, archive/restore (30-day), delete
- Overview: stat tiles, standing distribution, histogram, period strip, term so far, component averages, hardest assessments, students to watch
- Gradebook: per-period tabs, keyboard entry (arrows/Tab/Enter, m = MISSED, e = EXC, undo), transmuted toggle, locked Final periods, live standing
- Assessments: filters, create (Today/Later, component, period, max, notes), attendance pre-fill, archive with 30-day restore
- Attendance: sessions (Whole / Lecture / Lab), P→L→A→E cycling, rate colors, sync to same-date assessments
- Students: filters, add student, detail panel (grade per period, rank, suggestion, Record / Work / Remarks / Shared view tabs), flag for consultation, remarks history
- Sharing: how-it-works, class policy (Grades/Attendance locked; Missing work / Remarks toggles), consent table with role chips, Ask student / Invite guardian / Remind, inline invite panel, account-level links
- Settings: grading system, scale & passing, periods, term grade (Average | Cumulative, period weights, Mark final), consultation hours, transmutation, co-instructors with grade/attendance/remark scopes, Profile (v3), this class
- Export: XLSX with scope dropdown + styling; PDF grade report with signature block and tier-based branding
- Product tour: 8 stops, spotlight overlay, ? Tour button, first-run auto start
- Save indicator, confirm dialogs, English/Filipino language prop
Mobile (Instructor · Student · Guardian) — see design_handoff_ulat_mobile

## What changed in v2.1 (Sep 17, 2026)
Update an existing implementation by touching only these areas:
1. **Sharing page** rebuilt around account-level guardian links: how-it-works cards, class policy bar (Grades/Attendance locked, Missing work/Remarks toggles), consent table with separate Guardian · Role · Contact columns, color-coded role chips, multi-guardian rows, pending tag, Ask student / Invite guardian / + Guardian actions with inline invite panel. Old per-student consent scopes and Active/Revoked status are gone.
2. **Product tour**: welcome card with 8-stop agenda, spotlight stops, finish card with Watch again, **? Tour** button in the header.
3. **Instructor mobile**: class creation removed (web only); assessment creation stays.
4. Student **Me** tab shows guardians with role chips and an add-guardian flow that feeds the instructor's pending state.

## About the Design Files
`Ulat Web v2.dc.html` is a **design reference built in HTML**. It is a working prototype that shows intended look and behavior; it is not production code to copy. Recreate it in the target codebase's environment (React, Next, etc.) using the codebase's own patterns and libraries. If no environment exists yet, choose one that suits a data-heavy web app with a companion mobile app (e.g. React + TypeScript web, React Native or Flutter mobile, one API).

Open the file in a browser to interact with it (`support.js` and `assets/` must sit next to it). The file has two parts: an `<x-dc>` template (markup with `{{ }}` holes, `<sc-if>` conditionals and `<sc-for>` loops) and a `class Component` logic block at the bottom that owns all state, seed data and computations. **All grade math lives in `renderVals()`**, chiefly `compute`, `termOf`, `periodOf`, `attRate`, and the outlook `simulate` — port these exactly.

## Fidelity
**High-fidelity.** Colors, typography, spacing, radii and copy are final. Recreate pixel-accurately. Demo data (CS101, MTEC305A, guardians, other-instructor classes) is seed content, not part of the design.

## Design Tokens
Fonts: Gabarito 700/800/900 (display, headings, big numbers); Figtree 400–700 (everything else). Google Fonts.

Colors
- Page background `#EFEBE3`; app canvas `#FBF9F5`; card `#FFFFFF`; sidebar / dark panels `#101D26`, hover row `#16242F`
- Ink `#22303C`; secondary text `#5A6672`; muted `#7B8792`, `#9AA3AB`; disabled `#B8C0C6`
- Borders `#E8E2D6`; hairline `#F1EDE5`
- Primary teal `#0FA3A0`; teal text `#0B807E`; teal tints `rgba(15,163,160,0.08 / 0.10 / 0.12)`
- Amber `#F5B70A`; amber text `#8A6400`; tint `rgba(245,183,10,0.16)`
- Red `#D14B33`; red text `#B03A24`; tints `rgba(209,75,51,0.08 / 0.12)`
- Standing colors: pass = teal, risk = amber, fail = red, INC = grey `rgba(90,102,114,…)` / `#5A6672`
- Attendance rate colors: ≥90 teal, ≥80 amber, else red
- Guardian role chips: Mother `rgba(212,90,140,0.14)` / `#8C2F5A`; Father `rgba(60,110,200,0.14)` / `#28508F`; Grandparent `rgba(245,183,10,0.18)` / `#8A6400`; Guardian `rgba(90,102,114,0.12)` / `#5A6672`
- Tour dim `rgba(16,29,38,0.58)`; tour card shadow `0 24px 60px rgba(16,29,38,0.35)`

Radii: cards 16 (web) / 20 (phone); inputs and buttons 12–14; chips 999; small tiles 10–12.
Shadow: `0 2px 10px rgba(34,48,60,0.06)`; selected carousel card `0 6px 16px rgba(15,163,160,0.18)`.
Type scale: page title 28/800 Gabarito; header title 22/800; section 17/800; card title 15/800; body 13–14/400–600 Figtree; labels 11/700 uppercase with 0.6px tracking; big grade 48–60/900 Gabarito with −2px tracking.
Spacing: web content padding 24px 32px; card padding 16–20; grid gaps 12–20; phone content padding 10px 20px, gaps 14.

## Screens / Views

### Web shell (1440×900 frame in the prototype; fluid in production)
- Left sidebar 240px, `#101D26`: logo, "CLASSES" list (active class = teal pill, white text), archived classes toggle, "THIS CLASS" nav (Overview, Gradebook with INC count, Assessments with count, Attendance, Students, Sharing, Settings), user card at the bottom with initials avatar and sign out.
- Header: class code · title (22/800), meta line `section · N students · grading summary · with <co-instructors>`, right side (flex gap 10): save indicator (dot + "All changes saved · students see them now"), **Export XLSX** (white, border 1.5px `#E8E2D6`, 13/700, hover teal border/text), **? Tour** (same style; 20px teal-tint circle with "?" 12/800 Gabarito `#0B807E`, label "Tour" `#5A6672`; replays the product tour), **+ Assessment** (teal primary, `data-tour="add-asm"`). All 38px tall, radius 12.
- Content area scrolls per page.

### Sign in / Sign up
Split layout: dark brand panel left, form right (520px). Google button, email, password, error text `#B03A24`, primary button. Note: students and guardians use the mobile app.

### Class wizard (4 steps: Class details, Grading system, Students, Review)
- Step rail on the left (280px dark). Details: code, title, section, level (College / Senior High / Basic Ed sets terms and periods), term picker with custom option, schedule slots (days, start–end, room) with validation (end ≤ start turns border `#D14B33`), grading method choice, generated class code with a QR-like join tile.
- Grading system: 4 presets (University single group; Lecture 60 / Laboratory 40; DepEd WW/PT/QA; Letter grades GPA 4.0). Groups with weight, components with weight and an "exam" flag (ungraded exam → INC). Weights must total 100 per group and across groups. Scale (1.00–5.00, Percentage, Letter, GPA 4.0), passing mark, at-risk band, transmutation table rows, transmutation base (None / 30 / 50 / 60 / 70 / Custom).
- Students: drop zone for CSV / XLSX / TXT / PDF, paste box, sample list; parsed roster table with issues (missing student no., odd name) and sorting. Duplicate names are skipped.
- Review: summary cards; "Create class" is blocked with a red note until details and weights are valid.

### Overview
- 4 stat tiles (students, class average, at-risk count, attendance) clickable to their pages.
- Grade distribution card: stacked standing bar (Passing / At risk / Failing / INC) with legend, histogram binned by the grading table, class average, median, passing mark, then a **period strip**: one tile per period (label uppercase, "· FINAL" when closed, class grade for that period) with the current period highlighted (teal border, teal tint); on the right "TERM SO FAR" with grade · %.
- Class average by component, Hardest assessments for the period (mean %, passed %), Students to watch (sorted fail → INC → risk) with reasons.

### Gradebook
- Period tabs (label gets " · Final" when the period is closed). Table: sticky student column 200px, one column per assessment in the period (min 104px), weighted %, standing chip. Keyboard: arrows/Tab move, digits type into a buffer, Enter commits, `m` = MISSED, `e` = EXC, Backspace clears, Ctrl/Cmd+Z undo. Cells in a **closed period are read-only**. Footer note explains standing is per period and how the term grade is formed. Optional "show transmuted" toggle.

### Assessments
- Left: period filter chips, assessment table (name / max, component path, date, graded count, mean), archive section with 30-day restore and permanent delete (confirm dialog).
- Right: New assessment form — name (placeholder suggests next name, e.g. "Quiz 3"), component chips, period chips, max points, Today | Later segmented toggle (Later reveals a date input), coverage notes; scheduled future items show a teal notice. Creating an assessment on a date with an attendance session pre-fills MISSED/EXC from that session (respecting Lecture/Lab session type). Selected assessment detail card below.

### Attendance
- Legend chips with counts (Present / Late / Absent / Excused). "New session": if the class has 2+ grading groups, chips **Whole class | Lecture | Laboratory** appear before the date input; sessions dedupe by date + type. Column header: date, weekday, "· Lec" / "· Lab" tag, remove ×. Columns 72px (84px when any session is typed). Clicking a cell cycles P → L → A → E; A/E carry into assessments of the same date and matching group (MISSED / EXC) unless the score was hand-edited. Rate column colored by threshold.

### Students
- Filter chips (All / Passing / At risk / Failing / INC), roster table with attendance and standing, add-student input (Enter or button, accepts pasted rows).
- Student detail panel (400px): name, student no. · section, standing chip, "For consultation" chip when flagged; right column shows the big grade for the **selected period**, the period label ("Semi-finals · Final") and "Term so far 2.75" / "Running grade" in the standing color. Context line: rank of N · class average. Suggestion sentence (standing + facts + what would help). Tabs Record / Work / Remarks / Shared view:
  - Record: component table per group, weighted %, attendance; **BY PERIOD** tiles (grade, period, %), clickable — they switch the selected period for the whole panel; current has teal border and tint.
  - Work: missed / not yet graded lists (click jumps to the gradebook cell), attendance exceptions.
  - Remarks: textarea with "Use suggestion", save; history list.
  - Shared view: what the student sees, what the guardian sees (consent scopes).
  - Footer: Flag for consultation (confirm to unflag), Mark as consulted, consultation notice, Remove from class.

### Sharing (v2 · guardian model)
Page order, top to bottom (content padding 24px 32px):

1. **How it works** — 3 equal cards (grid `repeat(3,minmax(0,1fr))`, gap 12, card radius 14, padding 14px 16px, shadow `0 2px 10px rgba(34,48,60,0.06)`). Each: numbered circle 28px `rgba(15,163,160,0.12)` / `#0B807E` 13/700, title 14/700 `#22303C`, body 12/400 `#5A6672` line-height 1.5. Copy (verbatim):
   - 1 · **Guardian registers** — "In the Ulat app they choose **I'm a guardian**, verify a mobile number or email, and pick their role: Mother, Father, Grandparent, or Guardian."
   - 2 · **Connects to the child** — "You send an invite from this page, or the guardian enters the student's number and the school confirms the match. No approval from the student is needed."
   - 3 · **Linked once, shared everywhere** — "The link is between accounts, not classes. Every class the student takes on Ulat shares with the guardian automatically, each under its own class policy. No re-invite needed."
2. **Class policy bar** (`data-tour="sharing"`) — white card radius 14, padding 12px 16px, flex wrap gap 12. Label "Shared with every linked guardian" 13/700. Four scope chips (pill 999, padding 6px 12px, border 1.5px, 12/600): **Grades** and **Attendance** are locked on (teal tint bg `rgba(15,163,160,0.12)`, teal border, text `#0B807E`, label prefixed "✓ ", cursor default); **Missing work** and **Remarks** toggle (on = same teal look with ✓; off = white bg, border `#E8E2D6`, text `#5A6672`). Right-aligned note 12/400 `#5A6672`: "Grades and Attendance are always shared. {n} of {N} students have at least one linked guardian." Stored per class as `guardianScopes: { Grades: true, Attendance: true, 'Missing work': bool, Remarks: bool }`.
3. **Consent table** — white card radius 16. Grid columns `1.2fr 1.5fr 1fr 1.4fr 1fr 110px 205px`, gap 8, row padding 10px 18px, min-height 50, 14/500. Header row bg `#FBF9F5`, 11/700 uppercase 0.6px tracking `#5A6672`: STUDENT · GUARDIAN · ROLE · CONTACT · LINKED · STATUS (right) · ACTION (right).
   - Guardian / Role / Contact cells stack one 22px-high line per guardian (gap 8) so multi-guardian rows align. No guardian → "—" in `#9AA3AB`.
   - Guardian name `#22303C`, ellipsis; invited-not-yet-registered appends "· pending" 11/600 `#8A6400`.
   - **Role chip** pill, padding 2px 8px, 11/600: Mother `rgba(212,90,140,0.14)` / `#8C2F5A`; Father `rgba(60,110,200,0.14)` / `#28508F`; Grandparent `rgba(245,183,10,0.18)` / `#8A6400`; Guardian `rgba(90,102,114,0.12)` / `#5A6672`.
   - Contact: mobile or email, `#5A6672`.
   - Linked: date of first link, or "—".
   - Status text (right, 13/600): "Linked" (+ " · 2" when several) `#0B807E`; "Pending" `#8A6400`; "Not linked" `#5A6672`.
   - Action cell (right, flex gap 6, buttons height 32, radius 10, 12/600):
     - No linked guardian → **Ask student** (white, border `#E8E2D6`, teal text; after click becomes "Asked" with teal tint bg and is inert) + **Invite guardian** (primary teal `#0FA3A0`, white text).
     - Pending only → **Remind guardian** (→ "Reminded") + **+ Guardian** (white, teal text).
     - Linked → **+ Guardian** only.
   - Clicking Invite / + Guardian opens an inline **invite panel** under the row (margin 0 18px 14px, padding 14px 16px, radius 12, bg `#FBF9F5`, border `#E8E2D6`): title "Invite a guardian for {first}" 13/700; grid `1.4fr 1.6fr 1fr auto auto` gap 8: name input (placeholder "Guardian's full name"), contact input ("Mobile number or email"), role select (Mother / Father / Grandparent / Guardian; defaults Mother for the first guardian, Father for additional), **Send invite** (teal; disabled grey `#B8C0C6` until name > 1 char and contact is a valid email or ≥10 digits), **Cancel**. Inputs 36px, radius 8, 13/500. Helper 12/400: "The guardian gets a one-time link to register or sign in. Once they confirm {first}'s student number, grades and attendance are shared right away and {first} is notified."
     - Send → guardian appears in the row as pending with today's date, status Pending, and a confirmation dialog "Sent".
     - Ask student → dialog "Sent" ("{first} was asked to add a guardian contact in the app.").
4. Footer note 12/500 `#5A6672`: "Guardians linked here are linked to the student's account, so other instructors on Ulat see them too. This page only sets what {code} shares."

Model: a guardian–student link is **account-level** (one relationship, visible to every instructor of that student). Each class contributes only its `guardianScopes`. The instructor cannot revoke a link; there is no per-student consent row anymore.

### Settings
1. Grading system (same editor as the wizard) with assessment counts per group.
2. Scale and passing (scale, passing, at-risk band, table rows).
3. Periods and journal (period chips, add by Enter).
4. **Term grade**: segmented Average of periods | Cumulative; explanatory note; one row per period with assessment count and class average, weight input + % (hidden in Cumulative; sum warning in red when ≠ 100), and **Mark final / Final · reopen** toggle (closed: teal tint, teal text).
5. Consultation hours: slots (days, start, end, place), note; shown to students when flagged.
6. Transmutation (base options + custom).
7. **Instructors**: owner row (teal avatar, "Owner" pill). Co-instructor rows: avatar, name, email, status pill ("Co-instructor" teal / "Invited · not on Ulat yet" amber), Remove (confirm). Scope chips: **CAN GRADE** one chip per grading group (only when the class has 2+ groups), **CAN ALSO** Attendance, Remarks and flags. Note under each: assessments recorded by them, or the pending-invite explanation. Invite: email input + "Invite co-instructor" (disabled grey until a valid email). Rule text: co-instructors can never delete/archive the class, change the grading system, or edit consent.
8. This class: archive / restore (30-day read-only archive), delete (confirm).

### Phones (390×760, radius 40, status bar 46px, bottom nav)
Bottom nav: 4–5 tabs, active = teal tint pill with `#0B807E` icon/label, inactive `#5A6672`, 22px stroke icons, 10.5px labels. Alerts tab dot: 9px `#D14B33` circle at top-right of the bell with 2px white ring and soft red shadow.

**4b Instructor**: Classes tab has a **snap carousel** of class cards (250px wide, snap start, hidden scrollbar; selected = scale 1, teal border, teal shadow; others scale 0.9, opacity 0.7; selecting scrolls it into view) then the New assessment form (same rules as web). **Classes are created on the web only** — there is no "+ New class" on mobile; the carousel has no add card. Assessments can still be created here. Grades: assessment list → gradebook entry per assessment. Attendance: "Start today's session" (one button, or one per group: "Start today · Lecture" / "Start today · Laboratory"), date chips with LEC/LAB tag, summary tiles, tap to cycle marks. Alerts: students to watch + flagged. Me: profile, consultation hours (read-only), notification preferences, passcode lock, sync status, language, term summary, help.

**4c Student**: Home: greeting; one **expanded class card** (code · title, instructors · period, grade, weighted %, attendance, period label, Term so far) and **tiles** for the other classes (code, grade, attendance) that swap into the expanded slot on tap; merged Upcoming across classes with a teal class-code label per item. Classes: class chip row; live class shows standing (period name, chip, big grade), **four-period strip** (PRELIMS / MIDTERMS / SEMIS / FINALS, current highlighted), Term so far, component breakdown, upcoming, flagged notice with consultation hours, remark. Other-instructor classes show a summary. Alerts: merged, prefixed with class code. Me: student no., section, **Guardians** list (name · role chip · pending tag, same role colors as web) with "Add a guardian" (submits name, role, contact → instructor sees it as pending), what each class shares.

**4d Guardian**: Home: greeting; **Needs attention** digest across children (missed work, at-risk, consultation flag; tap opens that class), Coming up (nearest 3), child rows with worst standing chip. Children: child cards → child's classes (grade, chip, attendance, "n of 4 scopes shared") → Shared view: standing (grade shown only with Grades scope), **By period** card (Grades scope, live classes), attendance (Attendance scope), missing work (Missing work scope), remarks (Remarks scope; dashed card when not shared), footer with class · instructor. Back buttons are pills "‹ Children" / "‹ Ana's classes". Alerts merged across children; weekly report item last.

## Product tour (new)
A guided overlay over the web shell. Elements it targets carry `data-tour` attributes: `classes` (sidebar class list), `nav` (THIS CLASS nav), `add-asm` (header button), `gradebook` (grid card), `attendance` (grid card), `students` (page grid), `sharing` (policy bar), `settings` (settings page root).

Trigger: auto-starts the first time a user lands in the app after sign-in unless `localStorage.ulat_tour_done` is set; the **? Tour** button replays it anytime. Skip/Finish sets `ulat_tour_done = 1`.

Stops (in order; `page` = page navigated to before measuring): welcome → classes → nav → add-asm (assessments) → gradebook → attendance → students → sharing → settings → done. Copy, verbatim:
- **Welcome** (no target): "Welcome to Ulat, {firstName}" / "A quick walk through the class workspace: where things live, how grades compute, and how families stay in the loop. Nothing you click during the tour changes your data." Agenda grid 3 columns of 8 numbered tiles (Classes, Navigation, Assessments, Gradebook, Attendance, Students, Guardians, Settings). Footer: "About 2 minutes · replay anytime from the Tour button" 13/500 `#9AA3AB`, buttons **Skip** (ghost) and **Start tour** (teal).
- 1 Classes — "Every class is its own workspace" / "Switch classes here. Tap + New to open the setup wizard: name the class, choose a grading system, then import your roster from CSV, XLSX, TXT or a PDF class list. Archived classes stay one click away."
- 2 Navigation — "Seven views, one class" / "Overview for the pulse, Gradebook for scores, Assessments and Attendance for day-to-day work, Students for individual detail, Sharing for guardians, Settings for the rules. Badges show what needs you."
- 3 Assessments — "Add an assessment in seconds" / "Name it, pick its component (Quiz, Exam, Project…), set the total and period. It appears as a new gradebook column immediately, and students see it in their Upcoming feed."
- 4 Gradebook — "Grades that compute themselves" / "Type raw scores and move with the arrow keys. Transmutation, standing and period grades update live; Term follows your Average or Cumulative method. Finished periods are marked Final and locked."
- 5 Attendance — "Attendance talks to grades" / "Build a session, mark the class in one pass. Absences sync to matching assessments of the same type, lecture or lab, and can be restored within 30 days if a student turns up with an excuse."
- 6 Students — "Know where each student stands" / "Rank, class average and outlook up top; grades, attendance, missing work, remarks, timeline and shared view in the tabs below. Flag a student to keep them on your Overview."
- 7 Guardians — "Families see it automatically" / "Set what this class shares once. Every linked guardian sees it, no per-student approval. Invite a guardian by mobile or email, or ask the student for a contact."
- 8 Settings — "The rules live in Settings" / "Grading groups and weights, transmutation table, passing mark, Term method and period weights, plus team teaching: invite co-instructors and scope what they can grade."
- **Done** (no target): 56px teal-tint square (radius 18) with "✓" 26/800; "You are all set" / "That is the whole workspace. Start with + New to create a class, or replay this tour anytime from the Tour button in the top bar." Buttons **Watch again** (white, border) → restarts at stop 1, **Start teaching** (teal) → ends.

Visuals
- Overlay z-index 60 over the shell. Welcome/Done: full dim `rgba(16,29,38,0.58)` (click = skip). Stops: **spotlight** = target's bounding rect (measured after navigation, 8px padding, radius 14) drawn with `box-shadow: 0 0 0 9999px rgba(16,29,38,0.58)` plus 2px teal ring; everything else dimmed; the target stays interactive-looking but clicks are absorbed.
- Card: white, radius 20, shadow `0 24px 60px rgba(16,29,38,0.35)`, padding 22–24. Welcome 560px wide, Done 440px, stops 380px. Placement for stops: right of target (+18px) if it fits, else left, else below (else above); clamped to 20px margins. Position/size animate `left/top/width 0.35s cubic-bezier(.2,.8,.2,1)` alongside the spotlight.
- Stop card: "STOP n OF 8" 11/700 1px tracking `#0B807E` with ✕ close at right; title 21/800 Gabarito −0.4px; body 14/400 `#5A6672` line-height 1.6; footer: progress dots (active 18×6 teal pill, done 6px teal, upcoming 6px `#E8E2D6`), **Back** (ghost, hidden on stop 1), **Next** / **Finish** (teal, 36px, radius 10).
- Escape key = skip.

State: `tour: { step } | null`, `tourRect: { key, x, y, w, h } | null` (re-measured on step/page/class change via `getBoundingClientRect`, relative to the shell). Navigating during a stop sets `page` to the stop's page first, then measures on the next frame.

## Interactions & Behavior
- Save indicator: any change sets saving state; flips to saved after 700ms.
- Confirm dialogs for destructive actions (remove co-instructor, delete class, purge archived assessment, unflag).
- Period switching anywhere (tabs, overview strip, BY PERIOD tiles) sets one shared `period` state; gradebook focus resets to 0-0.
- Closed periods: gradebook cells ignore edits; labels show "· Final".
- Attendance ↔ assessment linking: `linked(session, assessment) = same date && (session has no type || assessment's group === session type)`.
- Team teaching is optional: with no co-instructor the owner records everything. Invited non-users stay "Invited" until they accept.
- Transitions: carousel card `transform/opacity/border-color 0.25s ease`; hover states change border to teal or tint the background.
- Language prop: English default, Filipino optional.

## State Management (web)
Single store per class: `{ id, code, title, section, term, schedule, joinCode, grading: { scale, passing, riskBand, groups[{ id, name, weight, comps[{ id, name, w, exam }] }], table, transmute, termMethod: 'average'|'cumulative', periodWeights: { [period]: n } }, periods[], closed: { [period]: bool }, roster[{ id, no, name, last, first, mi }], assessments[{ id, name, comp, period, max, date, notes, by }], archive[], scores: { [studentId]: { [assessmentId]: number | 'MISSED' | 'EXC' } }, sessions[{ date, group?, marks: { [studentId]: 'P'|'L'|'A'|'E' } }], remarks, remarkLog, flags, consults, consult: { slots, note }, team[{ id, name, email, status: 'active'|'invited', groups[], attendance, students }], archived }`.
Sharing state: per class `guardianScopes`; per student account `guardians[{ name, role: 'Mother'|'Father'|'Grandparent'|'Guardian', contact, status: 'linked'|'pending', linkedAt }]` (account-level, shared across classes/instructors). Web UI: `linkFor` (student id with the invite panel open), `linkName`, `linkContact`, `linkRole`, `nudged: { [studentId]: true }`. Tour: `tour`, `tourRect`.
UI state: `clsId, page, period, asmFilter, asmId, focus, buffer, undo, student, sdTab, filter, na (new assessment draft), newSessionDate, newSessionGroup, teamInvite, dialog, showTx`. Phone state: `ptab_i / ptab_s / ptab_g`, `phoneAsmId`, `phoneSession`, `sFocusCode`, `sClsCode`, `gChild`, `gCls`.

Grade math (port exactly)
- Component %: got / max over graded assessments; MISSED counts 0; EXC excluded; ungraded exam → INC.
- Transmutation: `p = raw × (100 − base)/100 + base/100` when a base is set.
- Group % = Σ(comp w × p) / Σ w over graded components; total = Σ(group weight × group %) / Σ weights.
- Standing: `inc` → INC; `< passing` → fail; `< passing + riskBand` → risk; else pass. Grade shown via table lookup by scale.
- Period grade = the above over that period's assessments. Term grade (average) = Σ(period % × weight) / Σ weights over graded periods; (cumulative) = the above over all assessments.
- Attendance rate = non-absent / (sessions − excused).

## Assets
`assets/ulat-mark.svg`, `assets/ulat-mark-white.svg` (logo marks). Icons are inline 24px stroke SVGs (1.8 stroke, round caps). Fonts from Google Fonts.

## Files
- `Ulat Web v3.dc.html` — **canonical** web prototype (template + logic): v3 skin, export scope + PDF, profile settings, animated logo.
- `Ulat Web v2.dc.html` — previous version, kept for diffing.
- `Ulat Prototype.dc.html` — mobile prototype (instructor / student / guardian phones).
- `support.js` — runtime needed to open the prototype in a browser; not part of the design.
- `assets/` — logo marks.
