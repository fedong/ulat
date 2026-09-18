import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { authPayload, verifyPassword } from "@/server/auth";
import { entitlementOf } from "@/server/entitlement";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");
  const user = await prisma.user.findUnique({ where: { email } });
  // One generic message: never confirm whether the email exists.
  if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash)))
    return NextResponse.json(
      { error: "invalid_credentials", message: "Incorrect email or password." },
      { status: 401 },
    );
  return NextResponse.json({
    ...(await authPayload(user)),
    entitlement: entitlementOf(user),
  });
}
