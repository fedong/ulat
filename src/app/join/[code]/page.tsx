"use client";

import { use, useEffect, useState } from "react";
import { AnimatedLogo } from "@/components/AnimatedLogo";
import { QrCode, joinUrl } from "@/components/QrCode";
import { usePageTitle } from "@/lib/hooks";

interface JoinInfo {
  code: string;
  title: string;
  section: string;
  term: string;
  instructor: string;
}

/**
 * Public landing page behind the class QR: works whether or not the app is
 * installed. Shows the class, the code in big text, and the way in.
 */
export default function JoinLandingPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const joinCode = decodeURIComponent(code).toUpperCase();
  const [info, setInfo] = useState<JoinInfo | null>(null);
  const [missing, setMissing] = useState(false);
  usePageTitle("Join a class · Ulat");

  useEffect(() => {
    fetch(`/api/v1/join/${joinCode}`)
      .then(async (r) => (r.ok ? setInfo((await r.json()) as JoinInfo) : setMissing(true)))
      .catch(() => setMissing(true));
  }, [joinCode]);

  return (
    <div className="bg-brand-v3 flex min-h-dvh flex-col items-center justify-center gap-7 px-6 py-10 text-canvas">
      <AnimatedLogo size={48} />

      <div className="w-full max-w-[420px] rounded-3xl bg-white p-7 text-ink shadow-[0_24px_60px_-24px_rgba(0,0,0,0.45)]">
        {missing ? (
          <div className="flex flex-col gap-2 text-center">
            <div className="font-display text-xl font-extrabold">This code isn&apos;t active</div>
            <p className="text-sm leading-[1.6] text-sub">
              The class may have a new code — check with your instructor and try again.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-5">
            <div className="text-center">
              <div className="label-caps text-sub">You&apos;re joining</div>
              <div className="mt-1 font-display text-[22px] font-extrabold leading-tight">
                {info ? `${info.code} · ${info.title}` : "…"}
              </div>
              {info && (
                <div className="mt-1 text-[13px] font-medium text-sub">
                  {info.section} · {info.instructor} · {info.term}
                </div>
              )}
            </div>
            <div className="rounded-2xl bg-teal-tint-12 px-7 py-2.5 font-display text-[32px] font-extrabold leading-none tracking-[6px] text-teal-text">
              {joinCode}
            </div>
            <ol className="flex w-full flex-col gap-2.5 text-sm leading-[1.55] text-ink">
              {[
                <>Get the <b>Ulat</b> app on your phone (App Store or Google Play).</>,
                <>Choose <b>I&apos;m a student</b> and create your account with your school email.</>,
                <>Enter this code with your <b>student number</b> — that&apos;s how we find you on the class list.</>,
              ].map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-teal-tint-12 text-[12px] font-bold text-teal-text">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <div className="flex flex-col items-center gap-1.5 border-t border-line pt-4">
              <QrCode value={joinUrl(joinCode)} size={116} />
              <div className="text-xs font-medium text-faint">Pass it on — this page is this QR</div>
            </div>
          </div>
        )}
      </div>

      <div className="text-[13px] font-medium text-muted">
        Ulat — the gradebook that reports home
      </div>
    </div>
  );
}
