import { NextRequest, NextResponse } from "next/server";
import { publicUser, requireUser, unauthorized } from "@/server/auth";
import { demoteIfLapsed, entitlementOf } from "@/server/entitlement";
import { prisma } from "@/server/db";

/** Profile + entitlement (payments spec §/v1/auth/me). */
export async function GET(req: NextRequest) {
  let user = await requireUser(req);
  if (!user) return unauthorized();
  // Lapsed trials/subscriptions converge to FREE on read.
  user = await demoteIfLapsed(user);
  return NextResponse.json({ user: publicUser(user), entitlement: entitlementOf(user) });
}

/** Update profile (Profile settings on web, language on mobile). */
export async function PATCH(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return unauthorized();
  const body = await req.json().catch(() => null);
  if (!body || typeof body.profile !== "object")
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { profile: { ...(user.profile as object), ...body.profile } },
  });
  return NextResponse.json({ user: publicUser(updated), entitlement: entitlementOf(updated) });
}
