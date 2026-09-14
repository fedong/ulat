"use client";

import { use, useEffect } from "react";
import { fmtDate } from "@/lib/derive";
import { ATT_COLORS, ATT_CYCLE, attColor, attRate, compById } from "@/lib/grading";
import { today, useClass, useUlat } from "@/lib/store";
import type { AttMark, Klass, Score, Session } from "@/lib/types";

const asmGroup = (cls: Klass, comp: string) => {
  const r = compById(cls.grading, comp);
  return r ? cls.grading.groups.find((g) => g.comps.some((c) => c.id === r.c.id))?.id ?? null : null;
};
const linked = (cls: Klass, s: Session, a: { date: string; comp: string }) =>
  a.date === s.date && (!s.group || asmGroup(cls, a.comp) === s.group);

export default function AttendancePage({ params }: { params: Promise<{ clsId: string }> }) {
  const { clsId } = use(params);
  const st = useUlat();
  const cls = useClass(clsId);

  useEffect(() => {
    if (!useUlat.getState().newSessionDate) st.set({ newSessionDate: today() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!cls) return null;
  const gs = cls.grading;
  const roster = cls.roster;
  const multiGroup = gs.groups.length > 1;
  const gShort = (id?: string) => {
    const g = gs.groups.find((x) => x.id === id);
    return g ? g.name.slice(0, 3) : "";
  };
  const sesGroup = gs.groups.some((g) => g.id === st.newSessionGroup) ? st.newSessionGroup : null;

  const allMarks = cls.sessions.flatMap((s) => roster.map((r) => s.marks[r.id] || "P"));
  const legend = (["P", "L", "A", "E"] as const).map((k) => ({
    n: allMarks.filter((x) => x === k).length,
    label: ATT_COLORS[k][2],
    bg: ATT_COLORS[k][0],
    color: ATT_COLORS[k][1],
  }));

  const sortSes = (ss: Session[]) =>
    ss.sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        gs.groups.findIndex((g) => g.id === a.group) - gs.groups.findIndex((g) => g.id === b.group),
    );

  const addSession = () => {
    if (
      !st.newSessionDate ||
      cls.sessions.some((s) => s.date === st.newSessionDate && (s.group || null) === sesGroup)
    )
      return;
    st.upCls(cls.id, (c) => ({
      sessions: sortSes([
        ...c.sessions,
        {
          date: st.newSessionDate,
          group: sesGroup || undefined,
          marks: Object.fromEntries(c.roster.map((r) => [r.id, "P" as AttMark])),
        },
      ]),
    }));
  };

  const tap = (sid: string, si: number) => {
    st.upCls(cls.id, (c) => {
      const s = c.sessions[si];
      const k = s.marks[sid] || "P";
      const nk = ATT_CYCLE[k];
      const auto: Partial<Record<AttMark, Score>> = { A: "MISSED", E: "EXC" };
      const scores = { ...c.scores };
      const mine = { ...(scores[sid] || {}) };
      let touched = false;
      // Carry A/E into same-day assessments of the matching group, unless hand-edited.
      c.assessments
        .filter((a) => linked(c, s, a))
        .forEach((a) => {
          const cur = mine[a.id];
          const wasAuto = cur === undefined || cur === null || cur === auto[k];
          if (!wasAuto) return;
          if (auto[nk]) {
            mine[a.id] = auto[nk];
            touched = true;
          } else if (cur === auto[k]) {
            delete mine[a.id];
            touched = true;
          }
        });
      if (touched) scores[sid] = mine;
      return {
        sessions: c.sessions.map((x, j) =>
          j === si ? { ...x, marks: { ...x.marks, [sid]: nk } } : x,
        ),
        scores,
      };
    });
  };

  const cw = cls.sessions.some((s) => s.group) ? 84 : 72;
  const attCols = `200px repeat(${Math.max(1, cls.sessions.length)},minmax(${cw}px,1fr)) 90px`;
  const attMinW = 200 + Math.max(1, cls.sessions.length) * cw + 90 + "px";

  return (
    <>
      <div className="mb-3.5 flex flex-shrink-0 items-center justify-between gap-3">
        <div className="flex gap-1.5">
          {legend.map((a) => (
            <span
              key={a.label}
              className="inline-flex h-[34px] items-center gap-1 whitespace-nowrap rounded-full px-3 text-[13px] font-bold"
              style={{ background: a.bg, color: a.color }}
            >
              {a.n} {a.label}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="whitespace-nowrap text-[13px] font-medium text-sub">New session</span>
          {multiGroup &&
            (
              [
                [null, "Whole class"],
                ...gs.groups.map((g) => [g.id, g.name] as [string, string]),
              ] as [string | null, string][]
            ).map(([id, label]) => {
              const on = sesGroup === id;
              return (
                <button
                  key={label}
                  onClick={() => st.set({ newSessionGroup: id })}
                  className="h-9 cursor-pointer whitespace-nowrap rounded-full px-3 text-xs font-semibold"
                  style={{
                    border: `1.5px solid ${on ? "#0FA3A0" : "#E8E2D6"}`,
                    background: on ? "#0FA3A0" : "#FFFFFF",
                    color: on ? "#FFFFFF" : "#5A6672",
                  }}
                >
                  {label}
                </button>
              );
            })}
          <input
            type="date"
            value={st.newSessionDate}
            onChange={(e) => st.set({ newSessionDate: e.target.value })}
            className="h-9 rounded-xl border-[1.5px] border-line bg-card px-2.5 text-[13px] font-medium text-ink outline-none focus:border-teal"
          />
          <button
            onClick={addSession}
            className="h-9 cursor-pointer whitespace-nowrap rounded-xl bg-teal px-3.5 text-[13px] font-bold text-white"
          >
            + Add · all present
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-shrink flex-col overflow-hidden rounded-2xl bg-card shadow-card">
        <div className="min-h-0 flex-1 overflow-auto">
          <div style={{ minWidth: attMinW }}>
            <div
              className="sticky top-0 z-[1] grid border-b border-line bg-canvas"
              style={{ gridTemplateColumns: attCols }}
            >
              <div className="label-caps sticky left-0 flex items-center gap-1 bg-canvas px-[18px] py-3 text-sub">
                STUDENT · {cls.sessions.length} SESSIONS
              </div>
              {cls.sessions.map((s, si) => {
                const dt = new Date(s.date + "T00:00:00");
                return (
                  <div key={si} className="flex flex-col items-center gap-px px-1 py-2">
                    <div
                      className="whitespace-nowrap text-xs font-bold"
                      style={{ color: si === cls.sessions.length - 1 ? "#0B807E" : "#5A6672" }}
                    >
                      {fmtDate(s.date)}
                    </div>
                    <div className="flex items-center gap-0.5">
                      <span className="whitespace-nowrap text-[11px] font-medium text-faint">
                        {dt.toLocaleDateString("en-US", { weekday: "short" }) +
                          (s.group ? " · " + gShort(s.group) : "")}
                      </span>
                      <button
                        onClick={() =>
                          st.upCls(cls.id, (c) => ({
                            sessions: c.sessions.filter((_, j) => j !== si),
                          }))
                        }
                        title="Remove session"
                        className="h-[18px] w-[18px] cursor-pointer rounded-md p-0 text-xs font-bold leading-none text-disabled hover:bg-hairline hover:text-red-text"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                );
              })}
              <div className="label-caps flex items-center justify-center px-2 py-3 text-sub">
                RATE
              </div>
            </div>

            {roster.map((r) => {
              const rate = attRate(cls, r.id);
              return (
                <div
                  key={r.id}
                  className="grid items-center border-b border-hairline"
                  style={{ gridTemplateColumns: attCols }}
                >
                  <div className="sticky left-0 flex h-[46px] items-center whitespace-nowrap bg-card px-[18px] text-sm font-semibold">
                    {r.name}
                  </div>
                  {cls.sessions.map((s, si) => {
                    const k = (s.marks[r.id] || "P") as AttMark;
                    return (
                      <button
                        key={si}
                        onClick={() => tap(r.id, si)}
                        className="mx-[5px] h-8 cursor-pointer rounded-lg text-xs font-bold"
                        style={{ background: ATT_COLORS[k][0], color: ATT_COLORS[k][1] }}
                      >
                        {k}
                      </button>
                    );
                  })}
                  <div className="text-center text-sm font-bold" style={{ color: attColor(rate) }}>
                    {rate}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-3 flex-shrink-0 text-xs font-medium text-sub">
        Click a cell to cycle P → L → A → E. Excused never lowers the rate. Marking Absent or
        Excused also fills that day&apos;s assessments with 0 missed or EXC, unless a score was
        already typed in.
      </div>
    </>
  );
}
