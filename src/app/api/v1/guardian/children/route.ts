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

  const [links, accountLinks] = await Promise.all([
    prisma.guardianLink.findMany({
      where: { guardianId: user.id, status: "active", studentRow: { removedAt: null } },
      include: { studentRow: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.guardianStudent.findMany({
      where: { guardianId: user.id },
      include: {
        student: {
          select: {
            email: true,
            profile: true,
            enrollments: {
              where: { studentRow: { removedAt: null } },
              include: { studentRow: true },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const children = new Map<
    string,
    { name: string; rows: { studentRowId: string; role: string; classId: string }[] }
  >();
  const addRow = (
    key: string,
    name: string,
    row: { studentRowId: string; role: string; classId: string },
  ) => {
    const c = children.get(key) ?? { name, rows: [] };
    if (!c.rows.some((r) => r.studentRowId === row.studentRowId)) c.rows.push(row);
    children.set(key, c);
  };
  // Account links cover every class the student is enrolled in.
  for (const l of accountLinks) {
    const p = (l.student.profile ?? {}) as { first?: string; last?: string };
    const fallback = [p.last, p.first].filter(Boolean).join(", ") || l.student.email;
    const name = l.student.enrollments[0]?.studentRow.name || fallback;
    const key = name.toLowerCase();
    for (const e of l.student.enrollments)
      addRow(key, name, {
        studentRowId: e.studentRowId,
        role: l.role,
        classId: e.studentRow.classId,
      });
    if (!l.student.enrollments.length) children.set(key, children.get(key) ?? { name, rows: [] });
  }
  // Instructor-created links cover their one roster row.
  for (const l of links)
    addRow(l.studentRow.name.toLowerCase(), l.studentRow.name, {
      studentRowId: l.studentRowId,
      role: l.role,
      classId: l.studentRow.classId,
    });

  const out = await Promise.all(
    [...children.values()].map(async (child) => ({
      name: child.name,
      role: child.rows[0]?.role ?? "Guardian",
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
