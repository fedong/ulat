"use client";

import { DEMO_INSTRUCTOR, profileFullName, profileInitials, profileShownName } from "@/lib/derive";
import { useUlat, type Profile } from "@/lib/store";

const capsLabel = "label-caps text-sub";
const inputCls =
  "h-10 rounded-[10px] border border-line bg-card px-3 text-sm font-medium text-ink outline-none";
const cardCls = "flex flex-col gap-3.5 rounded-2xl bg-card px-5 py-[18px] shadow-card";

const sectionHead = (title: string, sub?: string) => (
  <div className="px-0.5">
    <div className="font-display text-[17px] font-extrabold">{title}</div>
    {sub && <div className="mt-0.5 text-[13px] text-sub">{sub}</div>}
  </div>
);

const TITLES = ["", "Prof.", "Dr.", "Mr.", "Ms.", "Mrs.", "Engr.", "Atty.", "Sir", "Ma'am"];

export default function ProfilePage() {
  const st = useUlat();
  const prof = st.profile;
  const draft = st.profileDraft || prof;
  const authEmail = st.auth.email || DEMO_INSTRUCTOR.email;

  const upDraft = (patch: Partial<Profile>) =>
    st.set({ profileDraft: { ...(st.profileDraft || st.profile), ...patch } });
  const setP = (k: keyof Profile) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    upDraft({ [k]: e.target.value } as Partial<Profile>);

  const dirty = JSON.stringify(draft) !== JSON.stringify(prof);
  const save = () => {
    if (!dirty) return;
    st.set({ profile: st.profileDraft || st.profile, profileDraft: null, profileToast: true });
    setTimeout(() => useUlat.setState({ profileToast: false }), 2500);
  };
  const discard = () => st.set({ profileDraft: null });

  const barText = st.profileToast ? "Saved · applied across Ulat" : dirty ? "Unsaved changes" : "";
  const barColor = st.profileToast ? "#0B807E" : dirty ? "#8A6400" : "#9AA3AB";

  const changePw = () =>
    st.confirm({
      title: "Change password",
      body: "We will email a secure link to " + authEmail + ". The link expires in 30 minutes.",
      confirmLabel: "Send link",
      onConfirm: () => st.set({ profile: { ...st.profile, pwChanged: "today" } }),
    });
  const signOutAll = () =>
    st.confirm({
      title: "Sign out everywhere?",
      body: "Other browsers and the mobile app will need to sign in again. This session stays open.",
      confirmLabel: "Sign out everywhere",
      danger: true,
      onConfirm: () => {},
    });

  const notifPrefs: [keyof Profile["notif"], string, string][] = [
    ["risk", "At-risk alerts", "Email me when a student drops to At risk or Failing."],
    ["digest", "Weekly class digest", "Every Friday 5 PM: averages, missing work, attendance."],
    ["invites", "Co-instructor activity", "When a co-instructor accepts an invite or records grades."],
  ];

  return (
    <div className="-mr-2 flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto pr-2">
      <div className="mx-auto w-full flex max-w-[880px] items-center gap-[18px]">
        <div
          className="flex h-[72px] w-[72px] flex-shrink-0 items-center justify-center rounded-[22px] font-display text-[26px] font-extrabold text-white"
          style={{
            background: "linear-gradient(135deg,#17B5B1,#0B8F8C)",
            boxShadow: "0 10px 24px -10px rgba(15,163,160,0.7)",
          }}
        >
          {profileInitials(prof)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-[28px] font-extrabold leading-[1.1] tracking-[-0.6px]">
            {profileFullName(prof) || "Instructor"}
          </div>
          <div className="mt-1 text-sm font-medium text-sub">
            {[prof.position, prof.department, prof.school].filter(Boolean).join(" · ") ||
              "Add your institution details below"}
          </div>
        </div>
      </div>

      <div className="mx-auto w-full grid max-w-[880px] grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-5">
        {/* Left column */}
        <div className="flex min-w-0 flex-col gap-2.5">
          {sectionHead(
            "Name and title",
            "How your name appears to students, guardians and co-instructors, and on exported files.",
          )}
          <div className={cardCls}>
            <div className="grid grid-cols-[120px_1fr] gap-2.5">
              <label className="flex flex-col gap-1.5">
                <span className={capsLabel}>TITLE</span>
                <select value={draft.title} onChange={setP("title")} className={inputCls}>
                  {TITLES.map((t) => (
                    <option key={t} value={t}>
                      {t || "None"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={capsLabel}>FIRST NAME</span>
                <input value={draft.first} onChange={setP("first")} placeholder="Dolores" className={inputCls} />
              </label>
            </div>
            <div className="grid grid-cols-[1fr_100px] gap-2.5">
              <label className="flex flex-col gap-1.5">
                <span className={capsLabel}>LAST NAME</span>
                <input value={draft.last} onChange={setP("last")} placeholder="Rivera" className={inputCls} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={capsLabel}>SUFFIX</span>
                <input value={draft.suffix} onChange={setP("suffix")} placeholder="PhD, RMT" className={inputCls} />
              </label>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className={capsLabel}>STUDENTS AND GUARDIANS SEE</span>
              <div className="flex gap-1.5">
                {(
                  [
                    ["short", "Title + last name"],
                    ["full", "Full name"],
                  ] as const
                ).map(([k, label]) => {
                  const on = (draft.nameStyle || "short") === k;
                  return (
                    <button
                      key={k}
                      onClick={() => upDraft({ nameStyle: k })}
                      className="h-10 flex-1 cursor-pointer rounded-[10px] text-[13px] font-semibold"
                      style={{
                        border: `1.5px solid ${on ? "#0FA3A0" : "#E8E2D6"}`,
                        background: on ? "rgba(15,163,160,0.10)" : "#FFFFFF",
                        color: on ? "#0B807E" : "#5A6672",
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-line bg-canvas px-3.5 py-3">
              <div className="avatar-teal flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl font-display text-sm font-extrabold text-white">
                {profileInitials(draft)}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold">{profileShownName(draft)}</div>
                <div className="text-xs text-sub">
                  Preview · this is how &quot;{profileShownName(draft)} asked to see you&quot; reads
                  in the student app
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3.5">
            {sectionHead("Contact", "Shown to co-instructors. Students only see your consultation hours.")}
          </div>
          <div className={cardCls}>
            <label className="flex flex-col gap-1.5">
              <span className={capsLabel}>SIGN-IN EMAIL</span>
              <div className="flex items-center gap-2">
                <input
                  value={authEmail}
                  readOnly
                  className="h-10 flex-1 rounded-[10px] border border-line bg-canvas px-3 text-sm font-medium text-sub outline-none"
                />
                <span className="whitespace-nowrap rounded-full bg-teal-tint-12 px-2 py-1 text-[11px] font-semibold text-teal-text">
                  Verified
                </span>
              </div>
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <label className="flex flex-col gap-1.5">
                <span className={capsLabel}>MOBILE</span>
                <input value={draft.mobile} onChange={setP("mobile")} placeholder="0917 000 0000" className={inputCls} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={capsLabel}>OFFICE / ROOM</span>
                <input value={draft.office} onChange={setP("office")} placeholder="CAS 204" className={inputCls} />
              </label>
            </div>
          </div>

          <div className="mt-1 flex items-center justify-end gap-2.5">
            <span className="text-xs font-medium" style={{ color: barColor }}>
              {barText}
            </span>
            {dirty && (
              <button
                onClick={discard}
                className="h-10 cursor-pointer rounded-xl border-[1.5px] border-line bg-card px-4 text-[13px] font-bold text-ink"
              >
                Discard
              </button>
            )}
            <button
              onClick={save}
              className="h-10 rounded-xl px-[18px] text-[13px] font-bold text-white"
              style={{ background: dirty ? "#0FA3A0" : "#B8C0C6", cursor: dirty ? "pointer" : "default" }}
            >
              Save changes
            </button>
          </div>
        </div>

        {/* Right column */}
        <div className="flex min-w-0 flex-col gap-2.5">
          {sectionHead("Institution", "Printed under your name on exported gradebooks.")}
          <div className={cardCls}>
            <label className="flex flex-col gap-1.5">
              <span className={capsLabel}>SCHOOL</span>
              <input value={draft.school} onChange={setP("school")} placeholder="University name" className={inputCls} />
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <label className="flex flex-col gap-1.5">
                <span className={capsLabel}>COLLEGE / DEPARTMENT</span>
                <input value={draft.department} onChange={setP("department")} placeholder="College of Allied Health" className={inputCls} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={capsLabel}>POSITION</span>
                <input value={draft.position} onChange={setP("position")} placeholder="Assistant Professor" className={inputCls} />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <label className="flex flex-col gap-1.5">
                <span className={capsLabel}>FACULTY / EMPLOYEE ID</span>
                <input value={draft.facultyId} onChange={setP("facultyId")} placeholder="2019-0142" className={inputCls} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={capsLabel}>LICENSE (OPTIONAL)</span>
                <input value={draft.license} onChange={setP("license")} placeholder="PRC 0123456" className={inputCls} />
              </label>
            </div>
          </div>

          <div className="mt-3.5">{sectionHead("Preferences")}</div>
          <div className={cardCls}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Language</div>
                <div className="text-xs text-sub">
                  Interface language for you. Students choose their own.
                </div>
              </div>
              <div className="flex gap-1 rounded-[10px] border border-line bg-canvas p-[3px]">
                {(["English", "Filipino"] as const).map((l) => {
                  const on = (draft.lang || "English") === l;
                  return (
                    <button
                      key={l}
                      onClick={() => upDraft({ lang: l })}
                      className="h-[30px] cursor-pointer rounded-lg px-3 text-xs font-semibold"
                      style={{ background: on ? "#0FA3A0" : "transparent", color: on ? "#FFFFFF" : "#5A6672" }}
                    >
                      {l}
                    </button>
                  );
                })}
              </div>
            </div>
            {notifPrefs.map(([k, label, desc]) => {
              const on = !!draft.notif[k];
              return (
                <div key={k} className="flex items-center justify-between gap-3 border-t border-hairline pt-3">
                  <div>
                    <div className="text-sm font-semibold">{label}</div>
                    <div className="text-xs text-sub">{desc}</div>
                  </div>
                  <button
                    onClick={() => upDraft({ notif: { ...draft.notif, [k]: !on } })}
                    className="relative h-[26px] w-11 flex-shrink-0 cursor-pointer rounded-full"
                    style={{ background: on ? "#0FA3A0" : "#D9D3C7" }}
                  >
                    <span
                      className="absolute top-[3px] h-5 w-5 rounded-full bg-white"
                      style={{
                        left: on ? 21 : 3,
                        boxShadow: "0 1px 3px rgba(34,48,60,0.25)",
                        transition: "left 0.15s ease",
                      }}
                    />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-3.5">{sectionHead("Account")}</div>
          <div className={cardCls}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Password</div>
                <div className="text-xs text-sub">Last changed {prof.pwChanged}</div>
              </div>
              <button
                onClick={changePw}
                className="h-9 cursor-pointer rounded-[10px] border-[1.5px] border-line bg-card px-3.5 text-[13px] font-semibold text-ink hover:border-teal hover:text-teal-text"
              >
                Change password
              </button>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-hairline pt-3">
              <div>
                <div className="text-sm font-semibold">Sign out everywhere</div>
                <div className="text-xs text-sub">
                  Ends sessions on other browsers and the mobile app.
                </div>
              </div>
              <button
                onClick={signOutAll}
                className="h-9 cursor-pointer rounded-[10px] border-[1.5px] border-line bg-card px-3.5 text-[13px] font-semibold text-red-text hover:!border-red"
              >
                Sign out everywhere
              </button>
            </div>
            <div className="border-t border-hairline pt-3 text-xs leading-[1.5] text-faint">
              Your classes, grades and co-instructor invites stay with your account. Deleting a
              class is done from that class&apos;s Settings.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
