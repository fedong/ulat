"use client";

import { useEffect, useMemo, useState } from "react";
import { getEntitlement, mkL, readOnlyIds, type Entitlement } from "./billing";
import { compute, type Computed } from "./grading";
import type { Klass } from "./types";
import { useUlat } from "./store";

/** True after first client render — gates date-dependent UI from SSR mismatch. */
export const useMounted = () => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
};

export interface EntitlementCtx {
  ent: Entitlement;
  /** Read-only class ids (FREE over the 2-class limit). */
  ro: Set<string>;
  activeN: number;
  limitHit: boolean;
  L: (en: string, fi: string) => string;
  fil: boolean;
}

/** Live entitlement + free-limit context, derived from the store. */
export function useEntitlement(): EntitlementCtx {
  const entState = useUlat((s) => s.entState);
  const payMethodPref = useUlat((s) => s.payMethodPref);
  const sub = useUlat((s) => s.sub);
  const subCancel = useUlat((s) => s.subCancel);
  const classes = useUlat((s) => s.classes);
  const editableIds = useUlat((s) => s.editableIds);
  const fil = useUlat((s) => s.profile.lang === "Filipino");
  return useMemo(() => {
    const ent = getEntitlement(entState, payMethodPref, sub, subCancel);
    const ro = readOnlyIds(ent, classes, editableIds);
    const activeN = classes.filter((c) => !c.archived).length;
    return { ent, ro, activeN, limitHit: ent.tier === "FREE" && activeN >= 2, L: mkL(fil), fil };
  }, [entState, payMethodPref, sub, subCancel, classes, editableIds, fil]);
}

/** Per-student computed grades for the currently selected period. */
export function usePeriodComputed(cls: Klass | undefined): Record<string, Computed> {
  const period = useUlat((s) => s.period);
  return useMemo(() => {
    if (!cls) return {};
    const asmsP = cls.assessments.filter((a) => a.period === period);
    return Object.fromEntries(
      cls.roster.map((r) => [r.id, compute(cls, cls.grading, r.id, null, asmsP)]),
    );
  }, [cls, period]);
}
