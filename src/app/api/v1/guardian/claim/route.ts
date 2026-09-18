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

  const link = await prisma.guardianLink.findUnique({
    where: { code },
    include: { studentRow: true },
  });
  if (!link)
    return NextResponse.json(
      { error: "unknown_code", message: "No invite with that code. Check it with the instructor." },
      { status: 404 },
    );
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
