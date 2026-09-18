"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AnimatedLogo } from "@/components/AnimatedLogo";
import { ConfirmDialogHost } from "@/components/ConfirmDialogHost";
import { billingStrings } from "@/lib/billing";
import { DEMO_INSTRUCTOR, profileShownName } from "@/lib/derive";
import { scaleLabel, SCALES, shown, standing, txBase } from "@/lib/grading";
import { useEntitlement, useMounted } from "@/lib/hooks";
import { PRESETS, uid } from "@/lib/presets";
import { profileInitials } from "@/lib/derive";
import { mkClass } from "@/lib/seed";
import { today, useUlat } from "@/lib/store";
import type { Grading, ScaleKind } from "@/lib/types";
import {
  blankDraft,
  DAYS,
  DEMO_WIZ_ROSTER,
  LEVELS,
  mergeRoster,
  parseCells,
  parseRows,
  qrCells,
  readPdfCells,
  readXlsxCells,
  schedText,
  slotBad,
  type WizDraft,
  type WizSlot,
  type WizStudent,
} from "@/lib/wizard";

const capsLabel = "label-caps text-sub";
const cardCls =
  "rounded-2xl border border-[rgba(34,48,60,0.06)] bg-[linear-gradient(180deg,#FFFFFF_0%,#FDFCFA_100%)] shadow-[0_1px_2px_rgba(34,48,60,0.04),0_8px_24px_-12px_rgba(34,48,60,0.18)]";
const bigInput =
  "h-[46px] rounded-xl border-[1.5px] border-line bg-white px-3.5 text-[15px] font-medium outline-none";

const STEPS: [string, string][] = [
  ["Class details", "Code, section, periods"],
  ["Grading system", "Components, scale, table"],
  ["Students", "Import or join by code"],
  ["Review", "Create the class"],
];

