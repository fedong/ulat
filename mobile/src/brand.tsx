import React from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";

/**
 * The v3 brand surface (web `bg-brand-v3`): deep navy gradient with a teal
 * aura in one corner and a faint amber glow in the other.
 */
export function BrandBg({ children }: { children?: React.ReactNode }) {
  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={["#0E1A22", "#101D26", "#0A141B"]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <RadialGradient id="tealWash" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#0FA3A0" stopOpacity={0.32} />
            <Stop offset="100%" stopColor="#0FA3A0" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="amberWash" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#F5B70A" stopOpacity={0.13} />
            <Stop offset="100%" stopColor="#F5B70A" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx="100%" cy="100%" rx="90%" ry="55%" fill="url(#tealWash)" />
        <Ellipse cx="0%" cy="0%" rx="65%" ry="40%" fill="url(#amberWash)" />
      </Svg>
      {children}
    </View>
  );
}

/**
 * The v3 content wash (web `bg-content-v3`): warm page base with faint teal
 * and amber corners behind the app screens.
 */
export function ContentBg() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <RadialGradient id="cTeal" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#0FA3A0" stopOpacity={0.06} />
            <Stop offset="100%" stopColor="#0FA3A0" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="cAmber" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#F5B70A" stopOpacity={0.05} />
            <Stop offset="100%" stopColor="#F5B70A" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx="100%" cy="0%" rx="70%" ry="35%" fill="url(#cTeal)" />
        <Ellipse cx="0%" cy="100%" rx="60%" ry="30%" fill="url(#cAmber)" />
      </Svg>
    </View>
  );
}
