"use client";

import { use } from "react";
import { CONSENTS_RAW, DEFAULT_GUARDIAN_SCOPES, ROLE_COLORS, SCOPES } from "@/lib/consents";
import { useClass, useUlat } from "@/lib/store";
import type { GuardianRole } from "@/lib/types";

const HOW_IT_WORKS: [string, React.ReactNode][] = [
  [
    "Guardian registers",
    <>
      In the Ulat app they choose <b>I&apos;m a guardian</b>, verify a mobile number or
      email, and pick their role: Mother, Father, Grandparent, or Guardian.
    </>,
  ],
  [
    "Connects to the child",
    "You send an invite from this page, or the guardian enters the student's number and the school confirms the match. No approval from the student is needed.",
  ],
  [
    "Linked once, shared everywhere",
    "The link is between accounts, not classes. Every class the student takes on Ulat shares with the guardian automatically, each under its own class policy. No re-invite needed.",
  ],
];

export default function SharingPage({ params }: { params: Promise<{ clsId: string }> }) {
  const { clsId } = use(params);
  const st = useUlat();
  const cls = useClass(clsId);
  if (!cls) return null;
  const roster = cls.roster;

  const toast = (msg: string) =>
    st.confirm({ title: "Sent", body: msg, confirmLabel: "OK", onConfirm: () => {} });

  const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const linkOk =
    st.linkName.trim().length > 1 &&
    (/\S+@\S+\.\S+/.test(st.linkContact) || st.linkContact.replace(/\D/g, "").length >= 10);
  const closeLink = () =>
    st.set({ linkFor: null, linkName: "", linkContact: "", linkRole: "Mother" });

  const gScopes = cls.guardianScopes || DEFAULT_GUARDIAN_SCOPES;
  const shareScopes = SCOPES.map((k) => {
    const locked = k === "Grades" || k === "Attendance";
    const on = !!gScopes[k];
    return {
      k,
      label: on ? "✓ " + k : k,
      border: on ? "#0FA3A0" : "#E8E2D6",
      bg: on ? "rgba(15,163,160,0.12)" : "#FFFFFF",
      color: on ? "#0B807E" : "#5A6672",
      cursor: locked ? "default" : "pointer",
      toggle: () => {
        if (locked) return;
        st.upCls(cls.id, () => ({ guardianScopes: { ...gScopes, [k]: !on } }));
      },
    };
  });

  const consents = roster.map((r, i) => {
    const [gRaw, , date0, status0] = CONSENTS_RAW[i % CONSENTS_RAW.length];
    const mkContact = (j: number) =>
      "+63 9" + String(17 + i + j).padStart(2, "0") + " " +
      String(200 + i * 37 + j * 11).padStart(3, "0") + " " +
      String(1000 + i * 913 + j * 71).slice(-4);
    const linked =
      status0 === "Active"
        ? gRaw.split("|").map((s, j) => {
            const [name, role] = s.split(" · ");
            return { name, role: role as GuardianRole, contact: mkContact(j), pending: false, date: undefined as string | undefined };
          })
        : [];
    const invited = (st.links[r.id] || []).map((p) => ({
      name: p.name,
      role: p.role,
      contact: p.contact,
      pending: true,
      date: p.date as string | undefined,
    }));
    const guardians = [...linked, ...invited].map((g) => {
      const [roleBg, roleColor] = ROLE_COLORS[g.role] || ROLE_COLORS.Guardian;
      return { ...g, roleBg, roleColor };
    });
    const nLinked = linked.length;
    const nPending = invited.length;
    const status = nLinked ? "Linked" + (nLinked > 1 ? " · " + nLinked : "") : nPending ? "Pending" : "Not linked";
    const date = nLinked ? date0 : nPending ? "Invited " + invited[0].date : "—";
    const wasNudged = !!st.nudged[r.id];
    const first = r.name.split(",")[1].trim().split(" ")[0];
    const open = st.linkFor === r.id;
    return {
      id: r.id,
      name: r.name,
      first,
      guardians,
      date,
      status,
      statusColor: nLinked ? "#0B807E" : nPending ? "#8A6400" : "#5A6672",
      canNudge: !nLinked,
      nudgeLabel: wasNudged ? (nPending ? "Reminded" : "Asked") : nPending ? "Remind guardian" : "Ask student",
      nudgeBg: wasNudged ? "rgba(15,163,160,0.12)" : "#FFFFFF",
      nudgeColor: wasNudged ? "#0B807E" : "#22303C",
      nudge: () => {
        if (wasNudged) return;
        st.set({ nudged: { ...st.nudged, [r.id]: true } });
        toast(
          nPending
            ? "Reminder sent to " + invited.map((g) => g.name).join(" and ") + " to finish registering."
            : first + " is asked to submit a guardian's name, role and contact number.",
        );
      },
      canLink: !open,
      inviteLabel: nLinked || nPending ? "+ Guardian" : "Invite guardian",
      inviteBg: nLinked || nPending ? "#FFFFFF" : "#0FA3A0",
      inviteColor: nLinked || nPending ? "#0B807E" : "#FFFFFF",
      linkOpen: open,
      openLink: () =>
        st.set({
          linkFor: r.id,
          linkName: "",
          linkContact: "",
          linkRole: nLinked || nPending ? "Father" : "Mother",
        }),
      sendLink: () => {
        if (!linkOk) return;
        const name = st.linkName.trim();
        st.set({
          links: {
            ...st.links,
            [r.id]: [
              ...(st.links[r.id] || []),
              { name, contact: st.linkContact.trim(), role: st.linkRole, date: today },
            ],
          },
          linkFor: null,
          linkName: "",
          linkContact: "",
          linkRole: "Mother",
        });
        toast("Invite sent to " + name + ". Sharing starts as soon as they register.");
      },
    };
  });
  const shareCount = consents.filter((c) => c.status.startsWith("Linked")).length;

  const gridCols = "1.2fr 1.5fr 1fr 1.4fr 1fr 110px 205px";

  return (
    <>
      {/* How it works */}
      <div className="mb-3.5 grid flex-shrink-0 grid-cols-[repeat(3,minmax(0,1fr))] gap-3">
        {HOW_IT_WORKS.map(([title, body], i) => (
          <div key={i} className="flex gap-3 rounded-[14px] bg-card px-4 py-3.5 shadow-card">
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-teal-tint-12 text-[13px] font-bold text-teal-text">
              {i + 1}
            </span>
            <div>
              <div className="text-sm font-bold text-ink">{title}</div>
              <div className="mt-[3px] text-xs leading-[1.5] text-sub [text-wrap:pretty]">
                {body}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Class policy bar */}
      <div
        data-tour="sharing"
        className="mb-3.5 flex flex-shrink-0 flex-wrap items-center gap-3 rounded-[14px] bg-card px-4 py-3 shadow-card"
      >
        <div className="text-[13px] font-bold text-ink">Shared with every linked guardian</div>
        <div className="flex flex-wrap gap-1.5">
          {shareScopes.map((s) => (
            <button
              key={s.k}
              onClick={s.toggle}
              className="whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold"
              style={{
                border: `1.5px solid ${s.border}`,
                background: s.bg,
                color: s.color,
                cursor: s.cursor,
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="ml-auto text-xs text-sub">
          Grades and Attendance are always shared. {shareCount} of {roster.length} students
          have at least one linked guardian.
        </div>
      </div>

      {/* Consent table */}
      <div className="flex min-h-0 flex-shrink flex-col overflow-hidden rounded-2xl bg-card shadow-card">
        <div
          className="label-caps grid gap-2 border-b border-line bg-canvas px-[18px] py-3 text-sub"
          style={{ gridTemplateColumns: gridCols }}
        >
          <span>STUDENT</span>
          <span>GUARDIAN</span>
          <span>ROLE</span>
          <span>CONTACT</span>
          <span>LINKED</span>
          <span className="text-right">STATUS</span>
          <span className="text-right">ACTION</span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {consents.map((c) => (
            <div key={c.id} className="border-b border-hairline">
              <div
                className="grid min-h-[50px] items-center gap-2 px-[18px] py-2.5 text-sm font-medium"
                style={{ gridTemplateColumns: gridCols }}
              >
                <span className="font-semibold">{c.name}</span>
                <span className="flex flex-col gap-2">
                  {c.guardians.length === 0 && <span className="text-faint">—</span>}
                  {c.guardians.map((g, j) => (
                    <span key={j} className="flex h-[22px] min-w-0 items-center gap-1.5">
                      <span className="truncate text-ink">{g.name}</span>
                      {g.pending && (
                        <span className="whitespace-nowrap text-[11px] font-semibold text-amber-text">
                          · pending
                        </span>
                      )}
                    </span>
                  ))}
                </span>
                <span className="flex flex-col items-start gap-2">
                  {c.guardians.map((g, j) => (
                    <span key={j} className="flex h-[22px] items-center">
                      <span
                        className="whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold"
                        style={{ background: g.roleBg, color: g.roleColor }}
                      >
                        {g.role}
                      </span>
                    </span>
                  ))}
                </span>
                <span className="flex flex-col gap-2">
                  {c.guardians.map((g, j) => (
                    <span
                      key={j}
                      className="flex h-[22px] items-center truncate text-[13px] text-sub"
                    >
                      {g.contact}
                    </span>
                  ))}
                </span>
                <span className="text-[13px] text-sub">{c.date}</span>
                <span
                  className="whitespace-nowrap text-right font-bold"
                  style={{ color: c.statusColor }}
                >
                  {c.status}
                </span>
                <span className="flex justify-end gap-1.5">
                  {c.canNudge && (
                    <button
                      onClick={c.nudge}
                      className="cursor-pointer whitespace-nowrap rounded-lg border border-line px-[9px] py-1.5 text-xs font-semibold"
                      style={{ background: c.nudgeBg, color: c.nudgeColor }}
                    >
                      {c.nudgeLabel}
                    </button>
                  )}
                  {c.canLink && (
                    <button
                      onClick={c.openLink}
                      className="cursor-pointer whitespace-nowrap rounded-lg border border-teal px-[9px] py-1.5 text-xs font-semibold"
                      style={{ background: c.inviteBg, color: c.inviteColor }}
                    >
                      {c.inviteLabel}
                    </button>
                  )}
                </span>
              </div>

              {c.linkOpen && (
                <div className="mx-[18px] mb-3.5 flex flex-col gap-2.5 rounded-xl border border-line bg-canvas px-4 py-3.5">
                  <div className="text-[13px] font-bold text-ink">
                    Invite a guardian for {c.first}
                  </div>
                  <div className="grid grid-cols-[1.4fr_1.6fr_1fr_auto_auto] items-center gap-2">
                    <input
                      value={st.linkName}
                      onChange={(e) => st.set({ linkName: e.target.value })}
                      placeholder="Guardian's full name"
                      className="h-9 rounded-lg border border-line bg-card px-3 text-[13px] font-medium outline-none focus:border-teal"
                    />
                    <input
                      value={st.linkContact}
                      onChange={(e) => st.set({ linkContact: e.target.value })}
                      placeholder="Mobile number or email"
                      className="h-9 rounded-lg border border-line bg-card px-3 text-[13px] font-medium outline-none focus:border-teal"
                    />
                    <select
                      value={st.linkRole}
                      onChange={(e) => st.set({ linkRole: e.target.value as GuardianRole })}
                      className="h-9 rounded-lg border border-line bg-card px-2.5 text-[13px] font-medium outline-none"
                    >
                      <option>Mother</option>
                      <option>Father</option>
                      <option>Grandparent</option>
                      <option>Guardian</option>
                    </select>
                    <button
                      onClick={c.sendLink}
                      className="h-9 cursor-pointer whitespace-nowrap rounded-lg px-3.5 text-[13px] font-semibold text-white"
                      style={{ background: linkOk ? "#0FA3A0" : "#B8C0C6" }}
                    >
                      Send invite
                    </button>
                    <button
                      onClick={closeLink}
                      className="h-9 cursor-pointer rounded-lg border border-line bg-card px-3 text-[13px] font-semibold text-sub"
                    >
                      Cancel
                    </button>
                  </div>
                  <div className="text-xs leading-[1.5] text-sub">
                    The guardian gets a one-time link to register or sign in. Once they confirm{" "}
                    {c.first}&apos;s student number, grades and attendance are shared right away
                    and {c.first} is notified.
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 flex-shrink-0 text-xs font-medium text-sub">
        Guardians linked here are linked to the student&apos;s account, so other instructors on
        Ulat see them too. This page only sets what {cls.code} shares.
      </div>
    </>
  );
}
