"use client";

import { use, useEffect, useState } from "react";
import { AnimatedLogo } from "@/components/AnimatedLogo";
import { usePageTitle } from "@/lib/hooks";

interface InviteInfo {
  studentFirst: string;
  role: string;
}

/**
 * Public landing page behind a guardian invite link (shared from the student's
 * app or the instructor's Sharing page).
 */
export default function GuardianInvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const inviteCode = decodeURIComponent(code).toUpperCase();
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [missing, setMissing] = useState(false);
  usePageTitle("Guardian invite · Ulat");

  useEffect(() => {
    fetch(`/api/v1/invites/${inviteCode}`)
      .then(async (r) => (r.ok ? setInfo((await r.json()) as InviteInfo) : setMissing(true)))
      .catch(() => setMissing(true));
  }, [inviteCode]);

  return (
    <div className="bg-brand-v3 flex min-h-dvh flex-col items-center justify-center gap-7 px-6 py-10 text-canvas">
      <AnimatedLogo size={48} />

      <div className="w-full max-w-[420px] rounded-3xl bg-white p-7 text-ink shadow-[0_24px_60px_-24px_rgba(0,0,0,0.45)]">
        {missing ? (
          <div className="flex flex-col gap-2 text-center">
            <div className="font-display text-xl font-extrabold">This invite isn&apos;t active</div>
            <p className="text-sm leading-[1.6] text-sub">
              It may have been used already, or a new one was made. Ask for a fresh code.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-5">
            <div className="text-center">
              <div className="label-caps text-sub">You&apos;re invited</div>
              <div className="mt-1 font-display text-[22px] font-extrabold leading-tight">
                Follow {info?.studentFirst ?? "…"} on Ulat
              </div>
              <div className="mt-1 text-[13px] font-medium text-sub">
                Standing, attendance and missed work — updated as instructors record, plus a
                weekly report.
              </div>
            </div>
            <div className="rounded-2xl bg-teal-tint-12 px-7 py-2.5 font-display text-[28px] font-extrabold leading-none tracking-[4px] text-teal-text">
              {inviteCode}
            </div>
            <ol className="flex w-full flex-col gap-2.5 text-sm leading-[1.55] text-ink">
              {[
                <>Get the <b>Ulat</b> app on your phone (App Store or Google Play).</>,
                <>Choose <b>I&apos;m a guardian</b> and create your account.</>,
                <>Enter this code and you&apos;re connected — every class {info?.studentFirst ?? "they"} takes on Ulat shares with you automatically.</>,
              ].map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-teal-tint-12 text-[12px] font-bold text-teal-text">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      <div className="text-[13px] font-medium text-muted">
        Ulat — the gradebook that reports home
      </div>
    </div>
  );
}
