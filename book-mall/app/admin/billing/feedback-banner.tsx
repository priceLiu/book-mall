"use client";

import type { BillingActionState } from "@/app/actions/billing";

export function FeedbackBanner({ state }: { state: BillingActionState }) {
  if (state.kind === "idle") return null;
  const ok = state.kind === "ok";
  return (
    <div
      role={ok ? "status" : "alert"}
      aria-live="polite"
      className={
        "rounded-md border px-3 py-2 text-sm " +
        (ok
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "border-destructive/40 bg-destructive/10 text-destructive")
      }
    >
      {ok ? "保存成功：" : "保存失败："}
      <span className="ml-1">{state.message}</span>
    </div>
  );
}
