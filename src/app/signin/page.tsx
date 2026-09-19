"use client";

import { useEffect, useState } from "react";
import { AnimatedLogo, HeroCarousel } from "@/components/AnimatedLogo";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api";
import { usePageTitle } from "@/lib/hooks";
import { doRegister, doSignIn } from "@/lib/session";
import { useUlat } from "@/lib/store";
import type { Klass } from "@/lib/types";

const inputCls =
  "h-12 rounded-[14px] border-[1.5px] border-line bg-card px-3.5 text-[15px] font-medium outline-none focus:border-teal placeholder:text-faint";

/** Demo showcase account, seeded by the backend (`prisma db seed`). */
const DEMO_LOGIN = { email: "d.rivera@univ.edu.ph", pw: "ulat-demo-2026" };

export default function SignInPage() {
  const router = useRouter();
  const { signup, authError, auth, set } = useUlat();
  const [errMsg, setErrMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);
  // Referral link (…/signin?ref=CODE): attribute the sign-up to the referrer.
  const [refCode, setRefCode] = useState("");
  useEffect(() => {
    try {
      const r = new URLSearchParams(window.location.search).get("ref");
      if (r) {
        setRefCode(r.toUpperCase());
        set({ signup: true });
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  usePageTitle("Sign in · Ulat");

  const setA = (k: keyof typeof auth) => (e: React.ChangeEvent<HTMLInputElement>) =>
    set({ auth: { ...auth, [k]: e.target.value }, authError: false });

  const enter = (classes: Klass[]) => {
    set({ authError: false });
    const first = classes.find((c) => !c.archived) || classes[0];
    router.push(first ? `/c/${first.id}/overview` : "/new");
  };

  const fail = (e: unknown) => {
    setErrMsg(
      e instanceof ApiError && e.status !== 500
        ? e.message
        : "Couldn't reach Ulat. Check your connection and try again.",
    );
    set({ authError: true });
  };

  const run = async (fn: () => Promise<Klass[]>) => {
    if (busy) return;
    setBusy(true);
    try {
      enter(await fn());
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const signIn = () => {
    if (!auth.email.includes("@") || !auth.pw) {
      setErrMsg("Enter your school email and a password to continue.");
      return set({ authError: true });
    }
    void run(() =>
      signup
        ? doRegister({
            email: auth.email,
            password: auth.pw,
            school: auth.school,
            ref: refCode || undefined,
            ...nameParts(auth.name),
          })
        : doSignIn(auth.email, auth.pw),
    );
  };

  // The Google button tours the seeded demo account until OAuth lands.
  const signInGoogle = () => void run(() => doSignIn(DEMO_LOGIN.email, DEMO_LOGIN.pw));

  /** "Prof. Dolores Rivera" → { title, first, last } for the server profile. */
  function nameParts(name: string) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return {};
    const hasT = /^(Prof|Dr|Mr|Ms|Mrs|Engr|Atty)\.?$/i.test(parts[0]);
    return {
      title: hasT ? parts[0].replace(/\.?$/, ".") : "",
      first: (hasT ? parts.slice(1, -1) : parts.slice(0, -1)).join(" "),
      last: parts[parts.length - 1] || "",
    };
  }

  return (
    <div className="grid h-dvh grid-cols-1 lg:grid-cols-[1fr_520px]">
      {/* Brand pane: decorative — below lg the form takes the whole screen. */}
      <div className="bg-brand-v3 hidden flex-col justify-between p-16 text-canvas lg:flex">
        <div className="flex h-11 items-center gap-3">
          <AnimatedLogo size={40} />
        </div>
        <HeroCarousel />
        <div className="flex flex-wrap items-center gap-3.5 text-[13px] font-medium text-muted">
          Built for Philippine grading systems
        </div>
      </div>

      <div
        className="flex flex-col justify-center gap-4 overflow-y-auto px-6 py-10 sm:px-14 sm:py-16"
        style={{ background: "linear-gradient(180deg,#FFFFFF 0%,#FBF9F5 100%)" }}
      >
        <div className="font-display text-[28px] font-extrabold tracking-[-0.6px]">
          {signup ? "Create your instructor account" : "Welcome back"}
        </div>
        <div className="-mt-2 text-sm text-sub">
          {signup
            ? "Free for instructors. Your school can add a registrar later."
            : "Sign in to your classes."}
        </div>
        <button
          onClick={signInGoogle}
          disabled={busy}
          className="flex h-12 cursor-pointer items-center justify-center gap-2.5 rounded-[14px] border-[1.5px] border-line bg-card text-sm font-bold text-ink disabled:opacity-60"
        >
          <svg width={18} height={18} viewBox="0 0 48 48" aria-hidden>
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
          </svg>
          Continue with Google
        </button>
        <div className="flex items-center gap-2.5 text-xs font-medium text-faint">
          <span className="h-px flex-1 bg-line" />
          or use your school email
          <span className="h-px flex-1 bg-line" />
        </div>
        {signup && (
          <>
            <input
              value={auth.name}
              onChange={setA("name")}
              placeholder="Full name"
              className={inputCls}
            />
            <input
              value={auth.school}
              onChange={setA("school")}
              placeholder="School or university"
              className={inputCls}
            />
          </>
        )}
        <input
          value={auth.email}
          onChange={setA("email")}
          placeholder="name@school.edu.ph"
          className={inputCls}
        />
        <div className="relative">
          <input
            type={showPw ? "text" : "password"}
            value={auth.pw}
            onChange={setA("pw")}
            onKeyDown={(e) => e.key === "Enter" && signIn()}
            placeholder="Password"
            className={`${inputCls} w-full pr-12`}
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            aria-label={showPw ? "Hide password" : "Show password"}
            title={showPw ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 flex w-12 cursor-pointer items-center justify-center text-faint hover:text-sub"
          >
            {showPw ? (
              // eye-off
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                <line x1={1} y1={1} x2={23} y2={23} />
              </svg>
            ) : (
              // eye
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx={12} cy={12} r={3} />
              </svg>
            )}
          </button>
        </div>
        {authError && (
          <div className="text-[13px] font-medium text-red-text">
            {errMsg || "Enter your school email and a password to continue."}
          </div>
        )}
        <button
          onClick={signIn}
          disabled={busy}
          className="h-12 cursor-pointer rounded-[14px] bg-teal text-[15px] font-bold text-white disabled:opacity-60"
        >
          {busy ? "One moment…" : signup ? "Create account" : "Sign in"}
        </button>
        <div className="flex justify-between text-[13px] font-medium text-sub">
          <button
            onClick={() => set({ signup: !signup, authError: false })}
            className="cursor-pointer p-0 text-[13px] font-bold text-teal-text"
          >
            {signup ? "Have an account? Sign in" : "New here? Create an account"}
          </button>
          <span>Forgot password?</span>
        </div>
        <div className="mt-2 text-xs text-faint">
          Students and guardians use the mobile app. This web app is for instructors.
        </div>
      </div>
    </div>
  );
}
