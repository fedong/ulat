/**
 * Seed the demo instructor (d.rivera@univ.edu.ph / ulat-demo-2026) with the
 * same CS101 + MTEC305A classes the local prototypes ship, preserving ids so
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

async function main() {
  const email = "d.rivera@univ.edu.ph";
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log("Demo user already seeded — skipping.");
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

main().finally(() => prisma.$disconnect());
