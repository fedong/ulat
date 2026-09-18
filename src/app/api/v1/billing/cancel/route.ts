import { NextRequest, NextResponse } from "next/server";
import { badRequest, requireUser, unauthorized } from "@/server/auth";
import { prisma } from "@/server/db";
import { entitlementOf } from "@/server/entitlement";

/** Cancel at period end, or resume renewal. Pro stays active until `until`. */
export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return unauthorized();
  if (user.role !== "INSTRUCTOR")
    return NextResponse.json({ error: "wrong_role" }, { status: 403 });

  const b = await req.json().catch(() => null);
  const resume = b?.resume === true;
  if (resume && user.entMethod === "GCash")
    return badRequest("GCash renews manually — we'll remind you before your plan ends");

  const fresh = await prisma.user.update({
    where: { id: user.id },
    data: { entAutoRenew: resume },
  });
  return NextResponse.json({ ok: true, entitlement: entitlementOf(fresh) });
}
