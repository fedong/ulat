/**
 * Static demo content for the multi-class student and multi-child guardian,
 * ported from the design prototype: classes taught by OTHER instructors in
 * their own Ulat classes (read-only summaries), and the guardian's children.
 */
import { STANDING_COLORS, type Standing } from "@ulat/grade-math";
import { attColor } from "@ulat/grade-math";
import { countdown } from "./derive";

export const KLABEL: Record<Standing, string> = {
  pass: "Passing",
  risk: "At risk",
  fail: "Failing",
  inc: "INC",
};

export interface UpcomingItem {
  iso: string;
  code: string;
  name: string;
  max: number;
  compPath: string;
  countdown: string;
  day: number;
  mon: string;
  notes: string;
}

export interface StaticClass {
  live: boolean;
  code: string;
  title: string;
  instructor: string;
  grade: string;
  k: Standing;
  pct: string;
  att: string;
  attColor: string;
  color: string;
  bg: string;
  chipPlain: string;
  passingLine: string;
  missing: string[];
  upcoming: UpcomingItem[];
  remark: string;
  scopes: string[];
  status: "Active" | "Pending";
}

interface StaticIn {
  code: string;
  title: string;
  instructor: string;
  grade: string;
  k: Standing;
  pct: string;
  att: string;
  passingLine: string;
  missing: string[];
  upcoming: { name: string; date: string; comp: string; max: number; notes?: string }[];
  remark?: string;
  scopes?: string[];
}

export const mkStatic = (o: StaticIn): StaticClass => ({
  ...o,
  live: false,
  color: STANDING_COLORS[o.k][1],
  bg: STANDING_COLORS[o.k][0],
  chipPlain: KLABEL[o.k],
  attColor: attColor(parseInt(o.att, 10)),
  status: "Active",
  scopes: o.scopes || ["Grades", "Attendance", "Missing work"],
  remark: o.remark || "",
  upcoming: (o.upcoming || []).map((u) => {
    const dt = new Date(u.date + "T00:00:00");
    return {
      iso: u.date,
      code: o.code,
      name: u.name,
      max: u.max,
      compPath: u.comp,
      countdown: countdown(u.date),
      day: dt.getDate(),
      mon: dt.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
      notes: u.notes || "",
    };
  }),
});

/** Ana's classes with other instructors (beside the live CS101). */
export const OTHER_CLASSES = (): StaticClass[] => [
  mkStatic({
    code: "MATH101",
    title: "Calculus 1",
    instructor: "Prof. Ben Ocampo",
    grade: "2.00",
    k: "pass",
    pct: "84.2%",
    att: "96%",
    passingLine: "Passing at 3.00 or lower · 1.00 is highest",
    missing: [],
    upcoming: [{ name: "Long Quiz 2", date: "2026-09-21", comp: "Quizzes", max: 50 }],
  }),
  mkStatic({
    code: "GE5",
    title: "Purposive Communication",
    instructor: "Ms. Carla Ilagan",
    grade: "2.50",
    k: "risk",
    pct: "79.0%",
    att: "92%",
    passingLine: "Passing at 3.00 or lower · 1.00 is highest",
    missing: ["Reflection Paper 2"],
    upcoming: [
      {
        name: "Group Presentation",
        date: "2026-09-30",
        comp: "Performance",
        max: 100,
        notes: "Groups of 4. Ten minutes each, with slides.",
      },
    ],
    remark: "Reflection Paper 2 is late. Submit before the presentation to keep the standing.",
    scopes: ["Grades", "Missing work"],
  }),
];

/** The guardian's second child (fully static, DepEd-style grades). */
export const MIGUEL_CLASSES = (): StaticClass[] => [
  mkStatic({
    code: "SCI8",
    title: "Science 8",
    instructor: "Mrs. Ana Cruz",
    grade: "86",
    k: "pass",
    pct: "86%",
    att: "98%",
    passingLine: "Passing at 75 or higher",
    missing: [],
    upcoming: [{ name: "Periodical Test", date: "2026-09-24", comp: "Quarterly Assessment", max: 50 }],
    scopes: ["Grades", "Attendance", "Missing work", "Remarks"],
  }),
  mkStatic({
    code: "MATH8",
    title: "Mathematics 8",
    instructor: "Mr. Joel Lim",
    grade: "77",
    k: "risk",
    pct: "77%",
    att: "94%",
    passingLine: "Passing at 75 or higher",
    missing: ["Performance Task 3"],
    upcoming: [],
    remark: "Needs to submit Performance Task 3 before the periodical test.",
    scopes: ["Grades", "Attendance", "Missing work", "Remarks"],
  }),
];

/** The demo guardian account: Ana's mother, also linked to Miguel. */
export const DEMO_GUARDIAN = { name: "Lorna Reyes", shortName: "Mrs. Reyes", role: "Mother" as const };
