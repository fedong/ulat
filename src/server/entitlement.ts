import type { User } from "@prisma/client";
import { prisma } from "./db";

/** Wire shape of the entitlement block on /v1/auth/me (payments spec). */
export interface EntitlementDto {
  state: "Trialing" | "Active" | "Past due" | "Grace" | "Free";
  tier: "PRO" | "FREE";
  until: string | null;
  method: string | null;
  cycle: string | null;
  autoRenew: boolean;
}

/** Expired Pro keeps working this long while we chase the renewal. */
const GRACE_DAYS = 7;

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

const FREE: EntitlementDto = {
  state: "Free",
  tier: "FREE",
  until: null,
  method: null,
  cycle: null,
  autoRenew: false,
};

/**
 * Entitlement computed from the stored fields AND the clock — the states the
 * clients see (Past due / Grace / trial ended → Free) are derived here, so
 * they are correct even before the lazy demotion below persists them.
 */
export function entitlementOf(user: User): EntitlementDto {
  const now = Date.now();
  const until = user.entUntil?.getTime() ?? null;

  if (user.entState === "TRIALING") {
    if (until !== null && until >= now)
      return { state: "Trialing", tier: "PRO", until: iso(user.entUntil), method: null, cycle: null, autoRenew: false };
    return FREE; // trial over, no payment on file
  }

  if (user.entState === "ACTIVE" || user.entState === "PAST_DUE" || user.entState === "GRACE") {
    if (until === null) return FREE;
    if (until >= now)
      return {
        state: "Active",
        tier: "PRO",
        until: iso(user.entUntil),
        method: user.entMethod,
        cycle: user.entCycle,
        autoRenew: user.entAutoRenew,
      };
    if (now - until <= GRACE_DAYS * 864e5)
      return {
        // Auto-renew was on but the charge hasn't landed → Past due;
        // manual renewal (GCash / cancelled) → Grace reminder.
        state: user.entAutoRenew ? "Past due" : "Grace",
        tier: "PRO",
        until: iso(user.entUntil),
        method: user.entMethod,
        cycle: user.entCycle,
        autoRenew: user.entAutoRenew,
      };
    return FREE; // grace exhausted
  }

  return FREE;
}

/**
 * Persist a lapsed trial/subscription as FREE (called from /v1/auth/me so
 * the stored state converges; every read stays correct either way).
 */
export async function demoteIfLapsed(user: User): Promise<User> {
  if (user.entState === "FREE") return user;
  if (entitlementOf(user).state !== "Free") return user;
  return prisma.user.update({ where: { id: user.id }, data: { entState: "FREE" } });
}