export default function NewClassPage() {
  const router = useRouter();
  const mounted = useMounted();
  const st = useUlat();
  const { limitHit, fil } = useEntitlement();
  const t = billingStrings(fil);

  const [wiz, setWiz] = useState(0);
  const [draft, setDraft] = useState<WizDraft>(blankDraft);
  const [importMsg, setImportMsg] = useState("");
  const [importKind, setImportKind] = useState<"" | "ok" | "warn" | "error" | "busy">("");
  const [rosterSort, setRosterSort] = useState<{ key: keyof WizStudent; dir: "asc" | "desc" } | null>(null);

  if (!mounted) return <div className="h-dvh bg-canvas" />;

  const d = draft;
  const gs = d.grading;
  const up = (patch: Partial<WizDraft>) => setDraft((x) => ({ ...x, ...patch }));
  const upG = (fn: (g: Grading) => Partial<Grading>) =>
    setDraft((x) => ({ ...x, grading: { ...x.grading, ...fn(x.grading) } }));

  const authName = profileShownName(st.profile) || DEMO_INSTRUCTOR.name;
  const authEmail = st.auth.email || DEMO_INSTRUCTOR.email;

  /* ---- step 1: details ---- */
  const lv = LEVELS[d.level] || LEVELS.College;
  const yearStart = Number(d.yearStart) || new Date().getFullYear();
  const termStd = (d.termKind || "") + " · " + lv.yr(yearStart);
  const termFinal = d.termCustom ? (d.termText || "").trim() : d.termKind === "Full year" ? lv.yr(yearStart) : termStd;
  const timeBad = d.slots.some(slotBad);
  const schedShown = schedText(d.slots) || "No schedule set";
  const upSlot = (i: number, patch: Partial<WizSlot>) =>
    up({ slots: d.slots.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const pickLevel = (name: string) => {
    const L = LEVELS[name];
    up({ level: name, termKind: L.terms[0], termCustom: false, periods: L.periods });
  };

  /* ---- step 2: grading ---- */
  const passing = Number(gs.passing) || 0;
  const base = txBase(gs);
  const groupTotal = gs.groups.reduce((a, g) => a + (Number(g.weight) || 0), 0);
  const TX: [number | null | "custom", string][] = [
    [null, "None"], [30, "Base 30"], [50, "Base 50"], [60, "Base 60"], [70, "Base 70"], ["custom", "Custom"],
  ];
  const txIsCustom = base !== null && ![30, 50, 60, 70].includes(base);
  const txNote =
    base === null
      ? "Component averages are used as they are, so 10 / 20 counts as 50%."
      : "Component % = raw % × " + (100 - base) + "% + " + base + ". A zero component still shows " + base +
        "%, and missed work stays a 0 raw score. For example, 10 / 20 becomes " + ((50 * (100 - base)) / 100 + base).toFixed(0) + "%.";
  const scaleNote = {
    "5pt": "The Philippine university scale. 1.00 is the highest, 3.00 is the usual passing line and 5.00 fails. Lower is better.",
    pct: "Students see the weighted percentage, such as 86. Common in DepEd report cards.",
    letter: "Students see A–F from the LETTER column. Higher is better.",
    gpa: "Students see the 4.0-scale number from the GPA column. Higher is better.",
  }[gs.scale];

  /* ---- step 3: roster ---- */
  const addRoster = (rows: WizStudent[], file: string) => {
    const { fresh, msg, kind } = mergeRoster(d.roster, rows, file);
    up({ roster: [...d.roster, ...fresh], pasted: "" });
    setImportMsg(msg);
    setImportKind(kind);
  };
  const importFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const ext = (f.name.split(".").pop() || "").toLowerCase();
    e.target.value = "";
    setImportMsg("Reading " + f.name + "…");
    setImportKind("busy");
    const fail = (why?: string) => {
      setImportMsg(f.name + " could not be read" + (why ? " (" + why + ")" : "") + ". Try CSV, or paste the rows below.");
      setImportKind("error");
    };
    if (ext === "csv" || ext === "txt") {
      const rd = new FileReader();
      rd.onload = () => addRoster(parseRows(String(rd.result)), f.name);
      rd.onerror = () => fail();
      rd.readAsText(f);
    } else if (ext === "xlsx" || ext === "xls")
      readXlsxCells(f).then((cells) => addRoster(parseCells(cells), f.name)).catch((err) => fail(err.message));
    else if (ext === "pdf")
      readPdfCells(f).then((cells) => addRoster(parseCells(cells), f.name)).catch((err) => fail(err.message));
    else fail("unsupported type ." + ext);
  };
  const upRow = (i: number, patch: Partial<WizStudent>) =>
    up({
      roster: d.roster.map((x, j) => {
        if (j !== i) return x;
        const y = { ...x, ...patch };
        y.name = (y.first ? y.last + ", " + y.first : y.last) + (y.mi ? " " + y.mi : "");
        y.issues = [...(!y.no && !y.noOptional ? ["no"] : []), ...(!y.first ? ["name"] : [])];
        return y;
      }),
    });
  const sortBy = (key: keyof WizStudent) => {
    const dir = rosterSort?.key === key && rosterSort.dir === "asc" ? "desc" : "asc";
    setRosterSort({ key, dir });
    up({
      roster: [...d.roster].sort((p, q) => {
        const a = String(p[key] || "").toLowerCase();
        const b = String(q[key] || "").toLowerCase();
        if (!a && b) return 1;
        if (a && !b) return -1;
        const c = a.localeCompare(b, undefined, { numeric: true });
        return dir === "asc" ? c : -c;
      }),
    });
  };
  const issueCount = d.roster.filter((r) => r.issues.length).length;
  const K = {
    ok: ["#0FA3A0", "rgba(15,163,160,0.12)", "#0B807E"],
    warn: ["#E0A800", "rgba(245,183,10,0.16)", "#8A6400"],
    error: ["#D14B33", "rgba(209,75,51,0.12)", "#B03A24"],
    busy: ["#0FA3A0", "rgba(90,102,114,0.1)", "#5A6672"],
  }[importKind as "ok"] || ["#D9D3C7", "", ""];

  /* ---- validation + create ---- */
  const compsOk =
    gs.groups.every((g) => g.comps.reduce((a, c) => a + (Number(c.w) || 0), 0) === 100) &&
    (gs.groups.length === 1 || groupTotal === 100);
  const detailsOk = !!(d.code.trim() && d.title.trim() && d.section.trim() && !timeBad);
  const reviewBlocked = wiz === 3 && !(detailsOk && compsOk);
  const reviewBlockText = !detailsOk
    ? "Step 1 needs a course code, title, and section."
    : "Step 2: component weights must total 100% in each group (and group equivalents 100%).";
  const canNext = wiz === 0 ? detailsOk : wiz === 1 ? compsOk : wiz === 2 ? true : detailsOk && compsOk;

  const create = () => {
    if (limitHit) {
      st.confirm({
        title: "You've reached 2 classes on the Free plan.",
        body: "Pro gives you unlimited classes and the registrar-format export. Your existing classes are not affected.",
        confirmLabel: t.seePlans,
        onConfirm: () => {
          const first = st.classes.find((c) => !c.archived) || st.classes[0];
          if (first) router.push(`/c/${first.id}/billing`);
        },
      });
      return;
    }
    const id = uid();
    const cls = mkClass({
      id,
      code: d.code.trim(),
      title: d.title.trim(),
      section: d.section.trim(),
      term: termFinal,
      schedule: schedText(d.slots),
      joinCode: d.joinCode,
      grading: d.grading,
      periods: d.periods,
      roster: d.roster,
    });
    st.set({
      classes: [...st.classes, cls],
      period: d.periods[0] || "Prelims",
      student: d.roster[0] ? d.roster[0].id : "",
      asmId: null,
      focus: "0-0",
      buffer: "",
      na: { name: "", comp: d.grading.groups[0].comps[0].id, period: d.periods[0] || "", max: "20", date: today(), later: false, notes: "" },
    });
    router.push(`/c/${id}/overview`);
  };
  const wizNext = () => {
    if (!canNext) return;
    if (wiz < 3) setWiz(wiz + 1);
    else create();
  };
  const wizBack = () => {
    if (wiz > 0) return setWiz(wiz - 1);
    const first = st.classes.find((c) => !c.archived) || st.classes[0];
    router.push(first ? `/c/${first.id}/overview` : "/signin");
  };

  const segBtn = (on: boolean): React.CSSProperties => ({
    background: on ? "#0FA3A0" : "transparent",
    color: on ? "#FFFFFF" : "#5A6672",
  });
  const chip = (on: boolean): React.CSSProperties => ({
    background: on ? "#0FA3A0" : "#FFFFFF",
    color: on ? "#FFFFFF" : "#5A6672",
    border: `1px solid ${on ? "#0FA3A0" : "#E8E2D6"}`,
  });

  return (
    <div className="relative grid h-dvh grid-cols-[280px_1fr] overflow-hidden">
      <ConfirmDialogHost />

      {/* Step rail */}
      <div
        className="flex flex-col gap-1 px-5 py-7 text-canvas"
        style={{
          background:
            "radial-gradient(120% 60% at 0% 0%,rgba(15,163,160,0.22) 0%,rgba(15,163,160,0) 55%),linear-gradient(180deg,#0E1A22 0%,#101D26 45%,#0C161D 100%)",
          borderRight: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <div className="mb-8 flex items-center gap-2.5 px-2">
          <AnimatedLogo size={30} />
        </div>
        <div className="mx-2 mb-2.5 text-[11px] font-bold tracking-[1.2px] text-muted">NEW CLASS</div>
        {STEPS.map(([label, sub], i) => (
          <button
            key={label}
            onClick={() => setWiz(i)}
            className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left"
            style={{ background: wiz === i ? "#16242F" : "transparent", color: wiz === i ? "#FFFFFF" : "#B7C0C8" }}
          >
            <span
              className="flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-full font-display text-[13px] font-extrabold"
              style={{
                background: i < wiz ? "#0FA3A0" : wiz === i ? "#F5B70A" : "#16242F",
                color: i < wiz ? "#FFFFFF" : wiz === i ? "#22303C" : "#7B8792",
              }}
            >
              {i + 1}
            </span>
            <div>
              <div className="text-sm font-bold">{label}</div>
              <div className="mt-px text-xs opacity-75">{sub}</div>
            </div>
          </button>
        ))}
        <div
          className="mt-auto flex items-center gap-2.5 rounded-[14px] px-3 py-2.5"
          style={{ background: "rgba(255,255,255,0.04)", border: "1.5px solid rgba(255,255,255,0.08)" }}
        >
          <div
            className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[10px] font-display text-[13px] font-extrabold"
            style={{ background: "rgba(15,163,160,0.22)", color: "#8FE3E1" }}
          >
            {profileInitials(st.profile)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-bold text-canvas">{authName}</div>
            <div className="truncate text-xs text-muted">{authEmail}</div>
          </div>
          <button
            onClick={() => {
              st.set({ signedIn: false });
              router.push("/signin");
            }}
            className="h-8 flex-shrink-0 cursor-pointer whitespace-nowrap rounded-[9px] px-2.5 text-xs font-semibold text-[#B8C0C6] hover:text-canvas"
            style={{ border: "1.5px solid rgba(255,255,255,0.12)" }}
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Content column */}
      <div className="flex min-h-0 flex-col bg-content-v3">
        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-12 pb-6 pt-10">
          {/* ---------- STEP 1 · Class details ---------- */}
          {wiz === 0 && (
            <>
              <div>
                <div className="font-display text-[28px] font-extrabold tracking-[-0.6px]">Class details</div>
                <div className="mt-1 text-sm text-sub">
                  This is what students see when they join with the class code.
                </div>
              </div>
              <div className={`${cardCls} flex max-w-[820px] flex-col gap-[18px] p-6`}>
                <div className="grid grid-cols-[180px_1fr] gap-3.5">
                  <div className="flex flex-col gap-1.5">
                    <label className={capsLabel}>COURSE CODE</label>
                    <input
                      value={d.code}
                      onChange={(e) => up({ code: e.target.value })}
                      placeholder="CS101"
                      className="h-[46px] rounded-xl border-[1.5px] border-line bg-white px-3.5 font-display text-base font-bold outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className={capsLabel}>TITLE</label>
                    <input
                      value={d.title}
                      onChange={(e) => up({ title: e.target.value })}
                      placeholder="Intro to Computing"
                      className={bigInput}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className={capsLabel}>LEVEL</label>
                  <div className="grid grid-cols-[auto_1fr] items-center gap-3.5">
                    <div className="inline-grid grid-cols-[repeat(3,auto)] gap-1 rounded-xl border border-line bg-canvas p-1">
                      {Object.keys(LEVELS).map((n) => (
                        <button
                          key={n}
                          onClick={() => pickLevel(n)}
                          className="h-9 cursor-pointer whitespace-nowrap rounded-[9px] px-4 text-[13px] font-bold"
                          style={{
                            background: n === d.level ? "#FFFFFF" : "transparent",
                            color: n === d.level ? "#22303C" : "#5A6672",
                          }}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                    <div className="text-[13px] leading-[1.45] text-sub">{lv.note}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div className="flex flex-col gap-1.5">
                    <label className={capsLabel}>SECTION</label>
                    <input
                      value={d.section}
                      onChange={(e) => up({ section: e.target.value })}
                      placeholder="BSCS 2A"
                      className={bigInput}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className={capsLabel}>TERM</label>
                    <div
                      className="grid gap-2"
                      style={{
                        gridTemplateColumns: d.termCustom ? "1fr 1.4fr" : d.termKind === "Full year" ? "1fr 1fr" : "1.2fr 1fr",
                      }}
                    >
                      <select
                        value={d.termCustom ? "Custom" : d.termKind}
                        onChange={(e) => {
                          const v = e.target.value;
                          up(v === "Custom" ? { termCustom: true } : { termKind: v, termCustom: false });
                        }}
                        className="h-[46px] min-w-0 rounded-xl border-[1.5px] border-line bg-white px-3 text-[15px] font-medium text-ink outline-none"
                      >
                        {lv.terms.map((o) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                        <option value="Custom">Custom…</option>
                      </select>
                      {!d.termCustom ? (
                        <select
                          value={d.yearStart}
                          onChange={(e) => up({ yearStart: Number(e.target.value) })}
                          className="h-[46px] min-w-0 rounded-xl border-[1.5px] border-line bg-white px-3 text-[15px] font-medium text-ink outline-none"
                        >
                          {[yearStart - 1, yearStart, yearStart + 1].map((y) => (
                            <option key={y} value={y}>{lv.yr(y)}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          value={d.termText}
                          onChange={(e) => up({ termText: e.target.value })}
                          placeholder={lv.ph}
                          className="h-[46px] min-w-0 rounded-xl border-[1.5px] border-line bg-white px-3.5 text-[15px] font-medium text-ink outline-none"
                        />
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className={capsLabel}>SCHEDULE</label>
                  {d.slots.map((sl, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 rounded-xl border border-line bg-canvas px-3 py-2.5"
                    >
                      <div className="flex min-w-0 gap-1">
                        {DAYS.map((dn) => {
                          const on = sl.days.includes(dn);
                          return (
                            <button
                              key={dn}
                              onClick={() =>
                                upSlot(i, {
                                  days: on ? sl.days.filter((x) => x !== dn) : DAYS.filter((x) => x === dn || sl.days.includes(x)),
                                })
                              }
                              className="h-9 min-w-10 cursor-pointer whitespace-nowrap rounded-full px-2 text-xs font-bold"
                              style={chip(on)}
                            >
                              {dn}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={sl.start}
                          onChange={(e) => upSlot(i, { start: e.target.value })}
                          className="h-[38px] w-[106px] rounded-[10px] border-[1.5px] border-line bg-white px-2 text-[13px] font-medium text-ink outline-none"
                        />
                        <span className="text-[13px] font-medium text-sub">to</span>
                        <input
                          type="time"
                          value={sl.end}
                          min={sl.start}
                          onChange={(e) => upSlot(i, { end: e.target.value })}
                          className="h-[38px] w-[106px] rounded-[10px] border-[1.5px] bg-white px-2 text-[13px] font-medium text-ink outline-none"
                          style={{ borderColor: slotBad(sl) ? "#D14B33" : "#E8E2D6" }}
                        />
                        <input
                          value={sl.room}
                          onChange={(e) => upSlot(i, { room: e.target.value })}
                          placeholder="Room"
                          className="h-[38px] w-[84px] rounded-[10px] border-[1.5px] border-line bg-white px-2.5 text-[13px] font-medium text-ink outline-none"
                        />
                        <button
                          onClick={() => up({ slots: d.slots.filter((_, j) => j !== i) })}
                          title="Remove meeting"
                          className="h-7 w-7 cursor-pointer rounded-lg text-sm font-bold text-faint hover:bg-hairline hover:text-red-text"
                          style={{ visibility: d.slots.length > 1 ? "visible" : "hidden" }}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[13px] text-sub">
                      {timeBad && (
                        <span className="font-medium text-red-text">End time must be after the start time. </span>
                      )}
                      Shown to students as <b className="font-semibold text-ink">{schedShown}</b>
                    </div>
                    <button
                      onClick={() => up({ slots: [...d.slots, { days: [], start: "", end: "", room: "" }] })}
                      className="h-8 cursor-pointer whitespace-nowrap rounded-full border-[1.5px] border-dashed border-[#D9D3C7] px-3 text-[13px] font-semibold text-teal-text"
                    >
                      + Another day or time
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className={capsLabel}>GRADING PERIODS</label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {d.periods.map((p, i) => (
                      <span
                        key={p}
                        className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-canvas pl-3.5 pr-1.5 text-[13px] font-semibold"
                      >
                        {p}
                        <button
                          onClick={() => up({ periods: d.periods.filter((_, j) => j !== i) })}
                          className="h-6 w-6 cursor-pointer rounded-full bg-hairline text-[13px] font-bold text-sub"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    <input
                      value={d.newPeriod}
                      onChange={(e) => up({ newPeriod: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && d.newPeriod.trim()) {
                          const v = d.newPeriod.trim();
                          up({ periods: d.periods.includes(v) ? d.periods : [...d.periods, v], newPeriod: "" });
                        }
                      }}
                      placeholder="Add period, press Enter"
                      className="h-9 w-[200px] rounded-full border-[1.5px] border-dashed border-[#D9D3C7] bg-transparent px-3.5 text-[13px] font-medium outline-none"
                    />
                  </div>
                </div>
              </div>
              <div className="flex max-w-[820px] items-center gap-3 text-[13px] text-sub">
                <span>Class code</span>
                <b className="rounded-lg border border-line bg-white px-2.5 py-1 font-display text-[15px] font-extrabold tracking-[1px] text-ink">
                  {d.joinCode}
                </b>
                <span>is ready to share. You can also import the roster in step 3.</span>
              </div>
            </>
          )}

          {/* ---------- STEP 2 · Grading system ---------- */}
          {wiz === 1 && (
            <>
              <div>
                <div className="font-display text-[28px] font-extrabold tracking-[-0.6px]">Grading system</div>
                <div className="mt-1 text-sm text-sub">
                  Start from a preset, then change anything. All of this stays editable in Settings.
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {PRESETS.map((p, i) => (
                  <button
                    key={p.name}
                    onClick={() => up({ preset: i, grading: p.make() })}
                    className="cursor-pointer rounded-2xl bg-white p-4 text-left text-ink hover:!border-teal"
                    style={{ border: `2px solid ${d.preset === i ? "#0FA3A0" : "#E8E2D6"}` }}
                  >
                    <div className="font-display text-[15px] font-extrabold">{p.name}</div>
                    <div className="mt-1 text-xs leading-[1.45] text-sub">{p.desc}</div>
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_400px] items-start gap-5">
                <div className="flex min-w-0 flex-col gap-3">
                  {gs.groups.map((g) => {
                    const sum = g.comps.reduce((a, c) => a + (Number(c.w) || 0), 0);
                    return (
                      <div key={g.id} className={`${cardCls} flex flex-col gap-2 px-4 py-3.5`}>
                        <div className="grid grid-cols-[1fr_96px_32px] items-center gap-2">
                          <input
                            value={g.name}
                            onChange={(e) =>
                              upG((x) => ({ groups: x.groups.map((y) => (y.id === g.id ? { ...y, name: e.target.value } : y)) }))
                            }
                            className="h-[38px] rounded-[10px] border-[1.5px] border-transparent bg-canvas px-2.5 font-display text-[15px] font-extrabold text-ink outline-none"
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
                                className="h-[38px] w-16 rounded-[10px] border-[1.5px] border-line bg-white px-2 text-right font-display text-[15px] font-extrabold outline-none"
                              />
                              <span className="w-3.5 text-[13px] font-bold text-sub">%</span>
                            </div>
                          ) : (
                            <span />
                          )}
                          <button
                            onClick={() =>
                              upG((x) => ({ groups: x.groups.length > 1 ? x.groups.filter((y) => y.id !== g.id) : x.groups }))
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
                              className="h-9 rounded-[10px] border-[1.5px] border-line bg-white px-2.5 text-sm font-medium text-ink outline-none"
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
                                className="h-9 w-16 rounded-[10px] border-[1.5px] border-line bg-white px-2 text-right text-sm font-bold outline-none"
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
                          <span className="text-[13px] font-semibold" style={{ color: sum === 100 ? "#0B807E" : "#B03A24" }}>
                            Total {sum}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-between">
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
                      className="h-[38px] cursor-pointer whitespace-nowrap rounded-xl border-[1.5px] border-teal bg-white px-4 text-[13px] font-bold text-teal-text"
                    >
                      + Group (e.g. Laboratory)
                    </button>
                    <span
                      className="text-[13px] font-semibold"
                      style={{ color: gs.groups.length > 1 && groupTotal !== 100 ? "#B03A24" : "#0B807E" }}
                    >
                      {gs.groups.length > 1 ? "Group equivalents total " + groupTotal + "%" : "One group · weights apply directly"}
                    </span>
                  </div>
                </div>

                <div className="flex min-w-0 flex-col gap-3">
                  <div className={`${cardCls} flex flex-col gap-3 p-4`}>
                    <div className="font-display text-[15px] font-extrabold">Scale shown to students</div>
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
                    <div className="flex items-center justify-between border-t border-line pt-1 text-sm font-medium">
                      <span>Passing mark</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          value={gs.passing}
                          onChange={(e) => upG(() => ({ passing: e.target.value.replace(/[^0-9.]/g, "") }))}
                          className="h-9 w-16 rounded-[10px] border-[1.5px] border-line bg-white px-2 text-right font-display text-[15px] font-extrabold outline-none"
                        />
                        <span className="whitespace-nowrap text-[13px] font-bold text-sub">
                          % → <span className="text-teal-text">{shown(gs, passing)}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className={`${cardCls} flex flex-col gap-2.5 p-4`}>
                    <div className="flex items-baseline justify-between">
                      <div className="font-display text-[15px] font-extrabold">Grading method</div>
                      <span className="text-xs font-medium text-sub">Carreon-style transmutation</span>
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
                            className="h-9 w-16 rounded-[10px] border-[1.5px] border-line bg-white px-2 text-right font-display text-[15px] font-extrabold outline-none"
                          />
                          <span className="whitespace-nowrap text-[13px] font-bold text-sub">for a zero score</span>
                        </div>
                      </div>
                    )}
                    <div className="text-[13px] leading-[1.5] text-sub">{txNote}</div>
                  </div>

                  <div className={`${cardCls} flex flex-col gap-1.5 p-4`}>
                    <div className="mb-1 flex items-baseline justify-between">
                      <div className="font-display text-[15px] font-extrabold">Grade table</div>
                      <button
                        onClick={() => upG((x) => ({ table: [...x.table, { id: uid(), lo: 0, grade: "", letter: "", gpa: "" }] }))}
                        className="cursor-pointer text-xs font-bold text-teal-text"
                      >
                        + Row
                      </button>
                    </div>
                    <div className="label-caps grid grid-cols-[72px_1fr_1fr_1fr_28px] gap-1.5 px-1 pb-0.5 text-sub">
                      <span>FROM %</span><span>NUMERIC</span><span>LETTER</span><span>GPA 4.0</span><span />
                    </div>
                    {gs.table.map(row => {
                      const k = standing(gs, Number(row.lo), false);
                      const bg = k === "pass" ? "rgba(15,163,160,0.12)" : k === "risk" ? "rgba(245,183,10,0.16)" : "#FFFFFF";
                      const cellC = "h-8 rounded-lg border-[1.5px] border-line px-2 font-display text-[13px] font-extrabold outline-none";
                      const upT = (patch: Partial<typeof row>) =>
                        upG((x) => ({ table: x.table.map((y) => (y.id === row.id ? { ...y, ...patch } : y)) }));
                      return (
                        <div key={row.id} className="grid grid-cols-[72px_1fr_1fr_1fr_28px] items-center gap-1.5">
                          <input value={row.lo} onChange={(e) => upT({ lo: e.target.value.replace(/[^0-9.]/g, "") })} className="h-8 rounded-lg border-[1.5px] border-line bg-white px-2 text-[13px] font-semibold outline-none" />
                          <input value={row.grade} onChange={(e) => upT({ grade: e.target.value })} className={cellC} style={{ background: bg }} />
                          <input value={row.letter} onChange={(e) => upT({ letter: e.target.value })} className={`${cellC} bg-white`} />
                          <input value={row.gpa} onChange={(e) => upT({ gpa: e.target.value })} className={`${cellC} bg-white`} />
                          <button
                            onClick={() => upG((x) => ({ table: x.table.length > 2 ? x.table.filter((y) => y.id !== row.id) : x.table }))}
                            className="h-7 w-7 cursor-pointer rounded-lg text-sm font-bold text-faint hover:bg-hairline"
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                    <div className="mt-1 text-xs leading-[1.5] text-sub">
                      Rows read top-down: the first row whose FROM % is met gives the grade. Tinted rows are passing.
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ---------- STEP 3 · Students ---------- */}
          {wiz === 2 && (
            <>
              <div>
                <div className="font-display text-[28px] font-extrabold tracking-[-0.6px]">Students</div>
                <div className="mt-1 text-sm text-sub">
                  Import a class list now, or skip and let students join with the code. Both can be combined later.
                </div>
              </div>
              <div className="grid grid-cols-2 items-stretch gap-5">
                <div className="flex flex-col gap-3">
                  <label
                    className="flex h-[140px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed bg-white px-6 py-4 text-center hover:!border-teal"
                    style={{ borderColor: K[0] }}
                  >
                    <input type="file" accept=".csv,.txt,.xlsx,.xls,.pdf" onChange={importFile} className="hidden" />
                    <div className="text-[15px] font-bold text-teal-text">Upload CSV, XLSX, or PDF class list</div>
                    <div className="text-[13px] leading-[1.5] text-sub">
                      Columns: Student No., Last name, First name. A single &quot;Last, First M.&quot; column also works.
                      PDF lists are read as text.
                    </div>
                  </label>
                  {importMsg && (
                    <div
                      className="rounded-xl px-3.5 py-2.5 text-[13px] font-medium leading-[1.5]"
                      style={{ color: K[2], background: K[1] }}
                    >
                      {importMsg}
                    </div>
                  )}
                  <div className="flex items-center gap-2.5 text-xs font-medium text-faint">
                    <span className="h-px flex-1 bg-line" />
                    or paste from a spreadsheet
                    <span className="h-px flex-1 bg-line" />
                  </div>
                  <textarea
                    value={d.pasted}
                    onChange={(e) => up({ pasted: e.target.value })}
                    rows={6}
                    placeholder={"Student No., Last name, First name, M.I. — one per line\n2024-01102, Aquino, Paolo, S.\n2024-01115, Bautista, Maria\nDela Cruz, Juan P."}
                    className="resize-y rounded-[14px] border-[1.5px] border-line bg-white px-3.5 py-3 text-[13px] font-medium leading-[1.6] text-ink outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => addRoster(parseRows(d.pasted), "")}
                      className="h-10 cursor-pointer whitespace-nowrap rounded-xl bg-teal px-4 text-[13px] font-bold text-white"
                    >
                      Add pasted rows
                    </button>
                    <button
                      onClick={() => addRoster(DEMO_WIZ_ROSTER(), "the sample list")}
                      className="h-10 cursor-pointer whitespace-nowrap rounded-xl border-[1.5px] border-line bg-white px-4 text-[13px] font-bold text-sub"
                    >
                      Use sample list (10)
                    </button>
                    {d.roster.length > 0 && (
                      <button
                        onClick={() =>
                          st.confirm({
                            title: "Clear the student list?",
                            body: "All " + d.roster.length + " students will be removed from this list. Another list can be imported or pasted afterwards.",
                            confirmLabel: "Clear " + d.roster.length + " students",
                            danger: true,
                            onConfirm: () => {
                              up({ roster: [] });
                              setImportMsg("");
                              setImportKind("");
                            },
                          })
                        }
                        className="ml-auto h-10 cursor-pointer whitespace-nowrap rounded-xl px-3.5 text-[13px] font-bold text-red-text hover:bg-red-tint-8"
                      >
                        Clear all {d.roster.length}
                      </button>
                    )}
                  </div>
                </div>

                <div className={`${cardCls} flex min-h-0 flex-col overflow-hidden`}>
                  <div className="label-caps grid grid-cols-[110px_1fr_1fr_44px_32px] gap-3 border-b border-line bg-canvas px-4 py-3 text-sub">
                    {(
                      [
                        ["no", "STUDENT NO."],
                        ["last", "LAST NAME"],
                        ["first", "FIRST NAME"],
                        ["mi", "M.I."],
                      ] as [keyof WizStudent, string][]
                    ).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => sortBy(key)}
                        title="Sort"
                        className="label-caps flex cursor-pointer items-center gap-1 whitespace-nowrap p-0 text-left hover:!text-teal-text"
                        style={{ color: rosterSort?.key === key ? "#0B807E" : "#5A6672" }}
                      >
                        {label}
                        <span>{rosterSort?.key === key ? (rosterSort.dir === "asc" ? "↑" : "↓") : ""}</span>
                      </button>
                    ))}
                    <span className="justify-self-end whitespace-nowrap">{d.roster.length}</span>
                  </div>
                  {issueCount > 0 && (
                    <div className="flex items-center gap-2 border-b border-line bg-amber-tint px-4 py-2 text-xs font-medium text-amber-text">
                      <span className="h-2 w-2 flex-shrink-0 rounded-full bg-[#E0A800]" />
                      {issueCount} rows need attention — highlighted cells are empty or unclear. Click a cell to fix it.
                    </div>
                  )}
                  <div className="flex flex-1 flex-col overflow-y-auto">
                    {d.roster.length === 0 && (
                      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-8 text-center text-sm leading-[1.5] text-faint">
                        <div
                          className="grid h-[148px] w-[148px] rounded-xl border border-line bg-white p-2"
                          style={{ gridTemplateColumns: "repeat(25,1fr)", gridTemplateRows: "repeat(25,1fr)" }}
                        >
                          {qrCells(d.joinCode).map((c, i) => (
                            <span key={i} style={{ background: c }} />
                          ))}
                        </div>
                        <div className="mt-1.5 flex flex-col items-center gap-1.5 text-[13px] font-medium text-sub">
                          Scan to join, or enter the code
                          <b className="rounded-lg bg-teal-tint-12 px-3.5 py-1 font-display text-xl font-extrabold leading-[1.2] tracking-[2px] text-teal-text">
                            {d.joinCode}
                          </b>
                        </div>
                        <div className="text-[13px] text-sub">
                          No students yet. Import a list on the left, or share this with the class.
                        </div>
                      </div>
                    )}
                    {d.roster.map((r, i) => {
                      const noBad = r.issues.includes("no") && !r.no && !r.noOptional;
                      const nameBad = r.issues.includes("name") && !r.first;
                      const cellCls =
                        "h-8 min-w-0 rounded-lg border-[1.5px] bg-transparent px-2 -mx-2 w-[calc(100%+16px)] text-sm font-medium outline-none focus:!border-teal focus:bg-white";
                      return (
                        <div
                          key={r.id}
                          className="grid h-11 grid-cols-[110px_1fr_1fr_44px_32px] items-center gap-3 border-b border-hairline px-4 text-sm font-medium"
                          style={{ background: noBad || nameBad ? "rgba(245,183,10,0.08)" : "#FFFFFF" }}
                        >
                          <input
                            value={r.no}
                            onChange={(e) => upRow(i, { no: e.target.value.trim() })}
                            placeholder={noBad ? "Missing" : ""}
                            className={`${cellCls} text-sub`}
                            style={{ borderColor: noBad ? "#E0A800" : "transparent" }}
                          />
                          <input
                            value={r.last}
                            onChange={(e) => upRow(i, { last: e.target.value })}
                            className={`${cellCls} font-semibold text-ink`}
                            style={{ borderColor: "transparent" }}
                          />
                          <input
                            value={r.first}
                            onChange={(e) => upRow(i, { first: e.target.value.trim() })}
                            placeholder={nameBad ? "First name?" : ""}
                            className={`${cellCls} text-ink`}
                            style={{ borderColor: nameBad ? "#E0A800" : "transparent" }}
                          />
                          <input
                            value={r.mi}
                            onChange={(e) => {
                              const v = e.target.value.trim().replace(/\.$/, "");
                              upRow(i, { mi: v ? v.toUpperCase() + "." : "" });
                            }}
                            placeholder="—"
                            className="-mx-1.5 h-8 w-[calc(100%+12px)] min-w-0 rounded-lg border-[1.5px] border-transparent bg-transparent px-1.5 text-center text-sm font-medium text-sub outline-none focus:!border-teal focus:bg-white"
                          />
                          <button
                            onClick={() => up({ roster: d.roster.filter((_, j) => j !== i) })}
                            className="h-7 w-7 cursor-pointer rounded-lg text-sm font-bold text-faint hover:bg-hairline"
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ---------- STEP 4 · Review ---------- */}
          {wiz === 3 && (
            <>
              <div>
                <div className="font-display text-[28px] font-extrabold tracking-[-0.6px]">Review</div>
                <div className="mt-1 text-sm text-sub">Everything here can be changed later in Settings.</div>
              </div>
              <div className="grid max-w-[900px] grid-cols-2 gap-4">
                <div className={`${cardCls} flex flex-col gap-3 px-[22px] py-5`}>
                  <div className={capsLabel}>CLASS</div>
                  <div>
                    <div className="font-display text-[22px] font-extrabold tracking-[-0.4px]">
                      {d.code.trim() || "—"} · {d.title.trim() || "Untitled class"}
                    </div>
                    <div className="mt-0.5 text-sm font-medium text-sub">
                      {d.section.trim() || "No section"} · {termFinal || "No term"}
                    </div>
                    <div className="text-sm font-medium text-sub">{schedShown}</div>
                  </div>
                  <div className="grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1.5 border-t border-line pt-2.5 text-sm font-medium">
                    <span className="text-sub">Periods</span>
                    <span>{d.periods.join(" · ")}</span>
                    <span className="text-sub">Join code</span>
                    <b className="font-display text-[15px] font-extrabold tracking-[1px]">{d.joinCode}</b>
                  </div>
                </div>
                <div className={`${cardCls} flex flex-col gap-3 px-[22px] py-5`}>
                  <div className={capsLabel}>STUDENTS</div>
                  <div>
                    <div className="font-display text-[22px] font-extrabold tracking-[-0.4px]">
                      {d.roster.length} imported
                    </div>
                    <div className="mt-0.5 text-sm leading-[1.5] text-sub">
                      {d.roster.length
                        ? d.roster.slice(0, 4).map((r) => r.name).join(", ") +
                          (d.roster.length > 4 ? " and " + (d.roster.length - 4) + " more" : "")
                        : "Students will join with the class code."}
                    </div>
                  </div>
                </div>
                <div className={`${cardCls} col-span-full flex flex-col gap-3 px-[22px] py-5`}>
                  <div className="flex items-baseline justify-between gap-3">
                    <div className={capsLabel}>GRADING SYSTEM</div>
                    <div className="text-[13px] font-medium text-sub">
                      {scaleLabel(gs)} · passing at {gs.passing}% ({shown(gs, passing)})
                    </div>
                  </div>
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-5">
                    {gs.groups.map((g) => (
                      <div key={g.id} className="rounded-xl bg-canvas px-3.5 py-3">
                        <div className="mb-1.5 flex justify-between border-b border-line pb-1.5 font-display text-[15px] font-extrabold">
                          <span>{g.name}</span>
                          <span className="font-body text-[13px] font-semibold text-sub">
                            {gs.groups.length > 1 ? g.weight + "%" : ""}
                          </span>
                        </div>
                        {g.comps.map((c) => (
                          <div key={c.id} className="flex justify-between gap-6 py-[3px] text-sm font-medium">
                            <span>{c.name}</span>
                            <span className="text-sub">{c.w}%</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {reviewBlocked && (
                <div className="max-w-[900px] rounded-xl bg-[rgba(209,75,51,0.1)] px-3.5 py-2.5 text-[13px] font-medium text-red-text">
                  {reviewBlockText}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-shrink-0 items-center justify-between border-t border-line px-12 pb-6 pt-4">
          <button
            onClick={wizBack}
            className="h-11 cursor-pointer whitespace-nowrap rounded-xl border-[1.5px] border-line bg-white px-[18px] text-sm font-bold text-ink"
          >
            {wiz === 0 ? (st.classes.length ? "Cancel" : "Back to sign in") : "Back"}
          </button>
          <div className="flex gap-2">
            {wiz === 2 && (
              <button
                onClick={wizNext}
                className="h-11 cursor-pointer whitespace-nowrap rounded-xl border-[1.5px] border-teal bg-white px-[18px] text-sm font-bold text-teal-text"
              >
                Skip · students join by code
              </button>
            )}
            <button
              onClick={wizNext}
              className="h-11 cursor-pointer whitespace-nowrap rounded-xl px-[22px] text-sm font-bold text-white"
              style={{ background: canNext ? "#0FA3A0" : "#B8C0C6" }}
            >
              {wiz === 3 ? "Create class" : wiz === 2 ? "Continue with " + d.roster.length + " students" : "Continue"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
