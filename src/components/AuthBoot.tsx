"use client";

import { useEffect } from "react";
import { boot } from "@/lib/session";

/** Restores the stored session (if any) once per app load. Renders nothing. */
export function AuthBoot() {
  useEffect(() => {
    void boot();
  }, []);
  return null;
}
