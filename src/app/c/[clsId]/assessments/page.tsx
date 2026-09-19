"use client";

import { useRouter } from "next/navigation";
import { use, useEffect, useRef, useState } from "react";
import { fmtDate } from "@/lib/derive";
import { compById, compPath } from "@/lib/grading";
import { newId } from "@/lib/presets";
import { today, useClass, useUlat } from "@/lib/store";
import type { Assessment, Klass, Session } from "@/lib/types";

const ARCHIVE_DAYS = 30;

/** linked(session, assessment): same date, and same group when the session has one. */
const asmGroup = (cls: Klass, comp: string) => {
  const r = compById(cls.grading, comp);
  return r ? cls.grading.groups.find((g) => g.comps.some((c) => c.id === r.c.id))?.id ?? null : null;
};
const linked = (cls: Klass, s: Session, a: { date: string; comp: string }) =>
  a.date === s.date && (!s.group || asmGroup(cls, a.comp) === s.group);

export default function AssessmentsPage({ params }: { params: Promise<{ clsId: string }> }) {
  const { clsId } = use(params);
  const router = useRouter();
  const st = useUlat();
  const cls = useClass(clsId);
  const [revealAsm, setRevealAsm] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Initialize the draft's date/component on first visit.
  useEffect(() => {
    if (!cls) return;
    const na = useUlat.getState().na;
    const patch: Partial<typeof na> = {};
    if (!na.date) patch.date = today();
    if (!compById(cls.grading, na.comp))
      patch.comp = cls.grading.groups[0]?.comps[0]?.id || "";
    if (!cls.periods.includes(na.period)) patch.period = useUlat.getState().period;
    if (Object.keys(patch).length) st.set({ na: { ...na, ...patch } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cls?.id]);

  useEffect(() => {
    if (!revealAsm || !listRef.current) return;
    const row = listRef.current.querySelector<HTMLElement>(`[data-asm="${revealAsm}"]`);
    row?.scrollIntoView({ block: "nearest" });
    setRevealAsm(null);
  }, [revealAsm]);

  if (!cls) return null;
  const gs = cls.grading;
  const roster = cls.roster;
  const asms = cls.assessments;
  const periods = cls.periods;
  const todayIso = today();

  const gradedOf = (a: Assessment) =>
    roster.filter((r) => {
      const v = (cls.scores[r.id] || {})[a.id];
      return v !== undefined && v !== null;
    }).length;
  const daysUntil = (iso: string) =>
    Math.round(
      (new Date(iso + "T00:00:00").getTime() - new Date(todayIso + "T00:00:00").getTime()) / 864e5,
    );
  const countdown = (iso: string) => {
    const d = daysUntil(iso);
    return d === 0 ? "today" : d === 1 ? "tomorrow" : "in " + d + " days";
  };

  const asmList = asms
    .filter((a) => st.asmFilter === "All" || a.period === st.asmFilter)
    .map((a) => {
      const g = gradedOf(a);
      const done = g >= roster.length;
      const upcoming = a.date > todayIso && g === 0;
      return {
        ...a,
        compPathText: compPath(gs, a.comp),
        progress: upcoming
          ? countdown(a.date)
          : roster.length
            ? done
              ? "All graded"
              : g + "/" + roster.length
            : "—",
        progColor: upcoming ? "#0B807E" : done ? "#0B807E" : "#8A6400",
      };
    });

  const archive = cls.archive || [];
  const archiveRows = archive
    .slice()
    .sort((p, q) => q.archivedAt - p.archivedAt)
    .map((a) => {
      const left = Math.max(0, Math.ceil((a.archivedAt + ARCHIVE_DAYS * 864e5 - Date.now()) / 864e5));
      return {
        ...a,
        compPathText: compPath(gs, a.comp),
        daysText: left <= 1 ? "Permanently deleted today" : "Permanently deleted in " + left + " days",
        daysColor: left <= 7 ? "#B03A24" : "#5A6672",
      };
    });

  const archiveAsm = (a: Assessment) =>
    st.confirm({
      title: "Archive " + a.name + "?",
      body:
        "This assessment will be removed from the gradebook and excluded from grade computation. It can be restored from the Archive within " +
        ARCHIVE_DAYS +
        " days. After that, it will be permanently deleted.",
      confirmLabel: "Archive",
      onConfirm: () =>
        st.upCls(cls.id, (c) => ({
          assessments: c.assessments.filter((x) => x.id !== a.id),
          archive: [...(c.archive || []), { ...a, archivedAt: Date.now() }],
        })),
    });

  const restoreAsm = (id: string) =>
    st.upCls(cls.id, (c) => {
      const found = (c.archive || []).find((x) => x.id === id);
      if (!found) return {};
      const { archivedAt: _drop, ...asm } = found;
      return {
        assessments: [...c.assessments, asm].sort((x, y) => (x.date < y.date ? -1 : 1)),
        archive: (c.archive || []).filter((x) => x.id !== id),
      };
    });

  const purgeAsm = (a: Assessment) =>
    st.confirm({
      title: "Delete " + a.name + " permanently?",
      body:
        "The " + gradedOf(a) + " recorded scores for this assessment will also be deleted. This action cannot be undone.",
      confirmLabel: "Delete permanently",
      danger: true,
      onConfirm: () =>
        st.upCls(cls.id, (c) => {
          const scores: Klass["scores"] = {};
          Object.keys(c.scores).forEach((sid) => {
            const { [a.id]: _drop, ...rest } = c.scores[sid];
            scores[sid] = rest;
          });
          return { archive: (c.archive || []).filter((x) => x.id !== a.id), scores };
        }),
    });

  /* ---- new assessment form ---- */
  const compOptions = gs.groups.flatMap((g) =>
    g.comps.map((c) => ({
      value: c.id,
      label: (gs.groups.length > 1 ? g.name + " · " : "") + c.name + " (" + c.w + "%)",
    })),
  );
  const naComp = compById(gs, st.na.comp) ? st.na.comp : gs.groups[0]?.comps[0]?.id || "";
  const naPeriod = periods.includes(st.na.period) ? st.na.period : periods[0] || "";
  const naCompObj = compById(gs, naComp);
  const naBase = naCompObj
    ? naCompObj.c.name
        .replace(/zzes$/i, "z")
        .replace(/([^s])ies$/i, "$1y")
        .replace(/(ch|sh|x|ss)es$/i, "$1")
        .replace(/([^s])s$/i, "$1")
    : "Item";
  const naSuggest = naBase + " " + (asms.filter((a) => a.comp === naComp).length + 1);
  const naOk = parseFloat(st.na.max) > 0 && !!naComp;
  const naLater = !!st.na.later;
  const naFuture = naLater && st.na.date > todayIso;

  const setNa = (k: keyof typeof st.na) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    st.set({ na: { ...st.na, [k]: e.target.value } });

  const createNa = () => {
    if (!naOk) return;
    const id = newId();
    st.upCls(cls.id, (c) => {
      const ses = c.sessions.find((s) => linked(c, s, { date: st.na.date, comp: naComp }));
      const scores = { ...c.scores };
      if (ses)
        roster.forEach((r) => {
          const m = ses.marks[r.id];
          const v = m === "A" ? ("MISSED" as const) : m === "E" ? ("EXC" as const) : null;
          if (v) scores[r.id] = { ...(scores[r.id] || {}), [id]: v };
        });
      return {
        assessments: [
          ...c.assessments,
          {
            id,
            name: st.na.name.trim() || naSuggest,
            comp: naComp,
            period: naPeriod,
            max: Number(st.na.max),
            date: st.na.date,
            notes: (st.na.notes || "").trim(),
          },
        ],
        scores,
      };
    });
    st.set({
      na: { ...st.na, name: "", notes: "", later: false, date: today() },
      asmId: id,
      period: naPeriod,
    });
    setRevealAsm(id);
  };

  const asm = asms.find((a) => a.id === st.asmId);
  let asmDetail: React.ReactNode = null;
  if (asm) {
    const vals = roster
      .map((r) => (cls.scores[r.id] || {})[asm.id])
      .map((v) => (v === "MISSED" ? 0 : v))
      .filter((v): v is number => typeof v === "number");
    const g = gradedOf(asm);
    const done = g >= roster.length;
    const upcoming = asm.date > todayIso && g === 0;
    const progress = upcoming ? countdown(asm.date) : roster.length ? (done ? "All graded" : g + "/" + roster.length) : "—";
    const progColor = upcoming ? "#0B807E" : done ? "#0B807E" : "#8A6400";
    asmDetail = (
      <div className="flex flex-col gap-3.5 rounded-2xl bg-card p-5 shadow-card">
        <div>
          <div className="text-xs font-medium text-sub">
            {compPath(gs, asm.comp)} · {asm.period} · {fmtDate(asm.date)}
          </div>
          <div className="mt-0.5 font-display text-xl font-extrabold tracking-[-0.4px]">
            {asm.name} <span className="font-body text-sm font-medium text-sub">/ {asm.max}</span>
          </div>
        </div>
        {upcoming && (
          <div className="rounded-xl bg-teal-tint-12 px-3.5 py-2.5 text-[13px] font-semibold text-teal-text">
            Upcoming · {countdown(asm.date)}
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <label className="label-caps text-sub">
            COVERAGE AND REMINDERS · SHOWN TO STUDENTS
          </label>
          <textarea
            value={asm.notes || ""}
            onChange={(e) => {
              const v = e.target.value;
              st.upCls(cls.id, (c) => ({
                assessments: c.assessments.map((x) => (x.id === asm.id ? { ...x, notes: v } : x)),
              }));
            }}
            rows={2}
            placeholder="e.g. Chapters 3–5, bring a calculator."
            className="resize-none rounded-xl border-[1.5px] border-line bg-card px-3 py-2.5 text-[13px] leading-[1.5] text-ink outline-none focus:border-teal"
          />
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          <div className="rounded-xl bg-canvas px-3.5 py-3">
            <div className="font-display text-xl font-black leading-none">
              {vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : "—"}
            </div>
            <div className="mt-1 text-xs font-medium text-sub">mean</div>
          </div>
          <div className="rounded-xl bg-canvas px-3.5 py-3">
            <div className="font-display text-xl font-black leading-none">
              {vals.length ? Math.max(...vals) : "—"}
            </div>
            <div className="mt-1 text-xs font-medium text-sub">highest</div>
          </div>
          <div className="rounded-xl bg-canvas px-3.5 py-3">
            <div className="font-display text-xl font-black leading-none" style={{ color: progColor }}>
              {progress}
            </div>
            <div className="mt-1 text-xs font-medium text-sub">graded</div>
          </div>
        </div>
        <button
          onClick={() => {
            st.set({
              period: asm.period,
              focus: "0-" + asms.filter((a) => a.period === asm.period).findIndex((a) => a.id === asm.id),
            });
            router.push(`/c/${cls.id}/gradebook`);
          }}
          className="h-[42px] cursor-pointer rounded-xl border-[1.5px] border-teal bg-card text-sm font-bold text-teal-text"
        >
          Grade in gradebook →
        </button>
      </div>
    );
  }

  const selectCls =
    "h-11 rounded-xl border-[1.5px] border-line bg-card px-2.5 text-sm font-medium text-ink outline-none focus:border-teal";

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 items-start gap-5 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_minmax(300px,340px)] lg:overflow-visible xl:grid-cols-[minmax(0,1fr)_400px]">
      {/* Left: filters + table + archive */}
      <div className="flex max-h-full min-h-0 flex-col gap-3.5">
        <div className="flex flex-shrink-0 flex-wrap gap-1.5">
          {["All", ...periods].map((p) => {
            const on = st.asmFilter === p;
            return (
              <button
                key={p}
                onClick={() => st.set({ asmFilter: p })}
                className="h-[34px] cursor-pointer whitespace-nowrap rounded-full px-3.5 text-[13px] font-bold"
                style={{
                  background: on ? "#0FA3A0" : "#FFFFFF",
                  color: on ? "#FFFFFF" : "#5A6672",
                  border: `1px solid ${on ? "#0FA3A0" : "#E8E2D6"}`,
                }}
              >
                {p}
              </button>
            );
          })}
        </div>

        {/* overflow-x lets narrow screens scroll the table instead of squeezing columns into each other. */}
        <div className="flex min-h-0 flex-shrink flex-col overflow-y-hidden overflow-x-auto rounded-2xl bg-card shadow-card">
          <div className="label-caps grid grid-cols-[minmax(150px,2fr)_minmax(140px,1.6fr)_90px_70px_56px_90px_32px] gap-2 border-b border-line bg-canvas px-[18px] py-3 text-sub">
            <span>ASSESSMENT</span>
            <span>COMPONENT</span>
            <span>PERIOD</span>
            <span>DATE</span>
            <span className="text-right">MAX</span>
            <span className="text-right">GRADED</span>
            <span />
          </div>
          <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto">
            {asmList.map((a) => (
              <div
                key={a.id}
                data-asm={a.id}
                className={`grid h-[50px] grid-cols-[minmax(150px,2fr)_minmax(140px,1.6fr)_90px_70px_56px_90px_32px] items-center gap-2 border-b border-hairline px-[18px] text-sm font-medium text-ink transition-colors ${
                  st.asmId === a.id ? "bg-teal-tint-8" : "bg-white hover:bg-canvas"
                }`}
              >
                <button
                  onClick={() => st.set({ asmId: a.id })}
                  className="cursor-pointer truncate p-0 text-left text-sm font-bold text-ink hover:text-teal-text"
                >
                  {a.name}
                </button>
                <span className="truncate text-sub">{a.compPathText}</span>
                <span className="whitespace-nowrap text-sub">{a.period}</span>
                <span className="whitespace-nowrap text-sub">{fmtDate(a.date)}</span>
                <span className="text-right">{a.max}</span>
                <span className="whitespace-nowrap text-right font-bold" style={{ color: a.progColor }}>
                  {a.progress}
                </span>
                <button
                  onClick={() => archiveAsm(a)}
                  title="Archive assessment"
                  className="h-7 w-7 cursor-pointer justify-self-end rounded-lg text-sm font-bold text-faint hover:bg-hairline hover:text-red-text"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        {archive.length > 0 && (
          <div className="flex-shrink-0 overflow-hidden rounded-2xl bg-card shadow-card">
            <button
              onClick={() => st.set({ archiveOpen: !st.archiveOpen })}
              className="label-caps flex w-full cursor-pointer items-center justify-between bg-canvas px-[18px] py-3 text-left text-sub"
            >
              <span>ARCHIVE · {archive.length}</span>
              <span className="text-xs font-semibold normal-case tracking-normal text-teal-text">
                {st.archiveOpen ? "Hide" : "Show"}
              </span>
            </button>
            {st.archiveOpen && (
              <>
                <div className="px-[18px] pt-2.5 text-xs leading-[1.5] text-sub">
                  Archived assessments are excluded from grade computation. Items are permanently
                  deleted after {ARCHIVE_DAYS} days unless restored.
                </div>
                {archiveRows.map((a) => (
                  <div
                    key={a.id}
                    className="grid h-[50px] grid-cols-[minmax(150px,2fr)_minmax(140px,1.6fr)_1fr_auto_auto] items-center gap-2 border-t border-hairline px-[18px] text-[13px] font-medium"
                  >
                    <span className="truncate font-bold text-ink">{a.name}</span>
                    <span className="truncate text-sub">
                      {a.compPathText} · {a.period}
                    </span>
                    <span className="whitespace-nowrap font-semibold" style={{ color: a.daysColor }}>
                      {a.daysText}
                    </span>
                    <button
                      onClick={() => restoreAsm(a.id)}
                      className="h-[30px] cursor-pointer whitespace-nowrap rounded-full border-[1.5px] border-line bg-card px-3 text-xs font-bold text-teal-text hover:border-teal"
                    >
                      Restore
                    </button>
                    <button
                      onClick={() => purgeAsm(a)}
                      className="h-[30px] cursor-pointer whitespace-nowrap rounded-full px-3 text-xs font-bold text-red-text hover:bg-red-tint-8"
                    >
                      Delete now
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Right: new assessment form + detail */}
      <div className="flex max-h-full min-h-0 flex-col gap-3.5 overflow-y-auto">
        <div className="flex flex-col gap-3.5 rounded-2xl bg-card p-5 shadow-card">
          <div className="font-display text-[17px] font-extrabold">New assessment</div>
          <input
            value={st.na.name}
            onChange={setNa("name")}
            placeholder={naSuggest}
            className="h-11 rounded-xl border-[1.5px] border-line bg-card px-3 text-sm font-medium outline-none focus:border-teal"
          />
          <div className="grid grid-cols-2 gap-2.5">
            <div className="flex min-w-0 flex-col gap-1.5">
              <label className="label-caps text-sub">COMPONENT</label>
              <select value={naComp} onChange={setNa("comp")} className={selectCls}>
                {compOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <label className="label-caps text-sub">PERIOD</label>
              <select value={naPeriod} onChange={setNa("period")} className={selectCls}>
                {periods.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="flex min-w-0 flex-col gap-1.5">
              <label className="label-caps text-sub">MAX SCORE</label>
              <input
                value={st.na.max}
                onChange={setNa("max")}
                className="h-11 rounded-xl border-[1.5px] border-line bg-card px-3 font-display text-base font-extrabold outline-none focus:border-teal"
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <label className="label-caps text-sub">WHEN</label>
              <div className="grid h-11 grid-cols-2 gap-[3px] rounded-xl border-[1.5px] border-line bg-canvas p-[3px]">
                {(
                  [
                    ["today", "Today", !st.na.later],
                    ["later", "Later", !!st.na.later],
                  ] as [string, string, boolean][]
                ).map(([k, label, on]) => (
                  <button
                    key={k}
                    onClick={() =>
                      st.set({
                        na: {
                          ...st.na,
                          later: k === "later",
                          date: k === "later" ? (st.na.date > todayIso ? st.na.date : todayIso) : todayIso,
                        },
                      })
                    }
                    className="min-w-0 cursor-pointer truncate rounded-[9px] text-xs font-bold"
                    style={{
                      background: on ? "#FFFFFF" : "transparent",
                      color: on ? "#0B807E" : "#5A6672",
                      boxShadow: on ? "0 1px 3px rgba(34,48,60,0.12)" : "none",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {naLater && (
            <div className="flex flex-col gap-1.5">
              <label className="label-caps text-sub">DATE</label>
              <input
                type="date"
                value={st.na.date}
                onChange={setNa("date")}
                className="h-11 rounded-xl border-[1.5px] border-line bg-card px-3 text-sm font-medium text-ink outline-none focus:border-teal"
              />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <label className="label-caps text-sub">
              COVERAGE AND REMINDERS{" "}
              <span className="font-medium tracking-normal">· shown to students</span>
            </label>
            <textarea
              value={st.na.notes}
              onChange={setNa("notes")}
              rows={2}
              placeholder="e.g. Chapters 3–5, bring a calculator. Room B-301."
              className="resize-none rounded-xl border-[1.5px] border-line bg-card px-3 py-2.5 text-[13px] leading-[1.5] text-ink outline-none focus:border-teal"
            />
          </div>
          {naFuture && (
            <div className="rounded-xl bg-teal-tint-12 px-3.5 py-2.5 text-[13px] font-medium leading-[1.5] text-teal-text">
              Scheduled {fmtDate(st.na.date)}. Students see it under Upcoming with a countdown
              until the date passes.
            </div>
          )}
          <button
            onClick={createNa}
            className="h-11 cursor-pointer rounded-xl text-sm font-bold text-white"
            style={{ background: naOk ? "#0FA3A0" : "#B8C0C6" }}
          >
            {naFuture ? "Schedule assessment" : "Create assessment"}
          </button>
          <div className="text-xs leading-[1.5] text-sub">
            Leave blank to name it &quot;{naSuggest}&quot;. Components come from your grading
            system.{" "}
            <button
              onClick={() => router.push(`/c/${cls.id}/settings`)}
              className="cursor-pointer p-0 text-xs font-bold text-teal-text"
            >
              Edit them in Settings
            </button>
            .
          </div>
        </div>
        {asmDetail}
      </div>
    </div>
  );
}
