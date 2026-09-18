import React, { useEffect, useState } from "react";
import { router } from "expo-router";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { AnimatedLogo } from "@/AnimatedLogo";
import { ApiError } from "@/api";
import { BrandBg } from "@/brand";
import { doSignIn, tryResume } from "@/session";
import { C, F } from "@/theme";
import { FadeInView, FocusInput, PressableScale, PrimaryButton } from "@/ui";

/** Demo showcase account, seeded by the backend (`prisma db seed`). */
const DEMO_LOGIN = { email: "d.rivera@univ.edu.ph", pw: "ulat-demo-2026" };

/** Instructor sign-in: the one role backed by a real account. */
export default function SignInScreen() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<"" | "form" | "demo" | "resume">("resume");

  // A stored session skips the form entirely.
  useEffect(() => {
    let alive = true;
    (async () => {
      const restored = await tryResume();
      if (!alive) return;
      if (restored) router.replace("/instructor");
      else setBusy("");
    })();
    return () => {
      alive = false;
    };
  }, []);

  const run = async (kind: "form" | "demo", e: string, p: string) => {
    if (busy) return;
    setBusy(kind);
    setErr("");
    try {
      await doSignIn(e.trim().toLowerCase(), p);
      router.replace("/instructor");
    } catch (ex) {
      setErr(
        ex instanceof ApiError && ex.status !== 500
          ? ex.message
          : "Couldn't reach Ulat. Check your connection and try again.",
      );
      setBusy("");
    }
  };

  const submit = () => {
    if (!email.includes("@") || !pw) return setErr("Enter your school email and password.");
    void run("form", email, pw);
  };

  return (
    <BrandBg>
      <StatusBar style="light" />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={s.root}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <FadeInView delay={80} style={{ alignItems: "center", gap: 18 }}>
            <AnimatedLogo size={52} />
            <View style={{ alignItems: "center", gap: 4 }}>
              <Text style={s.title}>Sign in as instructor</Text>
              <Text style={s.sub}>Your classes, live from the cloud.</Text>
            </View>
          </FadeInView>

          {busy === "resume" ? (
            <FadeInView delay={200}>
              <Text style={s.resume}>Restoring your session…</Text>
            </FadeInView>
          ) : (
            <FadeInView delay={200} style={{ width: "100%", maxWidth: 340, gap: 10 }}>
              <FocusInput
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  setErr("");
                }}
                placeholder="name@school.edu.ph"
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                style={s.input}
              />
              <FocusInput
                value={pw}
                onChangeText={(v) => {
                  setPw(v);
                  setErr("");
                }}
                placeholder="Password"
                secureTextEntry
                onSubmitEditing={submit}
                style={s.input}
              />
              {!!err && <Text style={s.err}>{err}</Text>}
              <PrimaryButton
                label={busy === "form" ? "One moment…" : "Sign in"}
                onPress={submit}
                disabled={!!busy}
              />
              <PressableScale
                scaleTo={0.97}
                onPress={() => void run("demo", DEMO_LOGIN.email, DEMO_LOGIN.pw)}
                disabled={!!busy}
              >
                <View style={s.demoBtn}>
                  <Text style={s.demoText}>
                    {busy === "demo" ? "Opening the demo…" : "Tour the demo account"}
                  </Text>
                </View>
              </PressableScale>
              <Text style={s.foot}>
                Accounts are created on the web app. Students and guardians join with a class
                code — pick those roles from the start screen.
              </Text>
            </FadeInView>
          )}

          <FadeInView delay={340}>
            <PressableScale scaleTo={0.97} onPress={() => router.back()}>
              <Text style={s.back}>‹ Back to roles</Text>
            </PressableScale>
          </FadeInView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </BrandBg>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 30,
  },
  title: { fontFamily: F.d800, fontSize: 21, color: C.canvas },
  sub: { fontFamily: F.b400, fontSize: 13, color: C.muted },
  input: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 14,
    fontFamily: F.b500,
    fontSize: 15,
    color: C.canvas,
  },
  err: { fontFamily: F.b600, fontSize: 12.5, color: "#FF9E97", paddingHorizontal: 2 },
  demoBtn: {
    height: 46,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  demoText: { fontFamily: F.b700, fontSize: 13.5, color: "#9FE5E3" },
  foot: {
    fontFamily: F.b400,
    fontSize: 11.5,
    color: C.muted,
    textAlign: "center",
    lineHeight: 16,
    marginTop: 4,
  },
  resume: { fontFamily: F.b500, fontSize: 13, color: C.muted },
  back: { fontFamily: F.b600, fontSize: 13, color: "rgba(255,255,255,0.55)" },
});
