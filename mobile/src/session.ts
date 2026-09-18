import { loadAll, resume, signIn, signOut, type EntitlementDto, type MeProfile } from "./api";
import { useUlat } from "./store";

/** Instructor session lifecycle for the mobile app. */

const displayName = (p: MeProfile) =>
  [p.title, p.first, p.last].filter(Boolean).join(" ").trim() || "Instructor";

/** Pull profile + entitlement + classes into the store. Returns class count. */
export async function hydrate(): Promise<number> {
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
    meName: displayName(profile),
    lang: profile.lang === "Filipino" ? "Filipino" : "English",
    ent: entitlement,
    signedIn: true,
    phoneAsmId: null,
    phoneSession: null,
  });
  return classes.length;
}

/** Try the stored refresh token; true when a session was restored. */
export async function tryResume(): Promise<boolean> {
  try {
    if (!(await resume())) return false;
    await hydrate();
    return true;
  } catch {
    return false;
  }
}

export async function doSignIn(email: string, password: string) {
  await signIn(email, password);
  return hydrate();
}

export async function doSignOut() {
  await signOut();
  useUlat.setState({
    signedIn: false,
    classes: [],
    clsId: "",
    email: "",
    meName: "",
    ent: null,
    ptabI: "classes",
    phoneAsmId: null,
    phoneSession: null,
  });
}

export type { EntitlementDto };
