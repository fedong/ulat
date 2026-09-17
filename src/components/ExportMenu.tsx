"use client";

import { usePathname } from "next/navigation";
import { exportPdf, exportXlsx } from "@/lib/export";
import { useEntitlement } from "@/lib/hooks";
import { useClass, useUlat } from "@/lib/store";

export function ExportMenu({ clsId }: { clsId: string }) {
  const st = useUlat();
  const cls = useClass(clsId);
  const pathname = usePathname();
  const { ent } = useEntitlement();
  if (!cls) return null;
  const gs = cls.grading;
  const page = pathname.split("/").pop() || "overview";
  const periodClosed = !!(cls.closed || {})[st.period];

  const exportOptions = [
    { id: "all", label: "Whole gradebook", desc: "Every period, term summary and attendance" },
    { id: "period", label: st.period + (periodClosed ? " · Final" : ""), desc: "Scores for the current period only" },
    ...(gs.groups.length > 1
      ? gs.groups.map((g) => ({ id: "group:" + g.id, label: g.name + " only", desc: g.weight + "% of the grade · all periods" }))
      : []),
    { id: "term", label: "Term grades", desc: "Period grades, term grade and standing" },
    { id: "attendance", label: "Attendance", desc: cls.sessions.length + " sessions · P / L / A / E" },
  ];
  const exportDefault =
    page === "attendance" ? "attendance"
    : page === "gradebook" || page === "assessments" ? "period"
    : page === "overview" || page === "students" ? "term"
    : "all";
  const exportSel = st.exportSel || exportDefault;
  const isPaid = ent.tier === "PRO"; // §12: PDF branding shows only on the Free tier.

  const run = async () => {
    if (st.exportBusy) return;
    st.set({ exportBusy: true });
    const ctx = { cls, period: st.period, exportSel, profile: st.profile, isPaid };
    try {
      if (st.exportFmt === "pdf") await exportPdf(ctx);
      else await exportXlsx(ctx);
      st.set({ exportOpen: false });
    } catch {
      st.confirm({
        title: "Export failed",
        body: "The report could not be rendered. Try a smaller scope or the other format.",
        confirmLabel: "OK",
        onConfirm: () => {},
      });
    } finally {
      st.set({ exportBusy: false });
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => st.set({ exportOpen: !st.exportOpen, exportSel: exportDefault })}
        className="flex h-[38px] cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl bg-card py-0 pl-4 pr-3 text-[13px] font-bold hover:border-teal hover:text-teal-text hover:shadow-[0_6px_14px_-8px_rgba(15,163,160,0.45)]"
        style={{
          border: `1.5px solid ${st.exportOpen ? "#0FA3A0" : "#E8E2D6"}`,
          color: st.exportOpen ? "#0B807E" : "#22303C",
        }}
      >
        Export
        <span className="text-[11px] font-semibold opacity-70">▾</span>
      </button>
      {st.exportOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => st.set({ exportOpen: false })} />
          <div className="absolute right-0 top-[46px] z-[41] flex w-80 flex-col gap-2.5 rounded-2xl border border-line bg-white p-3.5 shadow-[0_16px_40px_rgba(16,29,38,0.18)]">
            <div className="flex items-center justify-between gap-2 px-0.5">
              <span className="label-caps text-sub">EXPORT</span>
              <div className="flex gap-[3px] rounded-[9px] border border-line bg-canvas p-0.5">
                {(
                  [
                    ["xlsx", "Excel"],
                    ["pdf", "PDF report"],
                  ] as const
                ).map(([k, label]) => {
                  const on = st.exportFmt === k;
                  return (
                    <button
                      key={k}
                      onClick={() => st.set({ exportFmt: k })}
                      className="h-[26px] cursor-pointer rounded-[7px] px-2.5 text-xs font-semibold"
                      style={{ background: on ? "#0FA3A0" : "transparent", color: on ? "#FFFFFF" : "#5A6672" }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              {exportOptions.map((o) => {
                const on = o.id === exportSel;
                return (
                  <button
                    key={o.id}
                    onClick={() => st.set({ exportSel: o.id })}
                    className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left text-ink hover:!border-teal"
                    style={{
                      border: `1.5px solid ${on ? "#0FA3A0" : "#E8E2D6"}`,
                      background: on ? "rgba(15,163,160,0.08)" : "#FFFFFF",
                    }}
                  >
                    <span
                      className="h-4 w-4 flex-shrink-0 rounded-full"
                      style={{
                        border: `2px solid ${on ? "#0FA3A0" : "#B8C0C6"}`,
                        background: on ? "#0FA3A0" : "#FFFFFF",
                        boxShadow: "inset 0 0 0 3px #FFFFFF",
                      }}
                    />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-[13px] font-bold">{o.label}</span>
                      <span className="text-xs text-sub">{o.desc}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <button
              onClick={run}
              className="h-[42px] cursor-pointer rounded-xl bg-teal text-sm font-bold text-white"
            >
              {st.exportBusy
                ? st.exportFmt === "pdf" ? "Preparing PDF…" : "Preparing workbook…"
                : st.exportFmt === "pdf" ? "Download PDF report" : "Download .xlsx"}
            </button>
            <div className="px-0.5 text-[11px] leading-[1.5] text-faint">
              {st.exportFmt === "pdf"
                ? "A4 landscape report with signature lines and page numbers. Carries a small Ulat mark on the free plan."
                : "Formatted workbook with the class header, standing colours and frozen name columns."}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
