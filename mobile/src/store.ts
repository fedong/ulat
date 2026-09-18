import { create } from "zustand";
import type { Klass } from "@ulat/grade-math";
import { seedClasses } from "@ulat/grade-math";
import { todayIso } from "./derive";

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
  classes: Klass[];
  /** Instructor's selected class. */
  clsId: string;
  period: string;
  lang: "English" | "Filipino";

  // Instructor (4b)
  ptabI: ITab;
  phoneAsmId: string | null;
  phoneSession: number | null;
  phoneToast: string | null;
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
  toast: (msg: string) => void;
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export const useUlat = create<UlatMobile>((set, get) => ({
  classes: seedClasses(),
  clsId: "cs101",
  period: "Semi-finals",
  lang: "English",

  ptabI: "classes",
  phoneAsmId: null,
  phoneSession: null,
  phoneToast: null,
  na: { name: "", comp: "", period: "Semi-finals", max: "", later: false, date: todayIso(), notes: "" },

  studentId: "s7", // Reyes, Ana
  ptabS: "home",
  sFocusCode: null,
  sClsCode: null,

  ptabG: "home",
  gChild: null,
  gCls: null,

  set: (p) => set(p),
  upCls: (clsId, fn) =>
    set((s) => ({
      classes: s.classes.map((c) => (c.id === clsId ? { ...c, ...fn(c) } : c)),
    })),
  toast: (msg) => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ phoneToast: msg });
    toastTimer = setTimeout(() => set({ phoneToast: null }), 3500);
  },
}));

export const useClass = (clsId: string) => useUlat((s) => s.classes.find((c) => c.id === clsId));
