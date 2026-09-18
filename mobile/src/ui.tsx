import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { ContentBg } from "./brand";
import { C, F, cardShadow } from "./theme";
import type { UpcomingItem } from "./demo";

// Android (old architecture) needs LayoutAnimation switched on once.
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/* ---------- press feedback (web: button:active scale) ---------- */

export function PressableScale({
  children,
  style,
  scaleTo = 0.98,
  ...rest
}: PressableProps & { children: React.ReactNode; style?: StyleProp<ViewStyle>; scaleTo?: number }) {
  const v = useRef(new Animated.Value(1)).current;
  return (
    <Pressable
      {...rest}
      style={style}
      onPressIn={(e) => {
        Animated.spring(v, { toValue: scaleTo, friction: 6, tension: 200, useNativeDriver: true }).start();
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        Animated.spring(v, { toValue: 1, friction: 6, tension: 200, useNativeDriver: true }).start();
        rest.onPressOut?.(e);
      }}
    >
      <Animated.View style={{ width: "100%", transform: [{ scale: v }] }}>{children}</Animated.View>
    </Pressable>
  );
}

/* ---------- entrance animation (web: ulatIn) ---------- */

export function FadeInView({
  children,
  delay = 0,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, {
      toValue: 1,
      duration: 320,
      delay,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [v, delay]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: v,
          transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/* ---------- icons (24px stroke SVGs, 1.8 stroke, round caps) ---------- */

export type IconName = "home" | "classes" | "grades" | "attend" | "alerts" | "me" | "kids";

export function TabIcon({ name, color }: { name: IconName; color: string }) {
  const p = {
    fill: "none",
    stroke: color,
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      {name === "home" && <Path {...p} d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />}
      {name === "classes" && (
        <>
          <Rect {...p} x={3} y={3} width={8} height={8} rx={2} />
          <Rect {...p} x={13} y={3} width={8} height={8} rx={2} />
          <Rect {...p} x={3} y={13} width={8} height={8} rx={2} />
          <Rect {...p} x={13} y={13} width={8} height={8} rx={2} />
        </>
      )}
      {name === "grades" && (
        <>
          <Rect {...p} x={3} y={4} width={18} height={16} rx={2} />
          <Path {...p} d="M3 10h18M9 4v16" />
        </>
      )}
      {name === "attend" && (
        <>
          <Circle {...p} cx={12} cy={12} r={9} />
          <Path {...p} d="m8 12 3 3 5-6" />
        </>
      )}
      {name === "alerts" && (
        <>
          <Path {...p} d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" />
          <Path {...p} d="M10 21a2 2 0 0 0 4 0" />
        </>
      )}
      {name === "me" && (
        <>
          <Circle {...p} cx={12} cy={8} r={4} />
          <Path {...p} d="M4 21a8 8 0 0 1 16 0" />
        </>
      )}
      {name === "kids" && (
        <>
          <Circle {...p} cx={9} cy={8} r={3.5} />
          <Circle {...p} cx={17} cy={9} r={2.5} />
          <Path {...p} d="M2.5 20a6.5 6.5 0 0 1 13 0M14.5 20a4.5 4.5 0 0 1 7 0" />
        </>
      )}
    </Svg>
  );
}

/* ---------- bottom tab bar ---------- */

export interface TabDef<K extends string> {
  k: K;
  label: string;
  icon: IconName;
  badge?: boolean;
}

export function TabBar<K extends string>({
  tabs,
  active,
  onPick,
}: {
  tabs: TabDef<K>[];
  active: K;
  onPick: (k: K) => void;
}) {
  return (
    <View style={s.tabBar}>
      {tabs.map((t) => {
        const on = t.k === active;
        const color = on ? C.tealText : C.sub;
        return (
          <Pressable
            key={t.k}
            onPress={() => onPick(t.k)}
            style={[s.tabBtn, on && { backgroundColor: C.tealTint12 }]}
          >
            <TabIcon name={t.icon} color={color} />
            <Text style={[s.tabLabel, { color, fontFamily: on ? F.b700 : F.b600 }]}>{t.label}</Text>
            {t.badge && <View style={s.tabBadge} />}
          </Pressable>
        );
      })}
    </View>
  );
}

/* ---------- cards, buttons, chips, headers ---------- */

/** v3 card: soft white gradient fill, hairline border, two-stage shadow. */
export function Card({
  children,
  style,
  pad = true,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  pad?: boolean;
}) {
  const { borderRadius = 20, ...rest } = StyleSheet.flatten(style) || {};
  return (
    <View style={[s.card, { borderRadius }]}>
      <LinearGradient colors={["#FFFFFF", "#FDFCFA"]} style={StyleSheet.absoluteFill} />
      <View style={[pad && s.cardPad, rest]}>{children}</View>
    </View>
  );
}

/** Primary CTA: the v3 teal gradient with an inner highlight and glow. */
export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  height = 48,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <PressableScale onPress={disabled ? undefined : onPress} scaleTo={0.985} style={style}>
      <View
        style={[
          { height, borderRadius: 14, overflow: "hidden" },
          !disabled && s.primaryGlow,
          disabled && { backgroundColor: C.disabled },
        ]}
      >
        {!disabled && (
          <LinearGradient
            colors={["#17B5B1", "#0FA3A0", "#0B8F8C"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}
        {!disabled && (
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 1.5,
              backgroundColor: "rgba(255,255,255,0.28)",
            }}
          />
        )}
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text numberOfLines={1} style={{ fontFamily: F.b700, fontSize: height >= 48 ? 15 : 14, color: "#FFFFFF" }}>
            {label}
          </Text>
        </View>
      </View>
    </PressableScale>
  );
}

/** TextInput with the web's focus treatment: teal border + soft teal ring. */
export function FocusInput(props: TextInputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      placeholderTextColor={C.faint}
      {...props}
      onFocus={(e) => {
        setFocused(true);
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        props.onBlur?.(e);
      }}
      style={[
        props.style,
        focused && {
          borderColor: C.teal,
          shadowColor: "#0FA3A0",
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.22,
          shadowRadius: 5,
          elevation: 2,
        },
      ]}
    />
  );
}

export function Chip({ text, bg, color }: { text: string; bg: string; color: string }) {
  return (
    <View style={[s.chip, { backgroundColor: bg }]}>
      <Text style={[s.chipText, { color }]}>{text}</Text>
    </View>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={s.sectionTitle}>{children}</Text>;
}

export function BackPill({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} scaleTo={0.96} style={{ alignSelf: "flex-start" }}>
      <View style={s.backPill}>
        <Text style={s.backChevron}>‹</Text>
        <Text style={s.backLabel}>{label}</Text>
      </View>
    </PressableScale>
  );
}

export function Toast({ text }: { text: string }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(v, { toValue: 1, friction: 6, tension: 120, useNativeDriver: true }).start();
  }, [v, text]);
  return (
    <Animated.View
      style={[
        s.toast,
        {
          opacity: v,
          transform: [
            { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
            { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
          ],
        },
      ]}
    >
      <View style={s.toastDot}>
        <Text style={{ fontFamily: F.d800, fontSize: 12, color: "#FFFFFF" }}>✓</Text>
      </View>
      <Text style={s.toastText}>{text}</Text>
    </Animated.View>
  );
}

/* ---------- upcoming row (shared by all three roles) ---------- */

export function UpcomingRow({ u, showCode }: { u: UpcomingItem; showCode?: boolean }) {
  return (
    <View style={s.upRow}>
      <View style={s.upDate}>
        <Text style={{ fontFamily: F.d800, fontSize: 16, lineHeight: 17, color: C.ink }}>{u.day}</Text>
        <Text style={{ fontFamily: F.b600, fontSize: 10, color: C.sub, letterSpacing: 0.4 }}>{u.mon}</Text>
      </View>
      <View style={{ minWidth: 0, flex: 1 }}>
        {showCode && (
          <Text style={{ fontFamily: F.b700, fontSize: 11, color: C.tealText, letterSpacing: 0.3 }}>
            {u.code}
          </Text>
        )}
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
          <Text style={{ fontFamily: F.b600, fontSize: 14, color: C.ink, flexShrink: 1 }}>{u.name}</Text>
          <Text style={{ fontFamily: F.b700, fontSize: 12, color: C.tealText }}>{u.countdown}</Text>
        </View>
        <Text style={{ fontFamily: F.b400, fontSize: 12, color: C.sub }}>
          {u.compPath} · {u.max} points
        </Text>
        {!!u.notes && (
          <Text style={{ fontFamily: F.b400, fontSize: 13, color: C.ink, marginTop: 4, lineHeight: 19 }}>
            {u.notes}
          </Text>
        )}
      </View>
    </View>
  );
}

/* ---------- phone screen shell ---------- */

export function PhoneShell({
  title,
  sub,
  children,
  tabBar,
  toast,
}: {
  title: string;
  sub: string;
  children: React.ReactNode;
  tabBar: React.ReactNode;
  toast?: string | null;
}) {
  // Entrance plays once when the role screen mounts. Tab and chip switches
  // inside a role are instant, per the handoff ("Tab switching is instant").
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.canvas }} edges={["top", "left", "right"]}>
      <StatusBar style="dark" />
      <ContentBg />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
      >
        <FadeInView style={{ gap: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ minWidth: 0 }}>
              <Text style={{ fontFamily: F.d800, fontSize: 20, letterSpacing: -0.3, color: C.ink }}>
                {title}
              </Text>
              <Text style={{ fontFamily: F.b500, fontSize: 13, color: C.sub }}>{sub}</Text>
            </View>
          </View>
          {!!toast && <Toast text={toast} />}
          {children}
        </FadeInView>
      </ScrollView>
      {tabBar}
    </SafeAreaView>
  );
}

