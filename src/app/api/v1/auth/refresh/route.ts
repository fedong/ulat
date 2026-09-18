import { NextRequest, NextResponse } from "next/server";
import { rotateRefreshToken, unauthorized, publicUser } from "@/server/auth";
import { entitlementOf } from "@/server/entitlement";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const token = String(body?.refresh || "");
  if (!token) return unauthorized();
  const rotated = await rotateRefreshToken(token);
  if (!rotated) return unauthorized();
  return NextResponse.json({
    access: rotated.access,
    refresh: rotated.refresh,
    user: publicUser(rotated.user),
    entitlement: entitlementOf(rotated.user),
  });
}
