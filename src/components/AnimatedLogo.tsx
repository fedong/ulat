"use client";

/** Animated Ulat mark: bubble springs in, trend line draws, arrowhead pops, mark glows. */
export function AnimatedLogo({ size = 40 }: { size?: number }) {
  const dur = 0.9;
  const delay = 0.15;
  return (
    <div className="flex items-center" style={{ gap: size * 0.3 }}>
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        style={{
          overflow: "visible",
          animation: `ulatGlow 3.2s ease-in-out infinite ${delay + dur + 0.6}s`,
        }}
      >
        <path
          d="M18 14 h64 a12 12 0 0 1 12 12 v40 a12 12 0 0 1 -12 12 H46 l-15 15 q-3 3 -3 -1 v-14 h-10 a12 12 0 0 1 -12 -12 V26 a12 12 0 0 1 12 -12 Z"
          fill="#FFFFFF"
          style={{
            transformOrigin: "50% 60%",
            animation: `ulatBubble .7s cubic-bezier(.2,.9,.3,1.2) ${delay}s both`,
          }}
        />
        <path
          d="M27 57 L43 43 L55 51 L74 30"
          fill="none"
          stroke="#0FA3A0"
          strokeWidth={7}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={80}
          strokeDashoffset={80}
          style={{ animation: `ulatDraw ${dur}s cubic-bezier(.4,0,.2,1) ${delay + 0.45}s forwards` }}
        />
        <path
          d="M74 30 h-12 M74 30 v12"
          fill="none"
          stroke="#0FA3A0"
          strokeWidth={7}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transformOrigin: "74px 30px",
            opacity: 0,
            animation: `ulatArrow .45s cubic-bezier(.2,.9,.3,1.3) ${delay + 0.45 + dur - 0.1}s forwards`,
          }}
        />
      </svg>
      <span
        className="font-display font-black text-canvas"
        style={{
          fontSize: Math.round(size * 0.85),
          letterSpacing: -(size / 40),
          opacity: 0,
          animation: `ulatWord .5s ease ${delay + 0.35}s forwards`,
        }}
      >
        ulat
      </span>
    </div>
  );
}

const SLIDES: { lines: string[]; sub: string }[] = [
  {
    lines: ["Grades your students understand.", "Reports their families can act on."],
    sub: "Set your own grading system, import a class list, and let students decide what their guardians see.",
  },
  {
    lines: ["Type a score once.", "Everything else computes."],
    sub: "Transmutation, standing and period grades update live. Finished periods lock as Final.",
  },
  {
    lines: ["Attendance that", "talks to grades."],
    sub: "Mark the class in one pass. Absences flow into the same-day assessment, lecture or lab, and can be excused within 30 days.",
  },
  {
    lines: ["Families in the loop,", "without the paperwork."],
    sub: "Link a guardian once. Every class shares automatically under its own policy, no per-student approval.",
  },
  {
    lines: ["Reports that look official", "because they are."],
    sub: "Export gradebooks to Excel or a signed PDF grade report with your school header in one click.",
  },
];

/** Sign-in hero: rotating headline slides with progress bars. */
export function HeroCarousel() {
  const HOLD = 6.5;
  const N = SLIDES.length;
  const TOTAL = HOLD * N;
  const frames = SLIDES.map((_, k) => {
    const a = ((k / N) * 100).toFixed(2);
    const b = (((k + 0.06) / N) * 100).toFixed(2);
    const c = (((k + 0.94) / N) * 100).toFixed(2);
    const d = Math.min(((k + 1) / N) * 100, 100).toFixed(2);
    return (
      `@keyframes ulatHero${k}{0%,${a}%{opacity:0;transform:translateY(22px);filter:blur(6px)}${b}%,${c}%{opacity:1;transform:none;filter:blur(0)}${d}%,100%{opacity:0;transform:translateY(-14px);filter:blur(6px)}}` +
      `@keyframes ulatBarK${k}{0%,${a}%{width:0}${d}%,100%{width:100%}}`
    );
  }).join("");

  return (
    <div className="relative flex min-h-[300px] flex-col justify-end">
      <div className="grid items-end">
        {SLIDES.map((s, k) => (
          <div
            key={k}
            style={{
              gridArea: "1 / 1",
              opacity: 0,
              animation: `ulatHero${k} ${TOTAL}s ease-in-out 0.3s infinite`,
            }}
          >
            {s.lines.map((ln, i) => (
              <div
                key={i}
                className="max-w-[620px] font-display text-[44px] font-extrabold leading-[1.1] tracking-[-1.5px] text-canvas"
              >
                {ln}
              </div>
            ))}
            <div className="mt-[18px] max-w-[560px] text-[17px] leading-[1.55] text-[#B7C0C8]">
              {s.sub}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-7 flex gap-2">
        {SLIDES.map((_, k) => (
          <div
            key={k}
            className="h-[3px] max-w-14 flex-1 overflow-hidden rounded-full"
            style={{ background: "rgba(255,255,255,0.14)" }}
          >
            <div
              className="h-full rounded-full"
              style={{
                background: "linear-gradient(90deg,#17B5B1,#0FA3A0)",
                width: 0,
                animation: `ulatBarK${k} ${TOTAL}s linear 0.3s infinite`,
              }}
            />
          </div>
        ))}
      </div>
      <style>{frames}</style>
    </div>
  );
}
