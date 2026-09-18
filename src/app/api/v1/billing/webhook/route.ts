import { NextRequest, NextResponse } from "next/server";
import { fulfillPayment, verifyPaymongoSignature } from "@/server/payments";

/**
 * PayMongo webhook (live keys only): checkout_session.payment.paid settles
 * the pending payment. Idempotent — retries and duplicates are no-ops.
 */
export async function POST(req: NextRequest) {
  const payload = await req.text();
  if (!verifyPaymongoSignature(payload, req.headers.get("paymongo-signature")))
    return NextResponse.json({ error: "bad_signature" }, { status: 401 });

  let event: {
    data?: { attributes?: { type?: string; data?: { id?: string } } };
  } | null = null;
  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "bad_payload" }, { status: 400 });
  }

  const type = event?.data?.attributes?.type;
  const sessionId = event?.data?.attributes?.data?.id;
  if (type === "checkout_session.payment.paid" && sessionId) await fulfillPayment(sessionId);
  // Unknown event types are acknowledged so PayMongo stops retrying.
  return NextResponse.json({ ok: true });
}
