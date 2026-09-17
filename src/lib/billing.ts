"use client";

import type { Klass } from "./types";

/**
 * Payments & entitlement (design handoff v3.1). Entitlement is READ, never
 * computed, on the client: this module stands in for `/v1/auth/me` →
 * { tier, state, until, method, plan, autoRenew }. Seed dates follow the
 * prototype; `sub` is the local post-checkout override.
 */

export type EntState = "Trialing" | "Active" | "Past due" | "Grace" | "Free";
export type PayMethod = "Card" | "Maya" | "GCash";
export type PlanCycle = "Monthly" | "Annual";

export interface Entitlement {
  tier: "PRO" | "FREE";
  state: EntState;
  until: Date | null;
  method?: PayMethod;
  plan?: PlanCycle;
  autoRenew: boolean;
}

export interface Sub {
  plan: PlanCycle;
  method: PayMethod;
  until: string;
}

export interface Invoice {
  no: string;
  date: string;
  desc: string;
  net: string;
  status: string;
  color: string;
}

export const fmtLong = (d: Date) =>
  d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
export const fmtDM = (d: Date) =>
  d.toLocaleDateString("en-GB", { day: "numeric", month: "long" });
export const daysLeft = (d: Date) =>
  Math.max(0, Math.ceil((d.getTime() - Date.now()) / 864e5));
export const peso = (centavos: number) =>
  "₱" + (centavos / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 });

export function getEntitlement(
  demoState: EntState,
  demoMethod: PayMethod,
  sub: Sub | null,
  subCancel: boolean,
): Entitlement {
  const base: Omit<Entitlement, "autoRenew"> = sub
    ? { tier: "PRO", state: "Active", until: new Date(sub.until), method: sub.method, plan: sub.plan }
    : demoState === "Trialing"
      ? { tier: "PRO", state: "Trialing", until: new Date(2027, 1, 14) }
      : demoState === "Active"
        ? { tier: "PRO", state: "Active", until: new Date(2027, 8, 3), method: demoMethod, plan: "Annual" }
        : demoState === "Past due"
          ? { tier: "PRO", state: "Past due", until: new Date(2026, 9, 2), method: demoMethod === "GCash" ? "Card" : demoMethod, plan: "Monthly" }
          : demoState === "Grace"
            ? { tier: "PRO", state: "Grace", until: new Date(2026, 11, 12) }
            : { tier: "FREE", state: "Free", until: null };
  return { ...base, autoRenew: !!base.method && base.method !== "GCash" && !subCancel };
}

/** Number of grades recorded in a class — stand-in for latest gradedAt ordering. */
export const gradedN = (c: Klass) =>
  Object.values(c.scores || {}).reduce((n, m) => n + Object.keys(m || {}).length, 0);

/** Read-only class ids for a FREE account over the 2-class limit. */
export function readOnlyIds(
  ent: Entitlement,
  classes: Klass[],
  editableIds: string[] | null,
): Set<string> {
  const activeCls = classes.filter((c) => !c.archived);
  if (ent.tier !== "FREE" || activeCls.length <= 2) return new Set();
  const defaultKeep = [...activeCls].sort((a, b) => gradedN(b) - gradedN(a)).slice(0, 2).map((c) => c.id);
  const keep = editableIds && editableIds.length ? editableIds : defaultKeep;
  return new Set(activeCls.filter((c) => !keep.includes(c.id)).map((c) => c.id));
}

export const defaultKeepIds = (classes: Klass[]) =>
  [...classes.filter((c) => !c.archived)]
    .sort((a, b) => gradedN(b) - gradedN(a))
    .slice(0, 2)
    .map((c) => c.id);

/** L(en, fil) — all v3.1 copy is bilingual; §12 strings verbatim. */
export const mkL = (fil: boolean) => (en: string, fi: string) => (fil ? fi : en);

