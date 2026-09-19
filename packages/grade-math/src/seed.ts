import { PRESETS } from "./presets";
import type { AttMark, Klass, Score, StudentRow } from "./types";

export const mkClass = (o: Partial<Klass> & Pick<Klass, "id" | "code" | "title" | "section" | "term" | "schedule" | "joinCode" | "grading" | "roster">): Klass => ({
  assessments: [],
  archive: [],
  scores: {},
  sessions: [],
  remarks: {},
  consult: { slots: [], note: "" },
  periods: ["Prelims", "Midterms", "Semi-finals", "Finals"],
  ...o,
});

const DEMO_ROSTER = (): StudentRow[] =>
  [
    "Aquino, Paolo",
    "Bautista, Maria",
    "Dela Cruz, Juan",
    "Garcia, Jose",
    "Mendoza, Carlo",
    "Ramos, Nico",
    "Reyes, Ana",
    "Santos, Miguel",
    "Torres, Bea",
    "Villanueva, Liza",
  ].map((name, i) => ({
    id: "s" + (i + 1),
    no: "2024-0" + (1102 + i * 13),
    name,
    last: name.split(",")[0].trim(),
    first: name.split(",")[1].trim(),
    mi: "",
    issues: [],
  }));

/** Demo class 1: CS101 — single-group university preset, 4 periods seeded. */
function buildCS101(): Klass {
  const cs101 = mkClass({
    id: "cs101",
    code: "CS101",
    title: "Intro to Computing",
    section: "BSCS 2A",
    term: "1st Trimester · AY 2026–27",
    schedule: "Tue/Thu 9:00–10:30 · Rm 302",
    joinCode: "CS1A2Q",
    grading: PRESETS[0].make(),
    roster: DEMO_ROSTER(),
  });
  const g = cs101.grading;
  const comp = (gi: number, ci: number) => g.groups[gi].comps[ci].id;
  cs101.assessments = [
    { id: "a1", name: "Quiz 1", comp: comp(0, 0), period: "Prelims", max: 20, date: "2026-08-14" },
    { id: "a2", name: "Assignment 1", comp: comp(0, 1), period: "Prelims", max: 30, date: "2026-08-21" },
    { id: "a3", name: "Quiz 2", comp: comp(0, 0), period: "Prelims", max: 20, date: "2026-08-26" },
    { id: "a4", name: "Recitation 1", comp: comp(0, 2), period: "Prelims", max: 50, date: "2026-09-01" },
    { id: "a5", name: "Semis Exam", comp: comp(0, 3), period: "Prelims", max: 100, date: "2026-09-02" },
    { id: "a10", name: "Final Exam", comp: comp(0, 3), period: "Finals", max: 100, date: "2026-09-25", notes: "Chapters 4–7. Bring a calculator and your ID. Room 302, 9:00 AM." },
    { id: "a6", name: "Assignment 2", comp: comp(0, 1), period: "Prelims", max: 20, date: "2026-08-20" },
    { id: "a7", name: "Quiz 3", comp: comp(0, 0), period: "Prelims", max: 20, date: "2026-08-27" },
    { id: "a8", name: "Recitation 2", comp: comp(0, 2), period: "Prelims", max: 100, date: "2026-09-03" },
    { id: "a9", name: "Assignment 3", comp: comp(0, 1), period: "Prelims", max: 100, date: "2026-09-04" },
  ];
  const seed: (Score | null)[][] = [
    [15, 24, 16, 42, 76, 18, 17, 88, 80],
    [17, 26, "EXC", 46, 85, 19, 18, 92, 84],
    [11, 18, 9, 30, 68, 12, 10, 70, 61],
    [19, 29, 20, 48, 95, 20, 19, 97, 93],
    [16, 25, 15, 41, 80, 17, 16, 85, 79],
    [14, 22, 13, 38, "MISSED", 15, 14, 76, 70],
    [18, 27, 18, 45, 88, 18, 18, 90, 86],
    [14, 23, null, 40, 78, 16, 15, 82, 75],
    [18, 28, 19, 44, 90, 19, 19, 93, 88],
    [16, 25, 17, null, null, 17, 17, 86, null],
  ];
  cs101.scores = {};
  seed.forEach((row, ri) => {
    cs101.scores[cs101.roster[ri].id] = {};
    row.forEach((v, ai) => {
      cs101.scores[cs101.roster[ri].id]["a" + (ai + 1)] = v;
    });
  });
  cs101.assessments.forEach((a) => {
    if (a.period === "Prelims") a.period = "Semi-finals";
  });
  {
    const mk = (pre: string, period: string, dates: string[], shift: number[]) => {
      const defs: [string, number, number][] = [
        ["Quiz 1", 0, 20],
        ["Assignment 1", 1, 30],
        ["Quiz 2", 0, 20],
        ["Recitation 1", 2, 50],
        [
          period.replace("Semi-finals", "Semis").replace("Midterms", "Midterm").replace("Prelims", "Prelim") + " Exam",
          3,
          100,
        ],
      ];
      defs.forEach(([name, ci, max], i) =>
        cs101.assessments.push({ id: pre + (i + 1), name, comp: comp(0, ci), period, max, date: dates[i] }),
      );
      seed.forEach((row, ri) => {
        const sid = cs101.roster[ri].id;
        defs.forEach(([, , max], i) => {
          const b = row[i];
          const d = shift[(ri + i) % shift.length];
          let v: Score;
          if (typeof b === "number") v = Math.max(0, Math.min(max, Math.round(b + (d * max) / 100)));
          else if (b === "MISSED" && pre === "p" && i === 4) v = "MISSED";
          else v = Math.round(max * (0.72 + d / 100));
          cs101.scores[sid][pre + (i + 1)] = v;
        });
      });
    };
    mk("p", "Prelims", ["2026-06-18", "2026-06-25", "2026-06-30", "2026-07-07", "2026-07-09"], [-4, 2, -6, 0, -3, 4, -2]);
    mk("m", "Midterms", ["2026-07-16", "2026-07-23", "2026-07-28", "2026-08-04", "2026-08-06"], [1, -3, 3, -1, 2, -5, 0]);
    cs101.assessments.sort((a, b) => (a.date < b.date ? -1 : 1));
    cs101.closed = { Prelims: true, Midterms: true };
  }
  const marks = [
    "PPPPPPPPPP",
    "PPLPPPPPPP",
    "PAAAPPPPPP",
    "PPPPPPPPPP",
    "PPPPLPPPPP",
    "PPPAPAAPPP",
    "PPPPPLPPPP",
    "PPPPPPPPPP",
    "PPEPPPPPPP",
    "PPPPPPAPPP",
  ];
  cs101.sessions = [
    "2026-08-11",
    "2026-08-13",
    "2026-08-18",
    "2026-08-20",
    "2026-08-25",
    "2026-08-27",
    "2026-09-01",
    "2026-09-03",
    "2026-09-08",
    "2026-09-10",
  ].map((date, si) => ({
    date,
    marks: Object.fromEntries(cs101.roster.map((r, ri) => [r.id, marks[ri][si] as AttMark])),
  }));
  cs101.remarks = { s8: "1 missing quiz — retake open until Oct 3." };
  cs101.remarkLog = {
    s8: [
      { text: "Quiz 2 missed while sick. Make-up set for Sep 5.", at: Date.parse("2026-08-28") },
      { text: "1 missing quiz — retake open until Oct 3.", at: Date.parse("2026-09-08") },
    ],
  };
  cs101.flags = { s3: true };
  cs101.consult = {
    slots: [{ id: "c1", days: ["Tue", "Thu"], start: "15:00", end: "16:00", where: "Faculty Room 2, CS Dept" }],
    note: "Message me on the app first so I can confirm the slot.",
  };
  return cs101;
}

export const seedClasses = (): Klass[] => [buildCS101()];
