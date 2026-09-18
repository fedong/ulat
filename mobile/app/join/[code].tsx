import { useEffect } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useUlat } from "@/store";

/**
 * Deep link target (ulat://join/CODE or the web /join/CODE URL): stash the
 * class code and drop into the student flow, which prefills it.
 */
export default function JoinDeepLink() {
  const { code } = useLocalSearchParams<{ code: string }>();
  useEffect(() => {
    useUlat.setState({ pendingJoinCode: String(code || "").toUpperCase() });
    const s = useUlat.getState();
    router.replace(
      (s.signedIn && s.role === "student" ? "/student" : "/signin?role=student") as never,
    );
  }, [code]);
  return null;
}
