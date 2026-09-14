"use client";

import { useRouter } from "next/navigation";
import { use } from "react";
import { fmtDate } from "@/lib/derive";
import {
  attRate,
  compPath,
  compute,
  periodOf,
  shown,
  standing,
  STANDING_COLORS,
  termOf,
} from "@/lib/grading";
import { usePeriodComputed } from "@/lib/hooks";
import { useClass, useUlat } from "@/lib/store";

export default function OverviewPage({ params }: { params: Promise<{ clsId: string }> }) {
  const { clsId } = use(params);
  const router = useRouter();
  const st = useUlat();
  const cls = useClass(clsId);
  const computed = usePeriodComputed(cls);
  if (!cls) return null;

  const gs = cls.grading;
  const roster = cls.roster;
  const asms = cls.assessments;
  const periods = cls.periods;
  const closedP = cls.closed || {};
  const passing = Number(gs.passing) || 0;
  const risk = Number(gs.riskBand) || 0;
  const period = st.period;
  const ks = Object.values(computed);
  const nInc = ks.filter((c) => c.k === "inc").length;

  const go = (page: string, patch?: Record<string, unknown>) => {
    if (patch) st.set(patch);
    router.push(`/c/${cls.id}/${page}`);
  };

  /* ---- stat tiles ---- */
  const tiles = [
    { value: String(roster.length), label: "students", color: "#22303C", go: () => go("students") },
    {
      value: roster.length
        ? Math.round(roster.reduce((a, r) => a + attRate(cls, r.id), 0) / roster.length) + "%"
        : "—",
      label: "attendance · " + cls.sessions.length + " sessions",
      color: "#0B807E",
      go: () => go("attendance"),
    },
    {
      value: String(ks.filter((c) => c.k === "risk").length),
      label: "at risk · within " + risk + " pts of passing",
      color: "#C28E00",
      go: () => go("students", { filter: "At risk" }),
    },
    {
      value: String(ks.filter((c) => c.k === "fail").length + nInc),
      label: "failing or INC",
      color: "#B03A24",
      go: () => go("students", { filter: "Failing" }),
    },
  ];

  /* ---- distribution + watch list ---- */
  const cur = roster.map((r) => ({ r, c: computed[r.id] }));
  const K: Record<string, [string, string]> = {
    pass: ["Passing", "#0FA3A0"],
    risk: ["At risk", "#F5B70A"],
    fail: ["Failing", "#D14B33"],
    inc: ["INC", "#9AA3AB"],
  };
  const distSegs = (["pass", "risk", "fail", "inc"] as const).map((k) => {
    const n = cur.filter((x) => x.c.k === k).length;
    return { label: K[k][0], bg: K[k][1], n, w: roster.length ? (n / roster.length) * 100 + "%" : "0%" };
  });
  const pcts = cur
    .map((x) => x.c.pct)
    .filter((p): p is number => p !== null)
    .sort((a, b) => a - b);
  const classAvg = pcts.length
    ? (pcts.reduce((a, b) => a + b, 0) / pcts.length).toFixed(1) + "%"
    : "—";
  const classMedian = pcts.length
    ? (pcts.length % 2
        ? pcts[(pcts.length - 1) / 2]
        : (pcts[pcts.length / 2 - 1] + pcts[pcts.length / 2]) / 2
      ).toFixed(1) + "%"
    : "—";
  const rowsT = gs.table.slice().sort((a, b) => Number(a.lo) - Number(b.lo));
  const bins = rowsT
    .map((r, i) => {
      const lo = Number(r.lo);
      const hi = i + 1 < rowsT.length ? Number(rowsT[i + 1].lo) : 101;
      const n = pcts.filter((p) => p >= lo && p < hi).length;
      return {
        lo,
        n,
        label:
          gs.scale === "pct"
            ? String(lo)
            : gs.scale === "letter"
              ? r.letter
              : gs.scale === "gpa"
                ? r.gpa
                : r.grade,
      };
    })
    .filter((b) => b.lo > 0 || b.n);
  const maxN = Math.max(1, ...bins.map((b) => b.n));
  const hist = bins.map((b) => ({
    label: b.label,
    nText: b.n ? String(b.n) : "",
    h: (b.n / maxN) * 100 + "%",
    bg: b.lo >= passing + risk ? "#0FA3A0" : b.lo >= passing ? "#F5B70A" : "#D14B33",
    title: b.n + " student" + (b.n === 1 ? "" : "s") + " from " + b.lo + "%",
  }));

  const reasons = (x: (typeof cur)[number]) => {
    const out: string[] = [];
    const miss = x.c.missing.length;
    if (miss) out.push(miss + " missed");
    const comps = x.c.groups
      .flatMap((g) =>
        g.comps
          .filter((c) => c.p !== null && c.p * 100 < passing)
          .map((c) => ({ n: (x.c.groups.length > 1 ? g.name + " " : "") + c.name, p: c.p as number })),
      )
      .sort((a, b) => a.p - b.p);
    if (comps.length) out.push("weakest " + comps[0].n + " " + Math.round(comps[0].p * 100) + "%");
    const at = attRate(cls, x.r.id);
    if (at < 85) out.push("attendance " + at + "%");
    if (x.c.k === "inc") out.push("exam pending");
    return out.join(" · ") || "Close to the passing line";
  };
  const order: Record<string, number> = { fail: 0, inc: 1, risk: 2 };
  const watch = cur
    .filter((x) => x.c.k !== "pass")
    .sort((a, b) => order[a.c.k] - order[b.c.k] || (a.c.pct || 0) - (b.c.pct || 0))
    .map((x) => ({
      id: x.r.id,
      name: x.r.name,
      chip: x.c.chip,
      bg: x.c.bg,
      color: x.c.color,
      why: reasons(x),
    }));

  /* ---- component averages ---- */
  let weakest: { avg: number; name: string; below: number } | null = null;
  const compAvg = gs.groups.map((g, gi) => ({
    name: gs.groups.length > 1 ? g.name : "Components",
    comps: g.comps.map((c, ci) => {
      const ps = cur
        .map((x) =>
          x.c.groups[gi] && x.c.groups[gi].comps[ci] ? x.c.groups[gi].comps[ci].p : null,
        )
        .filter((p): p is number => p !== null);
      const avg = ps.length ? (ps.reduce((a, b) => a + b, 0) / ps.length) * 100 : null;
      const below = ps.filter((p) => p * 100 < passing).length;
      if (avg !== null && (!weakest || avg < weakest.avg))
        weakest = { avg, name: (gs.groups.length > 1 ? g.name + " " : "") + c.name, below };
      return {
        name: c.name,
        note: ps.length ? below + " below passing" : "ungraded",
        avg: avg === null ? "—" : avg.toFixed(0) + "%",
        color: avg === null ? "#9AA3AB" : avg >= passing ? "#0B807E" : "#B03A24",
        bar: avg === null ? "#E8E2D6" : avg >= passing ? "#0FA3A0" : "#D14B33",
        w: (avg || 0) + "%",
      };
    }),
  }));
  const wk = weakest as { avg: number; name: string; below: number } | null;
  const compNote = wk
    ? "Weakest area is " +
      wk.name +
      " at " +
      wk.avg.toFixed(0) +
      "% with " +
      wk.below +
      " student" +
      (wk.below === 1 ? "" : "s") +
      " below passing. A review session or retake there moves the most students."
    : "Averages appear once components are graded.";

  /* ---- hardest assessments ---- */
  const asmDiff = asms
    .filter((a) => a.period === period)
    .map((a) => {
      const vs = roster
        .map((r) => (cls.scores[r.id] || {})[a.id])
        .map((v) => (v === "MISSED" ? 0 : v))
        .filter((v): v is number => typeof v === "number");
      if (!vs.length) return null;
      const mean = (vs.reduce((x, y) => x + y, 0) / vs.length / Number(a.max)) * 100;
      const pr = (vs.filter((v) => (v / Number(a.max)) * 100 >= passing).length / vs.length) * 100;
      return {
        id: a.id,
        name: a.name,
        max: a.max,
        compPath: compPath(gs, a.comp),
        date: fmtDate(a.date),
        meanN: mean,
        mean: mean.toFixed(0) + "%",
        meanColor: mean >= passing ? "#0B807E" : "#B03A24",
        passRate: pr.toFixed(0) + "%",
        passColor: pr >= 75 ? "#0B807E" : pr >= 50 ? "#8A6400" : "#B03A24",
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => a.meanN - b.meanN);

  /* ---- period strip + term ---- */
  const avgOf = (vals: (number | null)[]) => {
    const v = vals.filter((x): x is number => x !== null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const perAvg = (p: string) =>
    avgOf(
      roster.map((r) => {
        const x = periodOf(cls, gs, r.id, p);
        return x ? x.pct : null;
      }),
    );
  const periodStrip = periods.map((p) => {
    const a = perAvg(p);
    const curP = p === period;
    return {
      p,
      label: (p + (closedP[p] ? " · Final" : "")).toUpperCase(),
      value: a === null ? "—" : shown(gs, a),
      color: a === null ? "#9AA3AB" : STANDING_COLORS[standing(gs, a, false)][1],
      bg: curP ? "rgba(15,163,160,0.08)" : "#FFFFFF",
      border: curP ? "#0FA3A0" : "#E8E2D6",
    };
  });
  const ta = avgOf(roster.map((r) => termOf(cls, gs, periods, r.id).pct));
  const termAvgText = ta === null ? "—" : shown(gs, ta) + " · " + ta.toFixed(1) + "%";
  const termAvgColor = ta === null ? "#9AA3AB" : STANDING_COLORS[standing(gs, ta, false)][1];
  const passingPctText = passing + "%";

  return (
    <>
      <div className="grid flex-shrink-0 grid-cols-4 gap-3.5">
        {tiles.map((t) => (
          <button
            key={t.label}
            onClick={t.go}
            className="cursor-pointer rounded-2xl bg-card px-5 py-[18px] text-left text-ink shadow-card transition-shadow hover:shadow-[0_4px_16px_rgba(34,48,60,0.1)]"
          >
            <div
              className="font-display text-[32px] font-black leading-none tracking-[-1px]"
              style={{ color: t.color }}
            >
              {t.value}
            </div>
            <div className="mt-1.5 text-[13px] font-medium text-sub">{t.label}</div>
          </button>
        ))}
      </div>

      <div className="-mx-1 mt-5 grid min-h-0 flex-1 grid-cols-2 content-start gap-5 overflow-y-auto px-1 pb-7">
        {/* Needs attention */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between px-0.5">
            <div className="font-display text-[17px] font-extrabold">
              Needs attention{" "}
              <span className="font-body text-sm font-semibold text-sub">
                · {watch.length} of {roster.length}
              </span>
            </div>
            <button
              onClick={() => go("students")}
              className="cursor-pointer text-[13px] font-bold text-teal-text"
            >
              All students →
            </button>
          </div>
          <div className="max-h-[340px] overflow-y-auto rounded-2xl bg-card pb-1.5 shadow-card">
            {watch.length === 0 && (
              <div className="px-[18px] py-6 text-center text-[13px] text-faint">
                Everyone is passing in {period}.
              </div>
            )}
            {watch.map((s) => (
              <button
                key={s.id}
                onClick={() => go("students", { student: s.id, remarkDraft: null })}
                className="flex w-full cursor-pointer items-center justify-between gap-2.5 border-b border-hairline bg-card px-[18px] py-2.5 text-left text-ink hover:bg-canvas"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{s.name}</div>
                  <div className="mt-0.5 text-xs leading-[1.4] text-sub">{s.why}</div>
                </div>
                <span
                  className="whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold"
                  style={{ background: s.bg, color: s.color }}
                >
                  {s.chip}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Grade distribution */}
        <div className="flex flex-col gap-2.5">
          <div className="px-0.5 font-display text-[17px] font-extrabold">
            Grade distribution · {period}
          </div>
          <div className="flex flex-col gap-3.5 rounded-2xl bg-card px-[18px] py-4 shadow-card">
            <div className="flex h-3.5 overflow-hidden rounded-full bg-line">
              {distSegs.map((d) => (
                <div key={d.label} className="h-full" style={{ width: d.w, background: d.bg }} />
              ))}
            </div>
            <div className="flex flex-wrap gap-3.5 text-xs font-medium text-sub">
              {distSegs.map((d) => (
                <span key={d.label} className="flex items-center gap-[5px]">
                  <span className="h-2 w-2 rounded-full" style={{ background: d.bg }} />
                  {d.label} <b className="text-ink">{d.n}</b>
                </span>
              ))}
            </div>
            <div className="flex h-[84px] items-end gap-1 border-b border-line pt-1.5">
              {hist.map((h, i) => (
                <div
                  key={i}
                  title={h.title}
                  className="flex h-full flex-1 flex-col items-center justify-end gap-[3px]"
                >
                  <span className="text-[11px] font-bold text-sub">{h.nText}</span>
                  <div
                    className="w-full rounded-t"
                    style={{ background: h.bg, height: h.h }}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-1">
              {hist.map((h, i) => (
                <div
                  key={i}
                  className="flex-1 truncate text-center text-[11px] font-semibold text-sub"
                >
                  {h.label}
                </div>
              ))}
            </div>
            <div className="flex justify-between text-xs font-medium text-sub">
              <span>
                Class average <b className="text-ink">{classAvg}</b>
              </span>
              <span>
                Median <b className="text-ink">{classMedian}</b>
              </span>
              <span>
                Passing at <b className="text-ink">{passingPctText}</b>
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 border-t border-hairline pt-2.5">
              {periodStrip.map((p) => (
                <button
                  key={p.p}
                  onClick={() => st.set({ period: p.p, focus: "0-0", buffer: "" })}
                  className="flex cursor-pointer flex-col gap-px rounded-[10px] px-2.5 py-1.5 text-left"
                  style={{ border: `1.5px solid ${p.border}`, background: p.bg }}
                >
                  <span className="whitespace-nowrap text-[10px] font-semibold tracking-[0.4px] text-sub">
                    {p.label}
                  </span>
                  <span className="font-display text-sm font-extrabold" style={{ color: p.color }}>
                    {p.value}
                  </span>
                </button>
              ))}
              <div className="ml-auto text-right">
                <div className="text-[10px] font-semibold tracking-[0.4px] text-sub">
                  TERM SO FAR
                </div>
                <div
                  className="font-display text-base font-extrabold"
                  style={{ color: termAvgColor }}
                >
                  {termAvgText}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Class average by component */}
        <div className="flex flex-col gap-2.5">
          <div className="px-0.5 font-display text-[17px] font-extrabold">
            Class average by component
          </div>
          <div className="max-h-[420px] overflow-y-auto rounded-2xl bg-card px-[18px] pb-3.5 pt-2 shadow-card">
            {compAvg.map((g) => (
              <div key={g.name} className="pb-1 pt-2">
                <div className="mb-1 font-display text-[13px] font-extrabold text-sub">
                  {g.name}
                </div>
                {g.comps.map((c) => (
                  <div
                    key={c.name}
                    className="grid grid-cols-[1fr_auto] items-baseline gap-x-3 gap-y-0.5 py-[5px]"
                  >
                    <span className="text-[13px] font-semibold">
                      {c.name} <span className="text-xs font-medium text-sub">{c.note}</span>
                    </span>
                    <span className="text-[13px] font-bold" style={{ color: c.color }}>
                      {c.avg}
                    </span>
                    <div className="col-span-full h-[5px] overflow-hidden rounded-full bg-hairline">
                      <div
                        className="h-full rounded-full"
                        style={{ background: c.bar, width: c.w }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ))}
            <div className="mt-1.5 text-xs leading-[1.5] text-sub">{compNote}</div>
          </div>
        </div>

        {/* Hardest assessments */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between px-0.5">
            <div className="font-display text-[17px] font-extrabold">
              Hardest assessments · {period}{" "}
              <span className="font-body text-sm font-semibold text-sub">
                · {asmDiff.length} graded
              </span>
            </div>
            <button
              onClick={() => go("assessments")}
              className="cursor-pointer text-[13px] font-bold text-teal-text"
            >
              All →
            </button>
          </div>
          <div className="max-h-[340px] overflow-y-auto rounded-2xl bg-card pb-1.5 shadow-card">
            {asmDiff.length === 0 && (
              <div className="px-[18px] py-6 text-center text-[13px] text-faint">
                No graded assessments in {period} yet.
              </div>
            )}
            {asmDiff.map((a) => (
              <button
                key={a.id}
                onClick={() => go("assessments", { asmId: a.id })}
                className="grid h-[52px] w-full cursor-pointer grid-cols-[1fr_64px_72px] items-center gap-3 border-b border-hairline bg-card px-[18px] text-left text-ink hover:bg-canvas"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">
                    {a.name} <span className="font-medium text-sub">/ {a.max}</span>
                  </div>
                  <div className="mt-px text-xs text-sub">
                    {a.compPath} · {a.date}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[13px] font-bold" style={{ color: a.meanColor }}>
                    {a.mean}
                  </div>
                  <div className="text-[11px] font-medium text-sub">mean</div>
                </div>
                <div className="text-right">
                  <div className="text-[13px] font-bold" style={{ color: a.passColor }}>
                    {a.passRate}
                  </div>
                  <div className="text-[11px] font-medium text-sub">passed</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
