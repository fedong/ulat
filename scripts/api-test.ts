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
  // Rotation keeps the old token alive briefly (grace window), so a client
  // that lost the new token mid-navigation recovers instead of signing out.
  const reuse = await api("POST", "/api/v1/auth/refresh", {
    body: { refresh: login.body.refresh },
  });
  ok(reuse.status === 200, "just-rotated token still works inside the grace window");
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

  console.log("student accounts + join code");
  const joinCode: string = (await api("GET", `/api/v1/classes/${cid}`, { token })).body.class
    .joinCode;
  const stuReg = await api("POST", "/api/v1/auth/register", {
    body: { email: `qa.stu.${stamp}@example.com`, password, role: "student", first: "Ana", last: "Alpha" },
  });
  ok(
    stuReg.status === 201 && stuReg.body.user.role === "STUDENT",
    "student account registers with the student role",
  );
  ok(stuReg.body.entitlement.state === "Free", "student accounts carry no trial");
  const stuTok: string = stuReg.body.access;

  const badJoin = await api("POST", "/api/v1/join", {
    token: stuTok,
    body: { code: "NOPE99", name: "Alpha, Ana" },
  });
  ok(badJoin.status === 404 && badJoin.body.error === "unknown_code", "wrong class code rejected");
  const join = await api("POST", "/api/v1/join", {
    token: stuTok,
    body: { code: joinCode, name: "Alpha, Ana" },
  });
  ok(join.status === 201 && join.body.studentRowId === ana, "join matches the roster row by name");
  const wrongRole = await api("GET", "/api/v1/student/classes", { token });
  ok(wrongRole.status === 403, "instructor accounts cannot use the student view");

  // Give the student something to see: an assessment, scores, a session, a remark.
  const asm2 = await api("POST", `/api/v1/classes/${cid}/assessments`, {
    token,
    body: { name: "Quiz S", comp: compId, period: "Prelims", max: 20, date: "2026-09-21" },
  });
  const aid2: string = asm2.body.id;
  await api("PUT", `/api/v1/classes/${cid}/scores`, {
    token,
    body: { studentRowId: ana, assessmentId: aid2, value: 12 },
  });
  await api("PUT", `/api/v1/classes/${cid}/scores`, {
    token,
    body: { studentRowId: ben, assessmentId: aid2, value: 18 },
  });
  await api("POST", `/api/v1/classes/${cid}/sessions`, { token, body: { date: "2026-09-21" } });
  await api("PATCH", `/api/v1/classes/${cid}/sessions`, {
    token,
    body: { date: "2026-09-21", groupId: "", studentRowId: ana, mark: "L" },
  });
  await api("PATCH", `/api/v1/classes/${cid}/students`, {
    token,
    body: { studentRowId: ana, remark: "Doing better after consultation." },
  });

  const stuView = await api("GET", "/api/v1/student/classes", { token: stuTok });
  const sv = stuView.body.classes[0];
  ok(stuView.body.classes.length === 1 && sv.class.code === "QA101", "student sees the joined class");
  ok(sv.class.joinCode === "", "join code never reaches students");
  ok(
    sv.class.roster.length === 1 &&
      sv.class.scores[ana]?.[aid2] === 12 &&
      sv.class.scores[ben] === undefined,
    "student view holds only their own row and scores",
  );
  ok(
    sv.class.sessions.some(
      (s: { marks: Record<string, string> }) => s.marks[ana] === "L" && !(ben in s.marks),
    ),
    "attendance marks are filtered to the student",
  );
  ok(sv.class.remarks[ana] === "Doing better after consultation.", "students see their own remark");

  console.log("guardian invites + scope gating");
  const inv = await api("POST", `/api/v1/classes/${cid}/guardians`, {
    token,
    body: { studentRowId: ana, name: "Gina Alpha", contact: "0917 555 0100", role: "Mother" },
  });
  ok(inv.status === 201 && inv.body.code.length === 12, "guardian invite returns a claim code");
  const sharing = await api("GET", `/api/v1/classes/${cid}/guardians`, { token });
  const shAna = sharing.body.students[ana];
  ok(
    shAna.enrolled === true && shAna.guardians[0]?.status === "invited" && shAna.guardians[0]?.code,
    "sharing state shows the enrollment and the pending invite",
  );

  const gReg = await api("POST", "/api/v1/auth/register", {
    body: { email: `qa.grd.${stamp}@example.com`, password, role: "guardian", first: "Gina", last: "Alpha" },
  });
  const grdTok: string = gReg.body.access;
  const badClaim = await api("POST", "/api/v1/guardian/claim", {
    token: grdTok,
    body: { code: "WRONGCODE000" },
  });
  ok(badClaim.status === 404, "wrong invite code rejected");
  const claim = await api("POST", "/api/v1/guardian/claim", {
    token: grdTok,
    body: { code: inv.body.code },
  });
  ok(claim.status === 201 && claim.body.studentRowId === ana, "guardian claims the invite");

  let kids = await api("GET", "/api/v1/guardian/children", { token: grdTok });
  let kid = kids.body.children[0];
  ok(kids.body.children.length === 1 && kid.name === "Alpha, Ana", "guardian sees the linked child");
  ok(
    kid.classes[0].class.scores[ana]?.[aid2] === 12 &&
      kid.classes[0].scopes.includes("Missing work"),
    "child view shares grades under the class policy",
  );
  ok(
    kid.classes[0].class.remarks[ana] === undefined &&
      !kid.classes[0].scopes.includes("Remarks"),
    "remarks stay private while the Remarks scope is off",
  );

  await api("PATCH", `/api/v1/classes/${cid}`, {
    token,
    body: { guardianScopes: { Grades: true, Attendance: true, "Missing work": true, Remarks: true } },
  });
  kids = await api("GET", "/api/v1/guardian/children", { token: grdTok });
  kid = kids.body.children[0];
  ok(
    kid.classes[0].class.remarks[ana] === "Doing better after consultation." &&
      kid.classes[0].scopes.includes("Remarks"),
    "turning the Remarks scope on shares the remark",
  );

  const unlink = await api("DELETE", `/api/v1/classes/${cid}/guardians`, {
    token,
    body: { linkId: shAna.guardians[0].id },
  });
  ok(unlink.status === 200, "guardian link revoked");
  kids = await api("GET", "/api/v1/guardian/children", { token: grdTok });
  ok(kids.body.children.length === 0, "revoked link removes the child view");

  console.log("QR landing lookups + nudge");
  const pubJoin = await api("GET", `/api/v1/join/${joinCode}`);
  ok(pubJoin.status === 200 && pubJoin.body.code === "QA101", "public join lookup names the class");
  ok((await api("GET", "/api/v1/join/NOPE99")).status === 404, "unknown join code is 404");
  const nudge = await api("POST", `/api/v1/classes/${cid}/nudge`, {
    token,
    body: { studentRowId: ana },
  });
  ok(nudge.status === 200, "instructor nudges the student");
  const sharing2 = await api("GET", `/api/v1/classes/${cid}/guardians`, { token });
  ok(typeof sharing2.body.students[ana].nudgedAt === "number", "nudge persists on the sharing state");
  const stuView2 = await api("GET", "/api/v1/student/classes", { token: stuTok });
  ok(
    typeof stuView2.body.classes[0].guardianNudge === "number",
    "the student's app sees the nudge",
  );

  console.log("student-driven guardian invite (account-level)");
  const sInv = await api("POST", "/api/v1/student/invite", {
    token: stuTok,
    body: { role: "Mother" },
  });
  ok(sInv.status === 201 && sInv.body.code.length === 12, "student creates an invite code");
  const sInv2 = await api("POST", "/api/v1/student/invite", {
    token: stuTok,
    body: { role: "Mother" },
  });
  ok(sInv2.body.code === sInv.body.code, "asking again returns the same live code");
  const sg = await api("GET", "/api/v1/student/guardians", { token: stuTok });
  ok(
    sg.body.invites.some((i: { code: string }) => i.code === sInv.body.code),
    "the open invite shows on the student's guardian list",
  );
  const pubInv = await api("GET", `/api/v1/invites/${sInv.body.code}`);
  ok(
    pubInv.status === 200 && pubInv.body.studentFirst === "Ana" && pubInv.body.role === "Mother",
    "public invite lookup reveals only first name + role",
  );

  const g2 = await api("POST", "/api/v1/auth/register", {
    body: { email: `qa.grd2.${stamp}@example.com`, password, role: "guardian", first: "Mila", last: "Alpha" },
  });
  const g2Tok: string = g2.body.access;
  const claim2 = await api("POST", "/api/v1/guardian/claim", {
    token: g2Tok,
    body: { code: sInv.body.code },
  });
  ok(claim2.status === 201, "guardian claims the student's invite");
  let kids2 = await api("GET", "/api/v1/guardian/children", { token: g2Tok });
  ok(
    kids2.body.children.length === 1 && kids2.body.children[0].classes.length === 1,
    "account link covers the student's current class",
  );
  // The account link follows the student into classes they join later.
  const qa102 = (await api("GET", "/api/v1/classes", { token })).body.classes.find(
    (c: { code: string }) => c.code === "QA102",
  );
  const qa102Full = await api("GET", `/api/v1/classes/${qa102.id}`, { token });
  const join102 = await api("POST", "/api/v1/join", {
    token: stuTok,
    body: { code: qa102Full.body.class.joinCode, name: "Alpha, Ana" },
  });
  ok(join102.status === 201, "student joins a second class");
  kids2 = await api("GET", "/api/v1/guardian/children", { token: g2Tok });
  ok(
    kids2.body.children[0].classes.length === 2,
    "the account-level guardian follows the new class automatically",
  );
  const sharing3 = await api("GET", `/api/v1/classes/${cid}/guardians`, { token });
  const acct = sharing3.body.students[ana].guardians.find((x: { id: string }) =>
    x.id.startsWith("acct:"),
  );
  ok(acct && acct.name === "Mila Alpha", "the account link shows on the instructor's Sharing page");
  const unlink2 = await api("DELETE", `/api/v1/classes/${cid}/guardians`, {
    token,
    body: { linkId: acct.id },
  });
  ok(unlink2.status === 200, "instructor can revoke the account link");
  kids2 = await api("GET", "/api/v1/guardian/children", { token: g2Tok });
  ok(kids2.body.children.length === 0, "revoked account link removes the children");

  console.log("billing: checkout → entitlement → invoices");
  let bill = await api("GET", "/api/v1/billing", { token });
  ok(
    bill.body.entitlement.state === "Free" &&
      bill.body.creditCents === 0 &&
      /^UL[0-9A-F]{8}$/.test(bill.body.referralCode),
    "billing starts Free with a referral code and no credit",
  );
  const myRefCode: string = bill.body.referralCode;
  ok(
    (await api("POST", "/api/v1/billing/checkout", { token, body: { cycle: "Monthly", method: "GCash" } }))
      .status === 400,
    "GCash is rejected on the monthly plan",
  );
  const co1 = await api("POST", "/api/v1/billing/checkout", {
    token,
    body: { cycle: "Monthly", method: "Card" },
  });
  ok(
    co1.status === 201 && co1.body.provider === "mock" && co1.body.netCents === 19900,
    "monthly Card checkout starts on the sandbox provider",
  );
  bill = await api("GET", "/api/v1/billing", { token });
  ok(bill.body.invoices[0]?.status === "pending", "the pending invoice is visible");
  const paid1 = await api("POST", "/api/v1/billing/mock-pay", { token, body: { ref: co1.body.ref } });
  ok(paid1.status === 200 && paid1.body.entitlement.state === "Active", "settlement activates Pro");
  const until1 = new Date(paid1.body.entitlement.until + "T00:00:00").getTime();
  ok(
    Math.abs(until1 - (Date.now() + 30 * 864e5)) < 3 * 864e5 && paid1.body.entitlement.autoRenew,
    "one month of Pro with auto-renew on",
  );
  ok(
    (await api("POST", "/api/v1/classes", { token, body: { ...wizard, code: "QA105" } })).status === 201,
    "the free 2-class limit lifts with Pro",
  );

  const co2 = await api("POST", "/api/v1/billing/checkout", {
    token,
    body: { cycle: "Annual", method: "GCash" },
  });
  const paid2 = await api("POST", "/api/v1/billing/mock-pay", { token, body: { ref: co2.body.ref } });
  const until2 = new Date(paid2.body.entitlement.until + "T00:00:00").getTime();
  ok(
    Math.abs(until2 - (until1 + 365 * 864e5)) < 3 * 864e5,
    "a yearly GCash payment stacks on the remaining month",
  );
  ok(
    paid2.body.entitlement.autoRenew === false && paid2.body.entitlement.method === "GCash",
    "GCash never auto-renews",
  );
  ok(
    (await api("POST", "/api/v1/billing/cancel", { token, body: { resume: true } })).status === 400,
    "GCash cannot resume auto-renewal",
  );

  console.log("billing: lapse transitions");
  const meId: string = (await api("GET", "/api/v1/auth/me", { token })).body.user.id;
  await prisma.user.update({
    where: { id: meId },
    data: { entState: "ACTIVE", entUntil: new Date(Date.now() - 2 * 864e5), entAutoRenew: true },
  });
  ok(
    (await api("GET", "/api/v1/auth/me", { token })).body.entitlement.state === "Past due",
    "expired with auto-renew reads Past due (still PRO)",
  );
  await prisma.user.update({ where: { id: meId }, data: { entAutoRenew: false } });
  ok(
    (await api("GET", "/api/v1/auth/me", { token })).body.entitlement.state === "Grace",
    "expired manual renewal reads Grace",
  );
  await prisma.user.update({
    where: { id: meId },
    data: { entUntil: new Date(Date.now() - 10 * 864e5) },
  });
  ok(
    (await api("GET", "/api/v1/auth/me", { token })).body.entitlement.state === "Free",
    "grace exhausted demotes to Free",
  );
  ok(
    (await prisma.user.findUnique({ where: { id: meId } }))?.entState === "FREE",
    "the demotion persists",
  );
  const trialReg = await api("POST", "/api/v1/auth/register", {
    body: { email: `qa.tr.${stamp}@example.com`, password },
  });
  await prisma.user.update({
    where: { id: trialReg.body.user.id },
    data: { entUntil: new Date(Date.now() - 864e5) },
  });
  ok(
    (await api("GET", "/api/v1/auth/me", { token: trialReg.body.access })).body.entitlement.state ===
      "Free",
    "an expired trial reads Free",
  );

  console.log("billing: referral credit");
  const refReg = await api("POST", "/api/v1/auth/register", {
    body: { email: `qa.refb.${stamp}@example.com`, password, ref: myRefCode },
  });
  const refTok: string = refReg.body.access;
  const co3 = await api("POST", "/api/v1/billing/checkout", {
    token: refTok,
    body: { cycle: "Annual", method: "Card" },
  });
  await api("POST", "/api/v1/billing/mock-pay", { token: refTok, body: { ref: co3.body.ref } });
  bill = await api("GET", "/api/v1/billing", { token });
  ok(
    bill.body.creditCents === 19900 && bill.body.referredCount === 1,
    "the referrer earns ₱199 on the referred first yearly payment",
  );
  const co4 = await api("POST", "/api/v1/billing/checkout", {
    token,
    body: { cycle: "Monthly", method: "Card" },
  });
  ok(
    co4.status === 201 && co4.body.provider === "credit" && co4.body.netCents === 0,
    "credit fully covers the next monthly bill — no provider round-trip",
  );
  bill = await api("GET", "/api/v1/billing", { token });
  ok(
    bill.body.creditCents === 0 &&
      bill.body.entitlement.state === "Active" &&
      bill.body.invoices[0].netCents === 0 &&
      bill.body.invoices[0].status === "paid",
    "credit is consumed, Pro reactivates, the ₱0 invoice is on file",
  );
  ok(
    (await api("POST", "/api/v1/billing/webhook", { body: { any: "thing" } })).status === 401,
    "webhook rejects unsigned payloads",
  );

  console.log("demo student + guardian tours");
  const demoStu = await api("POST", "/api/v1/auth/login", {
    body: { email: "a.reyes@student.univ.edu.ph", password: "ulat-demo-2026" },
  });
  ok(demoStu.status === 200, "demo student logs in");
  const demoView = await api("GET", "/api/v1/student/classes", { token: demoStu.body.access });
  const dv = demoView.body.classes[0];
  ok(dv?.class.code === "CS101" && dv.studentRowId === "s7", "Ana is enrolled in CS101");
  {
    const local = seedClasses().find((k) => k.id === "cs101")!;
    const a = compute(local, local.grading, "s7");
    const b = compute(dv.class, dv.class.grading, "s7");
    ok(a.pct === b.pct && a.grade === b.grade, "Ana's scoped view computes her exact grade");
  }
  const demoGrd = await api("POST", "/api/v1/auth/login", {
    body: { email: "lorna.reyes@example.com", password: "ulat-demo-2026" },
  });
  ok(demoGrd.status === 200, "demo guardian logs in");
  const demoKids = await api("GET", "/api/v1/guardian/children", { token: demoGrd.body.access });
  ok(
    demoKids.body.children[0]?.name === "Reyes, Ana" &&
      demoKids.body.children[0].classes[0].class.code === "CS101",
    "Lorna follows Ana's CS101",
  );

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
