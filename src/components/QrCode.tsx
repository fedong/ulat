"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** Base URL the QR links point at (the deployed app; falls back to this origin). */
export const appOrigin = () =>
  process.env.NEXT_PUBLIC_APP_URL || (typeof window !== "undefined" ? window.location.origin : "");

export const joinUrl = (code: string) => `${appOrigin()}/join/${code}`;
export const inviteUrl = (code: string) => `${appOrigin()}/g/${code}`;

/** Crisp QR as an <img> (rendered offscreen at 4× the display size). */
export function QrCode({ value, size = 220 }: { value: string; size?: number }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(value, { margin: 1, width: size * 4, errorCorrectionLevel: "M" })
      .then((url) => alive && setSrc(url))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [value, size]);
  if (!src)
    return <div style={{ width: size, height: size }} className="rounded-xl bg-canvas" />;
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={src}
      alt={`QR code for ${value}`}
      width={size}
      height={size}
      className="rounded-xl"
      style={{ imageRendering: "pixelated" }}
    />
  );
}

/**
 * Full-screen join view made to be projected in a classroom: giant QR of the
 * join URL, the code in large text, and the two ways in.
 */
export function ProjectJoinOverlay({
  code,
  klassCode,
  title,
  onClose,
}: {
  code: string;
  klassCode: string;
  title: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-7 bg-white px-8"
      onClick={onClose}
    >
      <div className="text-center">
        <div className="font-display text-[34px] font-extrabold tracking-[-0.5px] text-ink">
          Join {klassCode} on Ulat
        </div>
        <div className="mt-1 text-lg font-medium text-sub">{title}</div>
      </div>
      <QrCode value={joinUrl(code)} size={Math.min(420, typeof window !== "undefined" ? window.innerHeight - 340 : 420)} />
      <div className="flex flex-col items-center gap-2">
        <div className="rounded-2xl bg-teal-tint-12 px-8 py-3 font-display text-[44px] font-extrabold leading-none tracking-[8px] text-teal-text">
          {code}
        </div>
        <div className="text-center text-[15px] font-medium text-sub">
          Scan with your camera — or open the Ulat app, choose{" "}
          <b className="text-ink">I&apos;m a student</b>, and enter the code with your student
          number.
        </div>
      </div>
      <div className="text-[13px] font-medium text-faint">Click anywhere or press Esc to close</div>
    </div>
  );
}
