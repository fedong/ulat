import type {
  Assessment as DbAssessment,
  AttSession,
  Class,
  Score,
  StudentRow,
} from "@prisma/client";
import type { AttMark, Klass, Score as ScoreValue } from "@ulat/grade-math";

export type FullClass = Class & {
  students: StudentRow[];
  assessments: (DbAssessment & { scores: Score[] })[];
  sessions: AttSession[];
};

export const classInclude = {
  students: { where: { removedAt: null }, orderBy: { name: "asc" as const } },
  // Archived assessments ride along and are split into Klass.archive below.
  assessments: { orderBy: { date: "asc" as const }, include: { scores: true } },
  sessions: { orderBy: [{ date: "asc" as const }, { groupId: "asc" as const }] },
};

const parseScore = (v: string): ScoreValue =>
  v === "MISSED" || v === "EXC" ? v : Number(v);

/**
 * Serialize a class into the exact Klass shape both clients already consume
 * (the same shape the local seeds produce), so wiring them to the API is a
 * data-source swap, not a rewrite.
 */
export function toKlass(c: FullClass): Klass {
  const scores: Klass["scores"] = {};
  for (const s of c.students) scores[s.id] = {};
  for (const a of c.assessments)
    for (const sc of a.scores) {
      if (!scores[sc.studentRowId]) continue; // removed student
      scores[sc.studentRowId][a.id] = parseScore(sc.value);
    }

  const remarks: Record<string, string> = {};
  const remarkLog: NonNullable<Klass["remarkLog"]> = {};
  const flags: Record<string, boolean> = {};
  const consults: NonNullable<Klass["consults"]> = {};
  for (const s of c.students) {
    if (s.remark) remarks[s.id] = s.remark;
    const log = s.remarkLog as { text: string; at: number }[];
    if (log?.length) remarkLog[s.id] = log;
    if (s.flagged) flags[s.id] = true;
    if (s.consultedAt) consults[s.id] = s.consultedAt.getTime();
  }

  return {
    id: c.id,
    code: c.code,
    title: c.title,
    section: c.section,
    term: c.term,
    schedule: c.schedule,
    joinCode: c.joinCode,
    grading: c.grading as unknown as Klass["grading"],
    periods: c.periods,
    closed: c.closed as Record<string, boolean>,
    roster: c.students.map((s) => ({
      id: s.id,
      no: s.no,
      name: s.name,
      last: s.last,
      first: s.first,
      mi: s.mi,
      issues: [],
    })),
    assessments: c.assessments
      .filter((a) => !a.archivedAt)
      .map((a) => ({
        id: a.id,
        name: a.name,
        comp: a.comp,
        period: a.period,
        max: a.max,
        date: a.date,
        notes: a.notes || undefined,
      })),
    archive: c.assessments
      .filter((a) => a.archivedAt)
      .map((a) => ({
        id: a.id,
        name: a.name,
        comp: a.comp,
        period: a.period,
        max: a.max,
        date: a.date,
        notes: a.notes || undefined,
        archivedAt: a.archivedAt!.getTime(),
      })),
    scores,
    sessions: c.sessions.map((s) => ({
      date: s.date,
      group: s.groupId || undefined,
      marks: s.marks as Record<string, AttMark>,
    })),
    remarks,
    remarkLog,
    flags,
    consults,
    consult: c.consult as unknown as Klass["consult"],
    team: c.team as unknown as Klass["team"],
    archived: c.archived,
    guardianScopes: c.guardianScopes as Record<string, boolean>,
  };
}

/**
 * Narrow a full Klass to what one student (or their guardian) may see: their
 * own row, scores, marks and notes only — and never the join code. `remarks`
 * false (guardian scope "Remarks" off) strips remark text and history.
 */
export function scopeToStudent(k: Klass, sid: string, opts: { remarks: boolean }): Klass {
  return {
    ...k,
    joinCode: "",
    roster: k.roster.filter((r) => r.id === sid),
    scores: { [sid]: k.scores[sid] || {} },
    sessions: k.sessions.map((s) => ({
      ...s,
      marks: (s.marks[sid] ? { [sid]: s.marks[sid] } : {}) as typeof s.marks,
    })),
    remarks: opts.remarks && k.remarks[sid] ? { [sid]: k.remarks[sid] } : {},
    remarkLog: opts.remarks && k.remarkLog?.[sid] ? { [sid]: k.remarkLog[sid] } : {},
    flags: k.flags?.[sid] ? { [sid]: true } : {},
    consults: k.consults?.[sid] != null ? { [sid]: k.consults[sid] } : {},
    archive: [],
    team: [],
  };
}

/** Instructor display name for student/guardian payloads (never the email). */
export function instructorNameOf(profile: unknown): string {
  const p = (profile ?? {}) as { title?: string; first?: string; last?: string; nameStyle?: string };
  const short = p.nameStyle !== "full";
  const name = short
    ? [p.title, p.last].filter(Boolean).join(" ")
    : [p.title, p.first, p.last].filter(Boolean).join(" ");
  return name.trim() || "Instructor";
}

export function classSummary(c: Class & { students?: { id: string }[] }) {
  return {
    id: c.id,
    code: c.code,
    title: c.title,
    section: c.section,
    term: c.term,
    archived: c.archived,
    students: c.students?.length ?? undefined,
  };
}
