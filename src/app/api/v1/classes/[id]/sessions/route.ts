import { NextRequest, NextResponse } from "next/server";
import type { Grading } from "@ulat/grade-math";
import { badRequest, notFound, unauthorized } from "@/server/auth";
import { loadOwnedClass } from "@/server/classes";
import { prisma } from "@/server/db";

type Ctx = { params: Promise<{ id: string }> };

const groupOfComp = (grading: Grading, compId: string) =>
  grading.groups.find((g) => g.comps.some((c) => c.id === compId))?.id ?? null;

/** Sessions are addressed by id, or by (date, groupId) — clients keep no ids. */
const findSession = (
  sessions: { id: string; date: string; groupId: string; marks: unknown }[],
  b: { sessionId?: unknown; date?: unknown; groupId?: unknown },
) =>
  b.sessionId
    ? sessions.find((s) => s.id === String(b.sessionId))
    : sessions.find(
        (s) => s.date === String(b.date || "") && s.groupId === String(b.groupId || ""),
      );

/** Start a session: everyone Present. Idempotent per (date, group). */
export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const r = await loadOwnedClass(req, id);
  if ("error" in r) return r.error === "unauthorized" ? unauthorized() : notFound();
  const b = await req.json().catch(() => null);
  const date = String(b?.date || "");
  const groupId = String(b?.groupId || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return badRequest("date must be yyyy-mm-dd");

  const marks = Object.fromEntries(r.cls.students.map((s) => [s.id, "P"]));
  const session = await prisma.attSession.upsert({
    where: { classId_date_groupId: { classId: id, date, groupId } },
    create: { classId: id, date, groupId, marks },
    update: {}, // already started: leave existing marks alone
  });
  return NextResponse.json({ id: session.id }, { status: 201 });
}

/**
 * Set one mark. Absent/Excused carry into same-day assessments of the
 * matching group as MISSED/EXC unless a score was hand-typed — the same rule
 * both clients implement locally.
 */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const r = await loadOwnedClass(req, id);
  if ("error" in r) return r.error === "unauthorized" ? unauthorized() : notFound();
  const b = await req.json().catch(() => null);
  const studentRowId = String(b?.studentRowId || "");
  const mark = String(b?.mark || "");
  if (!["P", "L", "A", "E"].includes(mark)) return badRequest("mark must be P, L, A or E");
  const session = findSession(r.cls.sessions, b || {});
  const student = r.cls.students.find((s) => s.id === studentRowId);
  if (!session || !student) return badRequest("unknown session or student");

  const marks = { ...(session.marks as Record<string, string>) };
  const prev = marks[studentRowId] || "P";
  marks[studentRowId] = mark;

  const auto: Record<string, string> = { A: "MISSED", E: "EXC" };
  const grading = r.cls.grading as unknown as Grading;
  const linked = r.cls.assessments.filter(
    (a) =>
      !a.archivedAt &&
      a.date === session.date &&
      (!session.groupId || groupOfComp(grading, a.comp) === session.groupId),
  );

  await prisma.$transaction(async (tx) => {
    await tx.attSession.update({ where: { id: session.id }, data: { marks } });
    for (const a of linked) {
      const cur = a.scores.find((sc) => sc.studentRowId === studentRowId)?.value;
      const wasAuto = cur === undefined || cur === auto[prev];
      if (!wasAuto) continue;
      if (auto[mark]) {
        await tx.score.upsert({
          where: { studentRowId_assessmentId: { studentRowId, assessmentId: a.id } },
          create: { studentRowId, assessmentId: a.id, value: auto[mark] },
          update: { value: auto[mark] },
        });
      } else if (cur === auto[prev]) {
        await tx.score.deleteMany({ where: { studentRowId, assessmentId: a.id } });
      }
    }
  });
  return NextResponse.json({ ok: true });
}

/** Discard a session (accidental start) and clean its auto-carried scores. */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const r = await loadOwnedClass(req, id);
  if ("error" in r) return r.error === "unauthorized" ? unauthorized() : notFound();
  const b = await req.json().catch(() => null);
  const session = findSession(r.cls.sessions, b || {});
  if (!session) return badRequest("unknown session");

  const marks = session.marks as Record<string, string>;
  const auto: Record<string, string> = { A: "MISSED", E: "EXC" };
  const grading = r.cls.grading as unknown as Grading;
  const linked = r.cls.assessments.filter(
    (a) =>
      !a.archivedAt &&
      a.date === session.date &&
      (!session.groupId || groupOfComp(grading, a.comp) === session.groupId),
  );

  await prisma.$transaction(async (tx) => {
    for (const a of linked)
      for (const s of r.cls.students) {
        const expect = auto[marks[s.id]];
        if (!expect) continue;
        const cur = a.scores.find((sc) => sc.studentRowId === s.id)?.value;
        if (cur === expect)
          await tx.score.deleteMany({ where: { studentRowId: s.id, assessmentId: a.id } });
      }
    await tx.attSession.delete({ where: { id: session.id } });
  });
  return NextResponse.json({ ok: true });
}
