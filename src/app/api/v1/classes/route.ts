import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { badRequest, requireUser, unauthorized } from "@/server/auth";
import { makeJoinCode } from "@/server/classes";
import { classSummary } from "@/server/serialize";

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return unauthorized();
  const classes = await prisma.class.findMany({
    where: { ownerId: user.id },
    include: { students: { where: { removedAt: null }, select: { id: true } } },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({
    classes: classes.map((c) => classSummary(c)),
  });
}

/** Create a class from the wizard payload. */
export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return unauthorized();
  const b = await req.json().catch(() => null);
  if (!b) return badRequest("body required");
  const code = String(b.code || "").trim();
  const title = String(b.title || "").trim();
  const section = String(b.section || "").trim();
  const term = String(b.term || "").trim();
  const periods: string[] = Array.isArray(b.periods) ? b.periods.map(String) : [];
  if (!code || !title || !section) return badRequest("code, title and section are required");
  if (!periods.length) return badRequest("at least one grading period is required");
  if (!b.grading?.groups?.length) return badRequest("a grading system is required");

  // Free plan: 2 active classes.
  if (user.entState === "FREE") {
    const active = await prisma.class.count({ where: { ownerId: user.id, archived: false } });
    if (active >= 2)
      return NextResponse.json(
        { error: "free_limit", message: "You've reached 2 classes on the Free plan." },
        { status: 403 },
      );
  }

  const roster: { id?: string; no: string; name: string; last: string; first: string; mi?: string }[] =
    Array.isArray(b.roster) ? b.roster : [];
  // Client-generated ids keep the optimistic UI's references valid.
  const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
  const clientId = String(b.id || "");
  if (clientId && !ID_RE.test(clientId)) return badRequest("invalid id");

  const cls = await prisma.class.create({
    data: {
      ...(clientId ? { id: clientId } : {}),
      ownerId: user.id,
      code,
      title,
      section,
      term,
      schedule: String(b.schedule || ""),
      joinCode: String(b.joinCode || "").trim() || makeJoinCode(),
      periods,
      grading: b.grading,
      students: {
        create: roster.map((r) => ({
          ...(r.id && ID_RE.test(String(r.id)) ? { id: String(r.id) } : {}),
          no: String(r.no || ""),
          name: String(r.name || ""),
          last: String(r.last || ""),
          first: String(r.first || ""),
          mi: String(r.mi || ""),
        })),
      },
    },
  });
  return NextResponse.json({ id: cls.id }, { status: 201 });
}
