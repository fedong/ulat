"use client";

import { use } from "react";
import { CONSENTS_RAW } from "@/lib/consents";
import { useClass } from "@/lib/store";

export default function SharingPage({ params }: { params: Promise<{ clsId: string }> }) {
  const { clsId } = use(params);
  const cls = useClass(clsId);
  if (!cls) return null;

  const consents = cls.roster.map((r, i) => {
    const [guardian, scopes, date, status] = CONSENTS_RAW[i % CONSENTS_RAW.length];
    return {
      id: r.id,
      name: r.name,
      guardian,
      date,
      status,
      statusColor:
        status === "Active" ? "#0B807E" : status.startsWith("Revoked") ? "#B03A24" : "#5A6672",
      scopes: scopes.length
        ? scopes.map((s) => ({ label: s, bg: "rgba(15,163,160,0.12)", color: "#0B807E" }))
        : [
            {
              label: status === "Not linked" ? "no guardian" : "nothing shared",
              bg: "rgba(90,102,114,0.14)",
              color: "#5A6672",
            },
          ],
    };
  });

  return (
    <>
      <div className="flex min-h-0 flex-shrink flex-col overflow-hidden rounded-2xl bg-card shadow-card">
        <div className="label-caps grid grid-cols-[1.4fr_1.6fr_2.2fr_1.2fr_110px] gap-2 border-b border-line bg-canvas px-[18px] py-3 text-sub">
          <span>STUDENT</span>
          <span>GUARDIAN</span>
          <span>SHARED SCOPES</span>
          <span>CONSENT RECORDED</span>
          <span className="text-right">STATUS</span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {consents.map((c) => (
            <div
              key={c.id}
              className="grid h-[50px] grid-cols-[1.4fr_1.6fr_2.2fr_1.2fr_110px] items-center gap-2 border-b border-hairline px-[18px] text-sm font-medium"
            >
              <span className="font-semibold">{c.name}</span>
              <span className="text-sub">{c.guardian}</span>
              <span className="flex flex-wrap gap-1">
                {c.scopes.map((s) => (
                  <span
                    key={s.label}
                    className="whitespace-nowrap rounded-full px-2 py-[3px] text-[11px] font-semibold"
                    style={{ background: s.bg, color: s.color }}
                  >
                    {s.label}
                  </span>
                ))}
              </span>
              <span className="text-sub">{c.date}</span>
              <span className="whitespace-nowrap text-right font-bold" style={{ color: c.statusColor }}>
                {c.status}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex-shrink-0 text-xs font-medium text-sub">
        Consent belongs to the student. You see the record, not the controls — scopes change only
        from the student&apos;s app.
      </div>
    </>
  );
}
