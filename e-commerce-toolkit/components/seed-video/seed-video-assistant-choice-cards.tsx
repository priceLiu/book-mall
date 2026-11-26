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

function isChoiceSelected(
  choice: SeedVideoAssistantChoice,
  selectedMessage?: string | null,
): boolean {
  if (!selectedMessage) return false;
  return (
    selectedMessage === choice.message ||
    selectedMessage === choice.label ||
    selectedMessage === choice.title
  );
}

export function SeedVideoAssistantChoiceCards({
  title,
  subtitle,
  choices,
  onSelect,
  disabled,
  selectedMessage,
  className,
}: Props) {
  const readOnly = !onSelect;

  return (
    <div className={cn("space-y-3", className)}>
      <div>
        <p className="text-sm font-semibold leading-snug text-[var(--ecom-ink)]">{title}</p>
        {subtitle ? <p className="mt-1 text-[11px] text-[var(--ecom-muted)]">{subtitle}</p> : null}
      </div>
      <div className="space-y-2">
        {choices.map((choice) => {
          const selected = isChoiceSelected(choice, selectedMessage);
          const shellClass = cn(
            "flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition",
            "border-[var(--ecom-divider)] bg-white",
            selected && "border-[var(--ecom-ink)] bg-[#fafafa]",
            !readOnly && !disabled && "hover:border-[var(--ecom-subtle)] hover:bg-[#fafafa]",
            !readOnly && disabled && "cursor-not-allowed opacity-50",
            readOnly && "cursor-default",
          );
          const body = (
            <>
              <span
                className={cn(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition",
                  selected
                    ? "border-[var(--ecom-ink)] bg-[var(--ecom-ink)] text-white"
                    : "border-[var(--ecom-subtle)] bg-white text-transparent",
                )}
                aria-hidden
              >
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold leading-snug text-[var(--ecom-ink)]">
                  {choice.title}
                  {choice.recommended ? (
                    <span className="font-medium text-[var(--ecom-muted)]">（推荐）</span>
                  ) : null}
                </span>
                {choice.description ? (
                  <span className="mt-1 block text-xs leading-relaxed text-[var(--ecom-muted)]">
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
