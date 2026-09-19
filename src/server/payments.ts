import { createHmac, randomBytes } from "crypto";
import type { Payment, User } from "@prisma/client";
import { prisma } from "./db";

/**
 * Payments per the v3.1 spec: Pro ₱1,199/year or ₱199/month via PayMongo
 * (Card / Maya / GCash — GCash is annual-only and never auto-renews), with
 * ₱199 referral credit applied to future billing.
 *
 * Provider abstraction: with PAYMONGO_SECRET_KEY set, checkouts go to the
 * real PayMongo Checkout Session API and are fulfilled by its webhook.
 * Without keys (dev/CI), the built-in "mock" provider runs the exact same
 * pending-payment → fulfillment path through /v1/billing/mock-pay.
 */

export const PRICES = { Monthly: 19900, Annual: 119900 } as const;
export const REFERRAL_CREDIT_CENTS = 19900;
export type Cycle = keyof typeof PRICES;

const PAYMONGO_KEY = () => process.env.PAYMONGO_SECRET_KEY || "";
export const provider = () => (PAYMONGO_KEY() ? "paymongo" : "mock");

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/**
 * ULAT-<year>-<seq>, assigned when the payment row is created. Derived from
 * the highest existing number, never from a count: deleting a payment row
 * (e.g. an account deletion cascade) must not make the sequence re-issue a
 * taken number, which would fail the unique constraint on every checkout.
 * Zero-padded numbers keep string DESC ordering correct up to 9999/year.
 */
async function nextInvoiceNo() {
  const year = new Date().getFullYear();
  const last = await prisma.payment.findFirst({
    where: { no: { startsWith: `ULAT-${year}-` } },
    orderBy: { no: "desc" },
    select: { no: true },
  });
  const n = last ? Number(last.no.slice(`ULAT-${year}-`.length)) || 0 : 0;
  return `ULAT-${year}-${String(n + 1).padStart(4, "0")}`;
}

export function validateCheckout(cycle: string, method: string): string | null {
  if (cycle !== "Monthly" && cycle !== "Annual") return "cycle must be Monthly or Annual";
  if (!["Card", "Maya", "GCash"].includes(method)) return "method must be Card, Maya or GCash";
  if (method === "GCash" && cycle !== "Annual") return "GCash is available on the yearly plan only";
  return null;
}

/** Create the pending payment row + provider checkout. */
export async function createCheckout(user: User, cycle: Cycle, method: string) {
  const gross = PRICES[cycle];
  const credit = Math.min(user.creditCents, gross);
  const net = gross - credit;

  // Two concurrent checkouts can race to the same invoice number; the unique
  // constraint catches it and a fresh number is drawn.
  let payment: Payment | null = null;
  for (let attempt = 0; !payment; attempt++) {
    try {
      payment = await prisma.payment.create({
        data: {
          userId: user.id,
          no: await nextInvoiceNo(),
          provider: net === 0 ? "credit" : provider(),
          providerRef: "ref_" + randomBytes(12).toString("hex"),
          method,
          cycle,
          grossCents: gross,
          creditCents: credit,
          netCents: net,
          desc: `Pro · ${cycle === "Annual" ? "Yearly" : "Monthly"} · ${method}`,
        },
      });
    } catch (e) {
      const dup = (e as { code?: string })?.code === "P2002";
      if (!dup || attempt >= 3) throw e;
    }
  }

  // Fully covered by referral credit: no provider round-trip needed.
  if (net === 0) {
    await fulfillPayment(payment.providerRef!);
    return { paymentId: payment.id, ref: payment.providerRef!, provider: "credit", url: null, netCents: 0 };
  }

  if (provider() === "paymongo") {
    const res = await fetch("https://api.paymongo.com/v1/checkout_sessions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Basic " + Buffer.from(PAYMONGO_KEY() + ":").toString("base64"),
      },
      body: JSON.stringify({
        data: {
          attributes: {
            line_items: [
              { name: `Ulat Pro · ${cycle === "Annual" ? "Yearly" : "Monthly"}`, amount: net, currency: "PHP", quantity: 1 },
            ],
            payment_method_types: [method === "Card" ? "card" : method === "Maya" ? "paymaya" : "gcash"],
            reference_number: payment.providerRef,
            success_url: `${appUrl()}/?paid=${payment.providerRef}`,
            cancel_url: `${appUrl()}/`,
            description: payment.desc,
          },
        },
      }),
    });
    const body = (await res.json().catch(() => null)) as {
      data?: { id: string; attributes?: { checkout_url?: string } };
    } | null;
    if (!res.ok || !body?.data?.attributes?.checkout_url) {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: "failed" } });
      throw new Error("PayMongo checkout could not be created");
    }
    // The session id is what the webhook hands back.
    await prisma.payment.update({
      where: { id: payment.id },
      data: { providerRef: body.data.id },
    });
    return {
      paymentId: payment.id,
      ref: body.data.id,
      provider: "paymongo",
      url: body.data.attributes.checkout_url,
      netCents: net,
    };
  }

  return { paymentId: payment.id, ref: payment.providerRef!, provider: "mock", url: null, netCents: net };
}

