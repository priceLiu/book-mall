"use client";

import { ChevronDown } from "lucide-react";
import { SBV1_ASPECT_RATIOS } from "@/lib/canvas/sbv1-video-models";
import type { Sbv1AspectRatio } from "@/lib/canvas/sbv1-workspace-types";
import { cn } from "@/lib/utils";
import {
  Sbv1ToolbarDropdown,
  useSbv1ToolbarAnchor,
} from "./sbv1-toolbar-anchor-popover";

export function Sbv1AspectRatioPicker({
  value,
  onChange,
}: {
  value: Sbv1AspectRatio;
  onChange: (ratio: Sbv1AspectRatio) => void;
}) {
  const { anchorRef, open, setOpen, rect } = useSbv1ToolbarAnchor();

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-white/85 hover:bg-white/8"
        onClick={() => setOpen(!open)}
      >
        {value}
        <ChevronDown className="size-3 opacity-60" />
      </button>
      <Sbv1ToolbarDropdown
        open={open}
        setOpen={setOpen}
        rect={rect}
        className="grid w-48 grid-cols-3 gap-1 rounded-xl border border-white/12 bg-[#1c1c1e] p-2 shadow-xl"
      >
        {SBV1_ASPECT_RATIOS.map((r) => (
          <button
            key={r}
            type="button"
            className={cn(
              "rounded-lg px-2 py-1.5 text-[11px] text-white hover:bg-white/10",
              r === value && "bg-cyan-500/20 text-cyan-100",
            )}
            onClick={() => {
              onChange(r);
              setOpen(false);
            }}
          >
            {r}
          </button>
        ))}
      </Sbv1ToolbarDropdown>
    </>
  );
}
