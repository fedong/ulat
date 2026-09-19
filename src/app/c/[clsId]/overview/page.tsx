"use client";

import { useRouter } from "next/navigation";
import { use, useState } from "react";
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
  const [perfHover, setPerfHover] = useState<number | null>(null);
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
  const classSigma = (() => {
    if (pcts.length < 2) return "—";
    const m = pcts.reduce((a, b) => a + b, 0) / pcts.length;
    return Math.sqrt(pcts.reduce((a, p) => a + (p - m) * (p - m), 0) / pcts.length).toFixed(1);
  })();
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
    // ABC early-warning line: missing more than 10% of class time.
    if (at < 90) out.push("attendance " + at + "%");
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

  /* ---- assessment discrimination (Ebel's upper–lower 27% index) ---- */
  const ranked = cur
    .filter((x) => x.c.pct !== null)
    .slice()
    .sort((a, b) => (b.c.pct as number) - (a.c.pct as number));
  const third = Math.max(3, Math.round(ranked.length * 0.27));
  const upperIds = new Set(ranked.slice(0, third).map((x) => x.r.id));
  const lowerIds = new Set(ranked.slice(-third).map((x) => x.r.id));
  const discOf = (aid: string, max: number) => {
    if (ranked.length < 6) return null;
    const grp = (ids: Set<string>) => {
      const vs = [...ids]
        .map((id) => (cls.scores[id] || {})[aid])
        .map((v) => (v === "MISSED" ? 0 : v))
        .filter((v): v is number => typeof v === "number");
      return vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length / max : null;
    };
    const u = grp(upperIds);
    const l = grp(lowerIds);
    return u === null || l === null ? null : u - l;
  };
  // Ebel's interpretation bands for D.
  const discBand = (d: number | null): [string, string] =>
    d === null
      ? ["—", "#9AA3AB"]
      : d >= 0.4
        ? ["strong", "#0B807E"]
        : d >= 0.2
          ? ["fair", "#8A6400"]
          : ["weak", "#B03A24"];

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
      const d = discOf(a.id, Number(a.max));
      const [discLabel, discColor] = discBand(d);
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
        disc: d === null ? "—" : d.toFixed(2),
        discLabel,
        discColor,
        discTitle:
          d === null
            ? "Needs at least 6 graded students"
            : "Discrimination index (Ebel): top vs bottom 27% of the class scored " +
              Math.round(d * 100) +
              " pts apart on this. ≥0.40 strong · 0.20–0.39 fair · <0.20 weak (too easy, too hard, or off-topic).",
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

  /* ---- class performance over time (mean % per graded assessment) ---- */
  const perf = asms
    .map((a) => {
      const vs = roster
        .map((r) => (cls.scores[r.id] || {})[a.id])
        .map((v) => (v === "MISSED" ? 0 : v))
        .filter((v): v is number => typeof v === "number");
      if (!vs.length) return null;
      return {
        id: a.id,
        name: a.name,
        period: a.period,
        date: a.date,
        mean: (vs.reduce((x, y) => x + y, 0) / vs.length / Number(a.max)) * 100,
        passRate: Math.round(
          (vs.filter((v) => (v / Number(a.max)) * 100 >= passing).length / vs.length) * 100,
        ),
        graded: vs.length,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  // Period boundaries for the trend chart (index where a new period starts).
  const perfBounds = perf
    .map((p, i) => (i > 0 && p.period !== perf[i - 1].period ? i : -1))
    .filter((i) => i > 0);
  const perfSegs = perf.length
    ? [0, ...perfBounds].map((startI, si, arr) => ({
        startI,
        label: perf[startI].period,
        endI: si + 1 < arr.length ? arr[si + 1] - 1 : perf.length - 1,
      }))
    : [];
  // SVG geometry: fixed viewBox, uniform scale; passing line as reference.
  const PW = 640;
  const PH = 150;
  const PPAD = { l: 30, r: 46, t: 14, b: 22 };
  const px = (i: number) =>
    PPAD.l + (perf.length < 2 ? 0.5 : i / (perf.length - 1)) * (PW - PPAD.l - PPAD.r);
  const py = (v: number) => PPAD.t + (1 - v / 100) * (PH - PPAD.t - PPAD.b);
  const perfPath = perf.map((p, i) => (i ? "L" : "M") + px(i).toFixed(1) + " " + py(p.mean).toFixed(1)).join(" ");
  const perfArea =
    perf.length > 1
      ? perfPath +
        ` L ${px(perf.length - 1).toFixed(1)} ${py(0)} L ${px(0).toFixed(1)} ${py(0)} Z`
      : "";
  const perfTickIdx =
    perf.length <= 5
      ? perf.map((_, i) => i)
      : [0, Math.round((perf.length - 1) / 3), Math.round(((perf.length - 1) * 2) / 3), perf.length - 1];
  const perfLast = perf[perf.length - 1];
  const perfDelta =
    perf.length >= 2 ? perf[perf.length - 1].mean - perf[perf.length - 2].mean : null;

  /* ---- path to passing (simulate remaining work in this period) ---- */
  const pathRows = cur
    .filter((x) => x.c.k === "fail" || x.c.k === "inc")
    .map((x) => {
      const rid = x.r.id;
      const remaining = asms.filter((a) => {
        const v = (cls.scores[rid] || {})[a.id];
        return a.period === period && (v === undefined || v === null);
      });
      const simAt = (f: number) => {
        const sc = { ...(cls.scores[rid] || {}) };
        remaining.forEach((a) => (sc[a.id] = Math.round(Number(a.max) * f)));
        const r = periodOf(cls, gs, rid, period, sc);
        return r ? r.pct : null;
      };
      if (!remaining.length)
        return { id: rid, name: x.r.name, note: "No work left in " + period, kind: "done" as const };
      const p100 = simAt(1);
      const p0 = simAt(0);
      if (p100 === null || p0 === null || p100 <= p0)
        return { id: rid, name: x.r.name, note: "No work left in " + period, kind: "done" as const };
      if (p100 < passing)
        return {
          id: rid,
          name: x.r.name,
          note: "Even perfect scores on the remaining " + remaining.length + " reach only " + p100.toFixed(0) + "%",
          kind: "out" as const,
        };
      const needed = Math.max(0, Math.ceil(((passing - p0) / (p100 - p0)) * 100));
      return {
        id: rid,
        name: x.r.name,
        note:
          "Needs a " + needed + "% average on the remaining " +
          remaining.length + " assessment" + (remaining.length === 1 ? "" : "s"),
        kind: needed > 90 ? ("stretch" as const) : ("reach" as const),
      };
    })
    .sort((a, b) => {
      const o = { reach: 0, stretch: 1, out: 2, done: 3 };
      return o[a.kind] - o[b.kind];
    });
  const PATH_CHIP: Record<string, [string, string, string]> = {
    reach: ["Reachable", "rgba(15,163,160,0.12)", "#0B807E"],
    stretch: ["Stretch", "#FFF6DC", "#8A6400"],
    out: ["Out of reach", "#FBE9E5", "#B03A24"],
    done: ["Final", "#EFEAE0", "#5A6672"],
  };

  /* ---- movers vs the previous period ---- */
  const prevPeriod = periods[periods.indexOf(period) - 1];
  const movers = !prevPeriod
    ? []
    : cur
        .map((x) => {
          const prev = periodOf(cls, gs, x.r.id, prevPeriod);
          if (!prev || prev.pct === null || x.c.pct === null) return null;
          return { id: x.r.id, name: x.r.name, delta: x.c.pct - prev.pct, now: x.c.pct };
        })
        .filter((m): m is NonNullable<typeof m> => m !== null && Math.abs(m.delta) >= 1)
        .sort((a, b) => b.delta - a.delta);
  const gainers = movers.filter((m) => m.delta > 0).slice(0, 4);
  const sliders = movers
    .filter((m) => m.delta < 0)
    .slice(-4)
    .reverse();

  /* ---- grading backlog (assessments past their date with unscored cells) ---- */
  const todayISO = new Date().toISOString().slice(0, 10);
  const backlog = asms
    .filter((a) => a.date && a.date <= todayISO)
    .map((a) => ({
      id: a.id,
      name: a.name,
      period: a.period,
      date: fmtDate(a.date),
      n: roster.filter((r) => {
        const v = (cls.scores[r.id] || {})[a.id];
        return v === undefined || v === null;
      }).length,
    }))
    .filter((a) => a.n > 0 && a.n < roster.length)
    .sort((a, b) => b.n - a.n);
  const backlogTotal = backlog.reduce((s, a) => s + a.n, 0);

  /* ---- attendance × grade quadrant (ABC early-warning thresholds) ---- */
  const quad = cur
    .filter((x) => x.c.pct !== null)
    .map((x) => ({
      id: x.r.id,
      name: x.r.name,
      initials: (x.r.first[0] || "") + (x.r.last[0] || ""),
      att: attRate(cls, x.r.id),
      pct: x.c.pct as number,
      color: x.c.color,
    }));
  const QW = 300;
  const QH = 210;
  const QP = { l: 30, r: 36, t: 12, b: 24 };
  const qXmin = Math.min(60, ...quad.map((q) => q.att - 4));
  const qx = (att: number) => QP.l + ((att - qXmin) / (100 - qXmin)) * (QW - QP.l - QP.r);
  const qYmin = Math.max(0, Math.min(50, ...quad.map((q) => q.pct - 6)));
  const qy = (pct: number) => QP.t + (1 - (pct - qYmin) / (100 - qYmin)) * (QH - QP.t - QP.b);

  /* ---- attendance by session + chronic absences ---- */
  const sessDays = [...new Set(cls.sessions.map((s) => s.date))].sort();
  const attByDay = sessDays.map((date) => {
    const ss = cls.sessions.filter((s) => s.date === date);
    let present = 0;
    let counted = 0;
    ss.forEach((s) =>
      roster.forEach((r) => {
        const m = s.marks[r.id] || "P";
        if (m === "E") return;
        counted++;
        if (m !== "A") present++;
      }),
    );
    const rate = counted ? Math.round((present / counted) * 100) : 100;
    return {
      date,
      rate,
      bg: rate >= 85 ? "#0FA3A0" : rate >= 70 ? "#F5B70A" : "#D14B33",
      title: fmtDate(date) + " · " + rate + "% present",
    };
  });
  const absentees = roster
    .map((r) => ({ id: r.id, name: r.name, rate: attRate(cls, r.id) }))
    .filter((a) => a.rate < 90)
    .sort((a, b) => a.rate - b.rate);

  /* ---- missing work (MISSED marks across the whole term) ---- */
  const missRows = roster
    .map((r) => {
      const sc = cls.scores[r.id] || {};
      const missed = asms.filter((a) => sc[a.id] === "MISSED");
      return { id: r.id, name: r.name, n: missed.length, names: missed.map((a) => a.name) };
    })
    .filter((m) => m.n > 0)
    .sort((a, b) => b.n - a.n);
  const missTotal = missRows.reduce((a, m) => a + m.n, 0);

  return (
    <>
      <div data-tour="overview" className="grid flex-shrink-0 grid-cols-2 gap-3.5 lg:grid-cols-4">
        {tiles.map((t) => (
          <button
            key={t.label}
            onClick={t.go}
            className="relative cursor-pointer overflow-hidden rounded-2xl bg-card px-5 py-[18px] text-left text-ink shadow-card hover:-translate-y-0.5 hover:!border-[rgba(15,163,160,0.35)] hover:!shadow-[0_2px_4px_rgba(34,48,60,0.04),0_18px_36px_-14px_rgba(34,48,60,0.28)]"
          >
            <div
              className="absolute inset-x-0 top-0 h-[3px]"
              style={{ background: `linear-gradient(90deg,${t.color},transparent)` }}
            />
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

      <div className="-mx-1 mt-5 grid min-h-0 flex-1 auto-rows-max grid-cols-1 content-start gap-5 overflow-y-auto px-1 pb-7 lg:grid-cols-2">
        <div className="mt-3 flex items-center gap-3 px-0.5 lg:col-span-2">
          <span className="label-caps whitespace-nowrap text-sub">HOW THE CLASS IS DOING</span>
          <span className="h-px flex-1 bg-line" />
        </div>

        {/* Class performance over time */}
        <div className="flex flex-col gap-2.5 lg:col-span-2">
          <div className="flex items-baseline justify-between px-0.5">
            <div className="font-display text-[17px] font-extrabold">
              Class performance over time{" "}
              <span className="font-body text-sm font-semibold text-sub">
                · mean score per assessment
              </span>
            </div>
            {perfDelta !== null && (
              <span
                className="text-[13px] font-bold"
                style={{ color: perfDelta >= 0 ? "#0B807E" : "#B03A24" }}
              >
                {perfDelta >= 0 ? "▲" : "▼"} {Math.abs(perfDelta).toFixed(1)} pts vs previous
              </span>
            )}
          </div>
          <div className="rounded-2xl bg-card px-[18px] pb-2 pt-3 shadow-card">
            {perf.length === 0 ? (
              <div className="py-6 text-center text-[13px] text-faint">
                The trend appears once assessments are graded.
              </div>
            ) : (
              <div className="relative" onMouseLeave={() => setPerfHover(null)}>
                <svg viewBox={`0 0 ${PW} ${PH}`} className="block h-auto w-full" role="img"
                  aria-label="Line chart of the class mean score for each graded assessment in date order">
                  {/* period boundaries + segment labels */}
                  {perfBounds.map((i) => (
                    <line key={i} x1={(px(i - 1) + px(i)) / 2} x2={(px(i - 1) + px(i)) / 2}
                      y1={PPAD.t - 2} y2={PH - PPAD.b} stroke="#EFEAE0" strokeWidth={1} />
                  ))}
                  {perfSegs.length > 1 &&
                    perfSegs.map((s) => (
                      <text key={s.label + s.startI} x={(px(s.startI) + px(s.endI)) / 2} y={PPAD.t - 3}
                        fontSize={9} fill="#B3BAC2" fontWeight={700} textAnchor="middle"
                        style={{ letterSpacing: "0.5px" }}>
                        {s.label.toUpperCase()}
                      </text>
                    ))}
                  {/* passing reference line */}
                  <line x1={PPAD.l} x2={PW - PPAD.r} y1={py(passing)} y2={py(passing)}
                    stroke="#E8E2D6" strokeWidth={1} />
                  <text x={PPAD.l + 4} y={py(passing) - 5} fontSize={10} fill="#8A94A0" fontWeight={600}>
                    pass {passing}%
                  </text>
                  {[0, 50, 100].map((v) => (
                    <text key={v} x={PPAD.l - 6} y={py(v) + 3.5} fontSize={10} fill="#B3BAC2" textAnchor="end">
                      {v}
                    </text>
                  ))}
                  {perfArea && <path d={perfArea} fill="rgba(15,163,160,0.10)" />}
                  <path d={perfPath} fill="none" stroke="#0FA3A0" strokeWidth={2}
                    strokeLinejoin="round" strokeLinecap="round" />
                  {perf.map((p, i) => (
                    <g key={p.id}>
                      {perfHover === i && (
                        <line x1={px(i)} x2={px(i)} y1={PPAD.t} y2={PH - PPAD.b}
                          stroke="#D9D3C7" strokeWidth={1} />
                      )}
                      <circle cx={px(i)} cy={py(p.mean)} r={perfHover === i ? 5.5 : 4.5}
                        fill={p.mean >= passing ? "#0FA3A0" : "#D14B33"}
                        stroke="#FFFFFF" strokeWidth={2} />
                      {/* generous invisible hit target for hover */}
                      <circle cx={px(i)} cy={py(p.mean)} r={13} fill="transparent"
                        onMouseEnter={() => setPerfHover(i)}
                        onClick={() => go("assessments", { asmId: p.id })}
                        style={{ cursor: "pointer" }} />
                    </g>
                  ))}
                  {perfLast && perfHover === null && (
                    <text x={px(perf.length - 1) + 9} y={py(perfLast.mean) + 4} fontSize={12}
                      fontWeight={700} fill="#22303C">
                      {perfLast.mean.toFixed(0)}%
                    </text>
                  )}
                  {perfTickIdx.map((i) => (
                    <text key={i} x={px(i)} y={PH - 6} fontSize={10} fill="#8A94A0" textAnchor="middle">
                      {fmtDate(perf[i].date)}
                    </text>
                  ))}
                </svg>
                {perfHover !== null && perf[perfHover] && (
                  <div
                    className="pointer-events-none absolute z-10 w-max max-w-[240px] rounded-xl bg-[#101D26] px-3 py-2 text-canvas"
                    style={{
                      left: `calc(${(px(perfHover) / PW) * 100}% ${perfHover > perf.length / 2 ? "- 8px" : "+ 8px"})`,
                      top: `${(py(perf[perfHover].mean) / PH) * 100}%`,
                      transform:
                        perfHover > perf.length / 2 ? "translate(-100%, -110%)" : "translate(0, -110%)",
                      boxShadow: "0 12px 32px rgba(16,29,38,0.35)",
                    }}
                  >
                    <div className="text-[13px] font-bold">{perf[perfHover].name}</div>
                    <div className="mt-0.5 text-xs text-[#B7C0C8]">
                      {perf[perfHover].mean.toFixed(0)}% mean · {perf[perfHover].passRate}% passed
                    </div>
                    <div className="text-xs text-[#B7C0C8]">
                      {perf[perfHover].period} · {fmtDate(perf[perfHover].date)} ·{" "}
                      {perf[perfHover].graded} graded
                    </div>
                  </div>
                )}
              </div>
            )}
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
            <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs font-medium text-sub">
              <span>
                Class average <b className="text-ink">{classAvg}</b>
              </span>
              <span>
                Median <b className="text-ink">{classMedian}</b>
              </span>
              <span title="Standard deviation — how spread out the class is. A big σ means very mixed mastery; consider grouping or differentiated review.">
                Spread σ <b className="text-ink">{classSigma}</b>
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

        <div className="mt-3 flex items-center gap-3 px-0.5 lg:col-span-2">
          <span className="label-caps whitespace-nowrap text-sub">WHO NEEDS YOU NOW</span>
          <span className="h-px flex-1 bg-line" />
        </div>

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

        {/* Path to passing */}
        <div className="flex flex-col gap-2.5">
          <div className="px-0.5 font-display text-[17px] font-extrabold">
            Path to passing · {period}{" "}
            <span className="font-body text-sm font-semibold text-sub">
              · what the remaining work can still do
            </span>
          </div>
          <div className="max-h-[340px] overflow-y-auto rounded-2xl bg-card pb-1.5 shadow-card">
            {pathRows.length === 0 && (
              <div className="px-[18px] py-6 text-center text-[13px] text-faint">
                No one is failing or incomplete in {period}. 🎉
              </div>
            )}
            {pathRows.map((s) => (
              <button
                key={s.id}
                onClick={() => go("students", { student: s.id, remarkDraft: null })}
                className="flex w-full cursor-pointer items-center justify-between gap-2.5 border-b border-hairline bg-card px-[18px] py-2.5 text-left text-ink hover:bg-canvas"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{s.name}</div>
                  <div className="mt-0.5 text-xs leading-[1.4] text-sub">{s.note}</div>
                </div>
                <span
                  className="whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold"
                  style={{ background: PATH_CHIP[s.kind][1], color: PATH_CHIP[s.kind][2] }}
                >
                  {PATH_CHIP[s.kind][0]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Movers vs previous period */}
        <div className="flex flex-col gap-2.5">
          <div className="px-0.5 font-display text-[17px] font-extrabold">
            On the move{" "}
            <span className="font-body text-sm font-semibold text-sub">
              {prevPeriod ? "· " + prevPeriod + " → " + period : "· needs two graded periods"}
            </span>
          </div>
          <div className="max-h-[340px] overflow-y-auto rounded-2xl bg-card pb-1.5 shadow-card">
            {(!prevPeriod || (gainers.length === 0 && sliders.length === 0)) && (
              <div className="px-[18px] py-6 text-center text-[13px] text-faint">
                {prevPeriod
                  ? "No student moved more than a point between periods."
                  : "Once two periods have grades, the biggest improvements and slips show here."}
              </div>
            )}
            {gainers.map((m) => (
              <button
                key={m.id}
                onClick={() => go("students", { student: m.id, remarkDraft: null })}
                className="flex w-full cursor-pointer items-center justify-between gap-2.5 border-b border-hairline bg-card px-[18px] py-2.5 text-left text-ink hover:bg-canvas"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{m.name}</div>
                  <div className="mt-0.5 text-xs text-sub">now {m.now.toFixed(1)}%</div>
                </div>
                <span className="whitespace-nowrap text-[13px] font-bold" style={{ color: "#0B807E" }}>
                  ▲ {m.delta.toFixed(1)} pts
                </span>
              </button>
            ))}
            {sliders.map((m) => (
              <button
                key={m.id}
                onClick={() => go("students", { student: m.id, remarkDraft: null })}
                className="flex w-full cursor-pointer items-center justify-between gap-2.5 border-b border-hairline bg-card px-[18px] py-2.5 text-left text-ink hover:bg-canvas"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{m.name}</div>
                  <div className="mt-0.5 text-xs text-sub">now {m.now.toFixed(1)}%</div>
                </div>
                <span className="whitespace-nowrap text-[13px] font-bold" style={{ color: "#B03A24" }}>
                  ▼ {Math.abs(m.delta).toFixed(1)} pts
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Missing work */}
        <div className="flex flex-col gap-2.5">
          <div className="px-0.5 font-display text-[17px] font-extrabold">
            Missing work{" "}
            <span className="font-body text-sm font-semibold text-sub">
              · {missTotal} missed across the term
            </span>
          </div>
          <div className="max-h-[340px] overflow-y-auto rounded-2xl bg-card pb-1.5 shadow-card">
            {missRows.length === 0 && (
              <div className="px-[18px] py-6 text-center text-[13px] text-faint">
                Nothing marked missed. Scores flagged M in the gradebook collect here.
              </div>
            )}
            {missRows.map((m) => (
              <button
                key={m.id}
                onClick={() => go("students", { student: m.id, remarkDraft: null })}
                className="flex w-full cursor-pointer items-center justify-between gap-2.5 border-b border-hairline bg-card px-[18px] py-2.5 text-left text-ink hover:bg-canvas"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{m.name}</div>
                  <div className="mt-0.5 truncate text-xs text-sub">
                    {m.names.slice(0, 2).join(", ")}
                    {m.n > 2 ? " +" + (m.n - 2) + " more" : ""}
                  </div>
                </div>
                <span className="whitespace-nowrap rounded-full bg-[#FBE9E5] px-2.5 py-1 text-xs font-bold text-[#B03A24]">
                  {m.n} missed
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3 px-0.5 lg:col-span-2" title="Item-analysis and early-warning views: D uses Ebel's upper-lower 27% discrimination index; the 90% attendance line is the validated early-warning threshold.">
          <span className="label-caps whitespace-nowrap text-sub">DIAGNOSTICS</span>
          <span className="h-px flex-1 bg-line" />
        </div>

        {/* Hardest assessments */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between px-0.5">
            <div className="font-display text-[17px] font-extrabold">
              Assessment diagnostics · {period}{" "}
              <span className="font-body text-sm font-semibold text-sub">
                · hardest first · D = discrimination
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
                className="grid h-[52px] w-full cursor-pointer grid-cols-[1fr_56px_56px_64px] items-center gap-2.5 border-b border-hairline bg-card px-[18px] text-left text-ink hover:bg-canvas"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">
                    {a.name} <span className="font-medium text-sub">/ {a.max}</span>
                  </div>
                  <div className="mt-px truncate text-xs text-sub">
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
                <div className="text-right" title={a.discTitle}>
                  <div className="text-[13px] font-bold" style={{ color: a.discColor }}>
                    {a.disc}
                  </div>
                  <div className="text-[11px] font-medium" style={{ color: a.discColor }}>
                    {a.discLabel}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Grading backlog */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between px-0.5">
            <div className="font-display text-[17px] font-extrabold">
              Grading backlog{" "}
              <span className="font-body text-sm font-semibold text-sub">
                · {backlogTotal} score{backlogTotal === 1 ? "" : "s"} to enter
              </span>
            </div>
            <button
              onClick={() => go("gradebook")}
              className="cursor-pointer text-[13px] font-bold text-teal-text"
            >
              Gradebook →
            </button>
          </div>
          <div className="max-h-[340px] overflow-y-auto rounded-2xl bg-card pb-1.5 shadow-card">
            {backlog.length === 0 && (
              <div className="px-[18px] py-6 text-center text-[13px] text-faint">
                All caught up — every past-dated assessment is fully scored.
              </div>
            )}
            {backlog.map((a) => (
              <button
                key={a.id}
                onClick={() => go("gradebook", { asmId: a.id, period: a.period })}
                className="flex w-full cursor-pointer items-center justify-between gap-2.5 border-b border-hairline bg-card px-[18px] py-2.5 text-left text-ink hover:bg-canvas"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{a.name}</div>
                  <div className="mt-0.5 text-xs text-sub">
                    {a.period} · {a.date}
                  </div>
                </div>
                <span className="whitespace-nowrap rounded-full bg-[#FFF6DC] px-2.5 py-1 text-xs font-bold text-[#8A6400]">
                  {a.n} unscored
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Attendance by session */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between px-0.5">
            <div className="font-display text-[17px] font-extrabold">
              Attendance by session{" "}
              <span className="font-body text-sm font-semibold text-sub">
                · {sessDays.length} days
              </span>
            </div>
            <button
              onClick={() => go("attendance")}
              className="cursor-pointer text-[13px] font-bold text-teal-text"
            >
              Attendance →
            </button>
          </div>
          <div className="flex flex-col gap-3 rounded-2xl bg-card px-[18px] py-4 shadow-card">
            {sessDays.length === 0 ? (
              <div className="py-4 text-center text-[13px] text-faint">
                No sessions recorded yet.
              </div>
            ) : (
              <>
                <div className="flex h-[72px] items-end gap-[3px] border-b border-line">
                  {attByDay.map((d) => (
                    <div
                      key={d.date}
                      title={d.title}
                      className="max-w-[24px] flex-1 rounded-t"
                      style={{ background: d.bg, height: Math.max(6, d.rate * 0.72) + "px" }}
                    />
                  ))}
                </div>
                <div className="flex justify-between text-[11px] font-semibold text-sub">
                  <span>{fmtDate(sessDays[0])}</span>
                  <span>{fmtDate(sessDays[sessDays.length - 1])}</span>
                </div>
                {absentees.length === 0 ? (
                  <div className="text-xs text-sub">
                    No one is below 90% attendance — the early-warning line (missing more than
                    10% of class time predicts course failure).
                  </div>
                ) : (
                  <div className="flex flex-col">
                    <div className="label-caps mb-1 text-sub" title="Missing more than 10% of class time — the validated early-warning threshold.">BELOW 90% · EARLY-WARNING LINE</div>
                    {absentees.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => go("students", { student: a.id, remarkDraft: null })}
                        className="flex cursor-pointer items-center justify-between border-t border-hairline py-2 text-left"
                      >
                        <span className="text-[13px] font-semibold text-ink">{a.name}</span>
                        <span className="text-[13px] font-bold" style={{ color: a.rate >= 80 ? "#8A6400" : "#B03A24" }}>
                          {a.rate}%
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Attendance × grade quadrant (ABC early-warning view) */}
        <div className="flex flex-col gap-2.5">
          <div className="px-0.5 font-display text-[17px] font-extrabold">
            Attendance × grade{" "}
            <span className="font-body text-sm font-semibold text-sub">
              · who to pull aside, and why
            </span>
          </div>
          <div className="flex flex-col gap-2 rounded-2xl bg-card px-[18px] py-4 shadow-card">
            {quad.length === 0 ? (
              <div className="py-4 text-center text-[13px] text-faint">
                Appears once grades and sessions are recorded.
              </div>
            ) : (
              <>
                <svg viewBox={`0 0 ${QW} ${QH}`} className="block h-auto w-full" role="img"
                  aria-label="Scatter of each student by attendance rate and current grade, split at the 90% attendance early-warning line and the passing mark">
                  <line x1={qx(90)} x2={qx(90)} y1={QP.t} y2={QH - QP.b} stroke="#E8E2D6" strokeWidth={1} />
                  <line x1={QP.l} x2={QW - QP.r} y1={qy(passing)} y2={qy(passing)} stroke="#E8E2D6" strokeWidth={1} />
                  <text x={QP.l + 3} y={QP.t + 8} fontSize={8} fill="#B3BAC2" fontWeight={700}>ABSENT · PASSING</text>
                  <text x={QW - QP.r - 3} y={QP.t + 8} fontSize={8} fill="#B3BAC2" fontWeight={700} textAnchor="end">ON TRACK</text>
                  <text x={QP.l + 3} y={QH - QP.b - 4} fontSize={8} fill="#B3BAC2" fontWeight={700}>DISENGAGED</text>
                  <text x={QW - QP.r - 3} y={QH - QP.b - 4} fontSize={8} fill="#B3BAC2" fontWeight={700} textAnchor="end">ATTENDS · NEEDS HELP</text>
                  <text x={qx(90)} y={QH - 4} fontSize={8.5} fill="#8A94A0" textAnchor="middle">90% attendance</text>
                  <text x={QP.l - 4} y={qy(passing) + 3} fontSize={8.5} fill="#8A94A0" textAnchor="end">pass</text>
                  {quad.map((q) => (
                    <g key={q.id} onClick={() => go("students", { student: q.id, remarkDraft: null })} style={{ cursor: "pointer" }}>
                      <circle cx={qx(q.att)} cy={qy(q.pct)} r={5} fill={q.color} stroke="#FFFFFF" strokeWidth={2}>
                        <title>{q.name + " · attendance " + q.att + "% · grade " + q.pct.toFixed(1) + "%"}</title>
                      </circle>
                      <text x={qx(q.att) + 7} y={qy(q.pct) + 3} fontSize={8} fill="#5A6672" fontWeight={600}>{q.initials}</text>
                    </g>
                  ))}
                </svg>
                <div className="text-xs leading-[1.5] text-sub">
                  Bottom-right attends but still struggles — that&apos;s a learning gap; coach the
                  subject. Bottom-left is disengaging — involve the guardian early.
                </div>
              </>
            )}
          </div>
        </div>

      </div>
    </>
  );
}
