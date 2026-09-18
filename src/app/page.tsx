"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUlat } from "@/lib/store";

export default function Home() {
  const router = useRouter();
  const booted = useUlat((s) => s.booted);
  const signedIn = useUlat((s) => s.signedIn);
  const firstClass = useUlat((s) => s.classes.find((c) => !c.archived) || s.classes[0]);

  useEffect(() => {
    if (!booted) return; // session restore in flight
    if (!signedIn) return router.replace("/signin");
    router.replace(firstClass ? `/c/${firstClass.id}/overview` : "/new");
  }, [router, booted, signedIn, firstClass]);

  return null;
}
