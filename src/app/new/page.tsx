"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

/**
 * Class wizard (4 steps: Class details, Grading system, Students, Review).
 * Placeholder for the next milestone — the shell mirrors the wizard's split
 * layout so the route is real and navigable today.
 */
export default function NewClassPage() {
  const router = useRouter();
  return (
    <div className="grid h-dvh grid-cols-[280px_1fr]">
      <div className="flex flex-col bg-panel px-4 py-6 text-canvas">
        <div className="flex items-center gap-2.5 px-2">
          <Image src="/ulat-mark-white.svg" alt="" width={30} height={30} />
          <span className="font-display text-[26px] font-black tracking-[-0.8px]">ulat</span>
        </div>
        <div className="mx-2 mb-2 mt-8 text-[11px] font-bold tracking-[1.2px] text-muted">
          NEW CLASS
        </div>
        {["Class details", "Grading system", "Students", "Review"].map((label, i) => (
          <div
            key={label}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${i === 0 ? "bg-panel-hover text-white" : "text-[#B7C0C8]"}`}
          >
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full font-display text-xs font-extrabold ${i === 0 ? "bg-amber text-ink" : "bg-panel-hover text-muted"}`}
            >
              {i + 1}
            </span>
            <span className="text-sm font-semibold">{label}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-col items-center justify-center gap-3 bg-canvas p-16">
        <div className="font-display text-[28px] font-extrabold tracking-[-0.6px]">
          Class wizard
        </div>
        <div className="max-w-[440px] text-center text-sm leading-[1.55] text-sub">
          The 4-step class wizard (details, grading system, roster import, review) is
          the next build milestone. For now, explore the two demo classes.
        </div>
        <button
          onClick={() => router.back()}
          className="mt-2 h-[42px] cursor-pointer rounded-xl border-[1.5px] border-line bg-card px-[18px] text-sm font-bold text-ink hover:border-teal hover:text-teal-text"
        >
          ‹ Back to classes
        </button>
      </div>
    </div>
  );
}