/** Animate the next layout change (e.g. cards swapping places). No-op on web. */
export function animateNextLayout() {
  try {
    LayoutAnimation.configureNext(LayoutAnimation.create(220, "easeInEaseOut", "opacity"));
  } catch {
    /* react-native-web has no LayoutAnimation */
  }
}

const s = StyleSheet.create({
  tabBar: {
    flexDirection: "row",
    gap: 4,
    paddingTop: 8,
    paddingHorizontal: 10,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderTopColor: C.line,
    backgroundColor: "#FFFFFF",
  },
  tabBtn: {
    flex: 1,
    alignItems: "center",
    gap: 3,
    paddingTop: 6,
    paddingBottom: 3,
    borderRadius: 12,
  },
  tabLabel: { fontSize: 10.5, letterSpacing: 0.2 },
  tabBadge: {
    position: "absolute",
    top: 5,
    left: "50%",
    marginLeft: 5,
    width: 9,
    height: 9,
    borderRadius: 999,
    backgroundColor: C.red,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(34,48,60,0.06)",
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    ...cardShadow,
  },
  cardPad: { paddingHorizontal: 18, paddingVertical: 16 },
  primaryGlow: {
    shadowColor: "#0FA3A0",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 5,
  },
  chip: {
    alignSelf: "flex-start",
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
  },
  chipText: { fontFamily: F.b700, fontSize: 11 },
  sectionTitle: { fontFamily: F.d800, fontSize: 15, color: C.ink },
  backPill: {
    height: 32,
    paddingLeft: 8,
    paddingRight: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  backChevron: { fontSize: 16, lineHeight: 18, color: C.tealText },
  backLabel: { fontFamily: F.b700, fontSize: 12, color: C.tealText },
  toast: {
    backgroundColor: C.ink,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  toastDot: {
    width: 20,
    height: 20,
    borderRadius: 999,
    backgroundColor: C.teal,
    alignItems: "center",
    justifyContent: "center",
  },
  toastText: { fontFamily: F.b600, fontSize: 13, color: C.canvas, lineHeight: 18, flex: 1 },
  upRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: C.hairline,
  },
  upDate: {
    minWidth: 44,
    alignItems: "center",
    backgroundColor: C.canvas,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
});
