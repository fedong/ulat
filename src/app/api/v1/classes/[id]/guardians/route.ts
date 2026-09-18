import { NextRequest, NextResponse } from "next/server";
import { badRequest, notFound, unauthorized } from "@/server/auth";
import { loadOwnedClass, makeJoinCode } from "@/server/classes";
import { prisma } from "@/server/db";

type Ctx = { params: Promise<{ id: string }> };

const ROLES = ["Mother", "Father", "Grandparent", "Guardian"];

/** Sharing state per student: enrollment + guardian links/invites. */
export async function GET(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const r = await loadOwnedClass(req, id);
  if ("error" in r) return r.error === "unauthorized" ? unauthorized() : notFound();

  const sids = r.cls.students.map((s) => s.id);
  const [enrollments, links] = await Promise.all([
    prisma.enrollment.findMany({
      where: { studentRowId: { in: sids } },
      include: {
        user: {
          select: {
            guardedBy: { include: { guardian: { select: { profile: true, email: true } } } },
          },
        },
      },
    }),
    prisma.guardianLink.findMany({
      where: { studentRowId: { in: sids } },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  // Student-invited guardians (account-level) show on every class's row.
  const accountBySid = new Map(
    enrollments.map((e) => [
      e.studentRowId,
      e.user.guardedBy.map((l) => {
        const p = (l.guardian.profile ?? {}) as { first?: string; last?: string };
        return {
          id: "acct:" + l.id,
          name: [p.first, p.last].filter(Boolean).join(" ") || l.guardian.email,
          role: l.role,
          contact: "",
          status: "active",
          code: undefined as string | undefined,
          date: l.createdAt.toISOString().slice(0, 10),
        };
      }),
    ]),
  );
  const enrolled = new Set(enrollments.map((e) => e.studentRowId));
  const nudgedAt = new Map(
    r.cls.students.map((s) => [s.id, s.guardianNudgeAt?.getTime() ?? null]),
  );
  return NextResponse.json({
    students: Object.fromEntries(
      sids.map((sid) => [
        sid,
        {
          enrolled: enrolled.has(sid),
          nudgedAt: nudgedAt.get(sid) ?? null,
          guardians: [
            ...(accountBySid.get(sid) ?? []),
            ...links
              .filter((l) => l.studentRowId === sid)
              .map((l) => ({
                id: l.id,
                name: l.name,
                role: l.role,
                contact: l.contact,
                status: l.status,
                // The claim code is only shown while the invite is unclaimed.
                code: l.status === "invited" ? l.code : undefined,
                date: l.createdAt.toISOString().slice(0, 10),
              })),
          ],
        },
      ]),
    ),
  });
}

/** Invite a guardian for one student; returns the claim code to pass along. */
export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const r = await loadOwnedClass(req, id);
  if ("error" in r) return r.error === "unauthorized" ? unauthorized() : notFound();
  const b = await req.json().catch(() => null);
  const studentRowId = String(b?.studentRowId || "");
  const name = String(b?.name || "").trim();
  const contact = String(b?.contact || "").trim();
  const role = ROLES.includes(b?.role) ? (b.role as string) : "Guardian";
  if (!r.cls.students.some((s) => s.id === studentRowId)) return badRequest("unknown student");
  if (!name) return badRequest("guardian name required");

  // Two joined 6-char blocks: long enough to not be guessable class-wide.
  const code = makeJoinCode() + makeJoinCode();
  const link = await prisma.guardianLink.create({
    data: { studentRowId, name, contact, role, code },
  });
  return NextResponse.json(
    { id: link.id, code, date: link.createdAt.toISOString().slice(0, 10) },
    { status: 201 },
  );
}

/** Revoke an invite or unlink a guardian. */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const r = await loadOwnedClass(req, id);
  if ("error" in r) return r.error === "unauthorized" ? unauthorized() : notFound();
  const b = await req.json().catch(() => null);
  const linkId = String(b?.linkId || "");
  const sids = new Set(r.cls.students.map((s) => s.id));

  // Account-level links (student-invited) unlink the guardian everywhere.
  if (linkId.startsWith("acct:")) {
    const gs = await prisma.guardianStudent.findUnique({
      where: { id: linkId.slice(5) },
      include: { student: { select: { enrollments: { select: { studentRowId: true } } } } },
    });
    if (!gs || !gs.student.enrollments.some((e) => sids.has(e.studentRowId)))
      return badRequest("unknown link");
    await prisma.guardianStudent.delete({ where: { id: gs.id } });
    return NextResponse.json({ ok: true });
  }

  const link = await prisma.guardianLink.findUnique({ where: { id: linkId } });
  if (!link || !sids.has(link.studentRowId)) return badRequest("unknown link");
  await prisma.guardianLink.delete({ where: { id: linkId } });
  return NextResponse.json({ ok: true });
}
