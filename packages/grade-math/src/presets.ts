import type { Comp, Grading, Group, TableRow } from "./types";

let uidCounter = 0;
/** Deterministic ids so seeded state is stable across server render and hydration. */
export const uid = () => "x" + (++uidCounter).toString(36).padStart(6, "0");

/**
 * Globally-unique id for entities that become database rows (classes,
 * students, assessments). Only for interaction-time creation — deterministic
 * uid() stays for module-scope fixtures so SSR hydration matches.
 */
export const newId = () =>
  "u" +
  Date.now().toString(36) +
  Math.random().toString(36).slice(2, 8) +
  Math.random().toString(36).slice(2, 6);

export const TABLE_5PT = (): TableRow[] =>
  (
    [
      [97, "1.00", "A+", "4.0"],
      [94, "1.25", "A", "4.0"],
      [91, "1.50", "A-", "3.7"],
      [88, "1.75", "B+", "3.3"],
      [85, "2.00", "B", "3.0"],
      [82, "2.25", "B-", "2.7"],
      [79, "2.50", "C+", "2.3"],
      [76, "2.75", "C", "2.0"],
      [75, "3.00", "C-", "1.7"],
      [60, "4.00", "D", "1.0"],
      [0, "5.00", "F", "0.0"],
    ] as [number, string, string, string][]
  ).map(([lo, grade, letter, gpa]) => ({ id: uid(), lo, grade, letter, gpa }));

const G = (name: string, weight: number, comps: [string, number, boolean?][]): Group => ({
  id: uid(),
  name,
  weight,
  comps: comps.map(
    ([n, w, exam]): Comp => ({ id: uid(), name: n, w, exam: !!exam }),
  ),
});

export interface Preset {
  name: string;
  desc: string;
  make: () => Grading;
}

export const PRESETS: Preset[] = [
  {
    name: "University · single group",
    desc: "One set of components for the whole class. 1.00–5.00 scale, passing at 75%.",
    make: () => ({
      scale: "5pt",
      passing: 75,
      riskBand: 3,
      groups: [
        G("Lecture", 100, [
          ["Quizzes", 20],
          ["Assignments", 10],
          ["Recitation", 10],
          ["Exam", 60, true],
        ]),
      ],
      table: TABLE_5PT(),
    }),
  },
  {
    name: "Lecture 60 / Laboratory 40",
    desc: "Two weighted groups, each with its own components. For subjects with a separate lab or practical part.",
    make: () => ({
      scale: "5pt",
      passing: 75,
      riskBand: 3,
      groups: [
        G("Lecture", 60, [
          ["Assignment", 5],
          ["Quiz", 15],
          ["P. Task", 30],
          ["Exam", 50, true],
        ]),
        G("Laboratory", 40, [
          ["Assignment", 5],
          ["Quiz", 15],
          ["P. Task", 30],
          ["Exam", 50, true],
        ]),
      ],
      table: TABLE_5PT(),
    }),
  },
  {
    name: "DepEd · WW / PT / QA",
    desc: "Written Work, Performance Tasks, Quarterly Assessment. Percentage shown, passing at 75.",
    make: () => ({
      scale: "pct",
      passing: 75,
      riskBand: 3,
      groups: [
        G("Quarter", 100, [
          ["Written Work", 30],
          ["Performance Tasks", 50],
          ["Quarterly Assessment", 20, true],
        ]),
      ],
      table: TABLE_5PT(),
    }),
  },
  {
    name: "Letter grades · GPA 4.0",
    desc: "A–F letters with 4.0 equivalents. Passing at C (70%).",
    make: () => ({
      scale: "letter",
      passing: 70,
      riskBand: 4,
      groups: [
        G("Course", 100, [
          ["Homework", 25],
          ["Midterm", 30, true],
          ["Final", 35, true],
          ["Participation", 10],
        ]),
      ],
      table: (
        [
          [93, "1.00", "A", "4.0"],
          [90, "1.25", "A-", "3.7"],
          [87, "1.50", "B+", "3.3"],
          [83, "1.75", "B", "3.0"],
          [80, "2.00", "B-", "2.7"],
          [77, "2.25", "C+", "2.3"],
          [73, "2.50", "C", "2.0"],
          [70, "2.75", "C-", "1.7"],
          [60, "4.00", "D", "1.0"],
          [0, "5.00", "F", "0.0"],
        ] as [number, string, string, string][]
      ).map(([lo, grade, letter, gpa]) => ({ id: uid(), lo, grade, letter, gpa })),
    }),
  },
];
