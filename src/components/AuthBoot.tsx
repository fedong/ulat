"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { boot } from "@/lib/session";

/** Restores the stored session (if any) once per app load. Renders nothing. */
export function AuthBoot() {
  const pathname = usePathname();
  // Public landing pages (/join/…, /g/…) never need auth — don't spend a
  // token rotation on them.
  const publicPage = pathname.startsWith("/join/") || pathname.startsWith("/g/");
  useEffect(() => {
    if (!publicPage) void boot();
  }, [publicPage]);
  return null;
}
