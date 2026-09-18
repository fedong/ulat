"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { fmtLong } from "@/lib/billing";
import { DEMO_INSTRUCTOR, profileFullName, profileInitials } from "@/lib/derive";
import { useEntitlement } from "@/lib/hooks";
import { doSignOut } from "@/lib/session";
import { useUlat } from "@/lib/store";

/** Sidebar account card + pop-up menu (v3.1). Replaces the old profile card. */
export function AccountMenu({ clsId }: { clsId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const st = useUlat();
  const { ent, activeN, L } = useEntitlement();
  const page = pathname.split("/").pop() || "overview";
  const menuOpen = st.menuOpen;
  const set = st.set;
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") set({ menuOpen: false });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen, set]);

  const authName = profileFullName(st.profile) || DEMO_INSTRUCTOR.name;
  const authEmail = st.email || st.auth.email || DEMO_INSTRUCTOR.email;
  const untilTxt = ent.until ? fmtLong(ent.until) : "";

  const planChipTitle = {
    Trialing: "Pro · trial",
    Active: "Pro",
    "Past due": L("Pro · payment issue", "Pro · problema sa bayad"),
    Grace: L("Pro · grace period", "Pro · palugit"),
    Free: L("Free plan", "Libreng plano"),
  }[ent.state];
  const planChipSub =
    ent.state === "Trialing"
      ? L("Free until ", "Libre hanggang ") + untilTxt
      : ent.state === "Active"
        ? (ent.autoRenew ? L("Renews ", "Mare-renew ") : L("Ends ", "Matatapos ")) + untilTxt + " · " + ent.method
        : ent.state === "Past due"
          ? L("Retrying until ", "Susubukan ulit hanggang ") + untilTxt
          : ent.state === "Grace"
            ? L("Full access until ", "Buong access hanggang ") + untilTxt
            : activeN + L(" of 2 classes", " sa 2 klase");
  const planDot =
    ent.state === "Past due" ? "#D14B33" : ent.state === "Grace" ? "#F5B70A" : ent.tier === "PRO" ? "#0FA3A0" : "#7B8792";

  const onAccountPage = ["profile", "billing", "invoices", "referrals"].includes(page);

  const go = (k: string) => {
    if (k === "tour") {
      st.set({ menuOpen: false, tour: { step: 0 }, tourRect: null });
      router.push(`/c/${clsId}/overview`);
      return;
    }
    if (k === "help") {
      st.set({ menuOpen: false });
      st.confirm({
        title: L("Get help", "Humingi ng tulong"),
        body: L(
          "Email help@ulat.ph or message us in the app. We reply within one working day; Pro subscribers get priority.",
          "Mag-email sa help@ulat.ph o mag-message sa app. Sasagot kami sa loob ng isang araw ng trabaho; priority ang Pro.",
        ),
        confirmLabel: "OK",
        onConfirm: () => {},
      });
      return;
    }
    st.set({ menuOpen: false, checkout: null });
    router.push(`/c/${clsId}/${k}`);
  };

  const menuItems: [string, string, string][] = [
    ["profile", L("Profile settings", "Profile settings"), ""],
    ["billing", L("Plan & billing", "Plano at bayad"), planChipSub],
    ["invoices", L("Invoices", "Mga invoice"), ""],
    ["referrals", L("Refer a colleague", "Mag-refer"), L("₱199 credit each", "₱199 credit bawat isa")],
    ["tour", L("Take the tour", "Tour"), ""],
    ["help", L("Get help", "Humingi ng tulong"), ""],
  ];

  return (
    <div className="relative mt-auto">
      {st.menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => st.set({ menuOpen: false })} />
          <div
            className="absolute inset-x-0 bottom-[calc(100%+8px)] z-[41] flex flex-col rounded-[14px] p-1.5"
            style={{
              background: "#16242F",
              border: "1.5px solid rgba(255,255,255,0.1)",
              boxShadow: "0 18px 40px rgba(0,0,0,0.45)",
              animation: "ulatIn .2s ease both",
            }}
          >
            <div
              className="mb-1 truncate px-3 pb-2.5 pt-2 text-xs text-muted"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
            >
              {authEmail}
            </div>
            {menuItems.map(([k, label, hint]) => (
              <button
                key={k}
                onClick={() => go(k)}
                className="flex h-[38px] cursor-pointer items-center justify-between gap-2.5 rounded-[9px] px-3 text-left text-[13px] font-semibold hover:!bg-white/[0.07]"
                style={{
                  background: page === k ? "rgba(15,163,160,0.14)" : "transparent",
                  color: page === k ? "#FFFFFF" : "#E6EBEE",
                }}
              >
                <span className="whitespace-nowrap">{label}</span>
                <span className="max-w-[110px] truncate text-[11px] font-medium text-muted">
                  {hint}
                </span>
              </button>
            ))}
            <div className="my-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
            <button
              onClick={() => {
                void doSignOut();
                router.push("/signin");
              }}
              className="flex h-[38px] cursor-pointer items-center rounded-[9px] px-3 text-left text-[13px] font-semibold text-[#B7C0C8] hover:!bg-white/[0.07] hover:text-canvas"
            >
              Sign out
            </button>
          </div>
        </>
      )}

      <button
        onClick={() => st.set({ menuOpen: !st.menuOpen })}
        title="Account"
        className="flex w-full cursor-pointer items-center gap-2.5 rounded-[14px] px-3 py-2.5 text-left text-canvas hover:!bg-white/[0.08]"
        style={{
          background: onAccountPage ? "rgba(15,163,160,0.14)" : "#16242F",
          border: `1.5px solid ${onAccountPage ? "#0FA3A0" : "transparent"}`,
        }}
      >
        <div className="avatar-teal flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl font-display text-sm font-extrabold text-white">
          {profileInitials(st.profile)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold">{authName}</div>
          <div className="flex items-center gap-[5px] truncate text-xs text-muted">
            <span
              className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
              style={{ background: planDot }}
            />
            {planChipTitle}
          </div>
        </div>
        <span className="text-[11px] font-semibold text-muted">{st.menuOpen ? "▾" : "▴"}</span>
      </button>
    </div>
  );
}
