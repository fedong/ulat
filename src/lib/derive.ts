import { scaleLabel, shown, txBase } from "./grading";
import type { Grading, Klass, TeamMember } from "./types";

/** "Prof. Ramon Dizon" → "Prof. Dizon". */
export const honor = (n: string) => {
  const m = n.match(/^((?:Prof|Mr|Ms|Mrs|Dr|Engr)\.)\s+/);
  return (m ? m[1] + " " : "") + n.split(" ").pop();
};

export const isActive = (m: TeamMember) => m.status === "active";
export const teamOf = (c: Klass) => (c.team || []).filter(isActive);

export const passingShown = (gs: Grading) => shown(gs, Number(gs.passing) || 0);

/** Short grading summary for the header meta line. */
export const systemShort = (gs: Grading) => {
  const base = txBase(gs);
  return (
    (gs.groups.length > 1
      ? gs.groups.map((g) => g.name + " " + g.weight).join(" / ")
      : gs.groups[0].comps.map((c) => c.name + " " + c.w).join(", ")) +
    " · " +
    scaleLabel(gs) +
    " · passing " +
    passingShown(gs) +
    (base !== null ? " · transmuted base " + base : "")
  );
};

/** Full grading summary used in Settings / review screens. */
export const systemLine = (gs: Grading) => {
  const base = txBase(gs);
  return (
    gs.groups
      .map(
        (g) =>
          (gs.groups.length > 1 ? g.name + " " + g.weight + "% (" : "") +
          g.comps.map((c) => c.name + " " + c.w).join(", ") +
          (gs.groups.length > 1 ? ")" : ""),
      )
      .join(" · ") +
    " · " +
    scaleLabel(gs) +
    " · passing " +
    passingShown(gs) +
    (base !== null ? " · transmuted base " + base : "")
  );
};

export const headerMeta = (cls: Klass) => {
  const activeTeam = teamOf(cls);
  return (
    cls.section +
    " · " +
    cls.roster.length +
    " students · " +
    systemShort(cls.grading) +
    (activeTeam.length ? " · with " + activeTeam.map((m) => honor(m.name)).join(", ") : "")
  );
};

export const fmtDate = (iso: string) => {
  const dt = new Date(iso + "T00:00:00");
  return isNaN(dt.getTime())
    ? iso
    : dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export const fmtTime = (hm: string) => {
  if (!hm) return "";
  const [h, m] = hm.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  return (((h + 11) % 12) + 1) + (m ? ":" + String(m).padStart(2, "0") : "") + " " + ap;
};

export const slotText = (s: { days: string[]; start: string; end: string; where: string }) =>
  (s.days.length
    ? s.days.map((d) => (d === "Thu" ? "Th" : d[0] === "T" ? "T" : d === "Sat" ? "Sa" : d[0])).join("")
    : "No day") +
  " " +
  fmtTime(s.start) +
  "–" +
  fmtTime(s.end) +
  (s.where ? " · " + s.where : "");

export const consultSummary = (cls: Klass) => {
  const consult = cls.consult || { slots: [], note: "" };
  const hasHours = consult.slots.some((s) => s.days.length);
  return hasHours
    ? consult.slots.filter((s) => s.days.length).map(slotText).join(" · ") +
        (consult.note ? ". " + consult.note : "")
    : "No consultation hours yet.";
};

export const DEMO_INSTRUCTOR = {
  name: "Prof. Dolores Rivera",
  email: "d.rivera@univ.edu.ph",
};

export const initialsOf = (name: string) =>
  name
    .replace(/^Prof\.\s*/, "")
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

interface ProfileNameParts {
  title: string;
  first: string;
  last: string;
  suffix: string;
  nameStyle: "short" | "full";
}

/** "Prof. Dolores Rivera, PhD" — used on exports and the profile header. */
export const profileFullName = (p: ProfileNameParts) =>
  [p.title, p.first, p.last].filter(Boolean).join(" ") + (p.suffix ? ", " + p.suffix : "");

/** Name as students and guardians see it, following the chosen style. */
export const profileShownName = (p: ProfileNameParts) => {
  const full = [p.title, p.first, p.last].filter(Boolean).join(" ");
  const short = p.title ? p.title + " " + (p.last || p.first) : [p.first, p.last].filter(Boolean).join(" ");
  return (p.nameStyle === "full" ? full : short) || "Instructor";
};

export const profileInitials = (p: ProfileNameParts) =>
  ((((p.first || "")[0] || "") + ((p.last || "")[0] || "")) || "IN").toUpperCase();
