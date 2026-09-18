"use client";

import { useParams, usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { AccountMenu } from "@/components/AccountMenu";
import { AnimatedLogo } from "@/components/AnimatedLogo";
import { ConfirmDialogHost } from "@/components/ConfirmDialogHost";
import { ExportMenu } from "@/components/ExportMenu";
import { PlanBanner } from "@/components/PlanSurfaces";
import { TourOverlay } from "@/components/TourOverlay";
import { billingStrings } from "@/lib/billing";
import { headerMeta } from "@/lib/derive";
import { useEntitlement, useMounted, usePageTitle, usePeriodComputed } from "@/lib/hooks";
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
  const { limitHit, fil, L } = useEntitlement();
  const t = billingStrings(fil);

  // Demo-only entitlement override: localStorage.ulat_ent = Trialing | Active |
  // Past due | Grace | Free (stand-in for the prototype's tweaks panel).
  useEffect(() => {
    try {
      const v = localStorage.getItem("ulat_ent");
      if (v && ["Trialing", "Active", "Past due", "Grace", "Free"].includes(v))
        useUlat.setState({ entState: v as never });
    } catch {}
  }, []);

  // Browser-tab title tracks the page, e.g. "Gradebook · CS101 · Ulat".
  const pageForTitle = pathname.split("/").pop() || "overview";
  const titleNames: Record<string, string> = {
    overview: "Overview",
    gradebook: "Gradebook",
    assessments: "Assessments",
    attendance: "Attendance",
    students: "Students",
    sharing: "Sharing",
    settings: "Settings",
    profile: "Profile settings",
    billing: "Plan & billing",
    invoices: "Invoices",
    referrals: "Referrals",
  };
  const titleName = titleNames[pageForTitle] || "Overview";
  const titleAccount = ["profile", "billing", "invoices", "referrals"].includes(pageForTitle);
  usePageTitle(
    titleAccount || !cls ? `${titleName} · Ulat` : `${titleName} · ${cls.code} · Ulat`,
  );

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
  const onAccountPage = ["profile", "billing", "invoices", "referrals"].includes(page);
  const headerTitle =
    page === "billing" ? t.billing
    : page === "profile" ? L("Profile settings", "Profile settings")
    : page === "invoices" ? t.invoices
    : page === "referrals" ? t.referrals
    : cls.code + " · " + cls.title;
  const headerSub =
    page === "billing" ? t.billingSub
    : page === "profile"
      ? [st.profile.position, st.profile.department, st.profile.school].filter(Boolean).join(" · ") ||
        L("Add your institution details below", "Add your institution details below")
    : page === "invoices" ? t.invoicesSub
    : page === "referrals" ? t.referralRule
    : headerMeta(cls);

  const newClass = () => {
    if (limitHit) {
      st.confirm({
        title: L("You've reached 2 classes on the Free plan.", "Umabot ka na sa 2 klase sa Libreng plano."),
        body: L(
          "Pro gives you unlimited classes and the registrar-format export. Your existing classes are not affected.",
          "Sa Pro, walang limitasyong klase at may registrar-format na export. Hindi maaapektuhan ang mga klase mo ngayon.",
        ),
        confirmLabel: t.seePlans,
        onConfirm: () => router.push(`/c/${cls.id}/billing`),
      });
      return;
    }
    router.push("/new");
  };

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
      <div className="bg-panel-v3 flex min-h-0 flex-col border-r border-white/5 px-4 py-6 text-canvas">
        <div className="flex h-[34px] items-center px-2">
          <AnimatedLogo size={30} />
        </div>

        <div className="mx-2 mb-2 mt-8 flex items-center justify-between">
          <span className="text-[11px] font-bold tracking-[1.2px] text-muted">
            {L("CLASSES", "MGA KLASE")}
          </span>
          <button onClick={newClass} className="cursor-pointer p-0 text-xs font-bold text-amber">
            {L("+ New", "+ Bago")}
          </button>
        </div>
        <div data-tour="classes" className="flex flex-col gap-1">
          {activeCls.map((c) => {
            const on = c.id === cls.id;
            return (
              <button
                key={c.id}
                onClick={() => pickCls(c)}
                className={`cursor-pointer rounded-xl px-3 py-2.5 text-left ${on ? "bg-teal text-white" : "text-canvas hover:bg-white/[0.06]"}`}
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
              {L(
                (st.showArchived ? "Hide" : "Show") + " archived (" + archivedCls.length + ")",
                (st.showArchived ? "Itago" : "Ipakita") + " ang naka-archive (" + archivedCls.length + ")",
              )}
            </button>
          )}
          {st.showArchived &&
            archivedCls.map((c) => {
              const on = c.id === cls.id;
              return (
                <button
                  key={c.id}
                  onClick={() => pickCls(c)}
                  className={`cursor-pointer rounded-xl px-3 py-2 text-left ${on ? "bg-teal text-white" : "text-muted hover:bg-white/[0.06]"}`}
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
          {L("THIS CLASS", "ANG KLASENG ITO")}
        </div>
        <div data-tour="nav" className="flex flex-col gap-0.5">
          {PAGES.map(([p, label]) => {
            const on = page === p;
            const badge = badges[p] || "";
            return (
              <button
                key={p}
                onClick={() => router.push(`/c/${cls.id}/${p}`)}
                className={`flex h-[38px] cursor-pointer items-center justify-between rounded-xl px-3 text-left text-sm font-semibold ${on ? "bg-panel-hover text-white" : "text-[#B7C0C8] hover:bg-white/[0.06]"}`}
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

        <AccountMenu clsId={cls.id} />
      </div>

      {/* Main column */}
      <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">
        <div className="header-frost flex flex-shrink-0 items-center justify-between gap-6 px-8 py-[22px]">
          <div className="min-w-0">
            <div className="title-gradient truncate font-display text-[22px] font-extrabold tracking-[-0.4px]">
              {headerTitle}
            </div>
            <div className="mt-[3px] truncate text-[13px] font-medium text-sub">{headerSub}</div>
          </div>
          {!onAccountPage && (
          <div className="flex flex-shrink-0 items-center gap-2.5">
            <span
              className="mr-1.5 inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium"
              style={{ color: st.saved ? "#0B807E" : "#8A6400" }}
            >
              <span
                className="inline-block h-[7px] w-[7px] rounded-full"
                style={{
                  background: st.saved ? "#0FA3A0" : "#F5B70A",
                  animation: "ulatPulse 2.4s ease-out infinite",
                }}
              />
              {st.saved
                ? L("All changes saved · students see them now", "Naka-save lahat · kita na ng mga estudyante")
                : L("Saving…", "Sine-save…")}
            </span>
            <ExportMenu clsId={cls.id} />
            <button
              data-tour="add-asm"
              onClick={() => router.push(`/c/${cls.id}/assessments`)}
              className="h-[38px] cursor-pointer whitespace-nowrap rounded-xl bg-teal px-4 text-[13px] font-bold text-white"
            >
              + Assessment
            </button>
          </div>
          )}
        </div>

        <PlanBanner clsId={cls.id} />

        {/* Keyed by pathname so every page change gets the same soft entrance. */}
        <div
          key={pathname}
          className="bg-content-v3 flex min-h-0 flex-1 flex-col px-8 pb-7 pt-6"
          style={{ animation: "ulatIn .3s ease both" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
