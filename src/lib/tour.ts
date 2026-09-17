/** Product tour stops. `target` is a [data-tour] key; `page` is the class page to open first. */
export interface TourStop {
  key: string;
  title: string;
  body: string;
  target?: string;
  page?: string;
  short?: string;
}

export const TOUR: TourStop[] = [
  {
    key: "welcome",
    title: "Welcome to Ulat, {name}",
    body: "A quick walk through the class workspace: where things live, how grades compute, and how families stay in the loop. Nothing you click during the tour changes your data.",
  },
  {
    key: "classes",
    target: "classes",
    short: "Classes",
    title: "Every class is its own workspace",
    body: "Switch classes here. Tap + New to open the setup wizard: name the class, choose a grading system, then import your roster from CSV, XLSX, TXT or a PDF class list. Archived classes stay one click away.",
  },
  {
    key: "nav",
    target: "nav",
    short: "Navigation",
    title: "Seven views, one class",
    body: "Overview for the pulse, Gradebook for scores, Assessments and Attendance for day-to-day work, Students for individual detail, Sharing for guardians, Settings for the rules. Badges show what needs you.",
  },
  {
    key: "add-asm",
    target: "add-asm",
    short: "Assessments",
    page: "assessments",
    title: "Add an assessment in seconds",
    body: "Name it, pick its component (Quiz, Exam, Project…), set the total and period. It appears as a new gradebook column immediately, and students see it in their Upcoming feed.",
  },
  {
    key: "gradebook",
    target: "gradebook",
    short: "Gradebook",
    page: "gradebook",
    title: "Grades that compute themselves",
    body: "Type raw scores and move with the arrow keys. Transmutation, standing and period grades update live; Term follows your Average or Cumulative method. Finished periods are marked Final and locked.",
  },
  {
    key: "attendance",
    target: "attendance",
    short: "Attendance",
    page: "attendance",
    title: "Attendance talks to grades",
    body: "Build a session, mark the class in one pass. Absences sync to matching assessments of the same type, lecture or lab, and can be restored within 30 days if a student turns up with an excuse.",
  },
  {
    key: "students",
    target: "students",
    short: "Students",
    page: "students",
    title: "Know where each student stands",
    body: "Rank, class average and outlook up top; grades, attendance, missing work, remarks, timeline and shared view in the tabs below. Flag a student to keep them on your Overview.",
  },
  {
    key: "sharing",
    target: "sharing",
    short: "Guardians",
    page: "sharing",
    title: "Families see it automatically",
    body: "Set what this class shares once. Every linked guardian sees it, no per-student approval. Invite a guardian by mobile or email, or ask the student for a contact.",
  },
  {
    key: "settings",
    target: "settings",
    short: "Settings",
    page: "settings",
    title: "The rules live in Settings",
    body: "Grading groups and weights, transmutation table, passing mark, Term method and period weights, plus team teaching: invite co-instructors and scope what they can grade.",
  },
  {
    key: "done",
    title: "You are all set",
    body: "That is the whole workspace. Start with + New to create a class, or replay this tour anytime from the Tour button in the top bar.",
  },
];

export const TOUR_STOPS = TOUR.filter((t) => t.target);
