import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { instructorNameOf } from "@/server/serialize";

type Ctx = { params: Promise<{ code: string }> };

/**
 * Public class lookup for the join landing page (the QR encodes its URL).
 * Join codes are semi-public — they get projected in classrooms — so this
 * returns only what the projection already shows.
 */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { code } = await ctx.params;
  const cls = await prisma.class.findUnique({
    where: { joinCode: String(code || "").toUpperCase() },
    include: { owner: { select: { profile: true } } },
  });
  if (!cls || cls.archived)
    return NextResponse.json({ error: "unknown_code" }, { status: 404 });
  return NextResponse.json({
    code: cls.code,
    title: cls.title,
    section: cls.section,
    term: cls.term,
    instructor: instructorNameOf(cls.owner.profile),
  });
}