/** Add one billing cycle on top of any remaining Pro time. */
const extendUntil = (current: Date | null, cycle: Cycle) => {
  const base = current && current.getTime() > Date.now() ? new Date(current) : new Date();
  if (cycle === "Annual") base.setFullYear(base.getFullYear() + 1);
  else base.setMonth(base.getMonth() + 1);
  return base;
};

/**
 * Idempotent fulfillment — the one path for webhook, mock-pay and credit:
 * marks the invoice paid, extends the entitlement, consumes credit, and
 * awards the referrer on the first paid annual invoice.
 */
export async function fulfillPayment(providerRef: string): Promise<Payment | null> {
  const payment = await prisma.payment.findUnique({
    where: { providerRef },
    include: { user: true },
  });
  if (!payment) return null;
  if (payment.status === "paid") return payment;

  const until = extendUntil(
    payment.user.entState === "ACTIVE" ? payment.user.entUntil : null,
    payment.cycle as Cycle,
  );
  const firstPaid = !(await prisma.payment.findFirst({
    where: { userId: payment.userId, status: "paid" },
  }));

  const [paid] = await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: { status: "paid", paidAt: new Date(), periodEnd: until },
    }),
    prisma.user.update({
      where: { id: payment.userId },
      data: {
        entState: "ACTIVE",
        entUntil: until,
        entMethod: payment.method,
        entCycle: payment.cycle,
        // GCash can't renew automatically; we remind before the plan ends.
        entAutoRenew: payment.method !== "GCash",
        creditCents: { decrement: payment.creditCents },
      },
    }),
    // Referral award: first paid annual bill earns the referrer ₱199.
    // (Spec releases it 14 days later with the refund window; that delay
    // lands with the notifications/job runner.)
    ...(payment.user.referredById && payment.cycle === "Annual" && firstPaid
      ? [
          prisma.user.update({
            where: { id: payment.user.referredById },
            data: { creditCents: { increment: REFERRAL_CREDIT_CENTS } },
          }),
        ]
      : []),
  ]);
  return paid;
}

/** Verify a PayMongo webhook signature (Paymongo-Signature: t=…,te=…,li=…). */
export function verifyPaymongoSignature(payload: string, header: string | null): boolean {
  const secret = process.env.PAYMONGO_WEBHOOK_SECRET || "";
  if (!secret || !header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((p) => p.split("=", 2) as [string, string]),
  );
  const sig = process.env.NODE_ENV === "production" ? parts.li : parts.te || parts.li;
  if (!parts.t || !sig) return false;
  const expect = createHmac("sha256", secret).update(`${parts.t}.${payload}`).digest("hex");
  return sig === expect;
}

/** Instructors get a shareable referral code lazily. */
export async function ensureReferralCode(user: User): Promise<string> {
  if (user.referralCode) return user.referralCode;
  for (;;) {
    const code = "UL" + randomBytes(4).toString("hex").toUpperCase();
    try {
      await prisma.user.update({ where: { id: user.id }, data: { referralCode: code } });
      return code;
    } catch {
      /* unique collision — roll again */
    }
  }
}
