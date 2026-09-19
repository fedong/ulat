/**
 * Seed the demo instructor (d.rivera@univ.edu.ph / ulat-demo-2026) with the
 * same CS101 demo class the local prototypes ship, preserving ids so
 * client fixtures and API data stay interchangeable.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { seedClasses, type Klass } from "../packages/grade-math/src";

const prisma = new PrismaClient();

async function insertClass(ownerId: string, k: Klass) {
  await prisma.class.create({
    data: {
      id: k.id,
      ownerId,
      code: k.code,
      title: k.title,
      section: k.section,
      term: k.term,
      schedule: k.schedule,
      joinCode: k.joinCode,
      periods: k.periods,
      closed: k.closed ?? {},
      grading: k.grading as object,
      guardianScopes: k.guardianScopes ?? {
        Grades: true,
        Attendance: true,
        "Missing work": true,
        Remarks: false,
      },
      consult: k.consult as object,
      students: {
        create: k.roster.map((r) => ({
          id: r.id,
          no: r.no,
          name: r.name,
          last: r.last,
          first: r.first,
          mi: r.mi,
          flagged: !!(k.flags ?? {})[r.id],
          remark: (k.remarks ?? {})[r.id] ?? "",
          remarkLog: ((k.remarkLog ?? {})[r.id] ?? []) as object[],
          consultedAt: (k.consults ?? {})[r.id]
            ? new Date((k.consults ?? {})[r.id] as number)
            : null,
        })),
      },
      assessments: {
        create: k.assessments.map((a) => ({
          id: a.id,
          name: a.name,
          comp: a.comp,
          period: a.period,
          max: a.max,
          date: a.date,
          notes: a.notes ?? "",
        })),
      },
      sessions: {
        create: k.sessions.map((s) => ({
          date: s.date,
          groupId: s.group ?? "",
          marks: s.marks as object,
        })),
      },
    },
  });

  const scoreRows: { studentRowId: string; assessmentId: string; value: string }[] = [];
  for (const [sid, byAsm] of Object.entries(k.scores))
    for (const [aid, v] of Object.entries(byAsm)) {
      if (v === null || v === undefined) continue;
      scoreRows.push({ studentRowId: sid, assessmentId: aid, value: String(v) });
    }
  if (scoreRows.length) await prisma.score.createMany({ data: scoreRows });
}

async function seedInstructor() {
  const email = "d.rivera@univ.edu.ph";
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log("Demo instructor already seeded — skipping.");
    return;
  }
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash("ulat-demo-2026", 10),
      role: "INSTRUCTOR",
      entState: "TRIALING",
      entUntil: new Date("2027-02-14"),
      profile: {
        title: "Prof.",
        first: "Dolores",
        last: "Rivera",
        suffix: "",
        nameStyle: "short",
        school: "Visayas State College of Health Sciences",
        department: "College of Medical Technology",
        position: "Associate Professor",
        lang: "English",
      },
    },
  });
  for (const k of seedClasses()) await insertClass(user.id, k);
  console.log("Seeded demo instructor with", (await prisma.class.count()), "classes.");
}

/** Demo student: Ana Reyes (s7 in CS101), for the mobile student tour. */
async function seedStudent() {
  const email = "a.reyes@student.univ.edu.ph";
  if (await prisma.user.findUnique({ where: { email } })) {
    console.log("Demo student already seeded — skipping.");
    return;
  }
  const row = await prisma.studentRow.findUnique({ where: { id: "s7" } });
  if (!row) return console.log("CS101 roster missing — student not seeded.");
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash("ulat-demo-2026", 10),
      role: "STUDENT",
      entState: "FREE",
      profile: { first: "Ana", last: "Reyes", nameStyle: "short", lang: "English" },
    },
  });
  await prisma.enrollment.upsert({
    where: { studentRowId: "s7" },
    create: { userId: user.id, studentRowId: "s7" },
    update: { userId: user.id },
  });
  console.log("Seeded demo student (Ana Reyes → CS101 s7).");
}

/** Demo guardian: Lorna Reyes following Ana, for the mobile guardian tour. */
async function seedGuardian() {
  const email = "lorna.reyes@example.com";
  if (await prisma.user.findUnique({ where: { email } })) {
    console.log("Demo guardian already seeded — skipping.");
    return;
  }
  const row = await prisma.studentRow.findUnique({ where: { id: "s7" } });
  if (!row) return console.log("CS101 roster missing — guardian not seeded.");
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash("ulat-demo-2026", 10),
      role: "GUARDIAN",
      entState: "FREE",
      profile: { first: "Lorna", last: "Reyes", nameStyle: "short", lang: "English" },
    },
  });
  await prisma.guardianLink.create({
    data: {
      studentRowId: "s7",
      guardianId: user.id,
      name: "Lorna Reyes",
      contact: "0917 555 0188",
      role: "Mother",
      code: "GRDDEMO00000",
      status: "active",
    },
  });
  console.log("Seeded demo guardian (Lorna Reyes → Ana).");
}

async function main() {
  // The demo now ships CS101 only — drop a previously seeded MTEC305A
  // (children cascade). No-op on fresh databases.
  await prisma.class.deleteMany({ where: { id: "mtec305a" } });
  await seedInstructor();
  await seedStudent();
  await seedGuardian();
}

main().finally(() => prisma.$disconnect());
