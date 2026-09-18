import { NextRequest, NextResponse } from "next/server";
import { badRequest, requireUser, unauthorized } from "@/server/auth";
import { prisma } from "@/server/db";
import { entitlementOf } from "@/server/entitlement";
import { fulfillPayment, provider } from "@/server/payments";

/**
 * Sandbox settlement: with no PayMongo keys configured, this plays the role
 * of the provider webhook for the caller's own pending payment. Disabled
 * entirely once live keys exist.
 */
export async function POST(req: NextRequest) {
  if (provider() !== "mock")
    return NextResponse.json({ error: "not_available" }, { status: 404 });
  const user = await requireUser(req);
  if (!user) return unauthorized();

  const b = await req.json().catch(() => null);
  const ref = String(b?.ref || "");
  const payment = await prisma.payment.findUnique({ where: { providerRef: ref } });
  if (!payment || payment.userId !== user.id) return badRequest("unknown payment");

  await fulfillPayment(ref);
  const fresh = await prisma.user.findUnique({ where: { id: user.id } });
  return NextResponse.json({ ok: true, entitlement: entitlementOf(fresh!) });
}
