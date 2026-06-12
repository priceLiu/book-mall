"use client";

import { cn } from "@/lib/utils";

export function Sbv1ResolutionPicker({
  value,
  onChange,
}: {
  value: "720p" | "1080p";
  onChange: (v: "720p" | "1080p") => void;
}) {
  return (
    <div className="flex rounded-lg border border-white/10 p-0.5">
      {(["720p", "1080p"] as const).map((r) => (
        <button
          key={r}
          type="button"
          className={cn(
            "rounded-md px-2 py-0.5 text-[10px] uppercase tracking-wide",
            value === r
              ? "bg-cyan-500/25 text-cyan-100"
              : "text-white/50 hover:text-white/80",
          )}
          onClick={() => onChange(r)}
        >
          {r}
        </button>
      ))}
    </div>
  );
}
