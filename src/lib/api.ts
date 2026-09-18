"use client";

import type { Entitlement, EntState, PayMethod, PlanCycle } from "./billing";
import type { Klass } from "./types";
import type { Profile } from "./store";

/**
 * API client for /api/v1. Access token lives in memory (re-minted from the
 * refresh token on reload); the refresh token persists in localStorage.
 */

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

const readRefresh = () => {
  try {
    return localStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
};
const writeRefresh = (v: string | null) => {
  try {
    if (v === null) localStorage.removeItem(REFRESH_KEY);
    else localStorage.setItem(REFRESH_KEY, v);
  } catch {}
};

export const hasSession = () => !!readRefresh();

async function request(method: string, path: string, body?: unknown): Promise<unknown> {
  const call = () =>
    fetch(path, {
      method,
      headers: {
        "content-type": "application/json",
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  let res = await call();
  // Expired access token: refresh once, then retry the original request.
  if (res.status === 401 && !path.startsWith("/api/v1/auth/") && readRefresh()) {
    if (await tryRefresh()) res = await call();
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

interface AuthResponse {
  access: string;
  refresh: string;
  user: { id: string; email: string; role: string; profile: Record<string, unknown> };
  entitlement: EntitlementDto;
}

export interface EntitlementDto {
  state: EntState;
  tier: "PRO" | "FREE";
  until: string | null;
  method?: PayMethod;
  cycle?: PlanCycle;
  autoRenew: boolean;
}

export const toEntitlement = (d: EntitlementDto): Entitlement => ({
  tier: d.tier,
  state: d.state,
  until: d.until ? new Date(d.until + "T00:00:00") : null,
  method: d.method,
  plan: d.cycle,
  autoRenew: d.autoRenew,
});

function adopt(a: AuthResponse): AuthResponse {
  accessToken = a.access;
  writeRefresh(a.refresh);
  return a;
}

export const signIn = async (email: string, password: string) =>
  adopt((await api.post("/api/v1/auth/login", { email, password })) as AuthResponse);

export const register = async (b: {
  email: string;
  password: string;
  title?: string;
  first?: string;
  last?: string;
  ref?: string;
}) => adopt((await api.post("/api/v1/auth/register", b)) as AuthResponse);

/** Re-mint tokens from the stored refresh token. Null = session expired. */
export async function resume(): Promise<AuthResponse | null> {
  const refresh = readRefresh();
  if (!refresh) return null;
  try {
    return adopt((await api.post("/api/v1/auth/refresh", { refresh })) as AuthResponse);
  } catch {
    writeRefresh(null);
    accessToken = null;
    return null;
  }
}

async function tryRefresh(): Promise<boolean> {
  return (await resume()) !== null;
}

export async function signOut() {
  const refresh = readRefresh();
  try {
    if (refresh) await api.post("/api/v1/auth/logout", { refresh });
  } catch {}
  accessToken = null;
  writeRefresh(null);
}

/** Everything the app shell needs after auth: profile, entitlement, classes. */
export async function loadAll(): Promise<{
  email: string;
  profile: Partial<Profile>;
  entitlement: Entitlement;
  classes: Klass[];
}> {
  const me = (await api.get("/api/v1/auth/me")) as {
    user: { email: string; profile: Partial<Profile> };
    entitlement: EntitlementDto;
  };
  const list = (await api.get("/api/v1/classes")) as { classes: { id: string }[] };
  const classes = await Promise.all(
    list.classes.map(
      async (c) => ((await api.get(`/api/v1/classes/${c.id}`)) as { class: Klass }).class,
    ),
  );
  return {
    email: me.user.email,
    profile: me.user.profile,
    entitlement: toEntitlement(me.entitlement),
    classes,
  };
}

export const saveProfile = (profile: Profile) => api.patch("/api/v1/auth/me", { profile });

export interface InvoiceRow {
  id: string;
  no: string;
  date: string; // yyyy-mm-dd
  desc: string;
  grossCents: number;
  creditCents: number;
  netCents: number;
  status: "paid" | "pending" | "failed";
}

export interface BillingInfo {
  entitlement: EntitlementDto;
  creditCents: number;
  referralCode: string;
  referredCount: number;
  invoices: InvoiceRow[];
}

export const getBilling = () => api.get("/api/v1/billing") as Promise<BillingInfo>;

export interface CheckoutStart {
  paymentId: string;
  ref: string;
  provider: "paymongo" | "mock" | "credit";
  url: string | null;
  netCents: number;
}

export const startProCheckout = (cycle: PlanCycle, method: PayMethod) =>
  api.post("/api/v1/billing/checkout", { cycle, method }) as Promise<CheckoutStart>;

/** Sandbox settlement (no live keys): plays the provider webhook. */
export const settleMockPayment = (ref: string) => api.post("/api/v1/billing/mock-pay", { ref });

export const setRenewal = (resume: boolean) => api.post("/api/v1/billing/cancel", { resume });

export const fetchClass = async (id: string) =>
  ((await api.get(`/api/v1/classes/${id}`)) as { class: Klass }).class;
