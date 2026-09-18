import {
  Gabarito_700Bold,
  Gabarito_800ExtraBold,
  Gabarito_900Black,
} from "@expo-google-fonts/gabarito";
import {
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
} from "@expo-google-fonts/figtree";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { AnimatedLogo } from "@/AnimatedLogo";
import { BrandBg } from "@/brand";
import { C, F } from "@/theme";

/** Branded loading screen: the Ulat mark animates while the app gets ready. */
function Splash({ done }: { done: boolean }) {
  const fade = useRef(new Animated.Value(1)).current;
  const [gone, setGone] = useState(false);
  useEffect(() => {
    if (!done) return;
    Animated.timing(fade, { toValue: 0, duration: 420, useNativeDriver: true }).start(() =>
      setGone(true),
    );
  }, [done, fade]);
  if (gone) return null;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade, zIndex: 10 }]}>
      <StatusBar style="light" />
      <BrandBg>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 18 }}>
          <AnimatedLogo size={64} />
          <Text style={{ fontFamily: F.b500, fontSize: 14, color: C.muted }}>
            The gradebook that reports home.
          </Text>
        </View>
      </BrandBg>
    </Animated.View>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Gabarito_700Bold,
    Gabarito_800ExtraBold,
    Gabarito_900Black,
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
  });
  // Hold the splash long enough for the mark to draw itself.
  const [minTime, setMinTime] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMinTime(true), 2100);
    return () => clearTimeout(t);
  }, []);
  const ready = fontsLoaded && minTime;

  return (
    <View style={{ flex: 1, backgroundColor: C.panel }}>
      {fontsLoaded && (
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: C.canvas },
            animation: "slide_from_right",
            animationDuration: 250,
          }}
        />
      )}
      {fontsLoaded && <Splash done={ready} />}
    </View>
  );
}
