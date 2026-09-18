"use client";

import { AnimatedLogo, HeroCarousel } from "@/components/AnimatedLogo";
import { useRouter } from "next/navigation";
import { usePageTitle } from "@/lib/hooks";
import { useUlat } from "@/lib/store";
import { DEMO_INSTRUCTOR } from "@/lib/derive";

const inputCls =
  "h-12 rounded-[14px] border-[1.5px] border-line bg-card px-3.5 text-[15px] font-medium outline-none focus:border-teal placeholder:text-faint";

export default function SignInPage() {
  const router = useRouter();
  const { signup, authError, auth, set } = useUlat();
  usePageTitle("Sign in · Ulat");

  const setA = (k: keyof typeof auth) => (e: React.ChangeEvent<HTMLInputElement>) =>
    set({ auth: { ...auth, [k]: e.target.value }, authError: false });

  const enter = () => {
    // A sign-up name seeds the profile (title parsed off when present).
    if (auth.name.trim()) {
      const parts = auth.name.trim().split(/\s+/);
      const hasT = /^(Prof|Dr|Mr|Ms|Mrs|Engr|Atty)\.?$/i.test(parts[0]);
      set({
        profile: {
          ...useUlat.getState().profile,
          title: hasT ? parts[0].replace(/\.?$/, ".") : "",
          first: (hasT ? parts.slice(1, -1) : parts.slice(0, -1)).join(" "),
          last: parts[parts.length - 1] || "",
        },
      });
    }
    set({ signedIn: true, authError: false });
    router.push("/c/cs101/overview");
  };

  const signIn = () => {
    if (!auth.email.includes("@") || !auth.pw) return set({ authError: true });
    enter();
  };

  const signInGoogle = () => {
    set({ auth: { ...auth, email: auth.email || DEMO_INSTRUCTOR.email } });
    enter();
  };

  return (
    <div className="grid h-dvh grid-cols-[1fr_520px]">
      <div className="bg-brand-v3 flex flex-col justify-between p-16 text-canvas">
        <div className="flex h-11 items-center gap-3">
          <AnimatedLogo size={40} />
        </div>
        <HeroCarousel />
        <div className="flex flex-wrap items-center gap-3.5 text-[13px] font-medium text-muted">
          Built for Philippine grading systems
        </div>
      </div>

      <div
        className="flex flex-col justify-center gap-4 px-14 py-16"
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
          className="flex h-12 cursor-pointer items-center justify-center gap-2.5 rounded-[14px] border-[1.5px] border-line bg-card text-sm font-bold text-ink"
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
        <input
          type="password"
          value={auth.pw}
          onChange={setA("pw")}
          onKeyDown={(e) => e.key === "Enter" && signIn()}
          placeholder="Password"
          className={inputCls}
        />
        {authError && (
          <div className="text-[13px] font-medium text-red-text">
            Enter your school email and a password to continue.
          </div>
        )}
        <button
          onClick={signIn}
          className="h-12 cursor-pointer rounded-[14px] bg-teal text-[15px] font-bold text-white"
        >
          {signup ? "Create account" : "Sign in"}
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
