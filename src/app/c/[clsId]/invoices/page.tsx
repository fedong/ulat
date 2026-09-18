"use client";

import { useRouter } from "next/navigation";
import { use } from "react";
import { billingStrings, fmtLong, peso, type Invoice } from "@/lib/billing";
import { useBillingData, useEntitlement } from "@/lib/hooks";
import { useUlat } from "@/lib/store";

export default function InvoicesPage({ params }: { params: Promise<{ clsId: string }> }) {
  const { clsId } = use(params);
  const router = useRouter();
  const st = useUlat();
  const { L, fil } = useEntitlement();
  const t = billingStrings(fil);
  const billing = useBillingData();

  const invoices: Invoice[] = (billing?.invoices ?? []).map((p) => ({
    no: p.status === "paid" ? p.no : "—",
    date: fmtLong(new Date(p.date + "T00:00:00")),
    desc: p.desc,
    net: peso(p.netCents),
    status:
      p.status === "paid"
        ? p.netCents === 0
          ? L("Paid by credit", "Bayad sa credit")
          : L("Paid", "Bayad")
        : p.status === "pending"
          ? L("Awaiting payment", "Hinihintay ang bayad")
          : L("Failed", "Bigo"),
    color: p.status === "paid" ? "#0B807E" : p.status === "pending" ? "#8A6400" : "#B03A24",
  }));

  return (
    <div className="-mr-2 flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pr-2">
      <div className="mx-auto w-full flex max-w-[760px] items-center justify-between gap-4">
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
      <div className="mx-auto w-full max-w-[760px]">
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
                <div className="text-sm font-bold tabular-nums">{i.net}</div>
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
