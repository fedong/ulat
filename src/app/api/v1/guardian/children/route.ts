import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthorized } from "@/server/auth";
import { prisma } from "@/server/db";
import { classInclude, instructorNameOf, scopeToStudent, toKlass } from "@/server/serialize";

/**
 * A guardian's children with their scope-gated class views. Grades and
 * Attendance always share; "Missing work" and Remarks follow each class's
 * guardianScopes (Remarks stripped server-side). Rows for the same student
 * name group into one child.
 */
export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return unauthorized();
  if (user.role !== "GUARDIAN")
    return NextResponse.json({ error: "wrong_role" }, { status: 403 });

  const links = await prisma.guardianLink.findMany({
    where: { guardianId: user.id, status: "active", studentRow: { removedAt: null } },
    include: { studentRow: true },
    orderBy: { createdAt: "asc" },
  });

  const children = new Map<
    string,
    { name: string; rows: { studentRowId: string; role: string; classId: string }[] }
  >();
  for (const l of links) {
    const key = l.studentRow.name.toLowerCase();
    const c = children.get(key) ?? { name: l.studentRow.name, rows: [] };
    c.rows.push({ studentRowId: l.studentRowId, role: l.role, classId: l.studentRow.classId });
    children.set(key, c);
  }

  const out = await Promise.all(
    [...children.values()].map(async (child) => ({
      name: child.name,
      role: child.rows[0].role,
      classes: (
        await Promise.all(
          child.rows.map(async (r) => {
            const cls = await prisma.class.findUnique({
              where: { id: r.classId },
              include: { ...classInclude, owner: { select: { profile: true } } },
            });
            if (!cls || cls.archived) return null;
            const scopes = (cls.guardianScopes ?? {}) as Record<string, boolean>;
            return {
              class: scopeToStudent(toKlass(cls), r.studentRowId, {
                remarks: scopes.Remarks === true,
              }),
              studentRowId: r.studentRowId,
              instructor: instructorNameOf(cls.owner.profile),
              // Grades and Attendance are always on (class policy bar, v2.1).
              scopes: ["Grades", "Attendance"]
                .concat(scopes["Missing work"] !== false ? ["Missing work"] : [])
                .concat(scopes.Remarks === true ? ["Remarks"] : []),
            };
          }),
        )
      ).filter(Boolean),
    })),
  );
  return NextResponse.json({ children: out });
}
