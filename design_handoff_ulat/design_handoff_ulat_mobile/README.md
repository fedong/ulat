# Handoff: Ulat — Mobile App (Instructor · Student · Guardian)

## What changed in v3.1 (Sep 18, 2026)
- **Instructor · Classes tab**: plan status card under the title (plan label 700 13px + one line 12px #5A6672). At the Free limit the line is exactly "You've reached 2 classes on the Free plan." — **no CTA, price, or link anywhere in the mobile app** (App Store anti-steering, spec §8). Entitlement is read from `/v1/auth/me`.
- Read-only classes (Free plan, over limit): view, student standing and guardian digests continue; grade entry, new assessments and attendance marking are disabled. See the web README and `Ulat_Payments_Implementation_Spec.md`.

## Overview
Ulat is a Philippine gradebook. Instructors set up classes and grading on the **web app** (separate handoff: `design_handoff_ulat_web`). The **mobile app** is one binary with three roles chosen at registration: **Instructor** (record scores and attendance on the go, watch at-risk students), **Student** (see standing per period, upcoming work, remarks, manage guardians), **Guardian** (follow one or more children across all their classes, weekly digest). All roles read the same class data; the mobile app never creates classes or edits grading rules.

## Stack
As agreed for the product: **React + TypeScript** web, **React Native (Expo, TypeScript)** mobile, **one shared API**.
- Expo SDK (managed workflow), `expo-router` for file-based navigation (stack per tab, bottom tabs per role).
- Styling: plain `StyleSheet` / inline styles mirroring the tokens below; no UI kit needed. Fonts via `expo-font` / `@expo-google-fonts/gabarito` and `@expo-google-fonts/figtree`.
- State/data: TanStack Query against the shared API; local optimistic writes for score/attendance entry; `expo-secure-store` for tokens and the passcode lock; `expo-notifications` for alerts and the guardian weekly digest.
- Lists and carousels: `FlatList` with `snapToInterval` / `pagingEnabled` for the class carousel; `ScrollView` horizontal for chip rows.
- **Share the grade-math module** with the web (`compute`, `termOf`, `periodOf`, `attRate`, `standing`, transmutation) as a plain TypeScript package so both clients show identical numbers.
- i18n: English default, Filipino optional (see Language). Use a simple key map; Filipino only for greetings/names unless the user switches.

## About the Design Files
The bundled `.dc.html` files are **design references built in HTML**, not code to ship. Recreate them in React Native using the patterns above.
- `Ulat Web v3.dc.html` — **canonical mobile reference** (v2 kept alongside; phones are identical, web skin differs): the three phones beside the web app (**4b Instructor**, **4c Student**, **4d Guardian**) share live state with the web, so you can check every role against the same data. Open it in a browser (`support.js` and `assets/` alongside).
- `Ulat Prototype.dc.html` — earlier standalone phones (3a–3c) with the Filipino language variant, greeting/home layouts, inbox and Me settings rows. Use where v2 is silent (language toggle, guardian digest settings, passcode).
Where the two disagree, v2 wins.

## Fidelity
**High-fidelity.** Colors, type, spacing, radii and copy are final; recreate pixel-accurately at 390pt width and let layouts stretch fluidly. Demo data (CS101, MTEC305A, Ana Reyes, Prof. Rivera) is seed content.

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


### Phone frame
Design width 390; radius 40 in mocks (device-owned in production); status bar 46; content padding 10px 20px (home headers 24px 20px), vertical gaps 14–16; cards white radius 20 (16 for small), shadow `0 2px 10px rgba(34,48,60,0.06)`. Minimum tap target 44.

### Bottom nav
4–5 tabs, height 64 + safe area. Active = teal-tint pill (`rgba(15,163,160,0.12)`) with `#0B807E` 22px stroke icon and 10.5/700 label; inactive `#5A6672`. Alerts badge: 9px `#D14B33` dot top-right of the bell with 2px white ring and soft red shadow.

Shared components: standing chip (pill, 12/700, pass teal / risk amber / fail red / INC grey tints); big grade (48–60/900 Gabarito −2px tracking, colored by standing); attendance chips P/L/A/E; period strip (4 tiles PRELIMS / MIDTERMS / SEMIS / FINALS, current tile teal border + teal tint, "· FINAL" when closed); guardian role chip (Mother / Father / Grandparent / Guardian colors above); toast (dark `#22303C` card, 13/600 `#FBF9F5`, radius 14).

## Onboarding (all roles)
Splash with mark → **I'm an instructor / I'm a student / I'm a guardian**. Sign in with Google or email; guardians may verify a mobile number (OTP) instead. Student links by student number confirmed by the school roster. Guardian: pick role (Mother / Father / Grandparent / Guardian) and either open a one-time invite link sent by the instructor or enter the child's student number for school confirmation. **No approval from the student is needed.** A guardian–student link is **account-level**: once linked, every class the child takes on Ulat shares with the guardian under each class's own policy.

## Screens — Instructor (4b)
Tabs: Classes · Grades · Attendance · Alerts · Me.
- **Classes**: greeting (Filipino greeting optional: "Magandang umaga, Prof. Rivera!"), term pill ("1st Sem · AY 2026–27 ▾"). **Class carousel**: horizontal snap list, cards 250 wide, gap 10, snap to start, hidden scrollbar; selected card scale 1, teal 1.5px border, shadow `0 6px 16px rgba(15,163,160,0.18)`; others scale 0.9, opacity 0.7; transitions `transform/opacity/border-color 0.25s ease`; selecting scrolls the card into view. Card: code 17/800 + title 15/500 grey, section · N students, standing chip (class average), "Next: …". **No class-creation control** — classes are created on the web only. Below the carousel: **New assessment** form (NAME with next-name placeholder e.g. "Quiz 3", COMPONENT chips, PERIOD chips, MAX POINTS, Today | Later segmented → date input, notes; primary "Add assessment" 48px teal, disabled grey `#B8C0C6` until name + max valid). Creating on a date with an attendance session pre-fills MISSED / EXC from that session (Lecture/Lab aware). Toast "Added Quiz 3 · students see it now".
- **Grades**: period chips; assessment list (name · max, component path, date, "n of N graded", mean) → **gradebook entry**: one row per student (name, current score input 44px, MISSED / EXC quick buttons), running standing chip. Numeric keypad; Enter moves down. Read-only rows in closed periods with "Final" tag.
- **Attendance**: "Start today's session" (one button; when the class has 2+ grading groups, two: "Start today · Lecture" / "Start today · Laboratory"); date chips with LEC / LAB tag; summary tiles (Present / Late / Absent / Excused counts); student rows, tap cycles P → L → A → E; A/E flow into same-date assessments of the matching group unless hand-edited.
- **Alerts**: Students to watch (fail → INC → risk, reason line) and flagged students; tap opens the student on web-equivalent detail (read-only summary on mobile).
- **Me**: profile card (initials avatar 52px teal; name/title come from the web Profile settings), consultation hours (read-only, set on web), notification preferences, passcode lock, sync status, language (English | Filipino segmented), term summary, help, sign out.

## Screens — Student (4c)
Tabs: Home · Classes · Alerts · Me.
- **Home**: greeting + date; one **expanded class card** (code · title, instructors · period, big grade, weighted %, attendance %, period label "Semi-finals · Final", "Term so far 2.75") and **tiles** for the other classes (code, grade, attendance) that swap into the expanded slot on tap (state `sFocusCode`); merged **Upcoming** across classes, each item with a teal class-code label, date, name · max.
- **Classes**: class chip row (`sClsCode`); live class: period name + standing chip + big grade; **four-period strip**; Term so far; component breakdown per group (weighted %); upcoming; **flagged notice** with the instructor's consultation hours; latest remark. Other-instructor classes show a compact summary (grade, attendance, instructor).
- **Alerts**: merged across classes, prefixed with class code (new assessment, graded, missed, at-risk, flagged).
- **Me**: student no., section; **Guardians** card: one row per guardian (name, role chip, "· pending" 11/600 `#8A6400` when invited but unregistered), **Add a guardian** (name, role select, mobile/email → instructor sees it as pending; the guardian gets a one-time link); **What each class shares**: per class the four scopes (Grades and Attendance always ✓; Missing work / Remarks as set by the class). Copy: "Your guardians are linked to your account, not to a class. Every class you take on Ulat shares with them under its own policy." Language, notifications, sign out.
- Responding to an instructor's **Ask student**: an Alerts item "Prof. Rivera asked you to add a guardian contact" deep-links to Add a guardian.

## Screens — Guardian (4d)
Tabs: Home · Children · Alerts · Me.
- **Home**: greeting ("Good afternoon, Mrs. Reyes!" / "Magandang hapon po, Gng. Reyes!"); **Needs attention** digest across children (missed work, at-risk, consultation flag; tap opens that class's Shared view); **Coming up** (nearest 3 items across children); child rows with worst standing chip; "Last updated …" / "Next report: Friday 5 PM".
- **Children**: child cards (avatar, name, school/section, N classes) → **child's classes** (code · title, big grade, standing chip, attendance %, "n of 4 scopes shared") → **Shared view**: standing (big grade only with Grades scope), **By period** card (Grades scope, live classes), attendance card (Attendance scope), **Missing work** (Missing work scope; teal tint when empty, red tint when items), **Remarks** (Remarks scope; dashed `#E8E2D6` card "Not shared by this class" when off), footer "class · instructor". Back buttons are pills "‹ Children" / "‹ Ana's classes" (32px, radius 999).
- **Alerts**: merged across children, weekly report item last.
- **Me**: profile with role chip, linked children (+ "Link another child"), language, digest time (Friday 5 PM), notifications, sign out. "How you can help" card with plain-language tips for at-risk children.

## Interactions & Behavior
- Tab switching is instant; screen pushes slide 250ms. Carousel and chip rows use native snapping.
- Optimistic writes for scores and attendance; a sync indicator in Me shows pending count; conflicts resolve last-write-wins per cell.
- Toast after create/mark actions (3s).
- Confirm sheets for destructive actions (remove guardian request, sign out with pending sync).
- Guardian scopes are evaluated client-side from the class policy: `show(scope) = class.guardianScopes[scope] && link.status === 'linked'`.
- Language prop/toggle: English default; Filipino swaps greetings and UI strings (see Prototype 3c for the Filipino set).

## State
Per role: `ptab_i / ptab_s / ptab_g` (active tab), instructor `clsId`, `phoneAsmId`, `phoneSession`, `na` (assessment draft); student `sFocusCode`, `sClsCode`; guardian `gChild`, `gCls`. Account: `guardians[{ name, role, contact, status: 'linked'|'pending', linkedAt }]` on the student; `children[]` on the guardian. Class data mirrors the web store (see web handoff): `grading, periods, closed, roster, assessments, scores, sessions, remarks, flags, consult, guardianScopes`.

Grade math (port exactly)
- Component %: got / max over graded assessments; MISSED counts 0; EXC excluded; ungraded exam → INC.
- Transmutation: `p = raw × (100 − base)/100 + base/100` when a base is set.
- Group % = Σ(comp w × p) / Σ w over graded components; total = Σ(group weight × group %) / Σ weights.
- Standing: `inc` → INC; `< passing` → fail; `< passing + riskBand` → risk; else pass. Grade shown via table lookup by scale.
- Period grade = the above over that period's assessments. Term grade (average) = Σ(period % × weight) / Σ weights over graded periods; (cumulative) = the above over all assessments.
- Attendance rate = non-absent / (sessions − excused).


## Assets
`assets/ulat-mark.svg`, `assets/ulat-mark-white.svg`. Icons: 24px stroke SVGs (1.8 stroke, round caps) — use `react-native-svg` or Lucide-RN equivalents. Fonts: Gabarito, Figtree (Google Fonts).

## Files
- `Ulat Web v3.dc.html` — canonical reference; phones 4b / 4c / 4d on the right of the web app.
- `Ulat Web v2.dc.html` — previous version.
- `Ulat Prototype.dc.html` — earlier standalone phones 3a / 3b / 3c (Filipino variant, settings rows).
- `support.js` — runtime to open the prototypes in a browser; not part of the design.
- `assets/` — logo marks.
