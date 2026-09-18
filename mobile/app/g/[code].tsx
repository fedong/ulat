import { useEffect } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useUlat } from "@/store";

/**
 * Deep link target (ulat://g/CODE or the web /g/CODE URL): stash the guardian
 * invite code and drop into the guardian flow, which prefills it.
 */
export default function GuardianInviteDeepLink() {
  const { code } = useLocalSearchParams<{ code: string }>();
  useEffect(() => {
    useUlat.setState({ pendingClaimCode: String(code || "").toUpperCase() });
    const s = useUlat.getState();
    router.replace(
      (s.signedIn && s.role === "guardian" ? "/guardian" : "/signin?role=guardian") as never,
    );
  }, [code]);
  return null;
}
