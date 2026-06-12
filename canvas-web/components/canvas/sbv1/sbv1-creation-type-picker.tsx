"use client";

import { ChevronDown } from "lucide-react";
import { SBV1_CREATION_TYPES } from "@/lib/canvas/sbv1-video-models";
import { cn } from "@/lib/utils";
import {
  Sbv1ToolbarDropdown,
  useSbv1ToolbarAnchor,
} from "./sbv1-toolbar-anchor-popover";

export function Sbv1CreationTypePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const { anchorRef, open, setOpen, rect } = useSbv1ToolbarAnchor();
  const current =
    SBV1_CREATION_TYPES.find((t) => t.id === value) ?? SBV1_CREATION_TYPES[0];

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-white/85 hover:bg-white/8"
        onClick={() => setOpen(!open)}
      >
        {current?.label ?? "视频生成"}
        <ChevronDown className="size-3 opacity-60" />
      </button>
      <Sbv1ToolbarDropdown
        open={open}
        setOpen={setOpen}
        rect={rect}
        className="w-52 rounded-xl border border-white/12 bg-[#1c1c1e] py-1 shadow-xl"
      >
        {SBV1_CREATION_TYPES.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={!item.enabled}
            title={item.enabled ? undefined : "即将推出"}
            className={cn(
              "flex w-full items-center justify-between px-3 py-2 text-left text-xs",
              item.enabled
                ? "text-white hover:bg-white/8"
                : "cursor-not-allowed text-white/30",
              item.id === value && item.enabled && "bg-white/10",
            )}
            onClick={() => {
              if (!item.enabled) return;
              onChange(item.id);
              setOpen(false);
            }}
          >
            {item.label}
            {!item.enabled ? (
              <span className="text-[10px] text-white/25">即将推出</span>
            ) : null}
          </button>
        ))}
      </Sbv1ToolbarDropdown>
    </>
  );
}