export function billingStrings(fil: boolean) {
  const L = mkL(fil);
  return {
    billing: L("Plan & billing", "Plano at bayad"),
    checkout: L("CHECKOUT", "CHECKOUT"),
    summary: L("SUMMARY", "BUOD"),
    plansTitle: L("Simple pricing for every teaching load", "Simpleng presyo para sa bawat teaching load"),
    plansSub: L(
      "Start on Pro for 5 months, free. Keep it for ₱1,199 a year, or stay on Free with 2 active classes.",
      "Simulan sa Pro nang 5 buwan, libre. Panatilihin sa ₱1,199 kada taon, o manatili sa Libre na may 2 aktibong klase.",
    ),
    yourPlan: L("Your plan", "Plano mo"),
    save2Months: L("2 months free", "2 buwang libre"),
    freeAfter: L("Included after your trial", "Kasama pagkatapos ng trial"),
    freeFoot: L("No card needed", "Hindi kailangan ng card"),
    invoicesSub: L("Receipts for every payment, ready for your accountant.", "Resibo ng bawat bayad, handa para sa accountant mo."),
    referNudgeTitle: L("Know an instructor who would like Ulat?", "May kakilalang guro na magugustuhan ang Ulat?"),
    referNudgeBody: L(
      "Share your link. When they pay for a year, you get ₱199 off your next bill.",
      "Ibahagi ang link mo. Kapag nagbayad sila ng isang taon, ₱199 ang bawas sa susunod mong bayad.",
    ),
    referNudgeCta: L("Refer a colleague", "Mag-refer"),
    referFine: L(
      "One award per referred person. Credit applies to future billing only, is never cashed out and never expires. Self-referrals and matching payment methods are not eligible.",
      "Isang award kada na-refer. Para lang sa susunod na bayad ang credit, hindi maaaring i-cash out at hindi nag-e-expire. Hindi kwalipikado ang self-referral at magkaparehong paraan ng bayad.",
    ),
    billingSub: L(
      "Your plan, payment method, invoices and referral credit. Changes apply to every class you teach.",
      "Plano, paraan ng bayad, invoice at referral credit. Umaaplay sa lahat ng klase mo.",
    ),
    cancel: L("Cancel", "Kanselahin"),
    payWith: L("PAY WITH", "MAGBAYAD GAMIT"),
    referralCredit: L("Referral credit", "Referral credit"),
    dueToday: L("Due today", "Babayaran ngayon"),
    refundPolicy: L("First yearly payment refundable within 14 days.", "Ang unang taunang bayad ay maaaring i-refund sa loob ng 14 araw."),
    redirecting: L("Taking you to PayMongo to authorize the payment…", "Dinadala ka sa PayMongo para aprubahan ang bayad…"),
    paymentReceived: L("Payment received", "Natanggap ang bayad"),
    backToPlan: L("Back to plan", "Balik sa plano"),
    gcashNotice: L(
      "GCash can't renew automatically. We'll remind you before your plan ends.",
      "Hindi awtomatikong nare-renew ang GCash. Paaalalahanan ka namin bago matapos ang plano mo.",
    ),
    remindersOn: L("Reminders on", "Paalala sa"),
    currentPlan: L("Current plan", "Kasalukuyang plano"),
    cancelAtEnd: L("Cancel at period end", "Kanselahin sa dulo ng period"),
    resume: L("Resume renewal", "Ituloy ang renewal"),
    invoices: L("Invoices", "Mga invoice"),
    noInvoices: L("No invoices yet. Your first one appears here after payment.", "Wala pang invoice. Lalabas dito ang una pagkabayad."),
    referrals: L("Refer a colleague", "Mag-refer ng kasamahan"),
    referralRule: L(
      "When someone you refer pays for a year, you get ₱199 credit toward your next bill 14 days later. Credit never expires and is never cashed out.",
      "Kapag nagbayad ng isang taon ang na-refer mo, makakakuha ka ng ₱199 credit para sa susunod mong bayad pagkalipas ng 14 araw. Hindi nag-e-expire ang credit at hindi maaaring i-cash out.",
    ),
    yourLink: L("YOUR LINK", "LINK MO"),
    creditBalance: L("Credit available", "Available na credit"),
    free: L("Free", "Libre"),
    year: L("year", "taon"),
    perMonthBilledYearly: L("₱100/month, billed yearly", "₱100 kada buwan, bayad taunan"),
    freeFor: L("For instructors trying Ulat, or teaching a light load.", "Para sa mga gurong sumusubok sa Ulat, o may magaan na load."),
    proFor: L("For instructors carrying a full teaching load.", "Para sa mga gurong may buong teaching load."),
    everythingInFree: L("Everything in Free, plus:", "Lahat ng nasa Libre, kasama ang:"),
    selTitle: L("Choose 2 classes to keep editable", "Pumili ng 2 klaseng mananatiling editable"),
    selBody: L(
      "Your Pro access has ended and you have more than 2 active classes. The others become read-only: you can still view and export them, students keep their standing, and guardian digests continue. Nothing is deleted. You can change this choice any time.",
      "Tapos na ang Pro access mo at higit sa 2 ang aktibong klase mo. Magiging read-only ang iba: puwede pa ring tingnan at i-export, makikita pa rin ng mga estudyante ang standing nila, at tuloy ang guardian digest. Walang mabubura. Puwede mong baguhin ito anumang oras.",
    ),
    selNote: L("most recently graded pre-selected", "pinakabagong na-grade ang napili"),
    seePlans: L("See plans", "Tingnan ang mga plano"),
    selSave: L("Keep these 2 editable", "Panatilihing editable ang 2 ito"),
  };
}

export function freeFeatures(fil: boolean): string[] {
  const L = mkL(fil);
  return [
    L("2 active classes per term", "2 aktibong klase kada term"),
    L("Unlimited students per class", "Walang limitasyong estudyante kada klase"),
    L("Full gradebook — components, weights, transmutation, locked Finals", "Buong gradebook — components, weights, transmutation, locked Finals"),
    L("Attendance with Lecture/Lab sync", "Attendance na naka-sync sa Lecture/Lab"),
    L("Guardian links, weekly digest, student app", "Guardian links, lingguhang digest, student app"),
    L("Roster import (CSV, XLSX, TXT, PDF)", "Roster import (CSV, XLSX, TXT, PDF)"),
    L("PDF grade report (with Ulat footer)", "PDF grade report (may Ulat footer)"),
    L("Basic XLSX export", "Basic XLSX export"),
    L("Unlimited archived terms", "Walang limitasyong archived term"),
  ];
}

export function proFeatures(fil: boolean): { text: string; weight: number }[] {
  const L = mkL(fil);
  return (
    [
      [L("Unlimited active classes", "Walang limitasyong klase"), 700],
      [L("Registrar-format XLSX export with scope selection", "Registrar-format XLSX export na may scope selection"), 700],
      [L("PDF grade report with your institution's letterhead and signature block — no Ulat mark", "PDF grade report na may letterhead at signature block ng institusyon mo — walang Ulat mark"), 700],
      [L("Co-instructors", "Mga co-instructor"), 700],
      [L("Full term history", "Buong term history"), 700],
      [L("Priority support", "Priority support"), 500],
    ] as [string, number][]
  ).map(([text, weight]) => ({ text, weight }));
}
