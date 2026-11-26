"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { EcomButtonSecondary } from "@/components/ui/ecom-button";
import { FASHION_CUSTOM_DIMENSION_CHOICE } from "@/lib/fashion-workflow";
import { cn } from "@/lib/utils";

import {
  DIMENSION_SEARCH_DEFAULT_VISIBLE,
  dimensionOptionsHasMore,
  filterDimensionOptions,
} from "@/lib/pro-vertical/dimension-search";

type ProDimensionSearchSelectProps = {
  label: string;
  options: readonly string[];
  disabled?: boolean;
  onSelect: (value: string) => void;
  className?: string;
};

export function ProDimensionSearchSelect({
  label,
  options,
  disabled,
  onSelect,
  className,
}: ProDimensionSearchSelectProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => filterDimensionOptions(options, query), [options, query]);
  const showMoreHint = useMemo(
    () => dimensionOptionsHasMore(options, query),
    [options, query],
  );

  return (
    <div className={cn("space-y-3", className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ecom-subtle)]" />
        <input
          type="search"
          value={query}
          disabled={disabled}
          placeholder={`搜索${label}…`}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-xl border border-[var(--ecom-border-soft)] bg-white py-2.5 pl-9 pr-3 text-sm text-[var(--ecom-ink)] outline-none ring-[var(--ecom-primary)] placeholder:text-[var(--ecom-subtle)] focus:border-[var(--ecom-outline-border)] focus:ring-2"
        />
      </div>
      {showMoreHint ? (
        <p className="text-[11px] text-[var(--ecom-subtle)]">
          默认展示 {DIMENSION_SEARCH_DEFAULT_VISIBLE} 项，输入关键词可搜索全部 {options.length} 项
        </p>
      ) : null}
      <div className="max-h-52 space-y-1 overflow-y-auto rounded-xl border border-[var(--ecom-divider)] bg-white p-1">
        {filtered.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-[var(--ecom-subtle)]">无匹配项，可尝试其他关键词或选「自定义」</p>
        ) : (
          filtered.map((opt) => (
            <button
              key={opt}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(opt)}
              className="flex w-full rounded-lg px-3 py-2 text-left text-sm text-[var(--ecom-ink)] transition hover:bg-[var(--ecom-content-selected-bg)] disabled:opacity-50"
            >
              {opt}
            </button>
          ))
        )}
      </div>
      <EcomButtonSecondary
        type="button"
        size="sm"
        disabled={disabled}
        className="w-full"
        onClick={() => onSelect(FASHION_CUSTOM_DIMENSION_CHOICE)}
      >
        {FASHION_CUSTOM_DIMENSION_CHOICE}
      </EcomButtonSecondary>
    </div>
  );
}
