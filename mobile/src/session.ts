import {
  claimInvite,
  guardianChildren,
  joinClass,
  loadAll,
  me,
  register,
  resume,
  signIn,
  signOut,
  studentClasses,
  studentGuardians,
  type EntitlementDto,
  type MeProfile,
} from "./api";
import { useUlat } from "./store";

/** Session lifecycle for all three roles; the account's role decides the UI. */

export type AppRole = "instructor" | "student" | "guardian";

const displayName = (p: MeProfile, fallback: string) =>
  [p.title, p.first, p.last].filter(Boolean).join(" ").trim() || fallback;

const roleOf = (r: string): AppRole =>
  r === "STUDENT" ? "student" : r === "GUARDIAN" ? "guardian" : "instructor";

async function hydrateInstructor() {
  const { email, profile, entitlement, classes } = await loadAll();
  const s = useUlat.getState();
  const first = classes.find((c) => !c.archived) || classes[0];
  const keep = classes.some((c) => c.id === s.clsId) ? s.clsId : first?.id || "";
  const cur = classes.find((c) => c.id === keep);
  useUlat.setState({
    classes,
    clsId: keep,
    period: cur && cur.periods.includes(s.period) ? s.period : cur?.periods[0] || s.period,
    email,
    meName: displayName(profile, "Instructor"),
    lang: profile.lang === "Filipino" ? "Filipino" : "English",
    ent: entitlement,
    signedIn: true,
    role: "instructor",
    phoneAsmId: null,
    phoneSession: null,
  });
}

async function hydrateStudent() {
  const [info, rows, guardians] = await Promise.all([me(), studentClasses(), studentGuardians()]);
  useUlat.setState({
    sLive: rows,
    sGuardians: guardians,
    email: info.user.email,
    meName: displayName(info.user.profile, rows[0]?.studentName || "Student"),
    lang: info.user.profile.lang === "Filipino" ? "Filipino" : "English",
    signedIn: true,
    role: "student",
    ptabS: "home",
    sFocusCode: null,
    sClsCode: null,
  });
}

async function hydrateGuardian() {
  const [info, kids] = await Promise.all([me(), guardianChildren()]);
  useUlat.setState({
    gKids: kids,
    email: info.user.email,
    meName: displayName(info.user.profile, "Guardian"),
    lang: info.user.profile.lang === "Filipino" ? "Filipino" : "English",
    signedIn: true,
    role: "guardian",
    ptabG: "home",
    gChild: null,
    gCls: null,
  });
}

/** Pull role-appropriate data into the store; returns the role for routing. */
export async function hydrate(): Promise<AppRole> {
  const info = await me();
  const role = roleOf(info.user.role);
  if (role === "instructor") await hydrateInstructor();
  else if (role === "student") await hydrateStudent();
  else await hydrateGuardian();
  return role;
}

/** Try the stored refresh token; returns the restored role, or null. */
export async function tryResume(): Promise<AppRole | null> {
  try {
    if (!(await resume())) return null;
    return await hydrate();
  } catch {
    return null;
  }
}

export async function doSignIn(email: string, password: string): Promise<AppRole> {
  await signIn(email, password);
  return hydrate();
}

export async function doRegister(b: {
  email: string;
  password: string;
  role: "student" | "guardian";
  first?: string;
  last?: string;
}): Promise<AppRole> {
  await register(b);
  return hydrate();
}

/** Student: join a class by code, then refresh the live views. */
export async function doJoinClass(code: string, opts: { studentNo?: string; name?: string }) {
  await joinClass(code, opts);
  await hydrateStudent();
}

/** Guardian: claim an invite code, then refresh the children. */
export async function doClaimInvite(code: string) {
  await claimInvite(code);
  await hydrateGuardian();
}

export async function doSignOut() {
  await signOut();
  useUlat.setState({
    signedIn: false,
    role: null,
    classes: [],
    clsId: "",
    sLive: null,
    sGuardians: null,
    gKids: null,
    email: "",
    meName: "",
    ent: null,
    ptabI: "classes",
    ptabS: "home",
    ptabG: "home",
    phoneAsmId: null,
    phoneSession: null,
    gChild: null,
    gCls: null,
    sFocusCode: null,
    sClsCode: null,
  });
}

export type { EntitlementDto };
