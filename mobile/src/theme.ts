/** Ulat design tokens (mobile) — from the design handoff. */
export const C = {
  page: "#EFEBE3",
  canvas: "#FBF9F5",
  card: "#FFFFFF",
  panel: "#101D26",
  panelHover: "#16242F",
  ink: "#22303C",
  sub: "#5A6672",
  muted: "#7B8792",
  faint: "#9AA3AB",
  disabled: "#B8C0C6",
  line: "#E8E2D6",
  hairline: "#F1EDE5",
  teal: "#0FA3A0",
  tealText: "#0B807E",
  tealTint8: "rgba(15,163,160,0.08)",
  tealTint10: "rgba(15,163,160,0.10)",
  tealTint12: "rgba(15,163,160,0.12)",
  amber: "#F5B70A",
  amberText: "#8A6400",
  amberTint: "rgba(245,183,10,0.16)",
  red: "#D14B33",
  redText: "#B03A24",
  redTint8: "rgba(209,75,51,0.08)",
  redTint12: "rgba(209,75,51,0.12)",
  incTint: "rgba(90,102,114,0.14)",
} as const;

/** Font families as registered by @expo-google-fonts. */
export const F = {
  d700: "Gabarito_700Bold",
  d800: "Gabarito_800ExtraBold",
  d900: "Gabarito_900Black",
  b400: "Figtree_400Regular",
  b500: "Figtree_500Medium",
  b600: "Figtree_600SemiBold",
  b700: "Figtree_700Bold",
} as const;

/** Card shadow (soft, per handoff `0 2px 10px rgba(34,48,60,0.06)`). */
export const cardShadow = {
  shadowColor: "#22303C",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 10,
  elevation: 2,
} as const;

export const selectedShadow = {
  shadowColor: "#0FA3A0",
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.18,
  shadowRadius: 16,
  elevation: 4,
} as const;
