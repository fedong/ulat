# Ulat — Claude Code Handoff Package

Philippine gradebook. Two clients, one shared API. Start with the README in each folder; each is self-sufficient and states the agreed stack.

- `design_handoff_ulat_web/` — React + TypeScript web app (instructor setup, grading, payments). 269 lines of spec.
- `design_handoff_ulat_mobile/` — React Native (Expo, TypeScript) app, one binary, three roles (Instructor / Student / Guardian). 112 lines of spec.
- Both folders bundle the same `.dc.html` design references (`Ulat Web v3.dc.html` is canonical; v2 and Prototype kept for details v3 is silent on), `support.js` (needed only to open the references in a browser), `assets/` (logo marks), and `Ulat_Payments_Implementation_Spec.md`.

Design references are HTML mockups, not shippable code. Recreate them in the target stack. Share the grade-math module (compute, termOf, periodOf, attRate, standing, transmutation) between web and mobile as a plain TypeScript package.

Suggested Claude Code order: shared API + grade-math package → web instructor setup → mobile Instructor role → Student/Guardian roles → payments.

Snapshot: 2026-09-18T02:55:31.807Z
