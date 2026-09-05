"use client";

import { Check } from "lucide-react";

import type { SeedVideoAssistantChoice } from "@/lib/seed-video-workflow";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  subtitle: string;
  choices: SeedVideoAssistantChoice[];
  onSelect?: (message: string) => void;
  disabled?: boolean;
  selectedMessage?: string | null;
  className?: string;
};

export function SeedVideoAssistantChoiceCards({
  title,
  subtitle,
  choices,
  onSelect,
  disabled,
  selectedMessage,
  className,
}: Props) {
  return (
    <div className={cn("space-y-3", className)}>
      <div>
        <p className="text-sm font-semibold leading-snug text-[#1d1d1f]">{title}</p>
        <p className="mt-1 text-[11px] text-[#6e6e73]">{subtitle}</p>
      </div>
      <div className="space-y-2">
        {choices.map((choice) => {
          const selected =
            selectedMessage === choice.message ||
            selectedMessage === choice.label ||
            selectedMessage === choice.title;
          const readOnly = disabled && !onSelect;
          const shellClass = cn(
            "flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition",
            "border-[#e8e8ed] bg-white",
            selected && "border-[#1d1d1f] bg-[#fafafa]",
            !readOnly && "hover:border-[#86868b] hover:bg-[#fafafa]",
            disabled && onSelect && "cursor-not-allowed opacity-50",
          );
          const body = (
            <>
              <span
                className={cn(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition",
                  selected
                    ? "border-[#1d1d1f] bg-[#1d1d1f] text-white"
                    : "border-[#86868b] bg-white text-transparent",
                )}
                aria-hidden
              >
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold leading-snug text-[#1d1d1f]">
                  {choice.title}
                  {choice.recommended ? (
                    <span className="font-medium text-[#6e6e73]">（推荐）</span>
                  ) : null}
                </span>
                {choice.description ? (
                  <span className="mt-1 block text-xs leading-relaxed text-[#6e6e73]">
                    {choice.description}
                  </span>
                ) : null}
              </span>
            </>
          );
          if (readOnly) {
            return (
              <div key={choice.id} className={shellClass} aria-disabled="true">
                {body}
              </div>
            );
          }
          return (
            <button
              key={choice.id}
              type="button"
              disabled={disabled}
              className={shellClass}
              onClick={() => onSelect?.(choice.message)}
            >
              {body}
            </button>
          );
        })}
      </div>
    </div>
  );
}
