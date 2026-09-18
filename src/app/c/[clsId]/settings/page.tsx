"use client";

import { useRouter } from "next/navigation";
import { use } from "react";
import { consultSummary, DEMO_INSTRUCTOR, honor, initialsOf } from "@/lib/derive";
import { periodOf, periodWeight, SCALES, shown, standing, txBase } from "@/lib/grading";
import { PRESETS, uid } from "@/lib/presets";
import { useClass, useUlat } from "@/lib/store";
import type { ScaleKind } from "@/lib/types";

const CDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const cardCls = "flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-card";
const sectionHead = (title: string, sub: string) => (
  <div className="px-0.5">
    <div className="font-display text-[17px] font-extrabold">{title}</div>
    <div className="mt-0.5 text-[13px] text-sub">{sub}</div>
  </div>
);
const numInput =
  "h-9 w-16 rounded-[10px] border-[1.5px] border-line bg-card px-2 text-right font-display text-[15px] font-extrabold outline-none focus:border-teal";

export default function SettingsPage({ params }: { params: Promise<{ clsId: string }> }) {
  const { clsId } = use(params);
  const router = useRouter();
  const st = useUlat();
  const cls = useClass(clsId);
  if (!cls) return null;

  const gs = cls.grading;
  const asms = cls.assessments;
  const periods = cls.periods;
  const closedP = cls.closed || {};
  const passing = Number(gs.passing) || 0;
  const base = txBase(gs);
  const groupTotal = gs.groups.reduce((a, g) => a + (Number(g.weight) || 0), 0);
  const upG = (fn: Parameters<typeof st.upGrading>[1]) => st.upGrading(cls.id, fn);
  const passingShownText = shown(gs, passing);
  const authName = st.auth.name || DEMO_INSTRUCTOR.name;
  const authEmail = st.auth.email || DEMO_INSTRUCTOR.email;

  /* ---- grading groups ---- */
  const asmCountFor = (gid: string) =>
    asms.filter((a) => gs.groups.find((g) => g.id === gid)?.comps.some((c) => c.id === a.comp)).length;

  /* ---- transmutation ---- */
  const TX: [number | null | "custom", string][] = [
    [null, "None"],
    [30, "Base 30"],
    [50, "Base 50"],
    [60, "Base 60"],
    [70, "Base 70"],
    ["custom", "Custom"],
  ];
  const txIsCustom = base !== null && ![30, 50, 60, 70].includes(base);
  const txNote =
    base === null
      ? "Component averages are used as they are, so 10 / 20 counts as 50%."
      : "Component % = raw % × " + (100 - base) + "% + " + base +
        ". A zero component still shows " + base +
        "%, and missed work stays a 0 raw score. For example, 10 / 20 becomes " +
        ((50 * (100 - base)) / 100 + base).toFixed(0) + "%.";

  const scaleNote = {
    "5pt": "The Philippine university scale. 1.00 is the highest, 3.00 is the usual passing line and 5.00 fails. Lower is better.",
    pct: "Students see the weighted percentage, such as 86. Common in DepEd report cards.",
    letter: "Students see A–F from the LETTER column. Higher is better.",
    gpa: "Students see the 4.0-scale number from the GPA column. Higher is better.",
  }[gs.scale];

  /* ---- term grade ---- */
  const termMethod = gs.termMethod === "cumulative" ? "cumulative" : "average";
  const isAverage = termMethod === "average";
  const avgOf = (vals: (number | null)[]) => {
    const v = vals.filter((x): x is number => x !== null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const perAvg = (p: string) =>
    avgOf(cls.roster.map((r) => periodOf(cls, gs, r.id, p)?.pct ?? null));
  const wsum = periods.reduce((a, p) => a + periodWeight(gs, periods, p), 0);

  /* ---- consultation ---- */
  const consult = cls.consult || { slots: [], note: "" };
  const upConsult = (fn: (c: typeof consult) => Partial<typeof consult>) =>
    st.upCls(cls.id, (c) => ({
      consult: { ...(c.consult || { slots: [], note: "" }), ...fn(c.consult || { slots: [], note: "" }) },
    }));

  /* ---- team ---- */
  const team = cls.team || [];
  const upTeam = (fn: (t: typeof team) => typeof team) =>
    st.upCls(cls.id, (c) => ({ team: fn(c.team || []) }));
  const inviteOk = /\S+@\S+\.\S+/.test(st.teamInvite);
  const inviteTeam = () => {
    if (!inviteOk) return;
    const em = st.teamInvite.trim().toLowerCase();
    const parts = em.split("@")[0].split(/[._-]/).filter(Boolean);
    const last = parts[parts.length - 1] || "Instructor";
    const nm =
      "Prof. " +
      (parts.length > 1 ? parts[0][0].toUpperCase() + ". " : "") +
      last[0].toUpperCase() +
      last.slice(1);
    const onUlat = /\.edu(\.ph)?$/.test(em);
    upTeam((tt) =>
      tt.some((x) => x.email === em)
        ? tt
        : [
            ...tt,
            {
              id: uid(),
              name: nm,
              email: em,
              status: onUlat ? ("active" as const) : ("invited" as const),
              groups: gs.groups.map((g) => g.id),
              attendance: true,
              students: false,
            },
          ],
    );
    st.set({ teamInvite: "" });
  };
  const tchip = (on: boolean) => ({
    background: on ? "#0FA3A0" : "#FFFFFF",
    color: on ? "#FFFFFF" : "#5A6672",
    border: `1.5px solid ${on ? "#0FA3A0" : "#E8E2D6"}`,
  });

  /* ---- this class ---- */
  const deleteCls = () =>
    st.confirm({
      title: "Delete " + cls.code + " · " + cls.section + "?",
      body: "Grades, attendance, assessments and the roster are removed for good. Students and guardians lose access immediately. This cannot be undone.",
      confirmLabel: "Delete class",
      danger: true,
      onConfirm: () => {
        const rest = st.classes.filter((c) => c.id !== cls.id);
        const nx = rest.find((c) => !c.archived) || rest[0];
        st.set({ classes: rest });
        router.push(nx ? `/c/${nx.id}/overview` : "/new");
      },
    });

  const segBtn = (on: boolean): React.CSSProperties => ({
    background: on ? "#0FA3A0" : "transparent",
    color: on ? "#FFFFFF" : "#5A6672",
  });

  return (
    <div
      data-tour="settings"
      className="-mr-2 flex min-h-0 flex-1 flex-col gap-7 overflow-y-auto pr-2"
    >
      {/* 1 · Grading components */}
      <div className="mx-auto w-full flex max-w-[960px] flex-col gap-3">
        <div className="flex items-center justify-between gap-4 px-0.5">
          <div>
            <div className="font-display text-[17px] font-extrabold">Grading components</div>
            <div className="mt-0.5 whitespace-nowrap text-[13px] text-sub">
              Assessments pick from this list.
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1.5">
            <span className="whitespace-nowrap text-xs font-medium text-sub">
              Replace with preset
            </span>
            {PRESETS.map((p) => (
              <button
                key={p.name}
                onClick={() => upG(() => p.make())}
                className="h-[30px] cursor-pointer whitespace-nowrap rounded-full border border-line bg-card px-3 text-xs font-semibold text-sub hover:border-teal hover:text-teal-text"
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(380px,1fr))] items-start gap-3">
          {gs.groups.map((g) => {
            const sum = g.comps.reduce((a, c) => a + (Number(c.w) || 0), 0);
            return (
              <div key={g.id} className="flex flex-col gap-2 rounded-2xl bg-card px-4 py-3.5 shadow-card">
                <div className="grid grid-cols-[1fr_96px_32px] items-center gap-2">
                  <input
                    value={g.name}
                    onChange={(e) =>
                      upG((x) => ({
                        groups: x.groups.map((y) => (y.id === g.id ? { ...y, name: e.target.value } : y)),
                      }))
                    }
                    className="h-[38px] rounded-[10px] border-[1.5px] border-transparent bg-canvas px-2.5 font-display text-[15px] font-extrabold text-ink outline-none focus:border-teal"
                  />
                  {gs.groups.length > 1 ? (
                    <div className="flex items-center justify-end gap-1.5">
                      <input
                        value={g.weight}
                        onChange={(e) =>
                          upG((x) => ({
                            groups: x.groups.map((y) =>
                              y.id === g.id ? { ...y, weight: e.target.value.replace(/[^0-9]/g, "") } : y,
                            ),
                          }))
                        }
                        className={numInput}
                      />
                      <span className="w-3.5 text-[13px] font-bold text-sub">%</span>
                    </div>
                  ) : (
                    <span />
                  )}
                  <button
                    onClick={() =>
                      upG((x) => ({
                        groups: x.groups.length > 1 ? x.groups.filter((y) => y.id !== g.id) : x.groups,
                      }))
                    }
                    title="Remove group"
                    className="h-8 w-8 cursor-pointer rounded-[10px] text-[15px] font-bold text-faint hover:bg-hairline hover:text-sub"
                  >
                    ×
                  </button>
                </div>
                {g.comps.map((c) => (
                  <div key={c.id} className="grid grid-cols-[1fr_96px_32px] items-center gap-2">
                    <input
                      value={c.name}
                      onChange={(e) =>
                        upG((x) => ({
                          groups: x.groups.map((y) =>
                            y.id === g.id
                              ? {
                                  ...y,
                                  comps: y.comps.map((z) =>
                                    z.id === c.id
                                      ? { ...z, name: e.target.value, exam: /exam|final|midterm/i.test(e.target.value) }
                                      : z,
                                  ),
                                }
                              : y,
                          ),
                        }))
                      }
                      className="h-9 rounded-[10px] border-[1.5px] border-line bg-card px-2.5 text-sm font-medium text-ink outline-none focus:border-teal"
                    />
                    <div className="flex items-center justify-end gap-1.5">
                      <input
                        value={c.w}
                        onChange={(e) =>
                          upG((x) => ({
                            groups: x.groups.map((y) =>
                              y.id === g.id
                                ? {
                                    ...y,
                                    comps: y.comps.map((z) =>
                                      z.id === c.id ? { ...z, w: e.target.value.replace(/[^0-9]/g, "") } : z,
                                    ),
                                  }
                                : y,
                            ),
                          }))
                        }
                        className="h-9 w-16 rounded-[10px] border-[1.5px] border-line bg-card px-2 text-right text-sm font-bold outline-none focus:border-teal"
                      />
                      <span className="w-3.5 text-[13px] font-bold text-sub">%</span>
                    </div>
                    <button
                      onClick={() =>
                        upG((x) => ({
                          groups: x.groups.map((y) =>
                            y.id === g.id ? { ...y, comps: y.comps.filter((z) => z.id !== c.id) } : y,
                          ),
                        }))
                      }
                      className="h-8 w-8 cursor-pointer rounded-[10px] text-[15px] font-bold text-faint hover:bg-hairline hover:text-sub"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-1">
                  <button
                    onClick={() =>
                      upG((x) => ({
                        groups: x.groups.map((y) =>
                          y.id === g.id
                            ? { ...y, comps: [...y.comps, { id: uid(), name: "New component", w: 0, exam: false }] }
                            : y,
                        ),
                      }))
                    }
                    className="h-8 cursor-pointer whitespace-nowrap rounded-full border-[1.5px] border-dashed border-[#D9D3C7] px-3 text-[13px] font-semibold text-teal-text"
                  >
                    + Component
                  </button>
                  <span
                    className="text-[13px] font-semibold"
                    style={{ color: sum === 100 ? "#0B807E" : "#B03A24" }}
                  >
                    Total {sum}% · {asmCountFor(g.id)} assessments
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between px-0.5">
          <button
            onClick={() =>
              upG((x) => ({
                groups: [
                  ...x.groups.map((g) => (x.groups.length === 1 ? { ...g, weight: 60 } : g)),
                  {
                    id: uid(),
                    name: x.groups.length === 1 ? "Laboratory" : "New group",
                    weight: x.groups.length === 1 ? 40 : 0,
                    comps: [
                      { id: uid(), name: "Quiz", w: 50, exam: false },
                      { id: uid(), name: "Exam", w: 50, exam: true },
                    ],
                  },
                ],
              }))
            }
            className="h-[38px] cursor-pointer whitespace-nowrap rounded-xl border-[1.5px] border-teal bg-card px-4 text-[13px] font-bold text-teal-text"
          >
            + Group (e.g. Laboratory)
          </button>
          <span
            className="text-[13px] font-semibold"
            style={{ color: gs.groups.length > 1 && groupTotal !== 100 ? "#B03A24" : "#0B807E" }}
          >
            {gs.groups.length > 1
              ? "Group equivalents total " + groupTotal + "%"
              : "One group · weights apply directly"}
          </span>
        </div>
      </div>

      {/* 2+3+4+5 · Scale / periods / term / consultation */}
      <div className="mx-auto w-full grid max-w-[960px] grid-cols-2 items-start gap-5">
        <div className="flex flex-col gap-3">
          {sectionHead("Scale and passing", "What students and guardians see.")}
          <div className={cardCls}>
            <div className="grid grid-cols-4 gap-1 rounded-xl border border-line bg-canvas p-1">
              {SCALES.map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => upG(() => ({ scale: k as ScaleKind }))}
                  className="h-8 cursor-pointer whitespace-nowrap rounded-[9px] px-1.5 text-xs font-bold"
                  style={segBtn(gs.scale === k)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="text-[13px] leading-[1.5] text-sub">{scaleNote}</div>
            <div className="flex items-center justify-between border-t border-line pt-2.5 text-sm font-medium">
              <span>Passing mark</span>
              <div className="flex items-center gap-1.5">
                <input
                  value={gs.passing}
                  onChange={(e) => upG(() => ({ passing: e.target.value.replace(/[^0-9.]/g, "") }))}
                  className={numInput}
                />
                <span className="whitespace-nowrap text-[13px] font-bold text-sub">
                  % → <span className="text-teal-text">{passingShownText}</span>
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm font-medium">
              <span>&quot;At risk&quot; band</span>
              <div className="flex items-center gap-1.5">
                <input
                  value={gs.riskBand}
                  onChange={(e) => upG(() => ({ riskBand: e.target.value.replace(/[^0-9.]/g, "") }))}
                  className={numInput}
                />
                <span className="whitespace-nowrap text-[13px] font-bold text-sub">
                  pts above passing
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2 border-t border-line pt-2.5">
              <div className="flex items-center justify-between text-sm font-medium">
                <span>Transmutation</span>
                <span className="text-xs font-medium text-sub">
                  Carreon-style, on each component average
                </span>
              </div>
              <div className="grid grid-cols-6 gap-1 rounded-xl border border-line bg-canvas p-1">
                {TX.map(([k, label]) => {
                  const on = k === "custom" ? txIsCustom : k === base && !txIsCustom;
                  return (
                    <button
                      key={label}
                      onClick={() => upG(() => ({ transmute: k === "custom" ? 40 : k }))}
                      className="h-8 cursor-pointer whitespace-nowrap rounded-[9px] px-1 text-xs font-bold"
                      style={segBtn(on)}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              {txIsCustom && (
                <div className="flex items-center justify-between text-sm font-medium">
                  <span>Custom base</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      value={gs.transmute ?? ""}
                      onChange={(e) => upG(() => ({ transmute: e.target.value.replace(/[^0-9]/g, "") }))}
                      className={numInput}
                    />
                    <span className="whitespace-nowrap text-[13px] font-bold text-sub">
                      for a zero score
                    </span>
                  </div>
                </div>
              )}
              <div className="text-[13px] leading-[1.5] text-sub">{txNote}</div>
            </div>
          </div>
          <div className="mt-2 px-0.5">
            <div className="font-display text-[17px] font-extrabold">Consultation hours</div>
            <div className="mt-0.5 text-[13px] text-sub">
              Shown in the student app. Students you flag for consultation are notified with these
              hours.
            </div>
          </div>
          <div className={cardCls}>
            {consult.slots.map((s, i) => (
              <div key={s.id} className="flex flex-col gap-2 border-b border-hairline pb-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex gap-1">
                    {CDAYS.map((d) => {
                      const on = s.days.includes(d);
                      return (
                        <button
                          key={d}
                          onClick={() =>
                            upConsult((c) => ({
                              slots: c.slots.map((x, j) =>
                                j === i
                                  ? {
                                      ...x,
                                      days: on
                                        ? x.days.filter((y) => y !== d)
                                        : CDAYS.filter((y) => x.days.includes(y) || y === d),
                                    }
                                  : x,
                              ),
                            }))
                          }
                          className="h-[30px] w-[38px] cursor-pointer rounded-lg text-xs font-bold"
                          style={{
                            border: `1px solid ${on ? "#0FA3A0" : "#E8E2D6"}`,
                            background: on ? "#0FA3A0" : "#FFFFFF",
                            color: on ? "#FFFFFF" : "#5A6672",
                          }}
                        >
                          {d === "Thu" ? "Th" : d[0] === "S" ? "Sa" : d[0]}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => upConsult((c) => ({ slots: c.slots.filter((_, j) => j !== i) }))}
                    className="h-7 w-7 cursor-pointer rounded-lg text-sm font-bold text-faint hover:bg-hairline hover:text-red-text"
                  >
                    ×
                  </button>
                </div>
                <div className="grid grid-cols-[auto_auto_1fr] items-center gap-2">
                  <input
                    type="time"
                    value={s.start}
                    onChange={(e) =>
                      upConsult((c) => ({
                        slots: c.slots.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)),
                      }))
                    }
                    className="h-9 rounded-[10px] border-[1.5px] border-line bg-card px-2 text-[13px] font-semibold text-ink outline-none focus:border-teal"
                  />
                  <input
                    type="time"
                    value={s.end}
                    onChange={(e) =>
                      upConsult((c) => ({
                        slots: c.slots.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)),
                      }))
                    }
                    className="h-9 rounded-[10px] border-[1.5px] border-line bg-card px-2 text-[13px] font-semibold text-ink outline-none focus:border-teal"
                  />
                  <input
                    value={s.where}
                    onChange={(e) =>
                      upConsult((c) => ({
                        slots: c.slots.map((x, j) => (j === i ? { ...x, where: e.target.value } : x)),
                      }))
                    }
                    placeholder="Where, or a meeting link"
                    className="h-9 min-w-0 rounded-[10px] border-[1.5px] border-line bg-card px-2.5 text-[13px] font-medium text-ink outline-none focus:border-teal"
                  />
                </div>
              </div>
            ))}
            <button
              onClick={() =>
                upConsult((c) => ({
                  slots: [...c.slots, { id: uid(), days: [], start: "15:00", end: "16:00", where: "" }],
                }))
              }
              className="h-8 cursor-pointer self-start whitespace-nowrap rounded-full border-[1.5px] border-dashed border-[#D9D3C7] px-3 text-[13px] font-semibold text-teal-text"
            >
              + Time slot
            </button>
            <input
              value={consult.note}
              onChange={(e) => upConsult(() => ({ note: e.target.value }))}
              placeholder="Note to students, e.g. message me first to confirm"
              className="h-9 rounded-[10px] border-[1.5px] border-line bg-card px-2.5 text-[13px] font-medium text-ink outline-none focus:border-teal"
            />
            <div className="text-xs font-medium leading-[1.5] text-sub">
              Students see: <b className="text-ink">{consultSummary(cls)}</b>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {sectionHead("Periods and joining", "Grading periods drive the tabs in Gradebook and Assessments.")}
          <div className={cardCls}>
            <div className="flex flex-wrap items-center gap-1.5">
              {periods.map((p, i) => (
                <span
                  key={p}
                  className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-canvas pl-3.5 pr-1.5 text-[13px] font-semibold"
                >
                  {p}
                  <button
                    onClick={() =>
                      st.upCls(cls.id, (c) => ({ periods: c.periods.filter((_, j) => j !== i) }))
                    }
                    className="h-6 w-6 cursor-pointer rounded-full bg-hairline text-[13px] font-bold text-sub"
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                onKeyDown={(e) => {
                  const target = e.target as HTMLInputElement;
                  if (e.key === "Enter" && target.value.trim()) {
                    const v = target.value.trim();
                    st.upCls(cls.id, (c) => ({
                      periods: c.periods.includes(v) ? c.periods : [...c.periods, v],
                    }));
                    target.value = "";
                  }
                }}
                placeholder="Add period, press Enter"
                className="h-9 w-[190px] rounded-full border-[1.5px] border-dashed border-[#D9D3C7] bg-transparent px-3.5 text-[13px] font-medium outline-none focus:border-teal"
              />
            </div>
            <div className="flex items-center justify-between border-t border-line pt-2.5 text-sm font-medium">
              <span>Class code for joining</span>
              <span className="rounded-lg border border-line bg-canvas px-2.5 py-1 font-display text-base font-extrabold tracking-[1px]">
                {cls.joinCode}
              </span>
            </div>
          </div>

          <div className="mt-2 px-0.5">
            <div className="font-display text-[17px] font-extrabold">Term grade</div>
            <div className="mt-0.5 text-[13px] text-sub">
              How period grades combine into the final grade, and which periods are closed.
            </div>
          </div>
          <div className={cardCls}>
            <div className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-canvas p-1">
              {(
                [
                  ["average", "Average of periods"],
                  ["cumulative", "Cumulative"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => upG(() => ({ termMethod: k }))}
                  className="h-[34px] cursor-pointer rounded-[9px] text-[13px] font-bold"
                  style={{
                    background: termMethod === k ? "#FFFFFF" : "transparent",
                    color: termMethod === k ? "#0B807E" : "#5A6672",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="text-xs leading-[1.5] text-sub">
              {termMethod === "average"
                ? "Each period is graded on its own. The term grade is the weighted average of the periods graded so far."
                : "All assessments pool into one running grade; component weights apply across the whole term."}
            </div>
            {periods.map((p) => {
              const n = asms.filter((a) => a.period === p).length;
              const a = perAvg(p);
              const closed = !!closedP[p];
              return (
                <div
                  key={p}
                  className="grid grid-cols-[1fr_84px_auto] items-center gap-2 border-t border-hairline pt-2.5"
                >
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold">{p}</div>
                    <div className="text-xs text-sub">
                      {n
                        ? n + " assessment" + (n === 1 ? "" : "s") +
                          (a === null ? "" : " · class average " + a.toFixed(1) + "%")
                        : "No assessments yet"}
                    </div>
                  </div>
                  {isAverage ? (
                    <div className="flex items-center gap-1">
                      <input
                        value={String(periodWeight(gs, periods, p))}
                        onChange={(e) =>
                          upG((x) => ({
                            periodWeights: {
                              ...(x.periodWeights || {}),
                              [p]: e.target.value.replace(/[^0-9]/g, ""),
                            },
                          }))
                        }
                        className="h-9 w-[60px] rounded-[10px] border-[1.5px] border-line bg-card px-2 text-right text-[13px] font-semibold text-ink outline-none focus:border-teal"
                      />
                      <span className="text-xs font-semibold text-sub">%</span>
                    </div>
                  ) : (
                    <span />
                  )}
                  <button
                    onClick={() =>
                      st.upCls(cls.id, (c) => ({ closed: { ...(c.closed || {}), [p]: !closed } }))
                    }
                    className="h-9 cursor-pointer whitespace-nowrap rounded-xl px-3 text-xs font-semibold"
                    style={{
                      border: `1.5px solid ${closed ? "transparent" : "#E8E2D6"}`,
                      background: closed ? "rgba(15,163,160,0.12)" : "#FFFFFF",
                      color: closed ? "#0B807E" : "#5A6672",
                    }}
                  >
                    {closed ? "Final · reopen" : "Mark final"}
                  </button>
                </div>
              );
            })}
            {isAverage && (
              <div
                className="text-xs font-semibold"
                style={{ color: wsum === 100 ? "#0B807E" : "#B03A24" }}
              >
                {wsum === 100
                  ? "Weights total 100%"
                  : "Weights total " + wsum + "% — they should add up to 100%"}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* 6 · Transmutation table */}
      <div className="mx-auto w-full flex max-w-[960px] flex-col gap-3">
        <div className="flex items-center justify-between px-0.5">
          <div>
            <div className="font-display text-[17px] font-extrabold">Transmutation table</div>
            <div className="mt-0.5 text-[13px] text-sub">
              Rows read top-down: the first row whose FROM % is met gives the grade. Tinted rows are
              passing.
            </div>
          </div>
          <button
            onClick={() =>
              upG((x) => ({ table: [...x.table, { id: uid(), lo: 0, grade: "", letter: "", gpa: "" }] }))
            }
            className="h-[30px] cursor-pointer whitespace-nowrap rounded-full border border-line bg-card px-3 text-xs font-semibold text-teal-text hover:border-teal"
          >
            + Row
          </button>
        </div>
        <div className="flex flex-col gap-1.5 rounded-2xl bg-card px-4 pb-4 pt-2 shadow-card">
          <div className="label-caps mb-1 grid grid-cols-[120px_1fr_1fr_1fr_32px] gap-2.5 border-b border-line px-1 pb-1.5 pt-2 text-sub">
            <span>FROM %</span>
            <span>NUMERIC</span>
            <span>LETTER</span>
            <span>GPA 4.0</span>
            <span />
          </div>
          {gs.table.map((t) => {
            const k = standing(gs, Number(t.lo), false);
            const bg = k === "pass" ? "rgba(15,163,160,0.12)" : k === "risk" ? "rgba(245,183,10,0.16)" : "#FFFFFF";
            const cell =
              "h-[34px] rounded-lg border-[1.5px] border-line px-2.5 font-display text-[13px] font-extrabold outline-none focus:border-teal";
            const upT = (patch: Partial<typeof t>) =>
              upG((x) => ({ table: x.table.map((y) => (y.id === t.id ? { ...y, ...patch } : y)) }));
            return (
              <div key={t.id} className="grid grid-cols-[120px_1fr_1fr_1fr_32px] items-center gap-2.5">
                <input
                  value={t.lo}
                  onChange={(e) => upT({ lo: e.target.value.replace(/[^0-9.]/g, "") })}
                  className="h-[34px] rounded-lg border-[1.5px] border-line bg-card px-2.5 text-[13px] font-semibold outline-none focus:border-teal"
                />
                <input value={t.grade} onChange={(e) => upT({ grade: e.target.value })} className={cell} style={{ background: bg }} />
                <input value={t.letter} onChange={(e) => upT({ letter: e.target.value })} className={`${cell} bg-card`} />
                <input value={t.gpa} onChange={(e) => upT({ gpa: e.target.value })} className={`${cell} bg-card`} />
                <button
                  onClick={() =>
                    upG((x) => ({ table: x.table.length > 2 ? x.table.filter((y) => y.id !== t.id) : x.table }))
                  }
                  className="h-7 w-7 cursor-pointer rounded-lg text-sm font-bold text-faint hover:bg-hairline"
                >
                  ×
                </button>
              </div>
            );
          })}
          <div className="mt-1.5 text-xs leading-[1.5] text-sub">
            Ungraded work = &quot;—&quot; and is left out of the %. EXC is excluded. A student is
            INC while an exam-type item is ungraded.
          </div>
        </div>
      </div>

      {/* 7 · Instructors */}
      <div className="mx-auto w-full flex max-w-[960px] flex-col gap-3">
        {sectionHead(
          "Instructors",
          "Team teaching is optional. If the other instructor is not on Ulat, keep recording their part here yourself.",
        )}
        <div className="flex flex-col gap-3.5 rounded-2xl bg-card p-4 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-full bg-teal text-[13px] font-bold text-white">
                {initialsOf(authName)}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold">{authName}</div>
                <div className="text-xs text-sub">{authEmail}</div>
              </div>
            </div>
            <span className="rounded-full bg-ink px-2.5 py-1 text-xs font-bold text-canvas">
              Owner
            </span>
          </div>

          {team.map((m) => {
            const nAsm = asms.filter((a) => a.by === m.id).length;
            const active = m.status === "active";
            return (
              <div key={m.id} className="flex flex-col gap-2.5 border-t border-hairline pt-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-full bg-teal-tint-12 text-[13px] font-bold text-teal-text">
                      {m.name.replace(/^\w+\.\s*/, "").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold">{m.name}</div>
                      <div className="text-xs text-sub">{m.email}</div>
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <span
                      className="rounded-full px-2.5 py-1 text-xs font-bold"
                      style={{
                        background: active ? "rgba(15,163,160,0.12)" : "rgba(245,183,10,0.16)",
                        color: active ? "#0B807E" : "#8A6400",
                      }}
                    >
                      {active ? "Co-instructor" : "Invited · not on Ulat yet"}
                    </span>
                    <button
                      onClick={() =>
                        st.confirm({
                          title: "Remove " + m.name + " from " + cls.code + "?",
                          body: "They lose access right away. Assessments and scores they recorded stay in the class.",
                          confirmLabel: "Remove",
                          danger: true,
                          onConfirm: () => upTeam((tt) => tt.filter((x) => x.id !== m.id)),
                        })
                      }
                      className="h-[30px] cursor-pointer rounded-[10px] px-2.5 text-xs font-semibold text-red-text hover:bg-red-tint-8"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {gs.groups.length > 1 ? (
                    <>
                      <span className="label-caps mr-1 text-sub">CAN GRADE</span>
                      {gs.groups.map((g) => {
                        const on = m.groups.includes(g.id);
                        return (
                          <button
                            key={g.id}
                            onClick={() =>
                              upTeam((tt) =>
                                tt.map((x) =>
                                  x.id === m.id
                                    ? {
                                        ...x,
                                        groups: on
                                          ? x.groups.filter((i) => i !== g.id)
                                          : [...x.groups, g.id],
                                      }
                                    : x,
                                ),
                              )
                            }
                            className="h-[30px] cursor-pointer rounded-full px-3 text-xs font-semibold"
                            style={tchip(on)}
                          >
                            {g.name}
                          </button>
                        );
                      })}
                      <span className="label-caps mx-1 ml-2.5 text-sub">CAN ALSO</span>
                    </>
                  ) : (
                    <span className="label-caps mr-1 text-sub">
                      CAN GRADE ALL ASSESSMENTS · CAN ALSO
                    </span>
                  )}
                  {(
                    [
                      ["attendance", "Attendance"],
                      ["students", "Remarks and flags"],
                    ] as const
                  ).map(([k, label]) => (
                    <button
                      key={k}
                      onClick={() =>
                        upTeam((tt) => tt.map((x) => (x.id === m.id ? { ...x, [k]: !x[k] } : x)))
                      }
                      className="h-[30px] cursor-pointer rounded-full px-3 text-xs font-semibold"
                      style={tchip(!!m[k])}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="text-xs leading-[1.5] text-sub">
                  {active
                    ? nAsm
                      ? nAsm + " assessment" + (nAsm === 1 ? "" : "s") + " recorded by " + honor(m.name) + " so far."
                      : "No assessments recorded by " + honor(m.name) + " yet."
                    : "Until they accept, record their part yourself. Everything you enter stays in this class either way."}
                </div>
              </div>
            );
          })}

          <div className="flex gap-2 border-t border-hairline pt-3.5">
            <input
              value={st.teamInvite}
              onChange={(e) => st.set({ teamInvite: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && inviteTeam()}
              placeholder="co-instructor@school.edu.ph"
              className="h-10 flex-1 rounded-xl border-[1.5px] border-line bg-card px-3 text-[13px] font-medium text-ink outline-none focus:border-teal"
            />
            <button
              onClick={inviteTeam}
              className="h-10 cursor-pointer whitespace-nowrap rounded-xl px-4 text-[13px] font-bold text-white"
              style={{ background: inviteOk ? "#0FA3A0" : "#B8C0C6" }}
            >
              Invite co-instructor
            </button>
          </div>
          <div className="text-xs leading-[1.5] text-sub">
            Co-instructors see the whole class. Where a class has separate groups (lecture, lab),
            they can only create and score assessments in the groups you tick. They can never delete
            or archive the class, change the grading system, or edit sharing consent.
          </div>
        </div>
      </div>

      {/* 8 · This class */}
      <div className="mx-auto w-full flex max-w-[960px] flex-col gap-3 pb-2">
        {sectionHead("This class", cls.code + " · " + cls.section + " · " + cls.term)}
        <div className={cardCls}>
          <div className="flex items-center justify-between gap-4">
            <div className="text-[13px] leading-[1.5] text-sub">
              {cls.archived
                ? "Archived classes are read-only for students and hidden from the main list."
                : "Archive when the term ends. Grades stay viewable; the class leaves the main list."}
            </div>
            <button
              onClick={() => st.upCls(cls.id, (c) => ({ archived: !c.archived }))}
              className="h-9 flex-shrink-0 cursor-pointer whitespace-nowrap rounded-xl border-[1.5px] border-line bg-card px-3.5 text-[13px] font-bold text-ink hover:border-teal hover:text-teal-text"
            >
              {cls.archived ? "Restore class" : "Archive class"}
            </button>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-line pt-3">
            <div className="text-[13px] leading-[1.5] text-sub">
              Deleting removes grades, attendance and the roster permanently. Students lose access
              immediately.
            </div>
            <button
              onClick={deleteCls}
              className="h-9 flex-shrink-0 cursor-pointer whitespace-nowrap rounded-xl border-[1.5px] bg-card px-3.5 text-[13px] font-bold text-red-text hover:bg-red-tint-8"
              style={{ borderColor: "rgba(209,75,51,0.4)" }}
            >
              Delete class
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
