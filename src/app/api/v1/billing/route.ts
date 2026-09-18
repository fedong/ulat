import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthorized } from "@/server/auth";
import { prisma } from "@/server/db";
import { entitlementOf } from "@/server/entitlement";
import { ensureReferralCode } from "@/server/payments";

/** Plan & billing state: entitlement, credit, referral code, invoices. */
export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return unauthorized();
  if (user.role !== "INSTRUCTOR")
    return NextResponse.json({ error: "wrong_role" }, { status: 403 });

  const [referralCode, referredCount, payments] = await Promise.all([
    ensureReferralCode(user),
    prisma.user.count({ where: { referredById: user.id } }),
    prisma.payment.findMany({
      where: { userId: user.id, status: { in: ["paid", "pending"] } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return NextResponse.json({
    entitlement: entitlementOf(user),
    creditCents: user.creditCents,
    referralCode,
    referredCount,
    invoices: payments.map((p) => ({
      id: p.id,
      no: p.no,
      date: (p.paidAt ?? p.createdAt).toISOString().slice(0, 10),
      desc: p.desc,
      grossCents: p.grossCents,
      creditCents: p.creditCents,
      netCents: p.netCents,
      status: p.status,
    })),
  });
}
