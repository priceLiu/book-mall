"use client";

import { Lightbulb } from "lucide-react";

import { ECOM_SELLPOINT_FIVE_PART_UI_HINT_LINES } from "@/lib/ecom-sellpoint-five-part";

export function EcomSellpointFivePartHint({ className }: { className?: string }) {
  return (
    <div
      className={
        className ??
        "mb-2 flex gap-2 rounded-xl border border-[#e8e8ed] bg-[#f5f5f7] px-3 py-2 text-[11px] leading-relaxed text-[#515154]"
      }
    >
      <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0071e3]" aria-hidden />
      <div>
        {ECOM_SELLPOINT_FIVE_PART_UI_HINT_LINES.map((line) => (
          <div key={line}>{line}</div>
        ))}
      </div>
    </div>
  );
}
