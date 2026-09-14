"use client";

import { useUlat } from "@/lib/store";

export function ConfirmDialogHost() {
  const dialog = useUlat((s) => s.dialog);
  const closeDialog = useUlat((s) => s.closeDialog);
  if (!dialog) return null;
  return (
    <div
      onClick={closeDialog}
      className="absolute inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(16,29,38,0.45)" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-[440px] flex-col gap-2.5 rounded-[20px] bg-card px-7 pb-6 pt-7"
        style={{ boxShadow: "0 24px 60px rgba(16,29,38,0.3)" }}
      >
        <div className="font-display text-[22px] font-extrabold tracking-[-0.4px]">
          {dialog.title}
        </div>
        <div className="text-sm leading-[1.55] text-sub">{dialog.body}</div>
        <div className="mt-3.5 flex justify-end gap-2">
          <button
            onClick={closeDialog}
            className="h-[42px] cursor-pointer rounded-xl border-[1.5px] border-line bg-card px-[18px] text-sm font-bold text-ink"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              dialog.onConfirm();
              closeDialog();
            }}
            className="h-[42px] cursor-pointer rounded-xl px-[18px] text-sm font-bold text-white"
            style={{ background: dialog.danger ? "#D14B33" : "#0FA3A0" }}
          >
            {dialog.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
