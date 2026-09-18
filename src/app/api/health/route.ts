import { NextResponse } from "next/server";
import { prisma } from "@/server/db";

/** Liveness + database check for Docker/Coolify health probes and UptimeRobot. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: "up" });
  } catch {
    return NextResponse.json({ ok: false, db: "down" }, { status: 503 });
  }
}
