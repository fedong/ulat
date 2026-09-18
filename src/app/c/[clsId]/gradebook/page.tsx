"use client";

import { useRouter } from "next/navigation";
import { use, useEffect, useRef } from "react";
import { compPath, tx, txBase } from "@/lib/grading";
import { useEntitlement, usePeriodComputed } from "@/lib/hooks";
import { useClass, useUlat } from "@/lib/store";
import type { Score } from "@/lib/types";

export default function GradebookPage({ params }: { params: Promise<{ clsId: string }> }) {
  const { clsId } = use(params);
  const router = useRouter();
  const st = useUlat();
  const cls = useClass(clsId);
  const computed = usePeriodComputed(cls);
  const { ro } = useEntitlement();
  const gridRef = useRef<HTMLDivElement>(null);

  const focus = st.focus;
  useEffect(() => {
    // Keep the focused cell visible under the sticky header / student column.
    const grid = gridRef.current;
    if (!grid) return;
    const cell = grid.querySelector<HTMLElement>(`[data-cell="${focus}"]`);
    const sc = grid.querySelector<HTMLElement>("[data-scroll]");
    if (!cell || !sc) return;
    const c = cell.getBoundingClientRect();
    const s = sc.getBoundingClientRect();
    const top = 52, left = 200, pad = 12;
    if (c.top < s.top + top) sc.scrollTop -= s.top + top - c.top + pad;
    else if (c.bottom > s.bottom) sc.scrollTop += c.bottom - s.bottom + pad;
    if (c.left < s.left + left) sc.scrollLeft -= s.left + left - c.left + pad;
    else if (c.right > s.right) sc.scrollLeft += c.right - s.right + pad;
  }, [focus]);

  if (!cls) return null;
  const gs = cls.grading;
  const roster = cls.roster;
  const periods = cls.periods;
  const closedP = cls.closed || {};
  const periodClosed = !!closedP[st.period];
  const passing = Number(gs.passing) || 0;
  const base = txBase(gs);
  const gbAsms = cls.assessments.filter((a) => a.period === st.period);
  const [fr, fc] = st.focus.split("-").map(Number);
  const termMethod = gs.termMethod === "cumulative" ? "cumulative" : "average";
  const wsum = periods.reduce(
    (a, p) =>
      a +
      (((gs.periodWeights || {})[p] ?? "") === ""
        ? Math.round(100 / periods.length)
        : Number((gs.periodWeights || {})[p]) || 0),
    0,
  );

  const setCell = (ri: number, ci: number, v: Score | null) => {
    if (periodClosed || ro.has(cls.id) || !gbAsms[ci] || !roster[ri]) return;
    const sid = roster[ri].id;
    const aid = gbAsms[ci].id;
    const prev = (cls.scores[sid] || {})[aid];
    st.upCls(cls.id, (c) => ({
      scores: { ...c.scores, [sid]: { ...(c.scores[sid] || {}), [aid]: v } },
    }));
    st.set({ undo: { sid, aid, prev: prev === undefined ? null : prev }, buffer: "" });
  };

  const move = (dr: number, dc: number) => {
    const [r, c] = useUlat.getState().focus.split("-").map(Number);
    st.set({
      focus:
        Math.max(0, Math.min(roster.length - 1, r + dr)) +
        "-" +
        Math.max(0, Math.min(gbAsms.length - 1, c + dc)),
      buffer: "",
    });
  };

  const commit = () => {
    const buffer = useUlat.getState().buffer;
    if (buffer === "" || !gbAsms[fc]) return;
    const v = Math.min(Number(gbAsms[fc].max), parseFloat(buffer));
    if (!isNaN(v)) setCell(fr, fc, v);
  };

  const undo = () => {
    const u = useUlat.getState().undo;
    if (!u) return;
    st.upCls(cls.id, (c) => ({
      scores: { ...c.scores, [u.sid]: { ...(c.scores[u.sid] || {}), [u.aid]: u.prev } },
    }));
    st.set({ undo: null });
  };

  const onKey = (e: React.KeyboardEvent) => {
    const k = e.key;
    if ((e.metaKey || e.ctrlKey) && /^z$/i.test(k)) {
      e.preventDefault();
      undo();
      return;
    }
    if (!gbAsms.length) return;
    if (k === "Tab") {
      e.preventDefault();
      commit();
      move(0, e.shiftKey ? -1 : 1);
    } else if (k === "Enter" || k === "ArrowDown") {
      e.preventDefault();
      commit();
      move(1, 0);
    } else if (k === "ArrowUp") {
      e.preventDefault();
      commit();
      move(-1, 0);
    } else if (k === "ArrowRight") {
      e.preventDefault();
      commit();
      move(0, 1);
    } else if (k === "ArrowLeft") {
      e.preventDefault();
      commit();
      move(0, -1);
    } else if (k === "Escape") st.set({ buffer: "" });
    else if (k === "Backspace") st.set({ buffer: st.buffer.slice(0, -1) });
    else if (k === "Delete") setCell(fr, fc, null);
    else if (/^e$/i.test(k)) setCell(fr, fc, "EXC");
    else if (/^m$/i.test(k)) setCell(fr, fc, "MISSED");
    else if (/^[0-9.]$/.test(k)) {
      e.preventDefault();
      if (st.buffer.length < 5) st.set({ buffer: st.buffer + k });
    }
  };

  const showTx = base !== null && st.showTx;
  const cellText = (v: Score | null | undefined, max: number): [string, string] => {
    if (v === undefined || v === null) return ["—", "#9AA3AB"];
    if (v === "EXC") return ["EXC", "#5A6672"];
    if (v === "MISSED")
      return [showTx ? (tx(gs, 0) * 100).toFixed(0) + "% missed" : "0 missed", "#B03A24"];
    const pct = tx(gs, Number(v) / Number(max)) * 100;
    const fail = pct < passing;
    return showTx
      ? [pct.toFixed(0) + "%", fail ? "#B03A24" : "#0B807E"]
      : [String(v), fail ? "#B03A24" : "#22303C"];
  };

  const gridCols = `200px repeat(${Math.max(1, gbAsms.length)},minmax(104px,1fr)) 80px 150px`;
  const gridMinW = 200 + Math.max(1, gbAsms.length) * 104 + 230 + "px";

  const gbNote =
    (periodClosed
      ? st.period + " is marked final; reopen it in Settings to edit. "
      : "Standing shown is for " + st.period + " only. ") +
    (termMethod === "average"
      ? "The term grade averages the periods" +
        (wsum === 100 ? "" : " (weights total " + wsum + "%)") +
        "."
      : "The term grade pools every period's work.");

  return (
    <>
      <div className="mb-3.5 flex flex-shrink-0 items-center justify-between gap-4">
        <div className="flex gap-1.5">
          {periods.map((p) => {
            const on = st.period === p;
            return (
              <button
                key={p}
                onClick={() => st.set({ period: p, focus: "0-0", buffer: "" })}
                className="h-[34px] cursor-pointer whitespace-nowrap rounded-full px-4 text-[13px] font-bold"
                style={{
                  background: on ? "#0FA3A0" : "#FFFFFF",
                  color: on ? "#FFFFFF" : "#5A6672",
                  border: `1px solid ${on ? "#0FA3A0" : "#E8E2D6"}`,
                }}
              >
                {p + (closedP[p] ? " · Final" : "")}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-3">
          <div className="whitespace-nowrap text-xs font-medium text-sub">
            Click a cell and type · Tab / Enter / arrows · <b>E</b> excused · <b>M</b>{" "}
            missed · Del clears ·{" "}
            <span className="font-bold text-red-text">red</span> is below passing
          </div>
          {base !== null && (
            <button
              onClick={() => st.set({ showTx: !st.showTx })}
              title="Switch between raw scores and transmuted percentages"
              className="h-[34px] cursor-pointer whitespace-nowrap rounded-full border-[1.5px] border-line bg-card px-3 text-xs font-bold text-teal-text hover:border-teal"
            >
              {showTx ? "Transmuted %" : "Raw scores"}
            </button>
          )}
        </div>
      </div>

      <div
        ref={gridRef}
        data-tour="gradebook"
        tabIndex={0}
        onKeyDown={onKey}
        className="flex min-h-0 flex-shrink flex-col overflow-hidden rounded-2xl bg-card shadow-card outline-none"
      >
        <div data-scroll className="min-h-0 flex-1 overflow-auto">
          <div style={{ minWidth: gridMinW }}>
            <div
              className="sticky top-0 z-[3] grid border-b border-line bg-canvas"
              style={{ gridTemplateColumns: gridCols, boxShadow: "0 1px 0 #E8E2D6" }}
            >
              <div className="label-caps sticky left-0 z-[4] flex items-center bg-canvas px-[18px] py-3 text-sub">
                STUDENT
              </div>
              {gbAsms.map((a) => (
                <div key={a.id} className="min-w-0 px-1.5 py-2.5 text-center">
                  <div className="truncate text-xs font-bold">{a.name}</div>
                  <div className="mt-0.5 truncate text-[11px] font-medium text-sub">
                    / {a.max} · {compPath(gs, a.comp)}
                  </div>
                </div>
              ))}
              <div className="label-caps flex items-center justify-center px-2 py-3 text-sub">
                %
              </div>
              <div className="label-caps flex items-center justify-center px-2 py-3 text-sub">
                STANDING
              </div>
            </div>

            {gbAsms.length === 0 && (
              <div className="p-10 text-center text-sm text-faint">
                No assessments in {st.period} yet. Add one from Assessments.
              </div>
            )}
            {roster.map((r, ri) => {
              const c = computed[r.id];
              return (
                <div
                  key={r.id}
                  className="grid items-center border-b border-hairline"
                  style={{ gridTemplateColumns: gridCols }}
                >
                  <button
                    onClick={() => {
                      st.set({ student: r.id, remarkDraft: null });
                      router.push(`/c/${cls.id}/students`);
                    }}
                    className="sticky left-0 z-[2] flex h-[46px] cursor-pointer items-center whitespace-nowrap bg-card px-[18px] text-left text-sm font-semibold text-ink hover:text-teal-text"
                  >
                    {r.name}
                  </button>
                  {gbAsms.map((a, ci) => {
                    const key = ri + "-" + ci;
                    const focused = st.focus === key;
                    const [text, color] =
                      focused && st.buffer !== ""
                        ? [st.buffer + "|", "#22303C"]
                        : cellText((cls.scores[r.id] || {})[a.id], a.max);
                    return (
                      <div
                        key={a.id}
                        data-cell={key}
                        onClick={() => {
                          st.set({ focus: key, buffer: "" });
                          gridRef.current?.focus();
                        }}
                        className="m-1 flex h-[38px] cursor-text items-center justify-center rounded-lg text-sm font-medium tabular-nums transition-colors hover:bg-teal-tint-8"
                        style={{
                          color,
                          outline: focused ? "2px solid #0FA3A0" : "none",
                        }}
                      >
                        {text}
                      </div>
                    );
                  })}
                  <div className="text-center text-sm font-semibold tabular-nums">{c.pctText}</div>
                  <div className="flex justify-center">
                    <span
                      className="whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold"
                      style={{ background: c.bg, color: c.color }}
                    >
                      {c.chip}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-shrink-0 items-center justify-between text-xs font-medium text-sub">
        <span>{gbNote}</span>
      </div>
    </>
  );
}
