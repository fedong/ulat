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

/** Demo class 2: MTEC305A — Lecture/Laboratory groups, team teaching. */
function buildMTEC(): Klass {
  const mtec = mkClass({
    id: "mtec305a",
    code: "MTEC305A",
    title: "Clinical Chemistry 1",
    section: "BSMT 3A",
    term: "1st Sem · AY 2026–27",
    schedule: "Tue/Thu 1:30–3:00 · B-301 · Lab 3:00–6:00 · MTLAB4F",
    joinCode: "MT3A7K",
    grading: PRESETS[1].make(),
    roster: [
      "Alim, Hedaya S.", "Ambolo, Hanifa G.", "Apat, Hannah Faith P.", "Apostol, Chester Rafael A.",
      "Aquinde, Abigail B.", "Bacus, Deib Michael A.", "Baroman, Katrina Nicole L.", "Baunto, Shahanie R.",
      "Bernabe, Fermin Fourth B.", "Caballero, Trix Mikyla L.", "Cagatan, Dane Geld R.",
      "Decampong, Mohammad Alfaiz S.", "Familar, Stephany I.", "Hernandez, Chase Dhea A.",
      "Juntilla, Pearl Lyza P.", "Langitao, Ainie D.", "Lim, Sophia Claire Y.", "Lomangco, Aisha Sofia M.",
      "Mabao, Elizah Dionne E.", "Mabayo, Trisha Nicole A.", "Macadaag, Izzahanie S.",
      "Malawad, Sittie Shahidah B.", "Ombar, Asnaira H.", "Padua, Yaeshona Foy B.", "Panuncial, Mariacel D.",
      "Penales, Clarence Harvey M.", "Pundaodaya, Rahimah M.", "Ramirez, Kyla A.", "Rudi, Wisham M.",
      "Sarmiento, Mary Joseth M.", "Suanga, Abdul Rahman P.", "Tindug, Ranaa Rashidah M.",
      "Torres, Bea Kirstin L.", "Urquia, Gabie Jirah S.",
    ].map((name, i) => {
      const [last, rest] = name.split(", ");
      const w = rest.split(" ");
      const mi = w.pop() as string;
      return { id: "m" + (i + 1), no: "2023-0" + (2201 + i * 7), name, last, first: w.join(" "), mi, issues: [] };
    }),
  });
  const g2 = mtec.grading;
  const c2 = (gi: number, ci: number) => g2.groups[gi].comps[ci].id;
  const defs: [string, number, number, number, string, string?][] = [
    ["Lec Assignment 1", 0, 0, 5, "2026-07-16"],
    ["Lec Quiz 1 · Units of measure", 0, 1, 10, "2026-07-21"],
    ["Lec Quiz 2 · Lab Math", 0, 1, 10, "2026-07-23"],
    ["Lec Quiz 3 · Sample collection", 0, 1, 10, "2026-07-28"],
    ["Lec Quiz 4", 0, 1, 10, "2026-08-04"],
    ["Lec Task 1", 0, 2, 40, "2026-08-06"],
    ["Lec Exam 1", 0, 3, 100, "2026-08-13"],
    ["Lab Assignment 1", 1, 0, 55, "2026-07-16"],
    ["Lab Quiz 1", 1, 1, 10, "2026-07-23"],
    ["Lab Quiz 2", 1, 1, 10, "2026-07-30"],
    ["Lab Quiz 3", 1, 1, 10, "2026-08-06"],
    ["Lab Task 1", 1, 2, 65, "2026-07-21"],
    ["Lab Task 2", 1, 2, 50, "2026-07-28"],
    ["Lab Task 3", 1, 2, 60, "2026-08-04"],
    ["Lab Task 4", 1, 2, 40, "2026-08-11"],
    ["Lab Task 5", 1, 2, 5, "2026-08-11"],
    ["Lab Exam 1", 1, 3, 85, "2026-08-13"],
    ["Lec Exam 2", 0, 3, 100, "2026-09-22", "Coverage: Units 5–8, enzymology and carbohydrates. Bring a scientific calculator. Room B-301."],
  ];
  mtec.assessments = defs.map(([name, gi, ci, max, date, notes], i) => ({
    id: "ma" + (i + 1),
    name,
    comp: c2(gi, ci),
    period: notes ? "Midterms" : "Prelims",
    max,
    date,
    notes: notes || "",
  }));
  const seed2: (number | null)[][] = [
    [5,8,9,6,5,30,71,55,9,10,7,60,50,60,31,5,55],[5,5,8,5,9,33,86,55,9,10,10,60,50,60,36,5,67],
    [5,5,4,7,8,30,74,55,10,10,9,54,50,60,30,5,58],[5,5,10,4,5,28,73,55,10,6,5,51,50,60,30,0,67],
    [5,9,7,8,8,33,80,55,9,10,8,64,50,60,30,5,69],[5,6,8,3,7,31,81,55,9,9,8,50,50,60,30,0,65],
    [5,8,8,6,7,32,76,55,8,10,9,63,50,60,36,5,73],[5,2,7,2,8,15,55,55,6,10,5,60,50,50,30,5,61],
    [5,6,6,3,7,34,75,55,6,9,8,60,50,60,30,5,70],[5,null,0,4,6,22,63,55,null,10,8,58,50,60,30,0,55],
    [5,5,7,5,8,32,79,55,8,10,5,56,50,60,36,5,69],[5,3,8,4,6,34,79,55,9,10,7,60,50,60,30,0,64],
    [5,7,5,5,7,33,68,55,9,9,7,63,50,60,31,5,58],[5,6,4,5,7,29,78,55,10,8,9,53,50,60,36,5,67],
    [5,4,6,8,4,28,72,55,7,7,7,59,50,60,30,5,69],[5,3,2,2,6,25,67,55,7,9,6,60,50,60,30,5,51],
    [5,7,6,9,null,31,77,55,10,10,9,65,50,60,31,5,71],[5,4,6,3,4,18,62,55,9,8,6,58,50,60,36,5,52],
    [5,7,6,6,5,26,83,55,7,9,9,60,50,60,31,5,71],[5,9,10,5,9,33,86,55,9,10,8,65,50,60,36,5,72],
    [5,6,4,7,8,28,82,55,8,10,10,59,50,60,31,5,79],[5,8,8,7,7,30,80,55,10,9,8,59,50,60,31,5,71],
    [5,2,2,4,6,18,69,55,8,9,5,59,50,60,36,5,51],[5,6,2,8,7,28,77,55,10,9,10,65,50,60,31,5,62],
    [5,7,2,3,4,22,66,55,7,7,4,58,50,60,36,5,43],[5,7,3,7,5,20,68,55,6,8,6,41,50,60,30,5,52],
    [5,6,0,4,7,15,71,55,9,9,7,59,50,60,36,5,59],[5,4,2,6,7,30,77,55,8,8,10,54,50,60,31,5,62],
    [5,3,7,3,7,23,52,55,6,8,4,60,50,60,30,5,53],[5,5,2,6,4,17,64,55,10,6,10,65,50,60,30,5,57],
    [5,8,8,6,8,34,80,55,8,10,7,60,50,60,30,5,69],[5,4,5,4,5,12,62,55,9,9,8,57,50,60,36,5,55],
    [5,4,0,0,7,14,62,55,8,7,9,60,50,60,30,5,59],[5,4,8,5,8,27,68,55,10,10,6,58,50,60,30,5,72],
  ];
  seed2.forEach((row, ri) => {
    const sid = mtec.roster[ri].id;
    mtec.scores[sid] = {};
    row.forEach((v, ai) => {
      if (v !== null) mtec.scores[sid]["ma" + (ai + 1)] = v;
    });
  });
  mtec.team = [
    { id: "t1", name: "Prof. Ramon Dizon", email: "r.dizon@univ.edu.ph", status: "active", groups: [g2.groups[1].id], attendance: true, students: false },
  ];
  mtec.assessments.forEach((a) => {
    if (g2.groups[1].comps.some((c) => c.id === a.comp)) a.by = "t1";
  });
  mtec.consult = {
    slots: [{ id: "c2", days: ["Mon", "Wed"], start: "10:00", end: "11:30", where: "MT Faculty Office" }],
    note: "",
  };
  mtec.sessions = [
    "2026-07-14", "2026-07-16", "2026-07-21", "2026-07-23", "2026-07-28",
    "2026-07-30", "2026-08-04", "2026-08-06", "2026-08-11", "2026-08-13",
  ].flatMap((date, si) =>
    [g2.groups[0].id, g2.groups[1].id].map((group, gi) => ({
      date,
      group,
      marks: Object.fromEntries(
        mtec.roster.map((r, ri) => [
          r.id,
          ((ri === 9 && (si === 2 || si === 3)) || (ri === 16 && si === 6)
            ? "A"
            : (ri * 7 + si + gi * 3) % 23 === 0
              ? "L"
              : "P") as AttMark,
        ]),
      ),
    })),
  );
  return mtec;
}

export const seedClasses = (): Klass[] => [buildCS101(), buildMTEC()];
