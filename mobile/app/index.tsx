import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AnimatedLogo } from "@/AnimatedLogo";
import { BrandBg } from "@/brand";
import { C, F } from "@/theme";
import { FadeInView, PressableScale, TabIcon, type IconName } from "@/ui";

/** The web hero headlines, rotating one at a time. */
const TAGLINES = [
  "Grades your students understand.",
  "Type a score once — everything else computes.",
  "Attendance that talks to grades.",
  "Families in the loop, without the paperwork.",
  "Reports that look official, because they are.",
];

function RotatingTagline() {
  const [i, setI] = useState(0);
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const t = setInterval(() => {
      Animated.timing(v, { toValue: 0, duration: 350, easing: Easing.in(Easing.ease), useNativeDriver: true }).start(() => {
        setI((x) => (x + 1) % TAGLINES.length);
        Animated.timing(v, { toValue: 1, duration: 350, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();
      });
    }, 4200);
    return () => clearInterval(t);
  }, [v]);
  return (
    <View style={{ minHeight: 64, justifyContent: "flex-start" }}>
      <Animated.Text
        style={{
          fontFamily: F.d800,
          fontSize: 24,
          lineHeight: 30,
          letterSpacing: -0.6,
          color: C.canvas,
          textAlign: "center",
          opacity: v,
          transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
        }}
      >
        {TAGLINES[i]}
      </Animated.Text>
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 5, marginTop: 14 }}>
        {TAGLINES.map((_, k) => (
          <View
            key={k}
            style={{
              width: k === i ? 16 : 5,
              height: 5,
              borderRadius: 999,
              backgroundColor: k === i ? C.teal : "rgba(255,255,255,0.18)",
            }}
          />
        ))}
      </View>
    </View>
  );
}

/** Splash + role choice (onboarding). Sign-in is stubbed for the prototype. */
export default function Onboarding() {
  const roles: { title: string; sub: string; href: string; icon: IconName }[] = [
    {
      title: "I'm an instructor",
      sub: "Record scores and attendance on the go",
      href: "/instructor",
      icon: "grades",
    },
    {
      title: "I'm a student",
      sub: "See your standing, upcoming work and remarks",
      href: "/student",
      icon: "me",
    },
    {
      title: "I'm a guardian",
      sub: "Follow your children across their classes",
      href: "/guardian",
      icon: "kids",
    },
  ];
  return (
    <BrandBg>
      <StatusBar style="light" />
      <SafeAreaView style={s.root}>
        <FadeInView delay={100} style={{ alignItems: "center", gap: 26 }}>
          <AnimatedLogo size={56} />
          <RotatingTagline />
        </FadeInView>
        <View style={{ gap: 10, width: "100%", maxWidth: 350 }}>
          {roles.map((r, i) => (
            <FadeInView key={r.href} delay={250 + i * 120}>
              <PressableScale scaleTo={0.97} onPress={() => router.push(r.href as never)}>
                <View style={s.roleBtn}>
                  <View style={s.roleIcon}>
                    <TabIcon name={r.icon} color="#7FD6D4" />
                  </View>
                  <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                    <Text style={s.roleTitle}>{r.title}</Text>
                    <Text style={s.roleSub}>{r.sub}</Text>
                  </View>
                  <Text style={s.roleChevron}>›</Text>
                </View>
              </PressableScale>
            </FadeInView>
          ))}
        </View>
        <FadeInView delay={700}>
          <Text style={s.foot}>Sign in with Google or email on the next step · Demo build</Text>
        </FadeInView>
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
    gap: 34,
  },
  roleBtn: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  roleIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: "rgba(15,163,160,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  roleTitle: { fontFamily: F.d700, fontSize: 17, color: C.canvas },
  roleSub: { fontFamily: F.b400, fontSize: 13, color: C.muted },
  roleChevron: { fontFamily: F.b600, fontSize: 22, color: "rgba(255,255,255,0.35)", marginTop: -2 },
  foot: { fontFamily: F.b400, fontSize: 12, color: C.muted, textAlign: "center" },
});
