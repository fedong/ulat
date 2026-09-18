import {
  attColor,
  attRate,
  compute,
  periodOf,
  shortPeriod,
  termOf,
  type Klass,
  type TermResult,
} from "@ulat/grade-math";
import { countdown, DEMO_INSTRUCTOR, passingLineOf, todayIso } from "./derive";
import type { StaticClass, UpcomingItem } from "./demo";
import { C } from "./theme";

export interface StripTile {
  short: string;
  value: string;
  color: string;
  bg: string;
  border: string;
}

/** Build the live-class summary (CS101 · Ana) shared by the student and guardian views. */
/** The class's live period: the last open period where scores are recorded. */
export function currentPeriodOf(cls: Klass, studentId: string): string {
  const sc = cls.scores[studentId] || {};
  const graded = cls.periods.filter((p) =>
    cls.assessments.some((a) => {
      const v = sc[a.id];
      return a.period === p && v !== undefined && v !== null;
    }),
  );
  const open = graded.filter((p) => !(cls.closed || {})[p]);
  return open[open.length - 1] || graded[graded.length - 1] || cls.periods[0];
}

export function buildLive(cls: Klass, studentId: string) {
  const gs = cls.grading;
  const period = currentPeriodOf(cls, studentId);

  const asmsP = cls.assessments.filter((a) => a.period === period);
  const c = compute(cls, gs, studentId, null, asmsP);
  const rate = attRate(cls, studentId);
  const upcoming: UpcomingItem[] = cls.assessments
    .filter((a) => {
      const v = (cls.scores[studentId] || {})[a.id];
      return a.date > todayIso() && (v === undefined || v === null);
    })
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((a) => {
      const dt = new Date(a.date + "T00:00:00");
      const cp = gs.groups.flatMap((g) => g.comps).find((x) => x.id === a.comp);
      return {
        iso: a.date,
        code: cls.code,
        name: a.name,
        max: a.max,
        compPath: cp ? cp.name : "Unassigned",
        countdown: countdown(a.date),
        day: dt.getDate(),
        mon: dt.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
        notes: a.notes || "",
      };
    });
  const term: TermResult = termOf(cls, gs, cls.periods, studentId);
  const strip: StripTile[] = cls.periods.map((p) => {
    const r = periodOf(cls, gs, studentId, p);
    return {
      short: shortPeriod(p),
      value: r && r.pct !== null ? r.grade : "—",
      color: r && r.pct !== null ? r.color : C.faint,
      bg: p === period ? C.tealTint8 : (cls.closed || {})[p] ? C.canvas : "#FFFFFF",
      border: p === period ? C.teal : C.line,
    };
  });
  const live: StaticClass = {
    live: true,
    code: cls.code,
    title: cls.title,
    instructor: DEMO_INSTRUCTOR.name,
    grade: c.grade,
    k: c.k,
    pct: c.pctText,
    att: rate + "%",
    attColor: attColor(rate),
    color: c.color,
    bg: c.bg,
    chipPlain: c.chipPlain,
    passingLine: passingLineOf(gs),
    missing: c.missing.map((a) => a.name),
    upcoming,
    remark: cls.remarks[studentId] || "",
    scopes: ["Grades", "Attendance", "Missing work"],
    status: "Active",
  };
  return { live, term, strip, period, computed: c };
}
