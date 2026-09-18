import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { authPayload, badRequest, hashPassword } from "@/server/auth";
import { entitlementOf } from "@/server/entitlement";

/** Instructor sign-up. New accounts start the 5-month Pro trial. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");
  if (!email.includes("@")) return badRequest("valid email required");
  if (password.length < 8) return badRequest("password must be at least 8 characters");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return badRequest("an account with this email already exists");

  const trialEnds = new Date(Date.now() + 150 * 864e5); // 5 months
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(password),
      role: "INSTRUCTOR",
      entState: "TRIALING",
      entUntil: trialEnds,
      profile: {
        title: String(body?.title || ""),
        first: String(body?.first || ""),
        last: String(body?.last || ""),
        suffix: "",
        nameStyle: "short",
        lang: "English",
      },
    },
  });
  return NextResponse.json(
    { ...(await authPayload(user)), entitlement: entitlementOf(user) },
    { status: 201 },
  );
}
