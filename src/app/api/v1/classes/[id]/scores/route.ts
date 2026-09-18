import { NextRequest, NextResponse } from "next/server";
import { badRequest, notFound, unauthorized } from "@/server/auth";
import { loadOwnedClass } from "@/server/classes";
import { prisma } from "@/server/db";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Write one score cell (last-write-wins, matching the clients' optimistic
 * writes). value: number | "MISSED" | "EXC" | null (null clears).
 */
export async function PUT(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const r = await loadOwnedClass(req, id);
  if ("error" in r) return r.error === "unauthorized" ? unauthorized() : notFound();
  const b = await req.json().catch(() => null);
  const studentRowId = String(b?.studentRowId || "");
  const assessmentId = String(b?.assessmentId || "");
  const value: unknown = b?.value;

  const student = r.cls.students.find((s) => s.id === studentRowId);
  const assessment = r.cls.assessments.find((a) => a.id === assessmentId);
  if (!student || !assessment) return badRequest("unknown student or assessment");
  if ((r.cls.closed as Record<string, boolean>)[assessment.period])
    return NextResponse.json(
      { error: "period_final", message: "This period is marked Final." },
      { status: 409 },
    );

  if (value === null) {
    await prisma.score.deleteMany({ where: { studentRowId, assessmentId } });
    return NextResponse.json({ ok: true, value: null });
  }
  let stored: string;
  if (value === "MISSED" || value === "EXC") stored = value;
  else if (typeof value === "number" && isFinite(value))
    stored = String(Math.max(0, Math.min(assessment.max, value)));
  else return badRequest("value must be a number, MISSED, EXC or null");

  await prisma.score.upsert({
    where: { studentRowId_assessmentId: { studentRowId, assessmentId } },
    create: { studentRowId, assessmentId, value: stored },
    update: { value: stored },
  });
  return NextResponse.json({ ok: true, value: stored === "MISSED" || stored === "EXC" ? stored : Number(stored) });
}
