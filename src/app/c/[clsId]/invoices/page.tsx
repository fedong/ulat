"use client";

import { useRouter } from "next/navigation";
import { use } from "react";
import { billingStrings, type Invoice } from "@/lib/billing";
import { useEntitlement } from "@/lib/hooks";
import { useUlat } from "@/lib/store";

export default function InvoicesPage({ params }: { params: Promise<{ clsId: string }> }) {
  const { clsId } = use(params);
  const router = useRouter();
  const st = useUlat();
  const { ent, L, fil } = useEntitlement();
  const t = billingStrings(fil);

  const seedInv: Invoice[] =
    ent.state === "Active" && !st.sub
      ? [
          {
            no: "ULAT-000231",
            date: "3 September 2026",
            desc: "Pro · " + L("Yearly", "Taunan") + " · " + ent.method,
            net: "₱1,199.00",
            status: L("Paid", "Bayad"),
            color: "#0B807E",
          },
        ]
      : ent.state === "Past due"
        ? [
            {
              no: "—",
              date: "16 September 2026",
              desc: "Pro · " + L("Monthly", "Buwanan") + " · " + ent.method,
              net: "₱199.00",
              status: L("Failed · retrying", "Bigo · sinusubukan ulit"),
              color: "#B03A24",
            },
            {
              no: "ULAT-000212",
              date: "16 August 2026",
              desc: "Pro · " + L("Monthly", "Buwanan") + " · " + ent.method,
              net: "₱199.00",
              status: L("Paid", "Bayad"),
              color: "#0B807E",
            },
          ]
        : [];
  const invoices = [...st.invoices, ...seedInv];

  return (
    <div
      className="-mr-2 flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pr-2"
      style={{ animation: "ulatIn .35s ease both" }}
    >
      <div className="flex max-w-[760px] items-center justify-between gap-4">
        <div className="text-[13px] text-sub">{t.refundPolicy}</div>
        <button
          onClick={() => {
            st.set({ checkout: null });
            router.push(`/c/${clsId}/billing`);
          }}
          className="h-[34px] cursor-pointer whitespace-nowrap rounded-[10px] border-[1.5px] border-line bg-white px-3 text-xs font-bold text-ink hover:border-teal hover:text-teal-text"
        >
          {t.billing} →
        </button>
      </div>
      <div className="max-w-[760px]">
        <div className="overflow-hidden rounded-2xl bg-card shadow-card">
          {invoices.length === 0 && (
            <div className="px-[18px] py-[26px] text-center text-[13px] text-faint">
              {t.noInvoices}
            </div>
          )}
          {invoices.map((i, idx) => (
            <div
              key={idx}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-b border-hairline px-[18px] py-3 last:border-b-0"
            >
              <div className="min-w-0">
                <div className="text-sm font-semibold">{i.desc}</div>
                <div className="mt-0.5 text-xs text-sub">
                  {i.date} · {i.no}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold">{i.net}</div>
                <div className="text-xs font-semibold" style={{ color: i.color }}>
                  {i.status}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
