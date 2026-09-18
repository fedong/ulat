"use client";

import { loadAll, register, resume, saveProfile, signIn, signOut } from "./api";
import { BLANK_PROFILE, useUlat, type Profile } from "./store";

/** Session lifecycle: boot-on-load, sign-in/up, sign-out — all store-aware. */

/** Pull profile + entitlement + classes and hydrate the store. */
export async function hydrate() {
  const { email, profile, entitlement, classes } = await loadAll();
  const first = classes.find((c) => !c.archived) || classes[0];
  const s = useUlat.getState();
  useUlat.setState({
    classes,
    email,
    entApi: entitlement,
    entState: entitlement.state,
    payMethodPref: entitlement.method ?? s.payMethodPref,
    profile: { ...BLANK_PROFILE, ...profile } as Profile,
    period: first && !first.periods.includes(s.period) ? first.periods[0] : s.period,
    student: first?.roster[0]?.id ?? null,
    asmId: null,
    focus: "0-0",
    signedIn: true,
    booted: true,
    syncError: false,
  });
  return classes;
}

/** Try the stored refresh token on app load. */
export async function boot() {
  if (useUlat.getState().booted) return;
  try {
    if (await resume()) {
      await hydrate();
      return;
    }
  } catch {
    await signOut().catch(() => {});
  }
  useUlat.setState({ booted: true, signedIn: false });
}

export async function doSignIn(email: string, password: string) {
  await signIn(email, password);
  return hydrate();
}

export async function doRegister(b: {
  email: string;
  password: string;
  title?: string;
  first?: string;
  last?: string;
  school?: string;
}) {
  const { school, ...rest } = b;
  await register(rest);
  const classes = await hydrate();
  if (school?.trim()) {
    const profile = { ...useUlat.getState().profile, school: school.trim() };
    useUlat.setState({ profile });
    await saveProfile(profile).catch(() => {});
  }
  return classes;
}

export async function doSignOut() {
  await signOut();
  useUlat.setState({
    signedIn: false,
    classes: [],
    email: "",
    entApi: null,
    student: null,
    asmId: null,
    menuOpen: false,
    auth: { email: "", pw: "", name: "", school: "" },
  });
}
