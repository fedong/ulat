# Handoff: Ulat — Instructor Web App (with synced Student / Guardian phone views)

## Overview
Ulat is a Philippine gradebook. Instructors run classes on the web: create a class through a wizard, import a roster, define a grading system (weighted groups and components, transmutation, scale, passing line), record assessments and scores, take attendance, flag students for consultation, and control what students and guardians see. Students and guardians use a mobile app; the prototype renders three phone views next to the web app so the same data can be checked from every role.

This package covers the **web app** (screen 4a) and the three **phone views** (4b instructor, 4c student, 4d guardian) that read from the same state.

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

Radii: cards 16 (web) / 20 (phone); inputs and buttons 12–14; chips 999; small tiles 10–12.
Shadow: `0 2px 10px rgba(34,48,60,0.06)`; selected carousel card `0 6px 16px rgba(15,163,160,0.18)`.
Type scale: page title 28/800 Gabarito; header title 22/800; section 17/800; card title 15/800; body 13–14/400–600 Figtree; labels 11/700 uppercase with 0.6px tracking; big grade 48–60/900 Gabarito with −2px tracking.
Spacing: web content padding 24px 32px; card padding 16–20; grid gaps 12–20; phone content padding 10px 20px, gaps 14.

## Screens / Views

### Web shell (1440×900 frame in the prototype; fluid in production)
- Left sidebar 240px, `#101D26`: logo, "CLASSES" list (active class = teal pill, white text), archived classes toggle, "THIS CLASS" nav (Overview, Gradebook with INC count, Assessments with count, Attendance, Students, Sharing, Settings), user card at the bottom with initials avatar and sign out.
- Header: class code · title (22/800), meta line `section · N students · grading summary · with <co-instructors>`, right side: save indicator (dot + "All changes saved · students see them now"), period label.
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

### Sharing
Consent table per student: guardian, scopes (Grades, Attendance, Missing work, Remarks), date, status (Active / Revoked / Not linked). Read-only for the instructor: "Consent belongs to the student."

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

**4b Instructor**: Classes tab has a **snap carousel** of class cards (250px wide, snap start, hidden scrollbar; selected = scale 1, teal border, teal shadow; others scale 0.9, opacity 0.7; selecting scrolls it into view) then the New assessment form (same rules as web). Grades: assessment list → gradebook entry per assessment. Attendance: "Start today's session" (one button, or one per group: "Start today · Lecture" / "Start today · Laboratory"), date chips with LEC/LAB tag, summary tiles, tap to cycle marks. Alerts: students to watch + flagged. Me: profile, consultation hours (read-only), notification preferences, passcode lock, sync status, language, term summary, help.

**4c Student**: Home: greeting; one **expanded class card** (code · title, instructors · period, grade, weighted %, attendance, period label, Term so far) and **tiles** for the other classes (code, grade, attendance) that swap into the expanded slot on tap; merged Upcoming across classes with a teal class-code label per item. Classes: class chip row; live class shows standing (period name, chip, big grade), **four-period strip** (PRELIMS / MIDTERMS / SEMIS / FINALS, current highlighted), Term so far, component breakdown, upcoming, flagged notice with consultation hours, remark. Other-instructor classes show a summary. Alerts: merged, prefixed with class code. Me: student no., section, guardian, sharing scopes.

**4d Guardian**: Home: greeting; **Needs attention** digest across children (missed work, at-risk, consultation flag; tap opens that class), Coming up (nearest 3), child rows with worst standing chip. Children: child cards → child's classes (grade, chip, attendance, "n of 4 scopes shared") → Shared view: standing (grade shown only with Grades scope), **By period** card (Grades scope, live classes), attendance (Attendance scope), missing work (Missing work scope), remarks (Remarks scope; dashed card when not shared), footer with class · instructor. Back buttons are pills "‹ Children" / "‹ Ana's classes". Alerts merged across children; weekly report item last.

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
- `Ulat Web v2.dc.html` — the full prototype (template + logic).
- `support.js` — runtime needed to open the prototype in a browser; not part of the design.
- `assets/` — logo marks.
