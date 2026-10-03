"use client";

import { HelpCircle } from "lucide-react";
import type { ReactNode } from "react";

import { IP_MASTER_INPUT_MODE_TABLE_ROWS } from "@/lib/ip-master-input-presets";
import { cn } from "@/lib/utils";

export function IpMasterHelpHover({
  ariaLabel,
  children,
  wide,
}: {
  ariaLabel: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <span className="group relative ml-1.5 inline-flex align-middle">
      <span className="cursor-help text-[#86868b] hover:text-[#6e6e73]" aria-label={ariaLabel}>
        <HelpCircle className="h-4 w-4" />
      </span>
      <span
        className={cn(
          "pointer-events-none absolute left-0 top-full z-[100] mt-2 hidden rounded-xl border border-[#d2d2d7] bg-[#1d1d1f] p-3 text-left text-[11px] leading-relaxed text-white shadow-2xl",
          "group-hover:block group-focus-within:block",
          wide ? "w-[min(720px,calc(100vw-2rem))]" : "w-[min(420px,calc(100vw-2rem))]",
        )}
        role="tooltip"
      >
        {children}
      </span>
    </span>
  );
}

export function IpMasterInputModeHelpTable() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-[10px]">
        <thead>
          <tr className="border-b border-white/20 text-white/70">
            <th className="px-2 py-1.5 text-left font-medium">模式</th>
            <th className="px-2 py-1.5 text-left font-medium">输入内容</th>
            <th className="px-2 py-1.5 text-left font-medium">流程说明</th>
            <th className="px-2 py-1.5 text-left font-medium">适用场景</th>
            <th className="px-2 py-1.5 text-left font-medium">优先级规则</th>
          </tr>
        </thead>
        <tbody>
          {IP_MASTER_INPUT_MODE_TABLE_ROWS.map((row) => (
            <tr key={row.mode} className="border-b border-white/10 align-top">
              <td className="whitespace-nowrap px-2 py-2 font-medium text-violet-200">
                {row.mode}
              </td>
              <td className="px-2 py-2">{row.input}</td>
              <td className="px-2 py-2">{row.flow}</td>
              <td className="px-2 py-2">{row.scene}</td>
              <td className="px-2 py-2 text-white/90">{row.priority}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
