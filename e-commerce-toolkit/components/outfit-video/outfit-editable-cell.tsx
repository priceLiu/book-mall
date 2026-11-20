"use client";

import { cn } from "@/lib/utils";

type Props = {
  value: string;
  disabled?: boolean;
  placeholder?: string;
  minRows?: number;
  onChange: (value: string) => void;
  className?: string;
};

export function OutfitEditableCell({
  value,
  disabled,
  placeholder = "—",
  minRows = 2,
  onChange,
  className,
}: Props) {
  return (
    <textarea
      className={cn(
        "ecom-scrollbar-thin block min-w-[9rem] max-w-[20rem] resize-y rounded-md border border-transparent bg-transparent px-1 py-0.5 text-xs leading-relaxed text-[#1d1d1f] outline-none transition-colors",
        "hover:border-[#e8e8ed] focus:border-[var(--ecom-outline-border)] focus:bg-white focus:ring-2 focus:ring-[#1d1d1f]/12",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      rows={minRows}
      disabled={disabled}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
