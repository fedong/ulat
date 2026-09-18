import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthorized } from "@/server/auth";
import { makeJoinCode } from "@/server/classes";
import { prisma } from "@/server/db";

const ROLES = ["Mother", "Father", "Grandparent", "Guardian"];

/**
 * Student creates (or re-fetches) their guardian invite code. Account-level:
 * the guardian who claims it follows every class the student takes.
 */
export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return unauthorized();
  if (user.role !== "STUDENT")
    return NextResponse.json({ error: "wrong_role" }, { status: 403 });

  const b = await req.json().catch(() => null);
  const role = ROLES.includes(b?.role) ? (b.role as string) : "Guardian";

  // One live code per relationship; asking again shows the same code.
  const existing = await prisma.studentInvite.findFirst({
    where: { studentUserId: user.id, role, claimedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return NextResponse.json({ code: existing.code, role });

  const invite = await prisma.studentInvite.create({
    data: { studentUserId: user.id, role, code: makeJoinCode() + makeJoinCode() },
  });
  return NextResponse.json({ code: invite.code, role }, { status: 201 });
}
