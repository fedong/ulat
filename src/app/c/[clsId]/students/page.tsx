"use client";

import { useRouter } from "next/navigation";
import { use } from "react";
import { CONSENTS_RAW } from "@/lib/consents";
import { consultSummary, fmtDate } from "@/lib/derive";
import {
  ATT_COLORS,
  attColor,
  attRate,
  compPath,
  compute,
  termOf,
} from "@/lib/grading";
import { usePeriodComputed } from "@/lib/hooks";
import { useClass, useUlat } from "@/lib/store";
import { parseRoster } from "@/lib/roster";
import type { Assessment } from "@/lib/types";

const capsLabel = "label-caps text-sub";

export default function StudentsPage({ params }: { params: Promise<{ clsId: string }> }) {
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
  const passing = Number(gs.passing) || 0;
  const periodClosed = !!(cls.closed || {})[st.period];
  const asmsP = asms.filter((a) => a.period === st.period);

  const FK: Record<string, string> = { Passing: "pass", "At risk": "risk", Failing: "fail", INC: "inc" };
  const filters = ["All", "Passing", "At risk", "Failing", "INC"];
  const studentList = roster.filter(
    (r) => st.filter === "All" || computed[r.id].k === FK[st.filter],
  );

  const addStudents = (text: string) => {
    const rows = parseRoster(text);
    if (!rows.length) return;
    st.upCls(cls.id, (c) => ({
      roster: [...c.roster, ...rows.filter((r) => !c.roster.some((e) => e.name === r.name))],
    }));
    st.set({ addStudentName: "" });
  };

  const sr = roster.find((r) => r.id === st.student) || roster[0];

  /* ---- detail panel derivations ---- */
  let panel: React.ReactNode = null;
  if (sr) {
    const c = computed[sr.id];
    const rate = attRate(cls, sr.id);
    const saved = cls.remarks[sr.id] || "";
    const draft = st.remarkDraft === null ? saved : st.remarkDraft;

    const failComps = c.groups.flatMap((g) =>
      g.comps.filter((x) => x.color === "#B03A24").map((x) => (c.groups.length > 1 ? g.name + " " : "") + x.name),
    );
    const missN = c.missing.length;
    const failGroups = c.groups.filter((g) => g.pctColor === "#B03A24").map((g) => g.name);
    const facts: string[] = [];
    if (missN) facts.push(missN + " missed " + (missN > 1 ? "assessments" : "assessment"));
    const totalComps = c.groups.reduce((n, g) => n + g.comps.length, 0);
    if (failComps.length)
      facts.push(
        failComps.length === totalComps
          ? "every component below passing"
          : failComps.length > 3
            ? "below passing in " + failComps.slice(0, 2).join(", ") + " and " + (failComps.length - 2) + " more"
            : "below passing in " + failComps.join(", "),
      );
    if (rate < 90) facts.push("attendance at " + rate + "%");
    const forward =
      c.k === "inc"
        ? "Grade is incomplete until the pending exam is recorded."
        : c.k === "fail"
          ? missN
            ? "Submitting the missed work is the fastest way to recover points."
            : "Needs at least " + passing + "% on the remaining assessments to pass."
          : c.k === "risk"
            ? "Within " + (Number(gs.riskBand) || 0) + " points of the passing line. One strong result moves this to passing."
            : "Keep the current pace.";
    const standingLine =
      c.k === "inc"
        ? "Incomplete"
        : c.chipPlain +
          " at " +
          c.pctText +
          (c.groups.length > 1 && failGroups.length && c.k !== "fail"
            ? ", though " + failGroups.join(" and ") + " is below the line"
            : "");
    const suggestion = standingLine + (facts.length ? " with " + facts.join(", ") : "") + ". " + forward;

    const ranked = roster
      .map((r) => computed[r.id].pct)
      .filter((p): p is number => p !== null)
      .sort((a, b) => b - a);
    const rank = c.pct === null ? null : ranked.indexOf(c.pct) + 1;
    const clsAvg = ranked.length ? ranked.reduce((a, b) => a + b, 0) / ranked.length : null;
    const context =
      (rank ? "Rank " + rank + " of " + ranked.length : "Unranked") +
      (clsAvg !== null ? " · class average " + clsAvg.toFixed(1) + "%" : "");

    const pending = asmsP.filter((a) => {
      const v = (cls.scores[sr.id] || {})[a.id];
      return v === undefined || v === null;
    });
    const simulate = (frac: number) => {
      const sc2 = { ...(cls.scores[sr.id] || {}) };
      pending.forEach((a) => {
        sc2[a.id] = Number(a.max) * frac;
      });
      return compute(cls, gs, sr.id, sc2, asmsP).pct;
    };
    let outlook: string;
    if (!pending.length)
      outlook =
        c.k === "pass"
          ? "All assessments graded. Standing is final for the recorded work."
          : c.k === "inc"
            ? "Incomplete until the pending exam is recorded."
            : "All assessments graded. Passing now depends on make-up work or a retake.";
    else {
      const lo = simulate(0);
      const hi = simulate(1);
      if (lo !== null && lo >= passing)
        outlook =
          "Stays passing even with 0 on the " + pending.length + " ungraded " + (pending.length > 1 ? "items" : "item") + ".";
      else if (hi !== null && hi < passing)
        outlook =
          "Cannot reach " + passing + "% on the current record, even with perfect scores on the remaining " + pending.length + ". Needs a retake or make-up.";
      else {
        let a = 0, b = 1;
        for (let i = 0; i < 20; i++) {
          const m = (a + b) / 2;
          const sim = simulate(m);
          if (sim !== null && sim >= passing) b = m;
          else a = m;
        }
        const need = Math.ceil(b * 100);
        outlook =
          "Needs an average of " + need + "% on the " + pending.length + " ungraded " + (pending.length > 1 ? "items" : "item") +
          (pending.length === 1
            ? " (" + Math.ceil(b * Number(pending[0].max)) + " / " + pending[0].max + " on " + pending[0].name + ")"
            : "") +
          " to reach " + passing + "%.";
      }
    }
    const outlookColor = c.k === "pass" ? "#0B807E" : c.k === "fail" ? "#B03A24" : "#8A6400";

    const tm = termOf(cls, gs, periods, sr.id);
    const periodLabel = st.period + (periodClosed ? " · Final" : "");

    const trend = periods.map((p) => {
      const set = asms.filter((a) => a.period === p);
      const graded = set.some((a) => {
        const v = (cls.scores[sr.id] || {})[a.id];
        return v !== undefined && v !== null;
      });
      const r = graded ? compute(cls, gs, sr.id, null, set) : null;
      return {
        p,
        label: p,
        value: r && r.pct !== null ? r.grade : "—",
        pct: r && r.pct !== null ? r.pctText : "",
        color: r && r.pct !== null ? r.color : "#9AA3AB",
        bg: p === st.period ? "rgba(15,163,160,0.08)" : "#FFFFFF",
        border: p === st.period ? "#0FA3A0" : "#E8E2D6",
      };
    });

    const toCell = (a: Assessment) => () => {
      st.set({
        period: a.period,
        focus:
          roster.findIndex((r) => r.id === sr.id) +
          "-" +
          asms.filter((x) => x.period === a.period).findIndex((x) => x.id === a.id),
        buffer: "",
      });
      router.push(`/c/${cls.id}/gradebook`);
    };
    const work = [
      ...c.missing.map((a) => ({
        name: a.name,
        meta: compPath(gs, a.comp) + " · " + fmtDate(a.date),
        tag: "Missed",
        tagBg: "rgba(209,75,51,0.12)",
        tagColor: "#B03A24",
        go: toCell(a),
      })),
      ...pending.map((a) => ({
        name: a.name,
        meta: compPath(gs, a.comp) + " · " + fmtDate(a.date),
        tag: "Not graded",
        tagBg: "rgba(90,102,114,0.14)",
        tagColor: "#5A6672",
        go: toCell(a),
      })),
    ];
    const absences = cls.sessions
      .filter((s) => ["A", "L", "E"].includes(s.marks[sr.id]))
      .map((s) => ({
        date: fmtDate(s.date),
        label: ATT_COLORS[s.marks[sr.id]][2],
        bg: ATT_COLORS[s.marks[sr.id]][0],
        color: ATT_COLORS[s.marks[sr.id]][1],
      }));

    const log = (cls.remarkLog || {})[sr.id] || [];
    const history = log
      .slice()
      .reverse()
      .map((e) => ({
        text: e.text,
        when: new Date(e.at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      }));

    const flagged = !!(cls.flags || {})[sr.id];
    const consulted = (cls.consults || {})[sr.id];
    const hasHours = (cls.consult?.slots || []).some((s) => s.days.length);
    const summary = consultSummary(cls);
    const consultNotice = flagged
      ? hasHours
        ? "The student is notified to come during consultation hours: " + summary
        : "The student is flagged, but no consultation hours are set yet."
      : hasHours
        ? "Flagging notifies the student with your consultation hours."
        : "Set consultation hours so flagged students know when to come.";

    const setFlag = () =>
      st.upCls(cls.id, (x) => ({ flags: { ...(x.flags || {}), [sr.id]: !flagged } }));
    const toggleFlag = () =>
      flagged
        ? st.confirm({
            title: "Remove the consultation flag?",
            body: sr.name + " will no longer see the request to come in. The record stays as it is.",
            confirmLabel: "Remove flag",
            onConfirm: setFlag,
          })
        : st.confirm({
            title: "Flag " + sr.name + " for consultation?",
            body: hasHours
              ? "The student will be notified in the app and shown your consultation hours: " + summary
              : "The student will be notified in the app. No consultation hours are set yet, so add them in Settings.",
            confirmLabel: "Flag and notify",
            onConfirm: setFlag,
          });
    const markConsulted = () =>
      st.upCls(cls.id, (x) => ({
        consults: { ...(x.consults || {}), [sr.id]: consulted ? null : Date.now() },
        flags: { ...(x.flags || {}), [sr.id]: false },
      }));

    const ci = roster.findIndex((r) => r.id === sr.id);
    const [gName, gScopes, , gStatus] = CONSENTS_RAW[ci % CONSENTS_RAW.length];
    const studentSees: [string, string][] = [
      ["Grade and standing", c.grade + " · " + c.chipPlain],
      ["Weighted total", c.pctText],
      ["Components", c.groups.flatMap((g) => g.comps).filter((x) => x.pctText).length + " with percentages"],
      ["Attendance", rate + "%"],
      ["Remark", saved ? "Shown" : "None yet"],
    ];
    const scopeOn = (s: string) => gScopes.includes(s) && gStatus === "Active";
    const guardianName = gStatus === "Not linked" ? "No guardian linked" : gName + " · " + gStatus;
    const guardianSees =
      gStatus === "Not linked"
        ? []
        : ["Grades", "Attendance", "Missing work", "Remarks"].map((k) => ({
            k,
            v: scopeOn(k) ? "Shared" : "Hidden",
            color: scopeOn(k) ? "#0B807E" : "#9AA3AB",
          }));

    const remarkStatus =
      st.remarkDraft !== null && draft !== saved
        ? "Unsaved draft"
        : saved
          ? "Saved · visible to the student"
          : "No remark yet";
    const saveRemark = () => {
      if (!draft.trim()) return;
      st.upCls(cls.id, (x) => ({
        remarks: { ...x.remarks, [sr.id]: draft },
        remarkLog: {
          ...(x.remarkLog || {}),
          [sr.id]: [...((x.remarkLog || {})[sr.id] || []), { text: draft, at: Date.now() }],
        },
      }));
      st.set({ remarkDraft: null });
    };

    const sdTab = st.sdTab || "record";
    const sdTabs: ["record" | "work" | "remarks" | "shared", string][] = [
      ["record", "Record"],
      ["work", "Work"],
      ["remarks", "Remarks"],
      ["shared", "Shared view"],
    ];

    panel = (
      <div className="flex max-h-full flex-col gap-4 overflow-y-auto rounded-2xl bg-card p-5 shadow-card">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-display text-[22px] font-extrabold tracking-[-0.4px]">{sr.name}</div>
            <div className="mt-0.5 text-[13px] font-medium text-sub">
              {sr.no} · {cls.section}
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <span
                className="whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold"
                style={{ background: c.bg, color: c.color }}
              >
                {c.chip}
              </span>
              {flagged && (
                <span className="whitespace-nowrap rounded-full bg-amber-tint px-2.5 py-1 text-xs font-bold text-amber-text">
                  For consultation
                </span>
              )}
            </div>
          </div>
          <div className="flex-shrink-0 text-right">
            <div
              className="font-display text-5xl font-black leading-none tracking-[-2px]"
              style={{ color: c.color }}
            >
              {c.grade}
            </div>
            <div className="mt-1 text-[11px] font-semibold text-sub">{periodLabel}</div>
            <div className="text-xs font-bold" style={{ color: tm.color }}>
              {tm.label} {tm.grade}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 text-[13px] font-medium leading-[1.5]">
          <div className="text-sub">{context}</div>
          <div className="font-semibold" style={{ color: outlookColor }}>
            {outlook}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1 rounded-xl border border-line bg-canvas p-1">
          {sdTabs.map(([k, label]) => (
            <button
              key={k}
              onClick={() => st.set({ sdTab: k })}
              className="h-[30px] cursor-pointer whitespace-nowrap rounded-[9px] text-xs font-bold"
              style={{
                background: sdTab === k ? "#0FA3A0" : "transparent",
                color: sdTab === k ? "#FFFFFF" : "#5A6672",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {sdTab === "record" && (
          <>
            <div className="rounded-xl bg-canvas px-3.5 py-2">
              {c.groups.map((g) => (
                <div key={g.name} className="py-1.5">
                  <div className="flex justify-between font-display text-[13px] font-extrabold">
                    <span>
                      {g.name}{" "}
                      <span className="font-body text-xs font-medium text-sub">{g.weightText}</span>
                    </span>
                    <span style={{ color: g.pctColor }}>{g.pct}</span>
                  </div>
                  {g.comps.map((cc) => (
                    <div key={cc.cid} className="flex justify-between pl-2.5 pt-[5px] text-[13px] font-medium">
                      <span>
                        {cc.name} <span className="text-sub">{cc.w}%</span>
                      </span>
                      <span className="font-bold" style={{ color: cc.color }}>
                        {cc.text}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
              <div className="flex justify-between border-t border-line pb-1 pt-2 text-[13px] font-bold">
                <span>Weighted %</span>
                <span style={{ color: c.color }}>{c.pctText}</span>
              </div>
              <div className="flex justify-between py-1 text-[13px] font-bold">
                <span>Attendance</span>
                <span style={{ color: attColor(rate) }}>{rate}%</span>
              </div>
            </div>
            <div>
              <div className={`${capsLabel} mb-2`}>BY PERIOD</div>
              <div className="grid grid-cols-4 gap-1.5">
                {trend.map((p) => (
                  <button
                    key={p.p}
                    onClick={() => st.set({ period: p.p, focus: "0-0", buffer: "" })}
                    className="min-w-0 cursor-pointer rounded-xl px-2 py-2.5 text-center text-ink hover:!border-teal"
                    style={{ border: `1.5px solid ${p.border}`, background: p.bg }}
                  >
                    <div className="font-display text-lg font-extrabold" style={{ color: p.color }}>
                      {p.value}
                    </div>
                    <div className="mt-0.5 truncate text-[11px] font-medium text-sub">{p.label}</div>
                    <div className="text-[11px] font-semibold text-sub">{p.pct}</div>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {sdTab === "work" && (
          <>
            <div>
              <div className={`${capsLabel} mb-2`}>MISSED AND NOT YET GRADED</div>
              {work.length === 0 && (
                <div className="rounded-xl border-[1.5px] border-dashed border-line p-3.5 text-center text-[13px] font-medium text-sub">
                  All work is recorded.
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                {work.map((w, i) => (
                  <button
                    key={i}
                    onClick={w.go}
                    title="Open in gradebook"
                    className="flex w-full cursor-pointer items-center justify-between gap-2.5 rounded-xl border border-line bg-card px-3 py-2.5 text-left text-ink hover:border-teal"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-semibold">{w.name}</div>
                      <div className="text-xs text-sub">{w.meta}</div>
                    </div>
                    <span
                      className="whitespace-nowrap rounded-full px-[9px] py-[3px] text-[11px] font-bold"
                      style={{ background: w.tagBg, color: w.tagColor }}
                    >
                      {w.tag}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className={`${capsLabel} mb-2`}>ATTENDANCE · {rate}%</div>
              {absences.length === 0 && (
                <div className="rounded-xl border-[1.5px] border-dashed border-line p-3.5 text-center text-[13px] font-medium text-sub">
                  Present in every session.
                </div>
              )}
              <div className="flex flex-wrap gap-1.5">
                {absences.map((ab, i) => (
                  <span
                    key={i}
                    className="flex items-center gap-1.5 rounded-full px-2.5 py-[5px] text-xs font-semibold"
                    style={{ background: ab.bg, color: ab.color }}
                  >
                    {ab.date} <span className="font-medium">{ab.label}</span>
                  </span>
                ))}
              </div>
            </div>
          </>
        )}

        {sdTab === "remarks" && (
          <>
            <div className="flex flex-col gap-2">
              <label className={capsLabel}>REMARK · FACT FIRST, THEN THE WAY FORWARD</label>
              <textarea
                value={draft}
                onChange={(e) => st.set({ remarkDraft: e.target.value })}
                rows={3}
                placeholder="e.g. 1 missing quiz — retake open until Oct 3."
                className="resize-none rounded-xl border-[1.5px] border-line bg-card px-3 py-2.5 text-[13px] leading-[1.5] text-ink outline-none focus:border-teal"
              />
              <div className="flex flex-col gap-2 rounded-xl bg-canvas px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className={capsLabel}>SUGGESTED FROM THE RECORD</span>
                  <button
                    onClick={() => st.set({ remarkDraft: suggestion })}
                    className="h-7 cursor-pointer whitespace-nowrap rounded-full border-[1.5px] border-line bg-card px-2.5 text-xs font-bold text-teal-text hover:border-teal"
                  >
                    Use this
                  </button>
                </div>
                <div className="text-[13px] leading-[1.5] text-ink">{suggestion}</div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-sub">{remarkStatus}</span>
                <button
                  onClick={saveRemark}
                  className="h-9 cursor-pointer whitespace-nowrap rounded-xl bg-teal px-3.5 text-[13px] font-bold text-white"
                >
                  Save remark
                </button>
              </div>
            </div>
            <div>
              <div className={`${capsLabel} mb-2`}>HISTORY</div>
              {history.length === 0 && (
                <div className="text-[13px] text-faint">No saved remarks yet.</div>
              )}
              <div className="flex flex-col">
                {history.map((h, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[52px_1fr] gap-2.5 border-t border-hairline py-2 text-[13px] leading-[1.5]"
                  >
                    <span className="pt-0.5 text-xs font-semibold text-sub">{h.when}</span>
                    <span>{h.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {sdTab === "shared" && (
          <>
            <div>
              <div className={`${capsLabel} mb-2`}>WHAT THE STUDENT SEES</div>
              <div className="rounded-xl bg-canvas px-3.5 py-1">
                {studentSees.map(([k, v]) => (
                  <div
                    key={k}
                    className="flex justify-between gap-3 border-b border-line py-2 text-[13px] font-medium last:border-b-0"
                  >
                    <span className="text-sub">{k}</span>
                    <span className="text-right font-bold">{v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className={`${capsLabel} mb-2`}>WHAT THE GUARDIAN SEES</div>
              <div className="mb-1.5 text-[13px] font-semibold">{guardianName}</div>
              <div className="flex flex-wrap gap-1.5">
                {guardianSees.map((row) => (
                  <span
                    key={row.k}
                    className="rounded-full border border-line px-2.5 py-[5px] text-xs font-semibold"
                    style={{ color: row.color }}
                  >
                    {row.k} · {row.v}
                  </span>
                ))}
              </div>
              <div className="mt-2 text-xs leading-[1.5] text-sub">
                Consent belongs to the student. Scopes change only from the student&apos;s app.
              </div>
            </div>
          </>
        )}

        <div className="flex gap-2 border-t border-hairline pt-1">
          <button
            onClick={toggleFlag}
            className="h-9 flex-1 cursor-pointer whitespace-nowrap rounded-xl text-xs font-bold"
            style={{
              border: `1.5px solid ${flagged ? "transparent" : "#E8E2D6"}`,
              background: flagged ? "rgba(245,183,10,0.16)" : "#FFFFFF",
              color: flagged ? "#8A6400" : "#5A6672",
            }}
          >
            {flagged ? "Flagged for consultation" : "Flag for consultation"}
          </button>
          <button
            onClick={markConsulted}
            className="h-9 flex-1 cursor-pointer whitespace-nowrap rounded-xl border-[1.5px] border-line bg-card text-xs font-bold text-teal-text hover:border-teal"
          >
            {consulted
              ? "Consulted " +
                new Date(consulted).toLocaleDateString("en-US", { month: "short", day: "numeric" })
              : "Mark as consulted"}
          </button>
        </div>
        <div className="text-xs leading-[1.5] text-sub">
          {consultNotice}{" "}
          {!hasHours && (
            <button
              onClick={() => router.push(`/c/${cls.id}/settings`)}
              className="cursor-pointer p-0 text-xs font-semibold text-teal-text"
            >
              Set them in Settings →
            </button>
          )}
        </div>
        <button
          onClick={() => {
            st.upCls(cls.id, (x) => ({ roster: x.roster.filter((r) => r.id !== sr.id) }));
            const next = roster.find((r) => r.id !== sr.id);
            st.set({ student: next ? next.id : "" });
          }}
          className="mt-1 h-9 cursor-pointer rounded-xl text-[13px] font-semibold text-red-text hover:bg-red-tint-8"
        >
          Remove from class
        </button>
      </div>
    );
  }

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_400px] items-start gap-5">
      <div className="flex max-h-full min-h-0 min-w-0 flex-col gap-3.5">
        <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {filters.map((f) => {
              const on = st.filter === f;
              return (
                <button
                  key={f}
                  onClick={() => st.set({ filter: f })}
                  className="h-[34px] cursor-pointer whitespace-nowrap rounded-full px-3.5 text-[13px] font-bold"
                  style={{
                    background: on ? "#0FA3A0" : "#FFFFFF",
                    color: on ? "#FFFFFF" : "#5A6672",
                    border: `1px solid ${on ? "#0FA3A0" : "#E8E2D6"}`,
                  }}
                >
                  {f}
                </button>
              );
            })}
          </div>
          <div className="flex min-w-0 flex-shrink gap-1.5">
            <div className="flex min-w-0 flex-shrink items-stretch overflow-hidden rounded-full border-[1.5px] border-line bg-card focus-within:border-teal">
              <input
                value={st.addStudentName}
                onChange={(e) => st.set({ addStudentName: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && st.addStudentName.trim()) addStudents(st.addStudentName);
                }}
                placeholder="2024-01102, Aquino, Paolo, S."
                title="Student No., Last name, First name, M.I. — separate with commas or Tab"
                className="h-[31px] w-60 min-w-0 border-none bg-transparent px-3.5 text-[13px] font-medium text-ink outline-none"
              />
              <button
                onClick={() => st.addStudentName.trim() && addStudents(st.addStudentName)}
                title="Add student"
                className="cursor-pointer whitespace-nowrap bg-teal px-4 text-[13px] font-bold text-white hover:bg-teal-text"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-shrink flex-col overflow-hidden rounded-2xl bg-card shadow-card">
          <div className="label-caps grid grid-cols-[minmax(0,1fr)_110px_90px_80px_100px] gap-2 border-b border-line bg-canvas px-[18px] py-3 text-sub">
            <span>STUDENT</span>
            <span>STUDENT NO.</span>
            <span className="text-right">ATTENDANCE</span>
            <span className="text-right">GRADE</span>
            <span className="text-right">STANDING</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {studentList.map((r) => {
              const c = computed[r.id];
              return (
                <button
                  key={r.id}
                  onClick={() => st.set({ student: r.id, remarkDraft: null })}
                  className="grid h-[50px] w-full cursor-pointer grid-cols-[minmax(0,1fr)_110px_90px_80px_100px] items-center gap-2 border-b border-hairline px-[18px] text-left text-sm font-medium text-ink hover:!bg-canvas"
                  style={{ background: st.student === r.id ? "rgba(15,163,160,0.08)" : "#FFFFFF" }}
                >
                  <span className="truncate font-semibold">{r.name}</span>
                  <span className="text-sub">{r.no}</span>
                  <span className="text-right text-sub">{attRate(cls, r.id)}%</span>
                  <span className="text-right font-display text-base font-extrabold" style={{ color: c.color }}>
                    {c.grade}
                  </span>
                  <span className="flex justify-end">
                    <span
                      className="whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold"
                      style={{ background: c.bg, color: c.color }}
                    >
                      {c.chipPlain}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {panel}
    </div>
  );
}
