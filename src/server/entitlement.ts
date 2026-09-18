import type { User } from "@prisma/client";

/** Wire shape of the entitlement block on /v1/auth/me (payments spec). */
export interface EntitlementDto {
  state: "Trialing" | "Active" | "Past due" | "Grace" | "Free";
  tier: "PRO" | "FREE";
  until: string | null;
  method: string | null;
  cycle: string | null;
  autoRenew: boolean;
}

const STATE_MAP = {
  TRIALING: "Trialing",
  ACTIVE: "Active",
  PAST_DUE: "Past due",
  GRACE: "Grace",
  FREE: "Free",
} as const;

export function entitlementOf(user: User): EntitlementDto {
  const state = STATE_MAP[user.entState];
  const until = user.entUntil ? user.entUntil.toISOString().slice(0, 10) : null;
  // Trial/active/past-due/grace all keep PRO features; only Free limits.
  const tier = state === "Free" ? "FREE" : "PRO";
  return {
    state,
    tier,
    until,
    method: user.entMethod,
    cycle: user.entCycle,
    // GCash cannot auto-renew (annual-only, manual reminder pipeline).
    autoRenew: state === "Active" && user.entMethod !== "GCash",
  };
}
