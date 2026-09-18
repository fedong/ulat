import React, { useEffect, useRef } from "react";
import { Animated, Easing, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { F } from "./theme";

const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * Animated Ulat mark, ported from the web AnimatedLogo: the chat bubble
 * springs in, the trend line draws, the arrowhead pops, the mark keeps a
 * soft teal glow, and the wordmark slides in beside it.
 */
export function AnimatedLogo({
  size = 40,
  showWord = true,
  wordColor = "#FBF9F5",
}: {
  size?: number;
  showWord?: boolean;
  wordColor?: string;
}) {
  const bubble = useRef(new Animated.Value(0)).current;
  const draw = useRef(new Animated.Value(80)).current;
  const arrow = useRef(new Animated.Value(0)).current;
  const word = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(150),
      Animated.parallel([
        Animated.spring(bubble, { toValue: 1, friction: 5, tension: 90, useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(200),
          Animated.timing(word, {
            toValue: 1,
            duration: 500,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.delay(300),
          Animated.timing(draw, {
            toValue: 0,
            duration: 900,
            easing: Easing.bezier(0.4, 0, 0.2, 1),
            useNativeDriver: false,
          }),
          Animated.spring(arrow, { toValue: 1, friction: 4, tension: 120, useNativeDriver: false }),
        ]),
      ]),
    ]).start(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glow, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(glow, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      ).start();
    });
  }, [bubble, draw, arrow, word, glow]);

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: size * 0.3 }}>
      <View style={{ width: size, height: size }}>
        {/* soft teal halo, pulsing like the web ulatGlow */}
        <Animated.View
          style={{
            position: "absolute",
            left: -size * 0.2,
            top: -size * 0.2,
            width: size * 1.4,
            height: size * 1.4,
            borderRadius: size,
            backgroundColor: "#0FA3A0",
            opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.1, 0.28] }),
          }}
        />
        <Animated.View
          style={{
            width: size,
            height: size,
            opacity: bubble,
            transform: [
              { translateY: bubble.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
              { scale: bubble.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) },
            ],
          }}
        >
          <Svg viewBox="0 0 100 100" width={size} height={size}>
            <Path
              d="M18 14 h64 a12 12 0 0 1 12 12 v40 a12 12 0 0 1 -12 12 H46 l-15 15 q-3 3 -3 -1 v-14 h-10 a12 12 0 0 1 -12 -12 V26 a12 12 0 0 1 12 -12 Z"
              fill="#FFFFFF"
            />
            <AnimatedPath
              d="M27 57 L43 43 L55 51 L74 30"
              fill="none"
              stroke="#0FA3A0"
              strokeWidth={7}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={[80, 80]}
              strokeDashoffset={draw as unknown as number}
            />
            <AnimatedPath
              d="M74 30 h-12 M74 30 v12"
              fill="none"
              stroke="#0FA3A0"
              strokeWidth={7}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={arrow as unknown as number}
            />
          </Svg>
        </Animated.View>
      </View>
      {showWord && (
        <Animated.Text
          style={{
            fontFamily: F.d900,
            fontSize: Math.round(size * 0.85),
            letterSpacing: -(size / 40),
            color: wordColor,
            opacity: word,
            transform: [{ translateX: word.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }],
          }}
        >
          ulat
        </Animated.Text>
      )}
    </View>
  );
}
