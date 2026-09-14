"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUlat } from "@/lib/store";

export default function Home() {
  const router = useRouter();
  const signedIn = useUlat((s) => s.signedIn);
  const firstClass = useUlat((s) => s.classes.find((c) => !c.archived) || s.classes[0]);

  useEffect(() => {
    router.replace(signedIn && firstClass ? `/c/${firstClass.id}/overview` : "/signin");
  }, [router, signedIn, firstClass]);

  return null;
}
