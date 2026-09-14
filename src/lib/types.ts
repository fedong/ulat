/** A recorded score: points, or a MISSED / EXC marker. */
export type Score = number | "MISSED" | "EXC";

export type ScaleKind = "5pt" | "pct" | "letter" | "gpa";

export interface Comp {
  id: string;
  name: string;
  w: number | string;
  exam: boolean;
}

export interface Group {
  id: string;
  name: string;
  weight: number | string;
  comps: Comp[];
}

export interface TableRow {
  id: string;
  lo: number | string;
  grade: string;
  letter: string;
  gpa: string;
}

export interface Grading {
  scale: ScaleKind;
  passing: number | string;
  riskBand: number | string;
  groups: Group[];
  table: TableRow[];
  /** Transmutation base (0–99) or unset for none. */
  transmute?: number | string | null;
  termMethod?: "average" | "cumulative";
  periodWeights?: Record<string, number | string>;
}

export interface StudentRow {
  id: string;
  no: string;
  name: string;
  last: string;
  first: string;
  mi: string;
  issues: string[];
}

export interface Assessment {
  id: string;
  name: string;
  comp: string;
  period: string;
  max: number;
  date: string;
  notes?: string;
  /** Team member id who recorded it. */
  by?: string;
}

export interface ArchivedAssessment extends Assessment {
  archivedAt: number;
}

export type AttMark = "P" | "L" | "A" | "E";

export interface Session {
  date: string;
  /** Grading group id for split (Lecture/Lab) sessions; absent = whole class. */
  group?: string;
  marks: Record<string, AttMark>;
}

export interface ConsultSlot {
  id: string;
  days: string[];
  start: string;
  end: string;
  where: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  status: "active" | "invited";
  groups: string[];
  attendance: boolean;
  students: boolean;
}

export interface RemarkEntry {
  text: string;
  at: number;
}

export interface Klass {
  id: string;
  code: string;
  title: string;
  section: string;
  term: string;
  schedule: string;
  joinCode: string;
  grading: Grading;
  periods: string[];
  closed?: Record<string, boolean>;
  roster: StudentRow[];
  assessments: Assessment[];
  archive: ArchivedAssessment[];
  scores: Record<string, Record<string, Score | null | undefined>>;
  sessions: Session[];
  remarks: Record<string, string>;
  remarkLog?: Record<string, RemarkEntry[]>;
  flags?: Record<string, boolean>;
  consults?: Record<string, boolean>;
  consult: { slots: ConsultSlot[]; note: string };
  team?: TeamMember[];
  archived?: boolean;
}

export type Standing = "pass" | "risk" | "fail" | "inc";
