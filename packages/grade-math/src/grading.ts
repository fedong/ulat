import type {
  Assessment,
  Grading,
  Klass,
  Score,
  Standing,
  TableRow,
} from "./types";

/** Standing → [chip background, text color]. */
export const STANDING_COLORS: Record<Standing, [string, string]> = {
  pass: ["rgba(15,163,160,0.12)", "#0B807E"],
  risk: ["rgba(245,183,10,0.16)", "#8A6400"],
  fail: ["rgba(209,75,51,0.12)", "#B03A24"],
  inc: ["rgba(90,102,114,0.14)", "#5A6672"],
};

/** Attendance mark → [background, text color, label]. */
export const ATT_COLORS: Record<string, [string, string, string]> = {
  P: ["rgba(15,163,160,0.12)", "#0B807E", "Present"],
  L: ["rgba(245,183,10,0.16)", "#8A6400", "Late"],
  A: ["rgba(209,75,51,0.12)", "#B03A24", "Absent"],
  E: ["rgba(90,102,114,0.14)", "#5A6672", "Excused"],
};

export const ATT_CYCLE: Record<string, "P" | "L" | "A" | "E"> = {
  P: "L",
  L: "A",
  A: "E",
  E: "P",
};

export const SCALES: [string, string][] = [
  ["5pt", "1.00–5.00"],
  ["pct", "Percentage"],
  ["letter", "Letter"],
  ["gpa", "GPA 4.0"],
];

export const SHORT_PERIODS: Record<string, string> = {
  Prelims: "PRELIMS",
  Midterms: "MIDTERMS",
  "Semi-finals": "SEMIS",
  Finals: "FINALS",
};

export const shortPeriod = (p: string) =>
  SHORT_PERIODS[p] || p.slice(0, 6).toUpperCase();

export const scaleLabel = (gs: Grading) =>
  (SCALES.find((s) => s[0] === gs.scale) || SCALES[0])[1];

export const rowFor = (gs: Grading, pct: number): TableRow =>
  gs.table
    .slice()
    .sort((a, b) => Number(b.lo) - Number(a.lo))
    .find((r) => pct >= Number(r.lo)) || gs.table[gs.table.length - 1];

/** Grade as shown on the class's scale ("2.75", "86", "B+", "3.3"). */
export const shown = (gs: Grading, pct: number | null): string => {
  if (pct === null) return "—";
  const r = rowFor(gs, pct);
  return gs.scale === "pct"
    ? pct.toFixed(0)
    : gs.scale === "letter"
      ? r.letter
      : gs.scale === "gpa"
        ? r.gpa
        : r.grade;
};

/** Transmutation base (0–99) or null when none is set. */
export const txBase = (gs: Grading): number | null =>
  gs.transmute === undefined || gs.transmute === null || gs.transmute === ""
    ? null
    : Math.min(99, Math.max(0, Number(gs.transmute) || 0));

/** Carreon-style transmutation: 0 → base, perfect → 100. Operates on a 0–1 fraction. */
export const tx = (gs: Grading, frac: number): number => {
  const base = txBase(gs);
  return base === null ? frac : (frac * (100 - base)) / 100 + base / 100;
};

export const standing = (gs: Grading, pct: number | null, inc: boolean): Standing => {
  const passing = Number(gs.passing) || 0;
  const risk = Number(gs.riskBand) || 0;
  return pct === null || inc
    ? "inc"
    : pct < passing
      ? "fail"
      : pct < passing + risk
        ? "risk"
        : "pass";
};

export const chipText = (k: Standing, g: string) =>
  k === "inc"
    ? "INC"
    : k === "risk"
      ? g + " · At risk"
      : k === "pass"
        ? g + " · Passing"
        : g + " · Failing";

export const chipPlain = (k: Standing) =>
  k === "inc" ? "INC" : k === "pass" ? "Passing" : k === "risk" ? "At risk" : "Failing";

export const compById = (gs: Grading, id: string) => {
  for (const g of gs.groups) for (const c of g.comps) if (c.id === id) return { g, c };
  return null;
};

