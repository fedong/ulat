import { NextRequest, NextResponse } from "next/server";
import { badRequest, requireUser, unauthorized } from "@/server/auth";
import { createCheckout, validateCheckout, type Cycle } from "@/server/payments";

/** Start a Pro checkout; returns the provider hand-off (or instant credit). */
export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return unauthorized();
  if (user.role !== "INSTRUCTOR")
    return NextResponse.json({ error: "wrong_role" }, { status: 403 });

  const b = await req.json().catch(() => null);
  const cycle = String(b?.cycle || "");
  const method = String(b?.method || "");
  const invalid = validateCheckout(cycle, method);
  if (invalid) return badRequest(invalid);

  try {
    const out = await createCheckout(user, cycle as Cycle, method);
    return NextResponse.json(out, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "checkout_failed", message: "The payment provider could not be reached." },
      { status: 502 },
    );
  }
}
