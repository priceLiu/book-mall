"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type BillMultiFilterMode = "include" | "exclude";

type Props = {
  label: string;
  /** 来自当前已加载明细行的去重列表（数据库 → API → rows） */
  options: string[];
  mode: BillMultiFilterMode;
  onModeChange: (m: BillMultiFilterMode) => void;
  selected: Set<string>;
  onSelectedChange: (next: Set<string>) => void;
  disabled?: boolean;
};

export function BillMultiFilter({
  label,
  options,
  mode,
  onModeChange,
  selected,
  onSelectedChange,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const filteredOpts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, search]);

  function toggle(v: string) {
    const next = new Set(selected);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    onSelectedChange(next);
  }

  function removeTag(v: string, e: React.MouseEvent) {
    e.stopPropagation();
    const next = new Set(selected);
    next.delete(v);
    onSelectedChange(next);
  }

  const summaryRight =
    selected.size === 0 ? null : (
      <span className="shrink-0 text-[#8c8c8c]">
        已选择 {selected.size}/{options.length} 项
      </span>
    );

  const selectedArr = Array.from(selected);

  return (
    <div ref={rootRef} className={cn("relative flex flex-col gap-1", disabled && "opacity-50")}>
      <span className="text-[#8c8c8c]">{label}</span>
      <button
        type="button"
        disabled={disabled || options.length === 0}
        className={cn(
          "flex min-h-[2.25rem] w-full flex-wrap items-center gap-1 rounded border border-[#d9d9d9] bg-white px-2 py-1 text-left text-sm",
          open && "border-[#1890ff] ring-1 ring-[#1890ff]/30",
          (disabled || options.length === 0) && "cursor-not-allowed bg-[#fafafa]",
        )}
        onClick={() => !disabled && options.length > 0 && setOpen((v) => !v)}
      >
        {selectedArr.length === 0 ? (
          <span className="flex-1 text-[#bfbfbf]">请选择</span>
        ) : (
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
            {selectedArr.map((v) => (
              <span
                key={v}
                className="inline-flex max-w-full items-center gap-0.5 rounded bg-[#f0f0f0] px-1.5 py-0.5 text-xs text-[#262626]"
                title={v}
              >
                <span className="truncate">{v}</span>
                <button
                  type="button"
                  className="shrink-0 rounded px-0.5 text-[#8c8c8c] hover:bg-[#e0e0e0] hover:text-[#262626]"
                  aria-label={`移除 ${v}`}
                  onClick={(e) => removeTag(v, e)}
                >
                  ×
                </button>
              </span>
            ))}
          </span>
        )}
        {summaryRight}
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-[#8c8c8c]" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-[#8c8c8c]" />
        )}
      </button>

      {open && !disabled && options.length > 0 ? (
        <div
          className="absolute left-0 right-0 top-full z-50 mt-0.5 rounded border border-[#d9d9d9] bg-white p-2 shadow-md"
          role="dialog"
          aria-label={label}
        >
          <div className="mb-2 flex gap-4 border-b border-[#f0f0f0] pb-2 text-xs">
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="radio"
                name={`${label}-rel`}
                checked={mode === "include"}
                onChange={() => onModeChange("include")}
              />
              仅包括
            </label>
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="radio"
                name={`${label}-rel`}
                checked={mode === "exclude"}
                onChange={() => onModeChange("exclude")}
              />
              仅排除
            </label>
          </div>
          <div className="relative mb-2">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#bfbfbf]" />
            <input
              type="search"
              className="w-full rounded border border-[#d9d9d9] py-1.5 pl-8 pr-2 text-xs"
              placeholder="请输入"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <ul className="max-h-48 overflow-y-auto text-xs">
            {filteredOpts.length === 0 ? (
              <li className="px-2 py-2 text-[#8c8c8c]">无匹配项</li>
            ) : (
              filteredOpts.map((o) => (
                <li key={o} className="flex items-center gap-2 px-1 py-1 hover:bg-[#f5f5f5]">
                  <label className="flex flex-1 cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selected.has(o)}
                      onChange={() => toggle(o)}
                    />
                    <span className="break-all">{o}</span>
                  </label>
                </li>
              ))
            )}
          </ul>
          <div className="mt-2 flex justify-end gap-2 border-t border-[#f0f0f0] pt-2">
            <button
              type="button"
              className="rounded px-2 py-1 text-xs text-[#1890ff] hover:bg-[#e6f7ff]"
              onClick={() => onSelectedChange(new Set())}
            >
              清空
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
