"use client";

import { useRouter } from "next/navigation";
import { use } from "react";
import {
  billingStrings,
  daysLeft,
  fmtDM,
  fmtLong,
  freeFeatures,
  peso,
  proFeatures,
  type PayMethod,
  type PlanCycle,
} from "@/lib/billing";
import { setRenewal, startProCheckout, type CheckoutStart } from "@/lib/api";
import { useBillingData, useEntitlement } from "@/lib/hooks";
import { refreshBilling } from "@/lib/session";
import { useUlat, type CheckoutState } from "@/lib/store";

export default function BillingPage({ params }: { params: Promise<{ clsId: string }> }) {
  const { clsId } = use(params);
  const router = useRouter();
  const st = useUlat();
  const { ent, activeN, L, fil } = useEntitlement();
  const t = billingStrings(fil);
  const billing = useBillingData();
  const renewCancelled = ent.state === "Active" && !ent.autoRenew && ent.method !== "GCash";

  const untilTxt = ent.until ? fmtLong(ent.until) : "";
  const dl = ent.until ? daysLeft(ent.until) : 0;
  const hasBanner = ["Trialing", "Grace", "Past due"].includes(ent.state);
  const planDot =
    ent.state === "Past due" ? "#D14B33" : ent.state === "Grace" ? "#F5B70A" : ent.tier === "PRO" ? "#0FA3A0" : "#7B8792";
  const [chipBg, chipColor] =
    ent.state === "Past due" ? ["#FBE9E5", "#B03A24"]
    : ent.state === "Grace" ? ["#FFF6DC", "#8A6400"]
    : ent.tier === "PRO" ? ["rgba(15,163,160,0.12)", "#0B807E"]
    : ["#F1EDE5", "#5A6672"];
  const stateShort =
    ent.state === "Trialing" ? "Trial"
    : ent.state === "Active" ? L("Active", "Aktibo")
    : ent.state === "Past due" ? L("Past due", "Lampas sa bayad")
    : ent.state === "Grace" ? L("Grace period", "Palugit")
    : L("Current", "Kasalukuyan");
  const billLead =
    ent.state === "Trialing" ? L("Full Pro access, free until " + untilTxt + ".", "Buong Pro access, libre hanggang " + untilTxt + ".")
    : ent.state === "Active"
      ? renewCancelled
        ? L("Renewal cancelled. Pro stays on until " + untilTxt + ".", "Kanselado ang renewal. Tuloy ang Pro hanggang " + untilTxt + ".")
        : ent.autoRenew
          ? L("Renews automatically on " + untilTxt + ".", "Awtomatikong mare-renew sa " + untilTxt + ".")
          : L("Ends " + untilTxt + " unless renewed.", "Matatapos sa " + untilTxt + " kung hindi i-renew.")
    : ent.state === "Past due" ? L("Payment failed. Access continues while we retry until " + untilTxt + ".", "Hindi nabayaran. Tuloy ang access habang sinusubukan ulit hanggang " + untilTxt + ".")
    : ent.state === "Grace" ? L("Trial ended. Full access until your term finishes on " + untilTxt + ".", "Tapos ang trial. Buong access hanggang matapos ang term sa " + untilTxt + ".")
    : L("2 active classes per term. Everything you record stays.", "2 aktibong klase kada term. Mananatili ang lahat ng naitala mo.");

  const billRows = (
    [
      ent.state === "Trialing" ? [L("Days left", "Araw pa"), String(dl)] : null,
      ent.plan
        ? [L("Plan", "Plano"), ent.plan === "Annual" ? L("Yearly · ₱1,199/year", "Taunan · ₱1,199 kada taon") : L("Monthly · ₱199/month", "Buwanan · ₱199 kada buwan")]
        : null,
      ent.method
        ? [L("Payment method", "Paraan ng bayad"), ent.method + (ent.method === "GCash" ? L(" · manual renewal", " · manu-manong renewal") : L(" · automatic", " · awtomatiko"))]
        : null,
      ent.until
        ? [
            ent.state === "Active" ? (ent.autoRenew ? L("Next charge", "Susunod na bayad") : L("Ends", "Matatapos"))
            : ent.state === "Trialing" ? L("Trial ends", "Tapos ng trial")
            : ent.state === "Grace" ? L("Access until", "Access hanggang")
            : L("Retrying until", "Susubukan hanggang"),
            untilTxt,
          ]
        : null,
      ent.tier === "FREE" ? [L("Active classes", "Aktibong klase"), activeN + " / 2"] : null,
    ] as ([string, string] | null)[]
  ).filter((x): x is [string, string] => x !== null);

  const cancelPlan = () =>
    st.confirm({
      title: L("Cancel at period end?", "Kanselahin sa dulo ng period?"),
      body: L(
        "Pro stays on until " + untilTxt + ". After that, classes beyond 2 become read-only. Nothing is deleted.",
        "Tuloy ang Pro hanggang " + untilTxt + ". Pagkatapos, magiging read-only ang klase lampas sa 2. Walang mabubura.",
      ),
      confirmLabel: L("Cancel plan", "Kanselahin"),
      danger: true,
      onConfirm: () => {
        void setRenewal(false)
          .then(() => refreshBilling())
          .catch(() => {});
      },
    });

  const showPlans = ent.state !== "Active" || st.showPlans;
  const proCta =
    ent.state === "Free" ? L("Upgrade to Pro", "Mag-upgrade sa Pro")
    : ent.state === "Past due" ? L("Update payment method", "I-update ang bayad")
    : ent.state === "Active" ? L("Switch to yearly", "Lumipat sa taunan")
    : L("Continue on Pro", "Magpatuloy sa Pro");
  const cycle = st.cycle;
  const proPrice = cycle === "Annual" ? "₱1,199" : "₱199";
  const proPer = cycle === "Annual" ? L("year", "taon") : L("month", "buwan");
  const proPriceNote = cycle === "Annual" ? t.perMonthBilledYearly : L("₱2,388/year billed monthly", "₱2,388 kada taon, buwanang bayad");
  const proMethodNote =
    cycle === "Annual" ? "Card · Maya · GCash" : L("Card · Maya. GCash is available on the yearly plan.", "Card · Maya. Available ang GCash sa taunang plano.");

  const startCheckout = (plan: PlanCycle) =>
    st.set({
      checkout: {
        plan,
        method: plan === "Monthly" && ent.method === "GCash" ? "Card" : ent.method || "Card",
        step: "method",
      },
    });

  /* ---- checkout (live: /v1/billing) ---- */
  const co = st.checkout;
  const creditAvail = billing?.creditCents ?? 0;
  let checkoutCard: React.ReactNode = null;
  if (co) {
    const gross = co.plan === "Annual" ? 119900 : 19900;
    const credit = Math.min(creditAvail, gross);
    const net = gross - credit;
    const coPlanLabel = co.plan === "Annual" ? L("Pro · Yearly", "Pro · Taunan") : L("Pro · Monthly", "Pro · Buwanan");
    // Settle a started checkout: live keys → PayMongo redirect; the sandbox
    // provider settles in place through the same pending-payment path.
    const settle = async (start: CheckoutStart) => {
      if (start.provider === "paymongo" && start.url) {
        window.location.href = start.url;
        return;
      }
      if (start.provider === "mock") {
        const { settleMockPayment } = await import("@/lib/api");
        await settleMockPayment(start.ref);
      }
      const fresh = await refreshBilling();
      const s = useUlat.getState();
      if (!s.checkout) return;
      s.set({
        checkout: {
          ...s.checkout,
          step: "done",
          until: fresh.entitlement.until ? fresh.entitlement.until + "T00:00:00" : undefined,
        } as CheckoutState,
        selDone: false,
        editableIds: null,
        pickIds: null,
      });
    };
    const coGo = () => {
      st.set({ checkout: { ...co, step: "redirect" } });
      void (async () => {
        try {
          const start = await startProCheckout(co.plan, co.method);
          // Keep the hand-off beat visible before settling the sandbox.
          await new Promise((r) => setTimeout(r, start.netCents === 0 ? 400 : 1200));
          if (!useUlat.getState().checkout) return; // cancelled meanwhile
          await settle(start);
        } catch {
          st.set({ checkout: { ...co, step: "method" } });
          st.confirm({
            title: L("Payment didn't start", "Hindi nagsimula ang bayad"),
            body: L(
              "The payment provider could not be reached. Check your connection and try again.",
              "Hindi maabot ang payment provider. Suriin ang koneksyon at subukan muli.",
            ),
            confirmLabel: "OK",
            onConfirm: () => {},
          });
        }
      })();
    };
    const methods = (["Card", "Maya", "GCash"] as PayMethod[]).map((m) => {
      const dis = m === "GCash" && co.plan === "Monthly";
      const on = co.method === m;
      return {
        m,
        dis,
        on,
        note: dis
          ? L("Yearly plan only", "Taunang plano lang")
          : m === "GCash"
            ? L("Renews manually each year", "Manu-manong renewal kada taon")
            : L("Renews automatically", "Awtomatikong renewal"),
      };
    });
    checkoutCard = (
      <div
        className="mx-auto w-full flex max-w-[1000px] flex-col gap-[18px] rounded-2xl px-6 py-[22px]"
        style={{
          background: "linear-gradient(180deg,#FFFFFF 0%,#FDFCFA 100%)",
          border: "1.5px solid #0FA3A0",
          boxShadow: "0 1px 2px rgba(34,48,60,0.04), 0 12px 32px -14px rgba(15,163,160,0.45)",
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="label-caps text-sub">{t.checkout}</div>
            <div className="mt-0.5 font-display text-xl font-extrabold">{coPlanLabel}</div>
          </div>
          <button
            onClick={() => st.set({ checkout: null })}
            className="h-8 cursor-pointer rounded-[9px] border-[1.5px] border-line bg-white px-3 text-xs font-semibold text-sub"
          >
            {t.cancel}
          </button>
        </div>

        {co.step === "method" && (
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="flex flex-col gap-2">
              <div className="label-caps text-sub">{t.payWith}</div>
              <div className="grid grid-cols-3 gap-2">
                {methods.map(({ m, dis, on, note }) => (
                  <button
                    key={m}
                    onClick={() => !dis && st.set({ checkout: { ...co, method: m } })}
                    className="flex cursor-pointer flex-col gap-1.5 rounded-xl p-3.5 text-left text-ink"
                    style={{
                      border: `1.5px solid ${on ? "#0FA3A0" : "#E8E2D6"}`,
                      background: on ? "rgba(15,163,160,0.08)" : "#FFFFFF",
                      opacity: dis ? 0.5 : 1,
                    }}
                  >
                    <span className="flex items-center justify-between">
                      <span className="text-[15px] font-bold">{m}</span>
                      <span
                        className="h-4 w-4 flex-shrink-0 rounded-full"
                        style={{
                          border: `2px solid ${on ? "#0FA3A0" : "#E8E2D6"}`,
                          background: on ? "#0FA3A0" : "#FFFFFF",
                          boxShadow: "inset 0 0 0 3px #FFFFFF",
                        }}
                      />
                    </span>
                    <span className="text-xs leading-[1.4] text-sub">{note}</span>
                  </button>
                ))}
              </div>
              {co.method === "GCash" && (
                <div className="rounded-xl border border-[#F2DFA0] bg-[#FFF6DC] px-3 py-2.5 text-[13px] leading-[1.5] text-amber-text">
                  {t.gcashNotice}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2.5 rounded-[14px] border border-line bg-canvas p-[18px]">
              <div className="label-caps text-sub">{t.summary}</div>
              <div className="flex justify-between text-sm font-medium">
                <span>{coPlanLabel}</span>
                <b>{peso(gross)}</b>
              </div>
              {credit > 0 && (
                <div className="flex justify-between text-sm font-medium text-teal-text">
                  <span>{t.referralCredit}</span>
                  <b>−{peso(credit)}</b>
                </div>
              )}
              <div className="flex items-baseline justify-between border-t border-line pt-2.5 font-display text-xl font-extrabold">
                <span className="font-body text-sm font-semibold text-sub">{t.dueToday}</span>
                <span>{peso(net)}</span>
              </div>
              <button
                onClick={coGo}
                className="mt-1 h-[46px] cursor-pointer rounded-xl bg-teal text-sm font-bold text-white"
              >
                {net === 0
                  ? L("Activate with credit", "I-activate gamit ang credit")
                  : L("Continue to PayMongo · ", "Magpatuloy sa PayMongo · ") + peso(net)}
              </button>
              <div className="text-center text-xs leading-[1.5] text-faint">{t.refundPolicy}</div>
            </div>
          </div>
        )}

        {co.step === "redirect" && (
          <div className="flex items-center gap-3 py-5 text-sm font-medium text-sub">
            <span
              className="h-3 w-3 rounded-full bg-teal"
              style={{ animation: "ulatPulse 1.2s ease-out infinite" }}
            />
            {t.redirecting}
          </div>
        )}

        {co.step === "done" && (
          <div className="flex flex-col gap-3 py-1.5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-teal-tint-12 font-display text-xl font-extrabold text-teal-text">
                ✓
              </span>
              <div>
                <div className="font-display text-lg font-extrabold">{t.paymentReceived}</div>
                <div className="mt-0.5 text-sm text-sub">
                  {L("Pro is active until ", "Aktibo ang Pro hanggang ") +
                    (co.until ? fmtLong(new Date(co.until)) : "") +
                    L(". Your invoice is below.", ". Nasa ibaba ang invoice mo.")}
                </div>
              </div>
            </div>
            {co.method === "GCash" && (
              <div className="rounded-xl border border-[#F2DFA0] bg-[#FFF6DC] px-3 py-2.5 text-[13px] leading-[1.5] text-amber-text">
                {t.gcashNotice}
              </div>
            )}
            <div>
              <button
                onClick={() => st.set({ checkout: null })}
                className="h-10 cursor-pointer rounded-xl border-[1.5px] border-line bg-white px-4 text-[13px] font-bold text-ink"
              >
                {t.backToPlan}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="-mr-2 flex min-h-0 flex-1 flex-col gap-7 overflow-y-auto pr-2">
      {/* Plan strip (only when no banner) */}
      {!hasBanner && (
        <div className="mx-auto w-full flex max-w-[1000px] items-center justify-between gap-4 rounded-[14px] bg-white px-4 py-3" style={{ border: "1px solid rgba(34,48,60,0.06)" }}>
          <div className="flex min-w-0 items-center gap-3">
            <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: planDot }} />
            <span className="whitespace-nowrap text-sm font-bold">
              {ent.tier === "PRO" ? "Pro" : t.free}
            </span>
            <span
              className="whitespace-nowrap rounded-full px-[9px] py-[3px] text-[11px] font-bold"
              style={{ background: chipBg, color: chipColor }}
            >
              {stateShort}
            </span>
            <span className="truncate text-[13px] text-sub">{billLead}</span>
          </div>
          <div className="flex flex-shrink-0 items-center gap-5">
            {billRows.map(([k, v]) => (
              <span key={k} className="whitespace-nowrap text-[13px] font-medium text-sub">
                {k} <b className="font-semibold text-ink">{v}</b>
              </span>
            ))}
            {ent.state === "Active" && ent.autoRenew && (
              <button
                onClick={cancelPlan}
                className="h-8 cursor-pointer whitespace-nowrap rounded-[9px] border-[1.5px] border-line bg-white px-3 text-xs font-bold text-sub hover:!border-red hover:!text-red-text"
              >
                {t.cancelAtEnd}
              </button>
            )}
            {ent.state === "Active" && renewCancelled && (
              <button
                onClick={() =>
                  void setRenewal(true)
                    .then(() => refreshBilling())
                    .catch(() => {})
                }
                className="h-8 cursor-pointer whitespace-nowrap rounded-[9px] border-[1.5px] border-teal bg-white px-3 text-xs font-bold text-teal-text"
              >
                {t.resume}
              </button>
            )}
            {ent.state === "Active" && (
              <button
                onClick={() => st.set({ showPlans: !st.showPlans })}
                className="h-8 cursor-pointer whitespace-nowrap rounded-[9px] border-[1.5px] border-line bg-white px-3 text-xs font-bold text-ink hover:border-teal hover:text-teal-text"
              >
                {st.showPlans ? L("Hide plans", "Itago ang mga plano") : L("Change plan", "Baguhin ang plano")}
              </button>
            )}
          </div>
        </div>
      )}

      {ent.method === "GCash" && ent.state === "Active" && (
        <div className="mx-auto w-full max-w-[1000px] rounded-xl border border-[#F2DFA0] bg-[#FFF6DC] px-3 py-2.5 text-[13px] leading-[1.5] text-amber-text">
          {t.gcashNotice} {t.remindersOn}{" "}
          {ent.until && [14, 7, 1, 0].map((n) => fmtDM(new Date(ent.until!.getTime() - n * 864e5))).join(" · ")}.
        </div>
      )}

      {checkoutCard}

      {showPlans && (
        <div className="mx-auto w-full flex max-w-[1000px] flex-col gap-4">
          <div className="flex flex-col items-center gap-3.5 pb-0.5 pt-2 text-center">
            <div>
              <div className="font-display text-2xl font-extrabold tracking-[-0.5px]">{t.plansTitle}</div>
              <div className="mt-1 text-sm text-sub">{t.plansSub}</div>
            </div>
            <div className="inline-grid grid-cols-[auto_auto] gap-1 rounded-xl border border-line bg-white p-1">
              {(
                [
                  ["Monthly", L("Monthly", "Buwanan")],
                  ["Annual", L("Yearly", "Taunan")],
                ] as [PlanCycle, string][]
              ).map(([k, label]) => {
                const on = cycle === k;
                return (
                  <button
                    key={k}
                    onClick={() => st.set({ cycle: k })}
                    className="flex h-9 cursor-pointer items-center gap-2 whitespace-nowrap rounded-[9px] px-[18px] text-[13px] font-bold"
                    style={{ background: on ? "#0FA3A0" : "transparent", color: on ? "#FFFFFF" : "#5A6672" }}
                  >
                    {label}
                    {k === "Annual" && (
                      <span
                        className="rounded-full px-[7px] py-0.5 text-[10px] font-bold"
                        style={{
                          background: on ? "rgba(255,255,255,0.22)" : "rgba(15,163,160,0.12)",
                          color: on ? "#FFFFFF" : "#0B807E",
                        }}
                      >
                        {t.save2Months}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mx-auto grid w-full max-w-[860px] grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-stretch gap-5">
            {/* Free card */}
            <div className="flex flex-col rounded-2xl p-7" style={{ background: "linear-gradient(180deg,#FFFFFF 0%,#FDFCFA 100%)", border: "1px solid rgba(34,48,60,0.06)", boxShadow: "0 1px 2px rgba(34,48,60,0.04), 0 8px 24px -12px rgba(34,48,60,0.18)" }}>
              <div className="flex h-6 items-center justify-between">
                <div className="font-display text-xl font-extrabold">{t.free}</div>
                {ent.tier === "FREE" && (
                  <span className="rounded-full bg-hairline px-2.5 py-1 text-[11px] font-bold text-sub">{t.yourPlan}</span>
                )}
              </div>
              <div className="mt-[18px] flex h-11 items-baseline gap-1.5">
                <span className="font-display text-[40px] font-black leading-none tracking-[-1.5px]">₱0</span>
              </div>
              <div className="mt-1.5 min-h-10 text-[13px] leading-[1.5] text-sub">{t.freeFor}</div>
              <div className="mt-[22px] flex flex-1 flex-col gap-2.5 border-t border-hairline pt-[22px] text-sm font-medium leading-[1.4]">
                {freeFeatures(fil).map((f) => (
                  <div key={f} className="flex items-start gap-2.5">
                    <span className="mt-px inline-flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full bg-hairline text-[11px] font-extrabold text-sub">✓</span>
                    <span>{f}</span>
                  </div>
                ))}
              </div>
              <div className="mt-[26px] flex flex-col gap-2">
                <div className="flex h-[46px] items-center justify-center rounded-xl border-[1.5px] border-line text-sm font-bold" style={{ color: ent.tier === "FREE" ? "#9AA3AB" : "#5A6672" }}>
                  {ent.tier === "FREE" ? t.currentPlan : t.freeAfter}
                </div>
                <div className="min-h-4 text-center text-xs text-faint">{t.freeFoot}</div>
              </div>
            </div>

            {/* Pro card */}
            <div className="relative flex flex-col rounded-2xl p-7" style={{ background: "linear-gradient(180deg,#FFFFFF 0%,#F3FAFA 100%)", border: "1.5px solid #0FA3A0", boxShadow: "0 1px 2px rgba(34,48,60,0.04), 0 18px 40px -16px rgba(15,163,160,0.5)" }}>
              <div className="flex h-6 items-center justify-between">
                <div className="font-display text-xl font-extrabold">Pro</div>
                <span className="rounded-full bg-[#0FA3A0] px-2.5 py-1 text-[11px] font-bold text-white">
                  {ent.state === "Active" ? t.yourPlan : L("Best value", "Pinakasulit")}
                </span>
              </div>
              <div className="mt-[18px] flex h-11 items-baseline gap-1.5">
                <span className="font-display text-[40px] font-black leading-none tracking-[-1.5px]">{proPrice}</span>
                <span className="text-[15px] font-semibold text-sub">/ {proPer}</span>
              </div>
              <div className="mt-1.5 min-h-10 text-[13px] leading-[1.5] text-sub">
                <b className="font-bold text-teal-text">{proPriceNote}</b>
                <br />
                {t.proFor}
              </div>
              <div className="mt-[22px] flex flex-1 flex-col gap-2.5 pt-[22px] text-sm font-medium leading-[1.4]" style={{ borderTop: "1px solid rgba(15,163,160,0.2)" }}>
                <div className="text-[13px] font-bold text-teal-text">{t.everythingInFree}</div>
                {proFeatures(fil).map((f) => (
                  <div key={f.text} className="flex items-start gap-2.5">
                    <span className="mt-px inline-flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full bg-[#0FA3A0] text-[11px] font-extrabold text-white">✓</span>
                    <span style={{ fontWeight: f.weight }}>{f.text}</span>
                  </div>
                ))}
              </div>
              <div className="mt-[26px] flex flex-col gap-2">
                <button
                  onClick={() => startCheckout(cycle)}
                  className="h-[46px] cursor-pointer rounded-xl bg-teal text-[15px] font-bold text-white"
                >
                  {proCta}
                </button>
                <div className="min-h-4 text-center text-xs text-faint">{proMethodNote}</div>
              </div>
            </div>
          </div>
          <div className="text-center text-xs text-faint">{t.refundPolicy}</div>
        </div>
      )}

      {/* Referral nudge */}
      <div
        className="mx-auto w-full flex max-w-[1000px] items-center justify-between gap-4 rounded-2xl px-5 py-4 text-canvas"
        style={{ background: "linear-gradient(135deg,#101D26 0%,#16242F 100%)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="min-w-0">
          <div className="font-display text-base font-extrabold">{t.referNudgeTitle}</div>
          <div className="mt-[3px] text-[13px] leading-[1.5] text-[#B7C0C8]">{t.referNudgeBody}</div>
        </div>
        <button
          onClick={() => router.push(`/c/${clsId}/referrals`)}
          className="h-10 flex-shrink-0 cursor-pointer whitespace-nowrap rounded-xl bg-amber px-4 text-[13px] font-bold text-ink hover:!bg-[#FFC633]"
        >
          {t.referNudgeCta}
        </button>
      </div>
    </div>
  );
}
