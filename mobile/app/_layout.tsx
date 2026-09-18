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
import { View } from "react-native";
import { C } from "@/theme";

export default function RootLayout() {
  const [loaded] = useFonts({
    Gabarito_700Bold,
    Gabarito_800ExtraBold,
    Gabarito_900Black,
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
  });
  if (!loaded) return <View style={{ flex: 1, backgroundColor: C.panel }} />;
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: C.canvas },
          animation: "slide_from_right",
          animationDuration: 250,
        }}
      />
    </>
  );
}
