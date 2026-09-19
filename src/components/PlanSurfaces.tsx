"use client";

import { usePathname, useRouter } from "next/navigation";
import { billingStrings, defaultKeepIds, fmtDM, daysLeft, gradedN } from "@/lib/billing";
import { useEntitlement } from "@/lib/hooks";
import { useUlat } from "@/lib/store";

/** Site-wide plan banner + read-only class strip (under the header). */
export function PlanBanner({ clsId }: { clsId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const st = useUlat();
  const { ent, ro, L, fil } = useEntitlement();
  const t = billingStrings(fil);
  const page = pathname.split("/").pop() || "overview";

  const hasBanner = ["Trialing", "Grace", "Past due"].includes(ent.state);
  const untilDM = ent.until ? fmtDM(ent.until) : "";
  const dl = ent.until ? daysLeft(ent.until) : 0;

  const bannerText =
    ent.state === "Trialing"
      ? L(
          "You're on Pro — free until " + untilDM + ". " + dl + " days left.",
          "Nasa Pro ka — libre hanggang " + untilDM + ". " + dl + " araw pa.",
        )
      : ent.state === "Grace"
        ? L(
            "Your Pro trial has ended. You'll keep full access until your term finishes on " + untilDM + ".",
            "Tapos na ang Pro trial mo. Mananatili ang buong access hanggang matapos ang term sa " + untilDM + ".",
          )
        : L(
            "We couldn't charge your " + ent.method + ". Pro access continues while we retry until " + untilDM + ".",
            "Hindi na-charge ang " + ent.method + " mo. Tuloy ang Pro habang sinusubukan ulit hanggang " + untilDM + ".",
          );
  const bannerCta =
    ent.state === "Trialing"
      ? L("See plans", "Tingnan ang mga plano")
      : ent.state === "Grace"
        ? L("Keep Pro", "Panatilihin ang Pro")
        : L("Update payment method", "I-update ang bayad");
  // Trialing gets the strong dark-gradient treatment (same family as the
  // billing referral banner) with an amber CTA; Grace stays amber-tinted and
  // Past due stays red.
  const strong = ent.state === "Trialing";
  const [bg, border, color] =
    ent.state === "Grace"
      ? ["#FFF6DC", "#F2DFA0", "#8A6400"]
      : ["#FBE9E5", "#F1C7BE", "#B03A24"];

  return (
    <>
      {hasBanner && (
        <div
          className="flex flex-shrink-0 items-center justify-between gap-4 px-8 py-2.5"
          style={
            strong
              ? {
                  background: "linear-gradient(135deg,#101D26 0%,#16242F 100%)",
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                }
              : { background: bg, borderBottom: `1px solid ${border}` }
          }
        >
          <span
            className="text-[13px] font-semibold"
            style={{ color: strong ? "#F5D98F" : color }}
          >
            {bannerText}
          </span>
          {page !== "billing" && (
            <button
              onClick={() => {
                st.set({ checkout: null });
                router.push(`/c/${clsId}/billing`);
              }}
              className="h-[30px] flex-shrink-0 cursor-pointer whitespace-nowrap rounded-full px-3.5 text-xs font-bold"
              style={
                strong
                  ? { background: "#F5B70A", color: "#1A2530", border: "none" }
                  : { background: "transparent", border: `1.5px solid ${color}`, color }
              }
            >
              {bannerCta}
            </button>
          )}
        </div>
      )}
      {ro.has(clsId) && (
        <div className="flex flex-shrink-0 items-center justify-between gap-4 border-b border-line bg-hairline px-8 py-2.5">
          <span className="text-[13px] font-semibold text-sub">
            {L(
              "This class is read-only on the Free plan. Viewing, export, student standing and guardian digests continue; new grades, assessments and attendance are paused.",
              "Read-only ang klaseng ito sa Libreng plano. Tuloy ang pagtingin, export, standing ng estudyante at guardian digest; naka-pause ang bagong marka, pagsusulit at attendance.",
            )}
          </span>
          <button
            onClick={() => st.set({ selDone: false })}
            className="h-[30px] flex-shrink-0 cursor-pointer whitespace-nowrap rounded-full border-[1.5px] border-sub bg-transparent px-3 text-xs font-bold text-sub"
          >
            {L("Choose classes", "Pumili ng klase")}
          </button>
        </div>
      )}
      <FreeLimitModal clsId={clsId} t={t} />
    </>
  );
}

/** Blocking "choose 2 classes to keep editable" modal (FREE over the limit). */
function FreeLimitModal({ clsId, t }: { clsId: string; t: ReturnType<typeof billingStrings> }) {
  const router = useRouter();
  const st = useUlat();
  const { ent, L } = useEntitlement();
  const activeCls = st.classes.filter((c) => !c.archived);
  const overLimit = ent.tier === "FREE" && activeCls.length > 2;
  if (!overLimit || st.selDone) return null;

  const keep = st.editableIds && st.editableIds.length ? st.editableIds : defaultKeepIds(st.classes);
  const pick = st.pickIds || keep;

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center"
      style={{
        background: "rgba(16,29,38,0.45)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
    >
      <div
        className="flex w-[520px] flex-col gap-2.5 rounded-[20px] bg-white px-7 pb-6 pt-7"
        style={{ boxShadow: "0 24px 60px rgba(16,29,38,0.3)" }}
      >
        <div className="font-display text-[22px] font-extrabold tracking-[-0.4px]">
          {t.selTitle}
        </div>
        <div className="text-sm leading-[1.55] text-sub">{t.selBody}</div>
        <div className="mt-2 flex flex-col gap-2">
          {activeCls.map((c) => {
            const on = pick.includes(c.id);
            return (
              <button
                key={c.id}
                onClick={() =>
                  st.set({
                    pickIds: on
                      ? pick.filter((x) => x !== c.id)
                      : pick.length >= 2
                        ? [pick[1], c.id]
                        : [...pick, c.id],
                  })
                }
                className="flex cursor-pointer items-center gap-3 rounded-xl px-3.5 py-3 text-left text-ink"
                style={{
                  border: `1.5px solid ${on ? "#0FA3A0" : "#E8E2D6"}`,
                  background: on ? "rgba(15,163,160,0.08)" : "#FFFFFF",
                }}
              >
                <span
                  className="h-[18px] w-[18px] flex-shrink-0 rounded-md"
                  style={{
                    border: `2px solid ${on ? "#0FA3A0" : "#D9D3C7"}`,
                    background: on ? "#0FA3A0" : "#FFFFFF",
                  }}
                />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm font-bold">
                    {c.code} · {c.section}{" "}
                    <span className="font-medium text-sub">· {c.title}</span>
                  </span>
                  <span className="text-xs text-sub">
                    {gradedN(c) + L(" grades recorded", " na marka")} ·{" "}
                    {c.assessments.length + L(" assessments", " na pagsusulit")}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-3.5 flex items-center justify-between gap-3">
          <span className="text-[13px] font-medium text-faint">
            {pick.length} / 2 · {t.selNote}
          </span>
          <div className="flex flex-shrink-0 gap-2">
            <button
              onClick={() => {
                st.set({ selDone: true, editableIds: null, checkout: null });
                router.push(`/c/${clsId}/billing`);
              }}
              className="h-[42px] cursor-pointer whitespace-nowrap rounded-xl border-[1.5px] border-line bg-white px-4 text-sm font-bold text-ink"
            >
              {t.seePlans}
            </button>
            <button
              onClick={() => {
                if (pick.length === 2) st.set({ editableIds: pick, selDone: true, pickIds: null });
              }}
              className="h-[42px] cursor-pointer whitespace-nowrap rounded-xl px-[18px] text-sm font-bold text-white"
              style={{ background: pick.length === 2 ? "#0FA3A0" : "#B8C0C6" }}
            >
              {t.selSave}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
