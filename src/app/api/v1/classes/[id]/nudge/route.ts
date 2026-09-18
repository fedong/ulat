import { NextRequest, NextResponse } from "next/server";
import { badRequest, notFound, unauthorized } from "@/server/auth";
import { loadOwnedClass } from "@/server/classes";
import { prisma } from "@/server/db";

type Ctx = { params: Promise<{ id: string }> };

/** "Ask student": prompt them in their app to invite a guardian. */
export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const r = await loadOwnedClass(req, id);
  if ("error" in r) return r.error === "unauthorized" ? unauthorized() : notFound();
  const b = await req.json().catch(() => null);
  const studentRowId = String(b?.studentRowId || "");
  if (!r.cls.students.some((s) => s.id === studentRowId)) return badRequest("unknown student");
  await prisma.studentRow.update({
    where: { id: studentRowId },
    data: { guardianNudgeAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
