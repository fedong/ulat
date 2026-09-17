"use client";

import Image from "next/image";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { ConfirmDialogHost } from "@/components/ConfirmDialogHost";
import { TourOverlay } from "@/components/TourOverlay";
import { DEMO_INSTRUCTOR, headerMeta, initialsOf } from "@/lib/derive";
import { useMounted, usePeriodComputed } from "@/lib/hooks";
import { today, useUlat } from "@/lib/store";
import type { Klass } from "@/lib/types";

const PAGES: [string, string][] = [
  ["overview", "Overview"],
  ["gradebook", "Gradebook"],
  ["assessments", "Assessments"],
  ["attendance", "Attendance"],
  ["students", "Students"],
  ["sharing", "Sharing"],
  ["settings", "Settings"],
];

// This layout sits ABOVE the [clsId] segment so it survives class switches:
// only the page content remounts, never the sidebar/header (no flash).
export default function ClassLayout({ children }: { children: React.ReactNode }) {
  const { clsId } = useParams<{ clsId: string }>();
  const router = useRouter();
  const shellRef = useRef<HTMLDivElement>(null);
  const tourAuto = useRef(false);
  const pathname = usePathname();
  const mounted = useMounted();
  const st = useUlat();
  const cls = st.classes.find((c) => c.id === clsId);
  const computed = usePeriodComputed(cls);

  // Auto-start the product tour on first arrival unless already seen.
  // eslint-disable-next-line react-hooks/rules-of-hooks -- stable hook order: this layout always reaches here
  useEffect(() => {
    if (!mounted || tourAuto.current) return;
    tourAuto.current = true;
    let seen = false;
    try {
      seen = !!localStorage.getItem("ulat_tour_done");
    } catch {}
    if (!seen) {
      const t = setTimeout(() => useUlat.setState({ tour: { step: 0 } }), 500);
      return () => clearTimeout(t);
    }
  }, [mounted]);

  if (!mounted) return <div className="h-dvh bg-canvas" />;
  if (!cls) {
    router.replace("/");
    return null;
  }

  const page = pathname.split("/").pop() || "overview";
  const activeCls = st.classes.filter((c) => !c.archived);
  const archivedCls = st.classes.filter((c) => c.archived);
  const nInc = Object.values(computed).filter((c) => c.k === "inc").length;
  const authName = st.auth.name || DEMO_INSTRUCTOR.name;
  const authEmail = st.auth.email || DEMO_INSTRUCTOR.email;

  const badges: Record<string, string> = {
    gradebook: nInc ? nInc + " INC" : "",
    assessments: String(cls.assessments.length),
    attendance: cls.sessions.length + " sessions",
  };

  const pickCls = (c: Klass) => {
    st.set({
      period: c.periods[0],
      student: c.roster[0] ? c.roster[0].id : "",
      asmId: c.assessments[0] ? c.assessments[0].id : "",
      focus: "0-0",
      buffer: "",
      na: {
        ...st.na,
        comp: c.grading.groups[0].comps[0].id,
        period: c.periods[0],
        date: today(),
      },
    });
    router.push(`/c/${c.id}/${page}`);
  };

  return (
    <div
      ref={shellRef}
      className="relative grid h-dvh grid-cols-[240px_minmax(0,1fr)] overflow-hidden bg-canvas"
    >
      <ConfirmDialogHost />
      <TourOverlay clsId={cls.id} shellRef={shellRef} />

      {/* Sidebar */}
      <div className="flex min-h-0 flex-col bg-panel px-4 py-6 text-canvas">
        <div className="flex items-center gap-2.5 px-2">
          <Image src="/ulat-mark-white.svg" alt="" width={30} height={30} />
          <span className="font-display text-[26px] font-black tracking-[-0.8px]">ulat</span>
        </div>

        <div className="mx-2 mb-2 mt-8 flex items-center justify-between">
          <span className="text-[11px] font-bold tracking-[1.2px] text-muted">CLASSES</span>
          <button
            onClick={() => router.push("/new")}
            className="cursor-pointer p-0 text-xs font-bold text-amber"
          >
            + New
          </button>
        </div>
        <div data-tour="classes" className="flex flex-col gap-1">
          {activeCls.map((c) => {
            const on = c.id === cls.id;
            return (
              <button
                key={c.id}
                onClick={() => pickCls(c)}
                className={`cursor-pointer rounded-xl px-3 py-2.5 text-left ${on ? "bg-teal text-white" : "text-canvas hover:bg-panel-hover"}`}
              >
                <div className="text-sm font-bold">
                  {c.code} · {c.section}
                </div>
                <div className="mt-px text-xs opacity-80">
                  {c.title} · {c.term}
                </div>
              </button>
            );
          })}
          {archivedCls.length > 0 && (
            <button
              onClick={() => st.set({ showArchived: !st.showArchived })}
              className="cursor-pointer px-3 pb-0.5 pt-2 text-left text-xs font-semibold text-muted hover:text-canvas"
            >
              {(st.showArchived ? "Hide" : "Show") + " archived (" + archivedCls.length + ")"}
            </button>
          )}
          {st.showArchived &&
            archivedCls.map((c) => {
              const on = c.id === cls.id;
              return (
                <button
                  key={c.id}
                  onClick={() => pickCls(c)}
                  className={`cursor-pointer rounded-xl px-3 py-2 text-left ${on ? "bg-teal text-white" : "text-muted hover:bg-panel-hover"}`}
                >
                  <div className="text-[13px] font-semibold">
                    {c.code} · {c.section}
                  </div>
                  <div className="mt-px text-[11px] opacity-80">{c.term}</div>
                </button>
              );
            })}
        </div>

        <div className="mx-2 mb-2 mt-7 text-[11px] font-bold tracking-[1.2px] text-muted">
          THIS CLASS
        </div>
        <div data-tour="nav" className="flex flex-col gap-0.5">
          {PAGES.map(([p, label]) => {
            const on = page === p;
            const badge = badges[p] || "";
            return (
              <button
                key={p}
                onClick={() => router.push(`/c/${cls.id}/${p}`)}
                className={`flex h-[38px] cursor-pointer items-center justify-between rounded-xl px-3 text-left text-sm font-semibold ${on ? "bg-panel-hover text-white" : "text-[#B7C0C8] hover:bg-panel-hover"}`}
              >
                {label}
                <span
                  className="whitespace-nowrap text-[11px] font-bold"
                  style={{ color: badge.endsWith("INC") ? "#F5B70A" : "#7B8792" }}
                >
                  {badge}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-auto flex items-center gap-2.5 rounded-[14px] bg-panel-hover px-3 py-2.5">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-teal font-display text-sm font-extrabold text-white">
            {initialsOf(authName)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold">{authName}</div>
            <div className="truncate text-xs text-muted">{authEmail}</div>
          </div>
          <button
            onClick={() => {
              st.set({ signedIn: false });
              router.push("/signin");
            }}
            title="Sign out"
            className="cursor-pointer p-1 text-sm font-bold text-muted"
          >
            ⏻
          </button>
        </div>
      </div>

      {/* Main column */}
      <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">
        <div className="flex flex-shrink-0 items-center justify-between gap-6 border-b border-line bg-card px-8 py-[22px]">
          <div className="min-w-0">
            <div className="truncate font-display text-[22px] font-extrabold tracking-[-0.4px]">
              {cls.code} · {cls.title}
            </div>
            <div className="mt-[3px] truncate text-[13px] font-medium text-sub">
              {headerMeta(cls)}
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2.5">
            <span
              className="mr-1.5 inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium"
              style={{ color: st.saved ? "#0B807E" : "#8A6400" }}
            >
              <span
                className="inline-block h-[7px] w-[7px] rounded-full"
                style={{ background: st.saved ? "#0FA3A0" : "#F5B70A" }}
              />
              {st.saved ? "All changes saved · students see them now" : "Saving…"}
            </span>
            <button className="h-[38px] cursor-pointer whitespace-nowrap rounded-xl border-[1.5px] border-line bg-card px-4 text-[13px] font-bold text-ink hover:border-teal hover:text-teal-text">
              Export XLSX
            </button>
            <button
              onClick={() => st.set({ tour: { step: 0 }, tourRect: null })}
              title="Product tour"
              className="group flex h-[38px] cursor-pointer items-center gap-[7px] whitespace-nowrap rounded-xl border-[1.5px] border-line bg-card py-0 pl-2 pr-3 text-[13px] font-bold text-sub hover:border-teal hover:text-teal-text"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-tint-12 font-display text-xs font-extrabold text-teal-text">
                ?
              </span>
              Tour
            </button>
            <button
              data-tour="add-asm"
              onClick={() => router.push(`/c/${cls.id}/assessments`)}
              className="h-[38px] cursor-pointer whitespace-nowrap rounded-xl bg-teal px-4 text-[13px] font-bold text-white"
            >
              + Assessment
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col px-8 pb-7 pt-6">{children}</div>
      </div>
    </div>
  );
}
