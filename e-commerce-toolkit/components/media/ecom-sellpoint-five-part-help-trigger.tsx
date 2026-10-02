"use client";

import type { ReactNode } from "react";

import { ECOM_SELLPOINT_FIVE_PART_UI_HINT_LINES } from "@/lib/ecom-sellpoint-five-part";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
};

/** 「要求」旁 ? · 悬停显示五段式说明（不占侧栏高度） */
export function EcomSellpointFivePartHelpTrigger({ className }: Props) {
  return (
    <span className={cn("group/help relative ml-0.5 inline-flex align-middle", className)}>
      <button
        type="button"
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#c7c7cc] text-[10px] font-semibold leading-none text-[#515154] hover:border-[#0071e3] hover:text-[#0071e3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#0071e3]"
        aria-label="卖点填写说明"
      >
        ?
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 w-[min(16rem,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border border-[#e8e8ed] bg-white px-3 py-2 text-[10px] leading-relaxed text-[#515154] opacity-0 shadow-lg transition-opacity duration-150 group-hover/help:opacity-100 group-focus-within/help:opacity-100"
      >
        {ECOM_SELLPOINT_FIVE_PART_UI_HINT_LINES.map((line) => (
          <div key={line}>{line}</div>
        ))}
      </span>
    </span>
  );
}

/** 标题 + 「要求」旁 ? 悬停说明 */
export function EcomSellpointSectionTitle({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center">
      {children}
      <EcomSellpointFivePartHelpTrigger />
    </span>
  );
}
