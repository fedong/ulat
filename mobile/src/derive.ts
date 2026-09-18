import type { Grading, Klass } from "@ulat/grade-math";
import { shown } from "@ulat/grade-math";

export const todayIso = () => new Date().toISOString().slice(0, 10);

export const fmtDate = (iso: string) => {
  const dt = new Date(iso + "T00:00:00");
  return isNaN(dt.getTime())
    ? iso
    : dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export const daysUntil = (iso: string) =>
  Math.round(
    (new Date(iso + "T00:00:00").getTime() - new Date(todayIso() + "T00:00:00").getTime()) / 864e5,
  );

export const countdown = (iso: string) => {
  const d = daysUntil(iso);
  return d === 0 ? "today" : d === 1 ? "tomorrow" : "in " + d + " days";
};

/** "Prof. Ramon Dizon" → "Prof. Dizon". */
export const honor = (n: string) => {
  const m = n.match(/^((?:Prof|Mr|Ms|Mrs|Dr|Engr)\.)\s+/);
  return (m ? m[1] + " " : "") + n.split(" ").pop();
};

export const fmtTime = (hm: string) => {
  if (!hm) return "";
  const [h, m] = hm.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  return (((h + 11) % 12) + 1) + (m ? ":" + String(m).padStart(2, "0") : "") + " " + ap;
};

export const consultSummary = (cls: Klass) => {
  const consult = cls.consult || { slots: [], note: "" };
  const hasHours = consult.slots.some((s) => s.days.length);
  if (!hasHours) return "No consultation hours yet.";
  const slotText = (s: { days: string[]; start: string; end: string; where: string }) =>
    s.days.map((d) => (d === "Thu" ? "Th" : d === "Sat" ? "Sa" : d[0] === "T" ? "T" : d[0])).join("") +
    " " +
    fmtTime(s.start) +
    "–" +
    fmtTime(s.end) +
    (s.where ? " · " + s.where : "");
  return (
    consult.slots.filter((s) => s.days.length).map(slotText).join(" · ") +
    (consult.note ? ". " + consult.note : "")
  );
};

export const hasConsultHours = (cls: Klass) =>
  (cls.consult || { slots: [] }).slots.some((s) => s.days.length);

export const passingShown = (gs: Grading) => shown(gs, Number(gs.passing) || 0);

export const passingLineOf = (gs: Grading) =>
  gs.scale === "5pt"
    ? "Passing at " + passingShown(gs) + " or lower · 1.00 is highest"
    : "Passing at " + passingShown(gs) + " or higher";

export const DEMO_INSTRUCTOR = { name: "Prof. Dolores Rivera", email: "d.rivera@univ.edu.ph" };

/** "Reyes, Ana" → "Ana"; "Reyes, Ana T." → "Ana". */
export const firstNameOf = (rosterName: string) => {
  const rest = rosterName.split(",")[1];
  return rest ? rest.trim().split(" ")[0] : rosterName;
};

export const initialsOfRosterName = (n: string) => {
  const [l, f] = n.split(",").map((s) => s.trim());
  return (((f || l)[0] || "") + (l[0] || "")).toUpperCase();
};

export const greeting = (fil: boolean) => {
  const h = new Date().getHours();
  if (fil) return h < 12 ? "Magandang umaga," : h < 18 ? "Magandang hapon," : "Magandang gabi,";
  return h < 12 ? "Good morning," : h < 18 ? "Good afternoon," : "Good evening,";
};
