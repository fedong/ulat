import { NextRequest, NextResponse } from "next/server";
import { badRequest, notFound, unauthorized } from "@/server/auth";
import { loadOwnedClass } from "@/server/classes";
import { prisma } from "@/server/db";

type Ctx = { params: Promise<{ id: string }> };

/** Client-generated ids are accepted so optimistic UIs keep their references. */
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

/** Add a student to the roster. */
export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const r = await loadOwnedClass(req, id);
  if ("error" in r) return r.error === "unauthorized" ? unauthorized() : notFound();
  const b = await req.json().catch(() => null);
  const name = String(b?.name || "").trim();
  if (!name) return badRequest("name is required");
  const clientId = String(b?.id || "");
  if (clientId && !ID_RE.test(clientId)) return badRequest("invalid id");

  const student = await prisma.studentRow.create({
    data: {
      ...(clientId ? { id: clientId } : {}),
      classId: id,
      no: String(b?.no || ""),
      name,
      last: String(b?.last || ""),
      first: String(b?.first || ""),
      mi: String(b?.mi || ""),
    },
  });
  return NextResponse.json({ id: student.id }, { status: 201 });
}

/** Update one student: name fields, flag, remark (+log), consultation stamp. */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const r = await loadOwnedClass(req, id);
  if ("error" in r) return r.error === "unauthorized" ? unauthorized() : notFound();
  const b = await req.json().catch(() => null);
  const studentRowId = String(b?.studentRowId || "");
  if (!r.cls.students.some((s) => s.id === studentRowId)) return badRequest("unknown student");

  const data: Record<string, unknown> = {};
  for (const k of ["no", "name", "last", "first", "mi", "remark"] as const)
    if (typeof b[k] === "string") data[k] = b[k];
  if (typeof b.flagged === "boolean") data.flagged = b.flagged;
  if (Array.isArray(b.remarkLog)) data.remarkLog = b.remarkLog;
  // consultedAt: epoch ms marks a consultation; null clears it.
  if (b.consultedAt === null) data.consultedAt = null;
  else if (typeof b.consultedAt === "number") data.consultedAt = new Date(b.consultedAt);

  await prisma.studentRow.update({ where: { id: studentRowId }, data });
  return NextResponse.json({ ok: true });
}

/** Remove from class (soft: scores and history are kept). */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const r = await loadOwnedClass(req, id);
  if ("error" in r) return r.error === "unauthorized" ? unauthorized() : notFound();
  const b = await req.json().catch(() => null);
  const studentRowId = String(b?.studentRowId || "");
  if (!r.cls.students.some((s) => s.id === studentRowId)) return badRequest("unknown student");

  await prisma.studentRow.update({
    where: { id: studentRowId },
    data: { removedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
