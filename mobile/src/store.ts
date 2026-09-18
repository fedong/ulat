import { create } from "zustand";
import type { Klass } from "@ulat/grade-math";
import { seedClasses } from "@ulat/grade-math";
import type { EntitlementDto } from "./api";
import { todayIso } from "./derive";
import { syncClassPatch } from "./sync";

export type ITab = "classes" | "grades" | "attend" | "alerts" | "me";
export type STab = "home" | "classes" | "alerts" | "me";
export type GTab = "home" | "kids" | "alerts" | "me";

export interface NaDraft {
  name: string;
  comp: string;
  period: string;
  max: string;
  later: boolean;
  date: string;
  notes: string;
}

interface UlatMobile {
  /** Instructor's live classes, hydrated from the API after sign-in. */
  classes: Klass[];
  /** Fixed demo data for the student/guardian showcase roles (until Phase 4). */
  demoClasses: Klass[];
  /** Instructor's selected class. */
  clsId: string;
  period: string;
  lang: "English" | "Filipino";

  // Instructor session (from /v1/auth/me)
  signedIn: boolean;
  email: string;
  meName: string;
  ent: EntitlementDto | null;

  // Instructor (4b)
  ptabI: ITab;
  phoneAsmId: string | null;
  phoneSession: number | null;
  phoneToast: string | null;
  phoneToastAct: { label: string; run: () => void } | null;
  na: NaDraft;

  // Student (4c) — the demo student account (Ana Reyes).
  studentId: string;
  ptabS: STab;
  sFocusCode: string | null;
  sClsCode: string | null;

  // Guardian (4d)
  ptabG: GTab;
  gChild: number | null;
  gCls: string | null;

  set: (p: Partial<UlatMobile>) => void;
  upCls: (clsId: string, fn: (c: Klass) => Partial<Klass>) => void;
  toast: (msg: string, act?: { label: string; run: () => void }) => void;
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export const useUlat = create<UlatMobile>((set, get) => ({
  classes: [],
  demoClasses: seedClasses(),
  clsId: "",
  period: "Semi-finals",
  lang: "English",

  signedIn: false,
  email: "",
  meName: "",
  ent: null,

  ptabI: "classes",
  phoneAsmId: null,
  phoneSession: null,
  phoneToast: null,
  phoneToastAct: null,
  na: { name: "", comp: "", period: "Semi-finals", max: "", later: false, date: todayIso(), notes: "" },

  studentId: "s7", // Reyes, Ana
  ptabS: "home",
  sFocusCode: null,
  sClsCode: null,

  ptabG: "home",
  gChild: null,
  gCls: null,

  set: (p) => set(p),
  upCls: (clsId, fn) => {
    // Optimistic: apply locally, then mirror the diff to the API.
    let synced: { prev: Klass; next: Klass; patch: Partial<Klass> } | null = null;
    set((s) => {
      const c0 = s.classes.find((c) => c.id === clsId);
      if (!c0) return {};
      const patch = fn(c0);
      const next = { ...c0, ...patch };
      synced = { prev: c0, next, patch };
      return { classes: s.classes.map((c) => (c.id === clsId ? next : c)) };
    });
    if (synced) {
      const { prev, next, patch } = synced as { prev: Klass; next: Klass; patch: Partial<Klass> };
      syncClassPatch(prev, next, patch);
    }
  },
  toast: (msg, act) => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ phoneToast: msg, phoneToastAct: act || null });
    // A toast with an action (e.g. Undo) stays a little longer.
    toastTimer = setTimeout(
      () => set({ phoneToast: null, phoneToastAct: null }),
      act ? 5000 : 3500,
    );
  },
}));

export const useClass = (clsId: string) => useUlat((s) => s.classes.find((c) => c.id === clsId));
