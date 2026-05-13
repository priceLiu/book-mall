"use client";

import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToolChargeSubmitButtonProps = {
  busy: boolean;
  disabled?: boolean;
  onClick: () => void;
  primaryLabel: string;
  busyLabel?: string;
  chargeLine: string;
  chargeTitle: string;
  idleIcon?: ReactNode;
  className?: string;
  /** 默认胶囊大号；compact 适合侧栏底部（较扁、圆角略小） */
  variant?: "default" | "compact";
};

/**
 * 涉计费的主操作按钮：双行（主文案 + 扣费说明），胶囊形深色底。
 * 样式约定见 .cursor/rules/tool-charge-submit-ui.mdc
 */
export function ToolChargeSubmitButton({
  busy,
  disabled = false,
  onClick,
  primaryLabel,
  busyLabel = "处理中…",
  chargeLine,
  chargeTitle,
  idleIcon,
  className,
  variant = "default",
}: ToolChargeSubmitButtonProps) {
  const inert = disabled || busy;
  const compact = variant === "compact";
  return (
    <button
      type="button"
      className={cn(
        "inline-flex w-full flex-col text-center transition-colors",
        "bg-[hsl(222_40%_18%)] text-white hover:bg-[hsl(222_40%_24%)] hover:text-white",
        "disabled:pointer-events-none disabled:text-white",
        busy && "disabled:opacity-100",
        !busy && disabled && "disabled:opacity-50",
        compact
          ? "min-h-0 gap-0.5 rounded-xl px-4 py-2 shadow-sm"
          : "min-h-[4.25rem] gap-0.5 rounded-full px-5 py-3 shadow-md",
        className,
      )}
      title={chargeTitle}
      disabled={inert}
      aria-busy={busy}
      onClick={() => onClick()}
    >
      <span
        className={cn(
          "inline-flex items-center justify-center gap-2 font-semibold leading-tight",
          compact ? "text-sm" : "text-base",
        )}
      >
        {busy ? (
          <>
            <Loader2
              className={cn(
                "shrink-0 animate-spin text-white",
                compact ? "h-4 w-4" : "h-5 w-5",
              )}
              strokeWidth={2.5}
              aria-hidden
            />
            {busyLabel}
          </>
        ) : (
          <>
            {idleIcon ? (
              <span className="inline-flex shrink-0 [&_svg]:h-4 [&_svg]:w-4">
                {idleIcon}
              </span>
            ) : null}
            {primaryLabel}
          </>
        )}
      </span>
      <span
        className={cn(
          "text-center font-normal leading-tight text-white/80",
          compact ? "text-[0.7rem]" : "text-xs",
        )}
        title={chargeTitle}
      >
        {chargeLine}{" "}
        <span className="cursor-help" title={chargeTitle} aria-hidden>
          ⓘ
        </span>
      </span>
    </button>
  );
}
