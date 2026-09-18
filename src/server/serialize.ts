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
