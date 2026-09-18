import React, { useMemo } from "react";
import { View } from "react-native";
import Svg, { Rect } from "react-native-svg";
import QRCode from "qrcode";

/** QR rendered as SVG (qrcode's pure-JS matrix + react-native-svg). */
export function QrSvg({ value, size = 180 }: { value: string; size?: number }) {
  const cells = useMemo(() => {
    try {
      const q = QRCode.create(value, { errorCorrectionLevel: "M" });
      const n = q.modules.size;
      const data = q.modules.data as Uint8Array;
      const on: { x: number; y: number }[] = [];
      for (let y = 0; y < n; y++)
        for (let x = 0; x < n; x++) if (data[y * n + x]) on.push({ x, y });
      return { n, on };
    } catch {
      return null;
    }
  }, [value]);
  if (!cells) return <View style={{ width: size, height: size }} />;
  const s = size / (cells.n + 2); // one-module quiet zone
  return (
    <View style={{ width: size, height: size, backgroundColor: "#FFFFFF", borderRadius: 12 }}>
      <Svg width={size} height={size}>
        {cells.on.map((c, i) => (
          <Rect
            key={i}
            x={(c.x + 1) * s}
            y={(c.y + 1) * s}
            width={s + 0.35}
            height={s + 0.35}
            fill="#1A242E"
          />
        ))}
      </Svg>
    </View>
  );
}
