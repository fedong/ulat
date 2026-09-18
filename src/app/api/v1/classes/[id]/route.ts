import { NextRequest, NextResponse } from "next/server";
import { notFound, unauthorized } from "@/server/auth";
import { loadOwnedClass } from "@/server/classes";
import { prisma } from "@/server/db";
import { classInclude, toKlass } from "@/server/serialize";

type Ctx = { params: Promise<{ id: string }> };

/** Full class in the Klass shape both clients consume. */
export async function GET(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const r = await loadOwnedClass(req, id);
  if ("error" in r) return r.error === "unauthorized" ? unauthorized() : notFound();
  return NextResponse.json({ class: toKlass(r.cls) });
}

/** Settings updates: grading, periods, closed, scopes, consult, archived. */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const r = await loadOwnedClass(req, id);
  if ("error" in r) return r.error === "unauthorized" ? unauthorized() : notFound();
  const b = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  for (const k of ["code", "title", "section", "term", "schedule", "joinCode"] as const)
    if (typeof b[k] === "string") data[k] = b[k];
  if (Array.isArray(b.periods)) data.periods = b.periods.map(String);
  if (Array.isArray(b.team)) data.team = b.team;
  for (const k of ["grading", "closed", "guardianScopes", "consult"] as const)
    if (b[k] && typeof b[k] === "object") data[k] = b[k];
  if (typeof b.archived === "boolean") data.archived = b.archived;
  const updated = await prisma.class.update({
    where: { id },
    data,
    include: classInclude,
  });
  return NextResponse.json({ class: toKlass(updated) });
}

/** Delete the class permanently (students, assessments, scores, sessions cascade). */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const r = await loadOwnedClass(req, id);
  if ("error" in r) return r.error === "unauthorized" ? unauthorized() : notFound();
  await prisma.class.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
