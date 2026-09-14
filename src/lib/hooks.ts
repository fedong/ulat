"use client";

import { useEffect, useMemo, useState } from "react";
import { compute, type Computed } from "./grading";
import type { Klass } from "./types";
import { useUlat } from "./store";

/** True after first client render — gates date-dependent UI from SSR mismatch. */
export const useMounted = () => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
};

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
