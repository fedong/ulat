import React, { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { AnimatedLogo } from "@/AnimatedLogo";
import { ApiError } from "@/api";
import { BrandBg } from "@/brand";
import { doRegister, doSignIn, tryResume, type AppRole } from "@/session";
import { C, F } from "@/theme";
import { FadeInView, FocusInput, PressableScale, PrimaryButton } from "@/ui";

/** Demo showcase accounts, seeded by the backend (`prisma db seed`). */
const DEMO_LOGIN: Record<AppRole, { email: string; pw: string }> = {
  instructor: { email: "d.rivera@univ.edu.ph", pw: "ulat-demo-2026" },
  student: { email: "a.reyes@student.univ.edu.ph", pw: "ulat-demo-2026" },
  guardian: { email: "lorna.reyes@example.com", pw: "ulat-demo-2026" },
};

const COPY: Record<AppRole, { title: string; sub: string; foot: string }> = {
  instructor: {
    title: "Sign in as instructor",
    sub: "Your classes, live from the cloud.",
    foot: "Instructor accounts are created on the web app. Students and guardians pick their role from the start screen.",
  },
  student: {
    title: "Sign in as student",
    sub: "Your standing, upcoming work and remarks.",
    foot: "New here? Create an account, then join your class with the code from your instructor.",
  },
  guardian: {
    title: "Sign in as guardian",
    sub: "Follow your children across their classes.",
    foot: "New here? Create an account, then enter the invite code from the instructor.",
  },
};

const routeFor: Record<AppRole, string> = {
  instructor: "/instructor",
  student: "/student",
  guardian: "/guardian",
};

export default function SignInScreen() {
  const params = useLocalSearchParams<{ role?: string }>();
  const role: AppRole =
    params.role === "student" ? "student" : params.role === "guardian" ? "guardian" : "instructor";
  const canRegister = role !== "instructor";

  const [signup, setSignup] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<"" | "form" | "demo" | "resume">("resume");

  // A stored session skips the form entirely (whatever role it carries).
  useEffect(() => {
    let alive = true;
    (async () => {
      const restored = await tryResume();
      if (!alive) return;
      if (restored) router.replace(routeFor[restored] as never);
      else setBusy("");
    })();
    return () => {
      alive = false;
    };
  }, []);

  const run = async (kind: "form" | "demo", fn: () => Promise<AppRole>) => {
    if (busy) return;
    setBusy(kind);
    setErr("");
    try {
      const actual = await fn();
      router.replace(routeFor[actual] as never);
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
    const e = email.trim().toLowerCase();
    if (!e.includes("@") || !pw) return setErr("Enter your email and password.");
    if (signup && canRegister) {
      const parts = name.trim().split(/\s+/).filter(Boolean);
      void run("form", () =>
        doRegister({
          email: e,
          password: pw,
          role: role as "student" | "guardian",
          first: parts.slice(0, -1).join(" ") || parts[0] || "",
          last: parts.length > 1 ? parts[parts.length - 1] : "",
        }),
      );
    } else {
      void run("form", () => doSignIn(e, pw));
    }
  };

  const t = COPY[role];
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
              <Text style={s.title}>{signup ? "Create your account" : t.title}</Text>
              <Text style={s.sub}>{t.sub}</Text>
            </View>
          </FadeInView>

          {busy === "resume" ? (
            <FadeInView delay={200}>
              <Text style={s.resume}>Restoring your session…</Text>
            </FadeInView>
          ) : (
            <FadeInView delay={200} style={{ width: "100%", maxWidth: 340, gap: 10 }}>
              {signup && canRegister && (
                <FocusInput
                  value={name}
                  onChangeText={(v) => {
                    setName(v);
                    setErr("");
                  }}
                  placeholder="Full name"
                  style={s.input}
                />
              )}
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
                label={busy === "form" ? "One moment…" : signup ? "Create account" : "Sign in"}
                onPress={submit}
                disabled={!!busy}
              />
              {canRegister && (
                <PressableScale
                  scaleTo={0.97}
                  onPress={() => {
                    setSignup(!signup);
                    setErr("");
                  }}
                >
                  <Text style={s.switchText}>
                    {signup ? "Have an account? Sign in" : "New here? Create an account"}
                  </Text>
                </PressableScale>
              )}
              <PressableScale
                scaleTo={0.97}
                onPress={() =>
                  void run("demo", () => doSignIn(DEMO_LOGIN[role].email, DEMO_LOGIN[role].pw))
                }
                disabled={!!busy}
              >
                <View style={s.demoBtn}>
                  <Text style={s.demoText}>
                    {busy === "demo" ? "Opening the demo…" : "Tour the demo account"}
                  </Text>
                </View>
              </PressableScale>
              <Text style={s.foot}>{t.foot}</Text>
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
  switchText: {
    fontFamily: F.b700,
    fontSize: 13,
    color: "#9FE5E3",
    textAlign: "center",
    padding: 4,
  },
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
