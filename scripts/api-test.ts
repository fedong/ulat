/**
 * End-to-end API test. Run against a server started with the seeded database:
 *
 *   npm run build && npm run start -- -p 3100   # in one shell
 *   npm run api:test                            # in another (or API_URL=...)
 *
 * Exercises the full Phase 1 surface: register/login/refresh/logout, class
 * creation with the free-plan limit, score writes (clamp + closed-period 409),
 * attendance sessions (start, carry into same-day assessments, discard), and
 * verifies the seeded demo classes serialize into the exact Klass shape the
 * clients consume by re-running the shared grade engine on both sides.
 */
import { PrismaClient } from "@prisma/client";
import { compute, seedClasses, type Klass } from "../packages/grade-math/src";

const BASE = process.env.API_URL || "http://localhost:3100";
const prisma = new PrismaClient();

let passed = 0;
function ok(cond: unknown, label: string) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    console.error(`  ✗ FAIL: ${label}`);
    process.exitCode = 1;
    throw new Error(label);
  }
}

async function api(
  method: string,
  path: string,
  opts: { token?: string; body?: unknown } = {},
) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "content-type": "application/json",
      ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function main() {
  const stamp = Date.now().toString(36);
  const email = `qa.${stamp}@example.com`;
  const password = "correct-horse-42";

  console.log("auth");
  const reg = await api("POST", "/api/v1/auth/register", {
    body: { email, password, title: "Prof.", first: "Q", last: "Atester" },
  });
  ok(reg.status === 201 && reg.body.access && reg.body.refresh, "register returns tokens");
  ok(reg.body.entitlement?.state === "Trialing", "new account starts the Pro trial");

  const dup = await api("POST", "/api/v1/auth/register", { body: { email, password } });
  ok(dup.status === 400, "duplicate email rejected");

  const badLogin = await api("POST", "/api/v1/auth/login", {
    body: { email, password: "wrong-password" },
  });
  ok(badLogin.status === 401, "wrong password rejected");

  const login = await api("POST", "/api/v1/auth/login", { body: { email, password } });
  ok(login.status === 200 && login.body.access, "login returns tokens");
  let token: string = login.body.access;

  const me = await api("GET", "/api/v1/auth/me", { token });
  ok(me.status === 200 && me.body.user.email === email, "auth/me returns the user");
  ok(me.body.entitlement.tier === "PRO", "trial entitlement is PRO tier");

  const rot = await api("POST", "/api/v1/auth/refresh", {
    body: { refresh: login.body.refresh },
  });
  ok(rot.status === 200 && rot.body.access, "refresh rotates tokens");
  const reuse = await api("POST", "/api/v1/auth/refresh", {
    body: { refresh: login.body.refresh },
  });
  ok(reuse.status === 401, "rotated refresh token cannot be reused");
  token = rot.body.access;

  console.log("classes");
  const cs101 = seedClasses().find((k) => k.id === "cs101")!;
  const wizard = {
    code: "QA101",
    title: "QA Automation",
    section: "QA-1",
    term: "AY 2026–2027 · 1st Sem",
    schedule: "MWF 9:00–10:00",
    periods: ["Prelims", "Midterms", "Finals"],
    grading: cs101.grading,
    roster: [
      { no: "1", name: "Alpha, Ana", last: "Alpha", first: "Ana", mi: "" },
      { no: "2", name: "Bravo, Ben", last: "Bravo", first: "Ben", mi: "" },
      { no: "3", name: "Cruz, Carla", last: "Cruz", first: "Carla", mi: "" },
    ],
  };
  const created = await api("POST", "/api/v1/classes", { token, body: wizard });
  ok(created.status === 201 && created.body.id, "class created from wizard payload");
  const cid: string = created.body.id;

  const list = await api("GET", "/api/v1/classes", { token });
  ok(
    list.body.classes.length === 1 && list.body.classes[0].students === 3,
    "class list shows the class with its roster count",
  );

  const full = await api("GET", `/api/v1/classes/${cid}`, { token });
  const k: Klass = full.body.class;
  ok(k.roster.length === 3 && k.joinCode.length === 6, "full class is Klass-shaped");
  const [ana, ben] = [k.roster[0].id, k.roster[1].id];

  const stranger = await api("POST", "/api/v1/auth/register", {
    body: { email: `qa2.${stamp}@example.com`, password },
  });
  const other = await api("GET", `/api/v1/classes/${cid}`, { token: stranger.body.access });
  ok(other.status === 404, "other accounts cannot read the class");

  console.log("attendance sessions");
  const date = "2026-09-18";
  const ses = await api("POST", `/api/v1/classes/${cid}/sessions`, {
    token,
    body: { date },
  });
  ok(ses.status === 201, "session starts (everyone Present)");
  const sesId: string = ses.body.id;

  const markA = await api("PATCH", `/api/v1/classes/${cid}/sessions`, {
    token,
    body: { sessionId: sesId, studentRowId: ana, mark: "A" },
  });
  ok(markA.status === 200, "mark set to Absent");

  console.log("assessments + attendance carry");
  const compId = cs101.grading.groups[0].comps[0].id;
  const asm = await api("POST", `/api/v1/classes/${cid}/assessments`, {
    token,
    body: { name: "Quiz QA", comp: compId, period: "Prelims", max: 20, date },
  });
  ok(asm.status === 201, "assessment created on the session date");
  const aid: string = asm.body.id;

  let cls: Klass = (await api("GET", `/api/v1/classes/${cid}`, { token })).body.class;
  ok(cls.scores[ana]?.[aid] === "MISSED", "Absent prefills MISSED on same-day assessment");
  ok(cls.scores[ben]?.[aid] === undefined, "Present students stay ungraded");

  const markBack = await api("PATCH", `/api/v1/classes/${cid}/sessions`, {
    token,
    body: { sessionId: sesId, studentRowId: ana, mark: "P" },
  });
  ok(markBack.status === 200, "mark set back to Present");
  cls = (await api("GET", `/api/v1/classes/${cid}`, { token })).body.class;
  ok(cls.scores[ana]?.[aid] === undefined, "auto-carried MISSED is cleared with the mark");

  console.log("scores");
  const over = await api("PUT", `/api/v1/classes/${cid}/scores`, {
    token,
    body: { studentRowId: ben, assessmentId: aid, value: 999 },
  });
  ok(over.status === 200 && over.body.value === 20, "score clamps to the max");

  const hand = await api("PUT", `/api/v1/classes/${cid}/scores`, {
    token,
    body: { studentRowId: ana, assessmentId: aid, value: 15 },
  });
  ok(hand.status === 200 && hand.body.value === 15, "score writes");

  const markA2 = await api("PATCH", `/api/v1/classes/${cid}/sessions`, {
    token,
    body: { sessionId: sesId, studentRowId: ana, mark: "A" },
  });
  ok(markA2.status === 200, "re-marked Absent after a hand-typed score");
  cls = (await api("GET", `/api/v1/classes/${cid}`, { token })).body.class;
  ok(cls.scores[ana]?.[aid] === 15, "hand-typed score survives the attendance carry");

  await api("PATCH", `/api/v1/classes/${cid}`, { token, body: { closed: { Prelims: true } } });
  const closed = await api("PUT", `/api/v1/classes/${cid}/scores`, {
    token,
    body: { studentRowId: ben, assessmentId: aid, value: 10 },
  });
  ok(closed.status === 409 && closed.body.error === "period_final", "closed period returns 409");
  await api("PATCH", `/api/v1/classes/${cid}`, { token, body: { closed: {} } });

  console.log("session discard");
  const markCarlaA = await api("PATCH", `/api/v1/classes/${cid}/sessions`, {
    token,
    body: { sessionId: sesId, studentRowId: cls.roster[2].id, mark: "A" },
  });
  ok(markCarlaA.status === 200, "third student marked Absent (carries MISSED)");
  const discard = await api("DELETE", `/api/v1/classes/${cid}/sessions`, {
    token,
    body: { sessionId: sesId },
  });
  ok(discard.status === 200, "session discarded");
  cls = (await api("GET", `/api/v1/classes/${cid}`, { token })).body.class;
  ok(cls.sessions.length === 0, "discarded session is gone");
  ok(cls.scores[cls.roster[2].id]?.[aid] === undefined, "discard cleans auto-carried MISSED");
  ok(cls.scores[ana]?.[aid] === 15, "discard keeps hand-typed scores");

  console.log("students");
  const addS = await api("POST", `/api/v1/classes/${cid}/students`, {
    token,
    body: { id: "qs-extra", no: "4", name: "Diaz, Dan", last: "Diaz", first: "Dan", mi: "" },
  });
  ok(addS.status === 201 && addS.body.id === "qs-extra", "student added with client id");
  const editS = await api("PATCH", `/api/v1/classes/${cid}/students`, {
    token,
    body: {
      studentRowId: "qs-extra",
      name: "Diaz, Daniel",
      flagged: true,
      remark: "Needs consultation",
      remarkLog: [{ text: "Needs consultation", at: 1758100000000 }],
      consultedAt: 1758100000000,
    },
  });
  ok(editS.status === 200, "student fields, flag, remark and consult update");
  cls = (await api("GET", `/api/v1/classes/${cid}`, { token })).body.class;
  const dan = cls.roster.find((r) => r.id === "qs-extra");
  ok(dan?.name === "Diaz, Daniel", "roster edit persisted");
  ok(
    cls.flags?.["qs-extra"] === true &&
      cls.remarks["qs-extra"] === "Needs consultation" &&
      cls.consults?.["qs-extra"] === 1758100000000,
    "flag, remark and consult round-trip in the Klass shape",
  );
  const dropS = await api("DELETE", `/api/v1/classes/${cid}/students`, {
    token,
    body: { studentRowId: "qs-extra" },
  });
  ok(dropS.status === 200, "student removed (soft)");
  cls = (await api("GET", `/api/v1/classes/${cid}`, { token })).body.class;
  ok(cls.roster.length === 3, "removed student leaves the roster");

  console.log("sessions addressed by date+group");
  const d2 = "2026-09-19";
  const ses2 = await api("POST", `/api/v1/classes/${cid}/sessions`, {
    token,
    body: { date: d2 },
  });
  ok(ses2.status === 201, "second session starts");
  const mark2 = await api("PATCH", `/api/v1/classes/${cid}/sessions`, {
    token,
    body: { date: d2, groupId: "", studentRowId: ben, mark: "L" },
  });
  ok(mark2.status === 200, "mark set without a session id");
  cls = (await api("GET", `/api/v1/classes/${cid}`, { token })).body.class;
  ok(
    cls.sessions.find((s) => s.date === d2)?.marks[ben] === "L",
    "date+group addressing hits the right session",
  );
  const drop2 = await api("DELETE", `/api/v1/classes/${cid}/sessions`, {
    token,
    body: { date: d2, groupId: "" },
  });
  ok(drop2.status === 200, "session discarded by date+group");

  console.log("assessment edit / archive / delete");
  const editA = await api("PATCH", `/api/v1/classes/${cid}/assessments`, {
    token,
    body: { assessmentId: aid, name: "Quiz QA v2", max: 25 },
  });
  ok(editA.status === 200, "assessment renamed and re-maxed");
  const arcA = await api("PATCH", `/api/v1/classes/${cid}/assessments`, {
    token,
    body: { assessmentId: aid, archived: true, archivedAt: 1758100000000 },
  });
  ok(arcA.status === 200, "assessment archived");
  cls = (await api("GET", `/api/v1/classes/${cid}`, { token })).body.class;
  ok(
    !cls.assessments.some((a) => a.id === aid) &&
      cls.archive.some((a) => a.id === aid && a.archivedAt === 1758100000000),
    "archived assessment moves to Klass.archive",
  );
  ok(cls.scores[ana]?.[aid] === 15, "archived assessment keeps its scores");
  const resA = await api("PATCH", `/api/v1/classes/${cid}/assessments`, {
    token,
    body: { assessmentId: aid, archived: false },
  });
  ok(resA.status === 200, "assessment restored");
  const delA = await api("DELETE", `/api/v1/classes/${cid}/assessments`, {
    token,
    body: { assessmentId: aid },
  });
  ok(delA.status === 200, "assessment deleted");
  cls = (await api("GET", `/api/v1/classes/${cid}`, { token })).body.class;
  ok(
    !cls.assessments.some((a) => a.id === aid) && cls.scores[ana]?.[aid] === undefined,
    "deleted assessment takes its scores with it",
  );

  console.log("class settings + delete");
  const team = [
    { id: "tm1", name: "Co Teacher", email: "co@univ.edu.ph", status: "invited", groups: [], attendance: true, students: false },
  ];
  const patchC = await api("PATCH", `/api/v1/classes/${cid}`, {
    token,
    body: { joinCode: "QAJC01", team },
  });
  ok(
    patchC.body.class.joinCode === "QAJC01" && patchC.body.class.team?.[0]?.id === "tm1",
    "joinCode and team persist on the class",
  );
  const disp = await api("POST", "/api/v1/classes", {
    token,
    body: { ...wizard, code: "QA104", joinCode: "" },
  });
  ok(disp.status === 201, "disposable class created");
  const delC = await api("DELETE", `/api/v1/classes/${disp.body.id}`, { token });
  ok(delC.status === 200, "class deleted");
  const goneC = await api("GET", `/api/v1/classes/${disp.body.id}`, { token });
  ok(goneC.status === 404, "deleted class is gone");

  console.log("free plan limit");
  const meNow = (await api("GET", "/api/v1/auth/me", { token })).body;
  await prisma.user.update({ where: { id: meNow.user.id }, data: { entState: "FREE" } });
  const second = await api("POST", "/api/v1/classes", {
    token,
    body: { ...wizard, code: "QA102" },
  });
  ok(second.status === 201, "free plan allows a second class");
  const third = await api("POST", "/api/v1/classes", {
    token,
    body: { ...wizard, code: "QA103" },
  });
  ok(third.status === 403 && third.body.error === "free_limit", "third class hits free_limit");

  console.log("demo seed → shared grade engine");
  const demo = await api("POST", "/api/v1/auth/login", {
    body: { email: "d.rivera@univ.edu.ph", password: "ulat-demo-2026" },
  });
  ok(demo.status === 200, "demo instructor logs in");
  const demoList = await api("GET", "/api/v1/classes", { token: demo.body.access });
  ok(demoList.body.classes.length === 2, "demo account has both seeded classes");

  for (const local of seedClasses()) {
    const served: Klass = (
      await api("GET", `/api/v1/classes/${local.id}`, { token: demo.body.access })
    ).body.class;
    ok(served.roster.length === local.roster.length, `${local.code}: roster intact`);
    ok(
      served.assessments.length === local.assessments.length &&
        served.sessions.length === local.sessions.length,
      `${local.code}: assessments and sessions intact`,
    );
    let compared = 0;
    for (const r of local.roster) {
      const a = compute(local, local.grading, r.id);
      const b = compute(served, served.grading, r.id);
      if (a.pct !== b.pct || a.grade !== b.grade || a.missing.length !== b.missing.length)
        ok(false, `${local.code}/${r.id}: grades differ (${a.pctText} vs ${b.pctText})`);
      compared++;
    }
    ok(compared === local.roster.length, `${local.code}: grade totals match for all ${compared} students`);
  }

  console.log("logout");
  const out = await api("POST", "/api/v1/auth/logout", {
    token,
    body: { refresh: rot.body.refresh },
  });
  ok(out.status === 200, "logout succeeds");
  const dead = await api("POST", "/api/v1/auth/refresh", {
    body: { refresh: rot.body.refresh },
  });
  ok(dead.status === 401, "refresh token revoked by logout");

  // Clean up the QA fixtures so reruns start fresh.
  await prisma.user.deleteMany({ where: { email: { startsWith: "qa." } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: "qa2." } } });

  console.log(`\nAll ${passed} checks passed.`);
}

main()
  .catch((e) => {
    process.exitCode = 1;
    console.error(e.message || e);
  })
  .finally(() => prisma.$disconnect());
