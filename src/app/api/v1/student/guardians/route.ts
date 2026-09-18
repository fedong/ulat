import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthorized } from "@/server/auth";
import { prisma } from "@/server/db";

/** The student's guardians: account links, class-level links, open invites. */
export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return unauthorized();
  if (user.role !== "STUDENT")
    return NextResponse.json({ error: "wrong_role" }, { status: 403 });

  const [account, invites, enrollments] = await Promise.all([
    prisma.guardianStudent.findMany({
      where: { studentUserId: user.id },
      include: { guardian: { select: { profile: true, email: true } } },
    }),
    prisma.studentInvite.findMany({
      where: { studentUserId: user.id, claimedAt: null },
      orderBy: { createdAt: "asc" },
    }),
    prisma.enrollment.findMany({ where: { userId: user.id }, select: { studentRowId: true } }),
  ]);
  const rowLinks = await prisma.guardianLink.findMany({
    where: {
      studentRowId: { in: enrollments.map((e) => e.studentRowId) },
      status: "active",
    },
  });

  const guardians = [
    ...account.map((l) => {
      const p = (l.guardian.profile ?? {}) as { first?: string; last?: string };
      return {
        name: [p.first, p.last].filter(Boolean).join(" ") || l.guardian.email,
        role: l.role,
        status: "linked" as const,
      };
    }),
    // Instructor-created links live on one roster row; shown all the same.
    ...rowLinks.map((l) => ({ name: l.name, role: l.role, status: "linked" as const })),
  ];
  return NextResponse.json({
    guardians,
    invites: invites.map((i) => ({ code: i.code, role: i.role })),
  });
}
