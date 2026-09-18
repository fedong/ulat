"use client";

import { billingStrings, peso } from "@/lib/billing";
import { useBillingData, useEntitlement } from "@/lib/hooks";
import { useUlat } from "@/lib/store";

export default function ReferralsPage() {
  const st = useUlat();
  const { L, fil } = useEntitlement();
  const t = billingStrings(fil);
  const billing = useBillingData();
  const creditAvail = billing?.creditCents ?? 0;
  const refLink =
    (typeof window !== "undefined" ? window.location.origin : "") +
    "/signin?ref=" +
    (billing?.referralCode ?? "…");

  const steps: [string, string][] = [
    [
      L("Share your link", "Ibahagi ang link"),
      L(
        "Send it to a colleague. They sign up and get the same 5-month Pro trial.",
        "Ipadala sa kasamahan. Mag-sign up sila at makukuha ang parehong 5-buwang Pro trial.",
      ),
    ],
    [
      L("They go Pro for a year", "Mag-Pro sila ng isang taon"),
      L("The referral qualifies on their first yearly payment.", "Kwalipikado ang referral sa unang taunang bayad nila."),
    ],
    [
      L("You get ₱199 credit", "Makakakuha ka ng ₱199 credit"),
      L(
        "Applied automatically to your next bill, 14 days after their payment.",
        "Awtomatikong ibabawas sa susunod mong bayad, 14 araw pagkabayad nila.",
      ),
    ],
  ];
  const referrals =
    (billing?.referredCount ?? 0) > 0
      ? [
          {
            name: L(
              billing!.referredCount + (billing!.referredCount === 1 ? " colleague signed up" : " colleagues signed up"),
              billing!.referredCount + (billing!.referredCount === 1 ? " kasamahan ang naka-sign up" : " kasamahan ang naka-sign up"),
            ),
            status: L("Credit lands on their first yearly payment", "Credit sa unang taunang bayad nila"),
            color: "#0B807E",
          },
        ]
      : [
          {
            name: L("No referrals yet", "Wala pang referral"),
            status: L("Share your link to start", "Ibahagi ang link para magsimula"),
            color: "#9AA3AB",
          },
        ];

  const copyRef = () => {
    try {
      navigator.clipboard.writeText(refLink);
    } catch {}
    st.set({ refCopied: true });
    setTimeout(() => useUlat.setState({ refCopied: false }), 1500);
  };

  return (
    <div className="-mr-2 flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pr-2">
      <div className="mx-auto w-full grid max-w-[760px] grid-cols-3 gap-3">
        {steps.map(([title, body], i) => (
          <div key={i} className="flex flex-col gap-2 rounded-2xl bg-card px-[18px] py-4 shadow-card">
            <span className="inline-flex h-[26px] w-[26px] items-center justify-center rounded-full bg-teal-tint-12 font-display text-[13px] font-extrabold text-teal-text">
              {i + 1}
            </span>
            <div className="text-sm font-bold">{title}</div>
            <div className="text-[13px] leading-[1.5] text-sub">{body}</div>
          </div>
        ))}
      </div>

      <div className="mx-auto w-full max-w-[760px]">
        <div className="flex flex-col gap-3.5 rounded-2xl bg-card px-5 py-[18px] shadow-card">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-canvas px-3.5 py-3">
            <div className="min-w-0">
              <div className="label-caps text-sub">{t.yourLink}</div>
              <div className="mt-0.5 truncate font-display text-base font-extrabold tracking-[0.3px]">
                {refLink.replace(/^https?:\/\//, "")}
              </div>
            </div>
            <button
              onClick={copyRef}
              className="h-9 flex-shrink-0 cursor-pointer whitespace-nowrap rounded-[10px] bg-teal px-3.5 text-[13px] font-bold text-white"
            >
              {st.refCopied ? L("Copied", "Nakopya") : L("Copy link", "Kopyahin ang link")}
            </button>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-medium text-sub">{t.creditBalance}</span>
            <span className="font-display text-[26px] font-black tracking-[-0.6px] text-teal-text">
              {peso(creditAvail)}
            </span>
          </div>
          <div className="flex flex-col">
            {referrals.map((r) => (
              <div
                key={r.name}
                className="flex justify-between gap-3 border-t border-hairline py-2.5 text-[13px] font-medium"
              >
                <span>{r.name}</span>
                <span className="text-right font-semibold" style={{ color: r.color }}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[760px] text-xs leading-[1.5] text-faint">{t.referFine}</div>
    </div>
  );
}
