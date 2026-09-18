import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path, Rect } from "react-native-svg";
import { C, F } from "@/theme";

/** Splash + role choice (onboarding). Sign-in is stubbed for the prototype. */
export default function Onboarding() {
  const roles: [string, string, string][] = [
    ["I'm an instructor", "Record scores and attendance on the go", "/instructor"],
    ["I'm a student", "See your standing, upcoming work and remarks", "/student"],
    ["I'm a guardian", "Follow your children across their classes", "/guardian"],
  ];
  return (
    <SafeAreaView style={s.root}>
      <View style={s.brand}>
        <View style={s.mark}>
          <Svg width={34} height={34} viewBox="0 0 40 40">
            <Rect x={4} y={6} width={32} height={24} rx={7} fill="#0FA3A0" />
            <Path d="M13 30l-3 6 9-6z" fill="#0FA3A0" />
            <Path
              d="M12 21l5-6 4 4 7-8"
              stroke="#FFFFFF"
              strokeWidth={3.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </Svg>
        </View>
        <Text style={s.wordmark}>ulat</Text>
        <Text style={s.tagline}>The gradebook that reports home.</Text>
      </View>
      <View style={{ gap: 10, width: "100%", maxWidth: 350 }}>
        {roles.map(([title, sub, href]) => (
          <Pressable key={href} style={s.roleBtn} onPress={() => router.push(href as never)}>
            <Text style={s.roleTitle}>{title}</Text>
            <Text style={s.roleSub}>{sub}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={s.foot}>Sign in with Google or email on the next step · Demo build</Text>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.panel,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 28,
  },
  brand: { alignItems: "center", gap: 8 },
  mark: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  wordmark: { fontFamily: F.d800, fontSize: 34, color: C.canvas, letterSpacing: -0.5 },
  tagline: { fontFamily: F.b500, fontSize: 14, color: C.muted },
  roleBtn: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 2,
  },
  roleTitle: { fontFamily: F.d700, fontSize: 17, color: C.canvas },
  roleSub: { fontFamily: F.b400, fontSize: 13, color: C.muted },
  foot: { fontFamily: F.b400, fontSize: 12, color: C.muted, textAlign: "center" },
});
