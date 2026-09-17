"use client";

import { create } from "zustand";
import { seedClasses } from "./seed";
import type { Grading, GuardianRole, Klass } from "./types";

export interface NewAssessmentDraft {
  name: string;
  comp: string;
  period: string;
  max: string;
  date: string;
  later: boolean;
  notes: string;
}

export interface ConfirmDialog {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
}

export interface UndoEntry {
  sid: string;
  aid: string;
  prev: number | "MISSED" | "EXC" | null | undefined;
}

/** A guardian invite sent from the Sharing page (pending until they register). */
export interface PendingGuardian {
  name: string;
  contact: string;
  role: GuardianRole;
  date: string;
}

export interface Profile {
  title: string;
  first: string;
  last: string;
  suffix: string;
  /** How students/guardians see the name: "short" = Title + last name, "full". */
  nameStyle: "short" | "full";
  school: string;
  department: string;
  position: string;
  facultyId: string;
  license: string;
  mobile: string;
  office: string;
  lang: "English" | "Filipino";
  notif: { risk: boolean; digest: boolean; invites: boolean };
  pwChanged: string;
}

export const DEFAULT_PROFILE: Profile = {
  title: "Prof.",
  first: "Dolores",
  last: "Rivera",
  suffix: "",
  nameStyle: "short",
  school: "Visayas State College of Health Sciences",
  department: "College of Medical Technology",
  position: "Associate Professor",
  facultyId: "2016-0233",
  license: "",
  mobile: "0917 555 0142",
  office: "CMT 3-B",
  lang: "English",
  notif: { risk: true, digest: true, invites: true },
  pwChanged: "June 2026",
};

export type ExportScope = string; // 'all' | 'period' | 'term' | 'attendance' | 'group:<id>'

export interface TourState {
  step: number;
}

export interface TourRect {
  key: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface AuthDraft {
  email: string;
  pw: string;
  name: string;
  school: string;
}

interface UlatState {
  signedIn: boolean;
  signup: boolean;
  authError: boolean;
  auth: AuthDraft;
  showArchived: boolean;
  archiveOpen: boolean;
  classes: Klass[];
  /** Selected period — shared by gradebook tabs, overview strip, student panel. */
  period: string;
  asmFilter: string;
  asmId: string | null;
  focus: string;
  buffer: string;
  undo: UndoEntry | null;
  saved: boolean;
  student: string | null;
  sdTab: "record" | "work" | "remarks" | "shared";
  filter: string;
  remarkDraft: string | null;
  addStudentName: string;
  na: NewAssessmentDraft;
  newSessionDate: string;
  newSessionGroup: string | null;
  teamInvite: string;
  dialog: ConfirmDialog | null;
  showTx: boolean;
  /** Sharing page: student id whose inline invite panel is open, and its fields. */
  linkFor: string | null;
  linkName: string;
  linkContact: string;
  linkRole: GuardianRole;
  /** Pending guardian invites per student id (account-level in the real backend). */
  links: Record<string, PendingGuardian[]>;
  /** Students already asked/reminded from the Sharing page. */
  nudged: Record<string, boolean>;
  tour: TourState | null;
  tourRect: TourRect | null;
  profile: Profile;
  /** Unsaved Profile edits; null when clean. */
  profileDraft: Profile | null;
  profileToast: boolean;
  exportOpen: boolean;
  exportSel: ExportScope | null;
  exportFmt: "xlsx" | "pdf";
  exportBusy: boolean;

  set: (patch: Partial<UlatState>) => void;
  /** Update one class; marks the store dirty and schedules the saved flip. */
  upCls: (clsId: string, fn: (c: Klass) => Partial<Klass>) => void;
  upGrading: (clsId: string, fn: (g: Grading) => Partial<Grading>) => void;
  confirm: (dialog: ConfirmDialog) => void;
  closeDialog: () => void;
}

let savedTimer: ReturnType<typeof setTimeout> | null = null;

export const useUlat = create<UlatState>((set, get) => ({
  signedIn: false,
  signup: false,
  authError: false,
  auth: { email: "", pw: "", name: "", school: "" },
  showArchived: false,
  archiveOpen: false,
  classes: seedClasses(),
  period: "Semi-finals",
  asmFilter: "All",
  asmId: "a5",
  focus: "0-0",
  buffer: "",
  undo: null,
  saved: true,
  student: "s7",
  sdTab: "record",
  filter: "All",
  remarkDraft: null,
  addStudentName: "",
  na: { name: "", comp: "", period: "Semi-finals", max: "20", date: "", later: false, notes: "" },
  newSessionDate: "",
  newSessionGroup: null,
  teamInvite: "",
  dialog: null,
  showTx: false,
  linkFor: null,
  linkName: "",
  linkContact: "",
  linkRole: "Mother",
  links: {},
  nudged: {},
  tour: null,
  tourRect: null,
  profile: DEFAULT_PROFILE,
  profileDraft: null,
  profileToast: false,
  exportOpen: false,
  exportSel: null,
  exportFmt: "xlsx",
  exportBusy: false,

  set: (patch) => set(patch),
  upCls: (clsId, fn) => {
    set((s) => ({
      classes: s.classes.map((c) => (c.id === clsId ? { ...c, ...fn(c) } : c)),
      saved: false,
    }));
    if (savedTimer) clearTimeout(savedTimer);
    savedTimer = setTimeout(() => {
      useUlat.setState({ saved: true });
    }, 700);
  },
  upGrading: (clsId, fn) => {
    get().upCls(clsId, (c) => ({ grading: { ...c.grading, ...fn(c.grading) } }));
  },
  confirm: (dialog) => set({ dialog }),
  closeDialog: () => set({ dialog: null }),
}));

export const useClass = (clsId: string): Klass | undefined =>
  useUlat((s) => s.classes.find((c) => c.id === clsId));

export const today = () => new Date().toISOString().slice(0, 10);