export const compPath = (gs: Grading, id: string) => {
  const r = compById(gs, id);
  return r ? (gs.groups.length > 1 ? r.g.name + " · " : "") + r.c.name : "Unassigned";
};

export interface CompOut {
  p: number | null;
  cid: string;
  pctText: string;
  name: string;
  w: number;
  text: string;
  color: string;
  pctW: string;
  bar: string;
}

export interface GroupOut {
  share: number;
  shareW: string;
  avg: string;
  segColor: string;
  weightNum: number;
  name: string;
  weightText: string;
  pct: string;
  pctColor: string;
  comps: CompOut[];
}

export interface Computed {
  pct: number | null;
  pctText: string;
  grade: string;
  k: Standing;
  bg: string;
  color: string;
  chip: string;
  chipPlain: string;
  groups: GroupOut[];
  missing: Assessment[];
}

export type ScoreMap = Record<string, Score | null | undefined>;

/**
 * Compute a student's weighted grade over a set of assessments.
 * Ported exactly from the design prototype:
 * - MISSED counts 0; EXC is excluded; ungraded exam with nothing else graded in
 *   its component → INC.
 * - Component % = got/max (transmuted when a base is set); group % = weighted
 *   average over graded components; total = weighted average over graded groups.
 */
export function compute(
  cls: Klass,
  gs: Grading,
  sid: string,
  scOverride?: ScoreMap | null,
  asmSet?: Assessment[] | null,
): Computed {
  const sc = scOverride || cls.scores[sid] || {};
  const asmsIn = asmSet || cls.assessments;
  const passing = Number(gs.passing) || 0;
  const base = txBase(gs);
  let total = 0,
    wsum = 0,
    inc = false;
  const groupsOut: GroupOut[] = [];
  gs.groups.forEach((g) => {
    const gw = gs.groups.length > 1 ? Number(g.weight) || 0 : 100;
    let gt = 0,
      gw2 = 0;
    const compsOut: CompOut[] = [];
    g.comps.forEach((c) => {
      let got = 0,
        max = 0,
        any = false,
        ungradedExam = false;
      asmsIn
        .filter((a) => a.comp === c.id)
        .forEach((a) => {
          const v = sc[a.id];
          if (v === undefined || v === null) {
            if (c.exam) ungradedExam = true;
            return;
          }
          if (v === "EXC") return;
          any = true;
          got += v === "MISSED" ? 0 : Number(v);
          max += Number(a.max);
        });
      if (ungradedExam && !any) inc = true;
      const raw = any && max ? got / max : null;
      const p = raw === null ? null : tx(gs, raw);
      const cw = Number(c.w) || 0;
      if (p !== null) {
        gt += cw * p;
        gw2 += cw;
      }
      compsOut.push({
        p,
        cid: c.id,
        pctText: any && p !== null ? (p * 100).toFixed(0) + "%" : "",
        name: c.name,
        w: cw,
        text:
          any && p !== null
            ? got + " / " + max + (base !== null ? " → " + (p * 100).toFixed(0) + "%" : "")
            : "— ungraded",
        color:
          !any || p === null ? "#9AA3AB" : p * 100 >= passing ? "#0B807E" : "#B03A24",
        pctW: (p === null ? 0 : Math.round(p * 100)) + "%",
        bar: p === null ? "#E8E2D6" : p * 100 >= passing ? "#0FA3A0" : "#D14B33",
      });
    });
    const gp = gw2 ? gt / gw2 : null;
    if (gp !== null) {
      total += gw * gp;
      wsum += gw;
    }
    const share = gp === null ? 0 : gp * gw;
    groupsOut.push({
      share,
      shareW: share.toFixed(1) + "%",
      avg: gp === null ? "—" : (gp * 100).toFixed(0) + "%",
      segColor: ["#0FA3A0", "#5BBFBD", "#9AD9D7", "#C9ECEB"][groupsOut.length % 4],
      weightNum: gw,
      name: g.name,
      weightText: gs.groups.length > 1 ? gw + "%" : "",
      pct:
        gp === null
          ? "—"
          : gs.groups.length > 1
            ? (gp * gw).toFixed(1) + "%"
            : (gp * 100).toFixed(1) + "%",
      pctColor: gp === null ? "#9AA3AB" : gp * 100 >= passing ? "#0B807E" : "#B03A24",
      comps: compsOut,
    });
  });
  const pct = wsum ? (total / wsum) * 100 : null;
  const k = standing(gs, pct, inc);
  const grade = pct === null ? "—" : shown(gs, pct);
  return {
    pct,
    pctText: pct === null ? "—" : pct.toFixed(1) + "%",
    grade,
    k,
    bg: STANDING_COLORS[k][0],
    color: STANDING_COLORS[k][1],
    chip: chipText(k, grade),
    chipPlain: chipPlain(k),
    groups: groupsOut,
    missing: asmsIn.filter((a) => sc[a.id] === "MISSED"),
  };
}

