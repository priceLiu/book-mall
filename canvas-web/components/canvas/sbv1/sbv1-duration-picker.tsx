"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sbv1ToolbarDropdown,
  useSbv1ToolbarAnchor,
} from "./sbv1-toolbar-anchor-popover";

const DURATIONS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

export function Sbv1DurationPicker({
  value,
  onChange,
  readOnly,
}: {
  value: number;
  onChange: (sec: number) => void;
  readOnly?: boolean;
}) {
  const { anchorRef, open, setOpen, rect } = useSbv1ToolbarAnchor();
  const label = readOnly ? "0s" : `${value}s`;

  if (readOnly) {
    return (
      <span className="rounded-lg px-2 py-1 text-[11px] text-white/45">{label}</span>
    );
  }

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-white/85 hover:bg-white/8"
        onClick={() => setOpen(!open)}
      >
        {label}
        <ChevronDown className="size-3 opacity-60" />
      </button>
      <Sbv1ToolbarDropdown
        open={open}
        setOpen={setOpen}
        rect={rect}
        className="grid max-h-48 w-36 grid-cols-3 gap-1 overflow-y-auto rounded-xl border border-white/12 bg-[#1c1c1e] p-2 shadow-xl"
      >
        {DURATIONS.map((sec) => (
          <button
            key={sec}
            type="button"
            className={cn(
              "rounded-lg px-1 py-1.5 text-[11px] text-white hover:bg-white/10",
              sec === value && "bg-cyan-500/20 text-cyan-100",
            )}
            onClick={() => {
              onChange(sec);
              setOpen(false);
            }}
          >
            {sec}s
          </button>
        ))}
      </Sbv1ToolbarDropdown>
    </>
  );
}
