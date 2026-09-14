"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useUlat } from "@/lib/store";
import { DEMO_INSTRUCTOR } from "@/lib/derive";

const inputCls =
  "h-12 rounded-[14px] border-[1.5px] border-line bg-card px-3.5 text-[15px] font-medium outline-none focus:border-teal placeholder:text-faint";

export default function SignInPage() {
  const router = useRouter();
  const { signup, authError, auth, set } = useUlat();

  const setA = (k: keyof typeof auth) => (e: React.ChangeEvent<HTMLInputElement>) =>
    set({ auth: { ...auth, [k]: e.target.value }, authError: false });

  const enter = () => {
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
      <div className="flex flex-col justify-between bg-panel p-16 text-canvas">
        <div className="flex items-center gap-3">
          <Image src="/ulat-mark-white.svg" alt="" width={40} height={40} />
          <span className="font-display text-[34px] font-black tracking-[-1px]">ulat</span>
        </div>
        <div>
          <div className="max-w-[620px] font-display text-[44px] font-extrabold leading-[1.1] tracking-[-1.5px]">
            Grades your students understand. Reports their families can act on.
          </div>
          <div className="mt-[18px] max-w-[560px] text-[17px] leading-[1.55] text-[#B7C0C8]">
            Set your own grading system, import a class list, and let students decide
            what their guardians see.
          </div>
        </div>
        <div className="text-[13px] font-medium text-muted">
          Used by 212 instructors in 9 schools · Data stays in the Philippines
        </div>
      </div>

      <div className="flex flex-col justify-center gap-4 bg-canvas px-14 py-16">
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
          <span
            className="h-[18px] w-[18px] rounded-full"
            style={{
              background:
                "conic-gradient(#EA4335 0 25%,#FBBC05 0 50%,#34A853 0 75%,#4285F4 0)",
            }}
          />
          Continue with Google Workspace
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
          Students and guardians use the mobile app. This web app is for instructors
          and registrars.
        </div>
      </div>
    </div>
  );
}
