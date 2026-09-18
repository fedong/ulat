import { NextRequest, NextResponse } from "next/server";
import { badRequest, requireUser, unauthorized } from "@/server/auth";
import { prisma } from "@/server/db";

/** Guardian claims an invite code from the instructor's Sharing page. */
export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return unauthorized();
  if (user.role !== "GUARDIAN")
    return NextResponse.json(
      { error: "wrong_role", message: "Only guardian accounts can claim an invite." },
      { status: 403 },
    );

  const b = await req.json().catch(() => null);
  const code = String(b?.code || "").trim().toUpperCase();
  if (!code) return badRequest("invite code required");

  // Instructor-created invite: links this one roster row.
  const link = await prisma.guardianLink.findUnique({
    where: { code },
    include: { studentRow: true },
  });
  if (link) {
    if (link.guardianId && link.guardianId !== user.id)
      return NextResponse.json(
        { error: "already_claimed", message: "That invite was already used by another account." },
        { status: 409 },
      );
    if (!link.guardianId)
      await prisma.guardianLink.update({
        where: { id: link.id },
        data: { guardianId: user.id, status: "active" },
      });
    return NextResponse.json(
      { studentRowId: link.studentRowId, studentName: link.studentRow.name },
      { status: 201 },
    );
  }

  // Student-created invite: account-level, follows every class they take.
  const invite = await prisma.studentInvite.findUnique({
    where: { code },
    include: { student: { select: { id: true, profile: true, email: true } } },
  });
  if (!invite)
    return NextResponse.json(
      { error: "unknown_code", message: "No invite with that code. Check it and try again." },
      { status: 404 },
    );
  if (invite.claimedAt) {
    const mine = await prisma.guardianStudent.findUnique({
      where: {
        guardianId_studentUserId: { guardianId: user.id, studentUserId: invite.studentUserId },
      },
    });
    if (!mine)
      return NextResponse.json(
        { error: "already_claimed", message: "That invite was already used by another account." },
        { status: 409 },
      );
  }
  await prisma.$transaction([
    prisma.guardianStudent.upsert({
      where: {
        guardianId_studentUserId: { guardianId: user.id, studentUserId: invite.studentUserId },
      },
      create: { guardianId: user.id, studentUserId: invite.studentUserId, role: invite.role },
      update: {},
    }),
    prisma.studentInvite.update({
      where: { id: invite.id },
      data: { claimedAt: invite.claimedAt ?? new Date() },
    }),
  ]);
  const p = (invite.student.profile ?? {}) as { first?: string; last?: string };
  return NextResponse.json(
    { studentName: [p.last, p.first].filter(Boolean).join(", ") || invite.student.email },
    { status: 201 },
  );
}
