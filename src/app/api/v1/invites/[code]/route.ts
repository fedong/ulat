import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";

type Ctx = { params: Promise<{ code: string }> };

const firstName = (s: string) => {
  const rest = s.split(",")[1];
  return rest ? rest.trim().split(" ")[0] : s.split(" ")[0] || s;
};

/**
 * Public guardian-invite lookup for the landing page. Reveals only the
 * student's first name and the invited role — the code is the secret.
 */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { code } = await ctx.params;
  const c = String(code || "").toUpperCase();

  const link = await prisma.guardianLink.findUnique({
    where: { code: c },
    include: { studentRow: true },
  });
  if (link && link.status === "invited")
    return NextResponse.json({ studentFirst: firstName(link.studentRow.name), role: link.role });

  const invite = await prisma.studentInvite.findUnique({
    where: { code: c },
    include: { student: { select: { profile: true } } },
  });
  if (invite && !invite.claimedAt) {
    const p = (invite.student.profile ?? {}) as { first?: string };
    return NextResponse.json({ studentFirst: p.first || "a student", role: invite.role });
  }
  return NextResponse.json({ error: "unknown_code" }, { status: 404 });
}
