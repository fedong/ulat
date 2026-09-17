"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { DEMO_INSTRUCTOR } from "@/lib/derive";
import { useUlat } from "@/lib/store";
import { TOUR, TOUR_STOPS } from "@/lib/tour";

export function markTourDone() {
  try {
    localStorage.setItem("ulat_tour_done", "1");
  } catch {}
}

/**
 * Guided product tour over the app shell. Spotlights [data-tour] targets,
 * navigating to each stop's page first and measuring after render.
 */
export function TourOverlay({
  clsId,
  shellRef,
}: {
  clsId: string;
  shellRef: React.RefObject<HTMLDivElement | null>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const st = useUlat();
  const tour = st.tour;
  const tStep = tour ? tour.step : -1;
  const tDef = TOUR[tStep];
  const page = pathname.split("/").pop() || "overview";

  // Navigate to the stop's page, then measure its target relative to the shell.
  useEffect(() => {
    if (!tDef) return;
    if (tDef.page && page !== tDef.page) {
      router.push(`/c/${clsId}/${tDef.page}`);
      return;
    }
    if (!tDef.target) return;
    let raf = 0;
    let tries = 0;
    const measure = () => {
      const shell = shellRef.current;
      const el = shell?.querySelector(`[data-tour="${tDef.target}"]`);
      if (!shell || !el) {
        if (tries++ < 60) raf = requestAnimationFrame(measure);
        return;
      }
      const fr = shell.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const next = {
        key: tDef.key,
        x: r.left - fr.left - 8,
        y: r.top - fr.top - 8,
        w: r.width + 16,
        h: r.height + 16,
      };
      const cur = useUlat.getState().tourRect;
      if (
        !cur ||
        cur.key !== next.key ||
        Math.abs(cur.x - next.x) > 1 ||
        Math.abs(cur.y - next.y) > 1 ||
        Math.abs(cur.w - next.w) > 1 ||
        Math.abs(cur.h - next.h) > 1
      )
        st.set({ tourRect: next });
    };
    raf = requestAnimationFrame(measure);
    const onResize = () => {
      cancelAnimationFrame(raf);
      tries = 0;
      raf = requestAnimationFrame(measure);
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tStep, page, clsId, tDef?.key]);

  useEffect(() => {
    if (!tour) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        markTourDone();
        st.set({ tour: null, tourRect: null });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!tour]);

  if (!tDef) return null;

  const firstName = (st.auth.name || DEMO_INSTRUCTOR.name).replace(/^Prof\.\s*/, "").split(" ")[0];
  const title = tDef.title.replace("{name}", firstName);
  const isWelcome = tDef.key === "welcome";
  const isDone = tDef.key === "done";
  const isStop = !!tDef.target;
  const stopIdx = TOUR_STOPS.findIndex((t) => t.key === tDef.key);
  const tr = st.tourRect && st.tourRect.key === tDef.key ? st.tourRect : null;

  const tourGo = (step: number) => {
    const d = TOUR[step];
    if (!d) return;
    st.set({ tour: { step }, dialog: null, tourRect: null });
  };
  const tourEnd = () => {
    markTourDone();
    st.set({ tour: null, tourRect: null });
  };

  // Card placement within the shell.
  const shell = shellRef.current;
  const W = shell?.clientWidth ?? 1440;
  const H = shell?.clientHeight ?? 900;
  const M = 20;
  let card: { x: number; y: number; w: number };
  if (!isStop) {
    const w = isWelcome ? 560 : 440;
    const hh = isWelcome ? 420 : 260;
    card = { x: (W - w) / 2, y: (H - hh) / 2, w };
  } else if (!tr) {
    card = { x: (W - 380) / 2, y: (H - 220) / 2, w: 380 };
  } else {
    const w = 380;
    const est = 230;
    let x: number, y: number;
    if (tr.x + tr.w + 18 + w <= W - M) {
      x = tr.x + tr.w + 18;
      y = tr.y;
    } else if (tr.x - 18 - w >= M) {
      x = tr.x - 18 - w;
      y = tr.y;
    } else {
      x = Math.min(Math.max(M, tr.x), W - M - w);
      y = tr.y + tr.h + 18;
      if (y + est > H - M) y = tr.y - 18 - est;
    }
    y = Math.min(Math.max(M, y), H - M - est);
    card = { x, y, w };
  }

  const ease = "0.4s cubic-bezier(.4,0,.2,1)";

  return (
    <div className="absolute inset-0 z-[60] overflow-hidden">
      {isStop && tr && (
        <div
          className="pointer-events-none absolute rounded-2xl"
          style={{
            left: tr.x,
            top: tr.y,
            width: tr.w,
            height: tr.h,
            boxShadow:
              "0 0 0 4000px rgba(16,29,38,0.58), 0 0 0 3px #0FA3A0, 0 0 0 9px rgba(15,163,160,0.25)",
            transition: `left ${ease}, top ${ease}, width ${ease}, height ${ease}`,
          }}
        />
      )}
      {(!isStop || !tr) && (
        <div
          onClick={tourEnd}
          className="absolute inset-0"
          style={{ background: "rgba(16,29,38,0.58)" }}
        />
      )}
      {/* Absorb clicks around the card while a spotlight is up */}
      {isStop && tr && <div className="absolute inset-0" />}

      <div
        className="absolute flex flex-col gap-2.5 rounded-[20px] bg-card px-[26px] pb-5 pt-6"
        style={{
          left: card.x,
          top: card.y,
          width: card.w,
          boxShadow: "0 24px 60px rgba(16,29,38,0.35)",
          transition: `left ${ease}, top ${ease}, width ${ease}`,
        }}
      >
        {isWelcome && (
          <>
            <div className="mb-1.5 flex items-center gap-3">
              <Image src="/ulat-mark.svg" alt="" width={40} height={40} />
              <span className="font-display text-[28px] font-black tracking-[-0.8px]">ulat</span>
            </div>
            <div className="font-display text-[28px] font-extrabold leading-[1.15] tracking-[-0.6px]">
              {title}
            </div>
            <div className="text-[15px] leading-[1.6] text-sub [text-wrap:pretty]">
              {tDef.body}
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {TOUR_STOPS.map((t, i) => (
                <div
                  key={t.key}
                  className="flex items-center gap-2 rounded-xl border border-line bg-canvas px-3 py-2.5 text-[13px] font-semibold text-ink"
                >
                  <span className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-teal-tint-12 font-display text-[11px] font-extrabold text-teal-text">
                    {i + 1}
                  </span>
                  {t.short}
                </div>
              ))}
            </div>
            <div className="mt-3.5 flex items-center justify-between">
              <span className="text-[13px] font-medium text-faint">
                About 2 minutes · replay anytime from the Tour button
              </span>
              <div className="flex gap-2">
                <button
                  onClick={tourEnd}
                  className="h-11 cursor-pointer rounded-xl border-[1.5px] border-line bg-card px-4 text-sm font-bold text-ink"
                >
                  Maybe later
                </button>
                <button
                  onClick={() => tourGo(1)}
                  className="h-11 cursor-pointer rounded-xl bg-teal px-5 text-sm font-bold text-white"
                >
                  Start the tour
                </button>
              </div>
            </div>
          </>
        )}

        {isDone && (
          <>
            <div className="mb-1.5 flex h-14 w-14 items-center justify-center rounded-[18px] bg-teal-tint-12 font-display text-[26px] font-extrabold text-teal-text">
              ✓
            </div>
            <div className="font-display text-[28px] font-extrabold leading-[1.15] tracking-[-0.6px]">
              {title}
            </div>
            <div className="text-[15px] leading-[1.6] text-sub [text-wrap:pretty]">
              {tDef.body}
            </div>
            <div className="mt-3.5 flex justify-end gap-2">
              <button
                onClick={() => tourGo(1)}
                className="h-11 cursor-pointer rounded-xl border-[1.5px] border-line bg-card px-4 text-sm font-bold text-ink"
              >
                Watch again
              </button>
              <button
                onClick={tourEnd}
                className="h-11 cursor-pointer rounded-xl bg-teal px-5 text-sm font-bold text-white"
              >
                Start teaching
              </button>
            </div>
          </>
        )}

        {isStop && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold tracking-[1px] text-teal-text">
                STOP {stopIdx + 1} OF {TOUR_STOPS.length}
              </span>
              <button
                onClick={tourEnd}
                className="cursor-pointer p-0 text-[13px] font-semibold text-faint hover:text-ink"
              >
                Skip tour
              </button>
            </div>
            <div className="font-display text-[21px] font-extrabold leading-[1.2] tracking-[-0.4px]">
              {title}
            </div>
            <div className="text-sm leading-[1.6] text-sub [text-wrap:pretty]">{tDef.body}</div>
            <div className="mt-3 flex items-center justify-between">
              <div className="flex gap-[5px]">
                {TOUR_STOPS.map((t, i) => (
                  <span
                    key={t.key}
                    className="h-1.5 rounded-full"
                    style={{
                      width: i === stopIdx ? 18 : 6,
                      background: i <= stopIdx ? "#0FA3A0" : "#E8E2D6",
                      transition: "width 0.3s, background 0.3s",
                    }}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => tourGo(Math.max(0, tStep - 1))}
                  className="h-10 cursor-pointer rounded-xl border-[1.5px] border-line bg-card px-3.5 text-sm font-bold text-ink"
                >
                  Back
                </button>
                <button
                  onClick={() => tourGo(tStep + 1)}
                  className="h-10 cursor-pointer rounded-xl bg-teal px-[18px] text-sm font-bold text-white"
                >
                  {stopIdx === TOUR_STOPS.length - 1 ? "Finish" : "Next"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
