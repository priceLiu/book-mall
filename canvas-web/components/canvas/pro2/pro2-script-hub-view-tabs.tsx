"use client";

import type { Pro2ScriptHubViewTab } from "@/lib/canvas/pro2-script-hub-view-types";
import { cn } from "@/lib/utils";

const TABS: Array<{ id: Pro2ScriptHubViewTab; label: string }> = [
  { id: "outline", label: "大纲" },
  { id: "character", label: "角色" },
  { id: "script", label: "脚本" },
];

export function Pro2ScriptHubViewTabs({
  value,
  onChange,
  size = "compact",
  className,
}: {
  value: Pro2ScriptHubViewTab;
  onChange: (tab: Pro2ScriptHubViewTab) => void;
  size?: "compact" | "modal";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex shrink-0 items-center rounded-lg border border-white/[0.08] bg-white/[0.04] p-0.5",
        size === "modal" && "border-violet-400/20 bg-violet-500/8",
        className,
      )}
      role="tablist"
      aria-label="脚本节点视图"
    >
      {TABS.map((tab) => {
        const active = value === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={cn(
              "nodrag rounded-md font-medium transition",
              size === "compact"
                ? "px-2 py-0.5 text-[10px]"
                : "px-3 py-1 text-[12px]",
              active
                ? size === "modal"
                  ? "bg-violet-500/25 text-violet-50"
                  : "bg-white/10 text-white/90"
                : size === "modal"
                  ? "text-white/45 hover:text-white/70"
                  : "text-white/45 hover:text-white/65",
            )}
            onClick={(e) => {
              e.stopPropagation();
              onChange(tab.id);
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
