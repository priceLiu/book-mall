"use client";

import { ChevronDown } from "lucide-react";
import { SBV1_REFERENCE_MODES } from "@/lib/canvas/sbv1-video-models";
import type { Sbv1ReferenceMode } from "@/lib/canvas/sbv1-workspace-types";
import { cn } from "@/lib/utils";
import {
  Sbv1ToolbarDropdown,
  useSbv1ToolbarAnchor,
} from "./sbv1-toolbar-anchor-popover";

export function Sbv1ReferenceModePicker({
  value,
  onChange,
}: {
  value: Sbv1ReferenceMode;
  onChange: (mode: Sbv1ReferenceMode) => void;
}) {
  const { anchorRef, open, setOpen, rect } = useSbv1ToolbarAnchor();
  const current =
    SBV1_REFERENCE_MODES.find((m) => m.id === value) ?? SBV1_REFERENCE_MODES[0];

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-white/85 hover:bg-white/8"
        onClick={() => setOpen(!open)}
      >
        {current.label}
        <ChevronDown className="size-3 opacity-60" />
      </button>
      <Sbv1ToolbarDropdown
        open={open}
        setOpen={setOpen}
        rect={rect}
        className="w-44 rounded-xl border border-white/12 bg-[#1c1c1e] py-1 shadow-xl"
      >
        {SBV1_REFERENCE_MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            className={cn(
              "flex w-full px-3 py-2 text-left text-xs text-white hover:bg-white/8",
              m.id === value && "bg-white/10",
            )}
            onClick={() => {
              onChange(m.id);
              setOpen(false);
            }}
          >
            {m.label}
          </button>
        ))}
      </Sbv1ToolbarDropdown>
    </>
  );
}
