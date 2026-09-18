import { NextRequest, NextResponse } from "next/server";
import { revokeRefreshToken } from "@/server/auth";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const token = String(body?.refresh || "");
  if (token) await revokeRefreshToken(token);
  return NextResponse.json({ ok: true });
}
