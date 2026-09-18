import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthorized } from "@/server/auth";
import { prisma } from "@/server/db";
import { classInclude, instructorNameOf, scopeToStudent, toKlass } from "@/server/serialize";

/** Everything a signed-in student sees: their view of each enrolled class. */
export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return unauthorized();
  if (user.role !== "STUDENT")
    return NextResponse.json({ error: "wrong_role" }, { status: 403 });

  const enrollments = await prisma.enrollment.findMany({
    where: { userId: user.id, studentRow: { removedAt: null } },
    include: { studentRow: true },
  });
  const rows = await Promise.all(
    enrollments.map(async (e) => {
      const cls = await prisma.class.findUnique({
        where: { id: e.studentRow.classId },
        include: { ...classInclude, owner: { select: { profile: true } } },
      });
      if (!cls || cls.archived) return null;
      // Students always see their own remarks; guardian scopes gate guardians.
      return {
        class: scopeToStudent(toKlass(cls), e.studentRowId, { remarks: true }),
        studentRowId: e.studentRowId,
        studentName: e.studentRow.name,
        instructor: instructorNameOf(cls.owner.profile),
        guardianNudge: e.studentRow.guardianNudgeAt?.getTime() ?? null,
      };
    }),
  );
  return NextResponse.json({ classes: rows.filter(Boolean) });
}