/** Attendance rate = non-absent / (sessions − excused); 100 when no sessions. */
export const attRate = (cls: Klass, sid: string): number => {
  const ks = cls.sessions.map((s) => s.marks[sid] || "P").filter((k) => k !== "E");
  return ks.length
    ? Math.round((ks.filter((k) => k !== "A").length / ks.length) * 100)
    : 100;
};

export const attColor = (r: number) =>
  r >= 90 ? "#0B807E" : r >= 80 ? "#8A6400" : "#B03A24";

/** Weight of one period under the "average of periods" term method. */
export const periodWeight = (gs: Grading, periods: string[], p: string): number => {
  const w = (gs.periodWeights || {})[p];
  return w === undefined || w === null || w === ""
    ? Math.round(100 / periods.length)
    : Number(w) || 0;
};

/** A student's grade for one period, or null when nothing is graded in it. */
export function periodOf(
  cls: Klass,
  gs: Grading,
  sid: string,
  p: string,
  sc?: ScoreMap | null,
): Computed | null {
  const set = cls.assessments.filter((a) => a.period === p);
  const graded = set.some((a) => {
    const v = (sc || cls.scores[sid] || {})[a.id];
    return v !== undefined && v !== null;
  });
  return graded ? compute(cls, gs, sid, sc, set) : null;
}

export interface TermResult {
  pct: number | null;
  pctText: string;
  grade: string;
  k: Standing;
  bg: string;
  color: string;
  chipPlain: string;
  label: string;
}

/**
 * Term grade. "average": weighted average of graded period grades;
 * "cumulative": one computation over all assessments ("Running grade").
 */
export function termOf(
  cls: Klass,
  gs: Grading,
  periods: string[],
  sid: string,
  sc?: ScoreMap | null,
): TermResult {
  const termMethod = gs.termMethod === "cumulative" ? "cumulative" : "average";
  if (termMethod === "cumulative")
    return { ...compute(cls, gs, sid, sc), label: "Running grade" };
  let tot = 0,
    w = 0,
    inc = false;
  periods.forEach((p) => {
    const r = periodOf(cls, gs, sid, p, sc);
    if (r && r.pct !== null) {
      tot += r.pct * periodWeight(gs, periods, p);
      w += periodWeight(gs, periods, p);
    }
    if (r && r.k === "inc") inc = true;
  });
  const pct = w ? tot / w : null;
  const k = standing(gs, pct, inc);
  return {
    pct,
    pctText: pct === null ? "—" : pct.toFixed(1) + "%",
    grade: pct === null ? "—" : shown(gs, pct),
    k,
    bg: STANDING_COLORS[k][0],
    color: STANDING_COLORS[k][1],
    chipPlain: chipPlain(k),
    label: "Term so far",
  };
}

/**
 * Outlook: what a student's period grade becomes if every pending (ungraded /
 * missed) assessment in the period scores `frac` of its max.
 */
export function simulate(
  cls: Klass,
  gs: Grading,
  sid: string,
  pending: Assessment[],
  asmsP: Assessment[],
  frac: number,
): number | null {
  const sc2: ScoreMap = { ...(cls.scores[sid] || {}) };
  pending.forEach((a) => {
    sc2[a.id] = Number(a.max) * frac;
  });
  return compute(cls, gs, sid, sc2, asmsP).pct;
}
