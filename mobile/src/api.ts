import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Klass } from "@ulat/grade-math";

/**
 * API client for the Ulat backend. Point EXPO_PUBLIC_API_URL at the server
 * (your machine's LAN IP when testing on a device); defaults to localhost.
 * Access token lives in memory; the refresh token persists in AsyncStorage.
 */

const HOST = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3100";
const BASE = HOST + "/api/v1";
const REFRESH_KEY = "ulat.refresh";

let accessToken: string | null = null;

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const readRefresh = () => AsyncStorage.getItem(REFRESH_KEY).catch(() => null);
const writeRefresh = (v: string | null) =>
  (v === null ? AsyncStorage.removeItem(REFRESH_KEY) : AsyncStorage.setItem(REFRESH_KEY, v)).catch(
    () => {},
  );

async function request(method: string, path: string, body?: unknown): Promise<unknown> {
  const call = () =>
    fetch(BASE + path, {
      method,
      headers: {
        "content-type": "application/json",
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  let res = await call();
  // Expired access token: refresh once, then retry the original request.
  if (res.status === 401 && !path.startsWith("/auth/") && (await readRefresh())) {
    if (await resume()) res = await call();
  }
  const data = (await res.json().catch(() => null)) as
    | { error?: string; message?: string }
    | null;
  if (!res.ok)
    throw new ApiError(
      res.status,
      data?.error || "request_failed",
      data?.message || `Request failed (${res.status})`,
    );
  return data;
}

export const api = {
  get: (path: string) => request("GET", path),
  post: (path: string, body?: unknown) => request("POST", path, body),
  put: (path: string, body?: unknown) => request("PUT", path, body),
  patch: (path: string, body?: unknown) => request("PATCH", path, body),
  del: (path: string, body?: unknown) => request("DELETE", path, body),
};

export interface EntitlementDto {
  state: "Trialing" | "Active" | "Past due" | "Grace" | "Free";
  tier: "PRO" | "FREE";
  until: string | null;
  method?: string;
  cycle?: string;
  autoRenew: boolean;
}

export interface MeProfile {
  title?: string;
  first?: string;
  last?: string;
  school?: string;
  lang?: "English" | "Filipino";
}

interface AuthResponse {
  access: string;
  refresh: string;
  user: { id: string; email: string; profile: MeProfile };
  entitlement: EntitlementDto;
}

async function adopt(a: AuthResponse): Promise<AuthResponse> {
  accessToken = a.access;
  await writeRefresh(a.refresh);
  return a;
}

export const signIn = async (email: string, password: string) =>
  adopt((await api.post("/auth/login", { email, password })) as AuthResponse);

export const register = async (b: {
  email: string;
  password: string;
  role: "student" | "guardian";
  first?: string;
  last?: string;
}) => adopt((await api.post("/auth/register", b)) as AuthResponse);

/** Re-mint tokens from the stored refresh token. Null = no/expired session. */
export async function resume(): Promise<AuthResponse | null> {
  const refresh = await readRefresh();
  if (!refresh) return null;
  try {
    return await adopt((await api.post("/auth/refresh", { refresh })) as AuthResponse);
  } catch {
    await writeRefresh(null);
    accessToken = null;
    return null;
  }
}

export async function signOut() {
  const refresh = await readRefresh();
  try {
    if (refresh) await api.post("/auth/logout", { refresh });
  } catch {}
  accessToken = null;
  await writeRefresh(null);
}

/** Profile + entitlement + full classes, ready for the store. */
export async function loadAll() {
  const me = (await api.get("/auth/me")) as {
    user: { email: string; profile: MeProfile };
    entitlement: EntitlementDto;
  };
  const list = (await api.get("/classes")) as { classes: { id: string }[] };
  const classes = await Promise.all(
    list.classes.map(
      async (c) => ((await api.get(`/classes/${c.id}`)) as { class: Klass }).class,
    ),
  );
  return { email: me.user.email, profile: me.user.profile, entitlement: me.entitlement, classes };
}

export const saveProfile = (profile: unknown) => api.patch("/auth/me", { profile });

export interface StudentClassRow {
  class: Klass;
  studentRowId: string;
  studentName: string;
  instructor: string;
  /** Instructor's "invite a guardian" prompt (epoch ms), if sent. */
  guardianNudge?: number | null;
}

export interface StudentGuardians {
  guardians: { name: string; role: string; status: "linked" }[];
  invites: { code: string; role: string }[];
}

export interface GuardianChild {
  name: string;
  role: string;
  classes: { class: Klass; studentRowId: string; instructor: string; scopes: string[] }[];
}

export const me = () =>
  api.get("/auth/me") as Promise<{
    user: { email: string; role: string; profile: MeProfile };
    entitlement: EntitlementDto;
  }>;

export const studentClasses = async () =>
  ((await api.get("/student/classes")) as { classes: StudentClassRow[] }).classes;

export const guardianChildren = async () =>
  ((await api.get("/guardian/children")) as { children: GuardianChild[] }).children;

/** Student joins a class by join code + student number or name. */
export const joinClass = (code: string, opts: { studentNo?: string; name?: string }) =>
  api.post("/join", { code, ...opts });

/** Guardian claims an invite code (from the instructor or the student). */
export const claimInvite = (code: string) => api.post("/guardian/claim", { code });

/** Student's linked guardians + open invite codes. */
export const studentGuardians = async () =>
  (await api.get("/student/guardians")) as StudentGuardians;

/** Student creates (or re-fetches) their guardian invite code. */
export const createStudentInvite = async (role: string) =>
  (await api.post("/student/invite", { role })) as { code: string; role: string };

/** Public origin serving the /g and /join landing pages (same host as the API). */
export const webOrigin = () => HOST;
