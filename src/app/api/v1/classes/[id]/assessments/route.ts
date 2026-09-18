import { NextRequest, NextResponse } from "next/server";
import type { Grading } from "@ulat/grade-math";
import { badRequest, notFound, unauthorized } from "@/server/auth";
import { loadOwnedClass } from "@/server/classes";
import { prisma } from "@/server/db";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Create an assessment. If an attendance session exists on the same date for
 * the matching group, Absent/Excused marks prefill MISSED/EXC — the server
 * owns this rule so every client gets it for free.
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const r = await loadOwnedClass(req, id);
  if ("error" in r) return r.error === "unauthorized" ? unauthorized() : notFound();
  const b = await req.json().catch(() => null);
  const name = String(b?.name || "").trim();
  const comp = String(b?.comp || "");
  const period = String(b?.period || "");
  const max = Number(b?.max);
  const date = String(b?.date || "");
  if (!name || !comp || !period) return badRequest("name, comp and period are required");
  if (!(max > 0)) return badRequest("max must be a positive number");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return badRequest("date must be yyyy-mm-dd");
  if (!r.cls.periods.includes(period)) return badRequest("unknown period");
  const clientId = String(b?.id || "");
  if (clientId && !/^[A-Za-z0-9_-]{1,64}$/.test(clientId)) return badRequest("invalid id");

  const grading = r.cls.grading as unknown as Grading;
  const group = grading.groups.find((g) => g.comps.some((c) => c.id === comp));
  if (!group) return badRequest("unknown component");

  const asm = await prisma.assessment.create({
    data: {
      ...(clientId ? { id: clientId } : {}),
      classId: id,
      name,
      comp,
      period,
      max,
      date,
      notes: String(b?.notes || "").trim(),
    },
  });

  // Attendance-linked prefill.
  const session = r.cls.sessions.find(
    (s) => s.date === date && (!s.groupId || s.groupId === group.id),
  );
  if (session) {
    const marks = session.marks as Record<string, string>;
    const rows = r.cls.students
      .map((s) => ({ s, m: marks[s.id] }))
      .filter(({ m }) => m === "A" || m === "E")
      .map(({ s, m }) => ({
        studentRowId: s.id,
        assessmentId: asm.id,
        value: m === "A" ? "MISSED" : "EXC",
      }));
    if (rows.length) await prisma.score.createMany({ data: rows });
  }
  return NextResponse.json({ id: asm.id }, { status: 201 });
}

/** Edit an assessment, or archive/restore it via `archived: boolean`. */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const r = await loadOwnedClass(req, id);
  if ("error" in r) return r.error === "unauthorized" ? unauthorized() : notFound();
  const b = await req.json().catch(() => null);
  const assessmentId = String(b?.assessmentId || "");
  const asm = r.cls.assessments.find((a) => a.id === assessmentId);
  if (!asm) return badRequest("unknown assessment");

  const data: Record<string, unknown> = {};
  if (typeof b.name === "string" && b.name.trim()) data.name = b.name.trim();
  if (typeof b.notes === "string") data.notes = b.notes;
  if (typeof b.max === "number" && b.max > 0) data.max = b.max;
  if (typeof b.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.date)) data.date = b.date;
  if (typeof b.period === "string" && r.cls.periods.includes(b.period)) data.period = b.period;
  if (typeof b.comp === "string") {
    const grading = r.cls.grading as unknown as Grading;
    if (!grading.groups.some((g) => g.comps.some((c) => c.id === b.comp)))
      return badRequest("unknown component");
    data.comp = b.comp;
  }
  if (typeof b.archived === "boolean")
    data.archivedAt = b.archived
      ? typeof b.archivedAt === "number"
        ? new Date(b.archivedAt)
        : new Date()
      : null;

  await prisma.assessment.update({ where: { id: assessmentId }, data });
  return NextResponse.json({ ok: true });
}

/** Delete permanently (scores cascade). */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const r = await loadOwnedClass(req, id);
  if ("error" in r) return r.error === "unauthorized" ? unauthorized() : notFound();
  const b = await req.json().catch(() => null);
  const assessmentId = String(b?.assessmentId || "");
  if (!r.cls.assessments.some((a) => a.id === assessmentId))
    return badRequest("unknown assessment");
  await prisma.assessment.delete({ where: { id: assessmentId } });
  return NextResponse.json({ ok: true });
}
