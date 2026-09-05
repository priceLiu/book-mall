"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { EcomScrollLoadFooter } from "@/components/media/ecom-scroll-load-footer";
import { EcomDialogCloseButton } from "@/components/ui/dialog";
import { fetchEcomModelLibraryCatalog } from "@/lib/ecom-model-library-api";
import { listEcomModelLibraryEntries } from "@/lib/ecom-model-library/catalog";
import { sortModelLibraryForDisplay } from "@/lib/ecom-model-library/display-order";
import {
  filterModelLibraryEntries,
  type ModelLibraryGenderFilter,
} from "@/lib/ecom-model-library/filter-models";
import type { EcomModelLibraryEntry } from "@/lib/ecom-model-library/types";
import { useEcomScrollPagination } from "@/lib/use-ecom-scroll-pagination";
import { cn } from "@/lib/utils";

const GRID_CLASS = "grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5";

const GENDER_FILTERS: Array<{ value: ModelLibraryGenderFilter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "female", label: "女" },
  { value: "male", label: "男" },
  { value: "plus_female", label: "大码女" },
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (entry: EcomModelLibraryEntry) => void | Promise<void>;
};

export function EcomModelLibraryPickerDialog({ open, onOpenChange, onPick }: Props) {
  const [models, setModels] = useState<EcomModelLibraryEntry[]>(() =>
    listEcomModelLibraryEntries(),
  );
  const [gender, setGender] = useState<ModelLibraryGenderFilter>("all");
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setGender("all");
    setShuffleSeed(Math.floor(Math.random() * 0xffffffff) + 1);
    void fetchEcomModelLibraryCatalog()
      .then((catalog) => {
        if (catalog.models.length) setModels(catalog.models);
      })
      .catch(() => undefined);
  }, [open]);

  const filteredModels = useMemo(
    () => filterModelLibraryEntries(models, gender),
    [models, gender],
  );

  const sortedModels = useMemo(
    () => sortModelLibraryForDisplay(filteredModels, shuffleSeed),
    [filteredModels, shuffleSeed],
  );

  const {
    scrollRef,
    sentinelRef,
    visibleCount,
    hasMore,
    loadingMore,
    pageSize,
  } = useEcomScrollPagination({
    total: sortedModels.length,
    resetKey: `${open}:${gender}:${shuffleSeed}`,
    pageSize: 30,
  });

  const visibleModels = useMemo(
    () => sortedModels.slice(0, visibleCount),
    [sortedModels, visibleCount],
  );

  const handlePick = useCallback(
    async (entry: EcomModelLibraryEntry) => {
      setBusyId(entry.id);
      try {
        await onPick(entry);
        onOpenChange(false);
      } finally {
        setBusyId(null);
      }
    },
    [onOpenChange, onPick],
  );

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="model-library-picker-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <div className="relative flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl">
        <EcomDialogCloseButton onClick={() => onOpenChange(false)} />
        <div className="border-b border-[#e5e5ea] px-5 py-4 pr-14">
          <h3 id="model-library-picker-title" className="text-base font-semibold text-[#1d1d1f]">
            选择模特
          </h3>
          <p className="mt-1 text-xs text-[#86868b]">
            来自平台模特库；可按性别筛选，大码女模特排在列表末尾。
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="性别筛选">
            {GENDER_FILTERS.map((opt) => {
              const active = gender === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition",
                    active
                      ? "border-[#0071e3] bg-[#f0f6ff] text-[#0071e3]"
                      : "border-[#e8e8ed] bg-white text-[#424245] hover:border-[#0071e3]/40",
                  )}
                  onClick={() => setGender(opt.value)}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
        <div
          ref={scrollRef}
          className="ecom-scrollbar-thin min-h-0 flex-1 overflow-y-auto p-4"
        >
          {models.length === 0 ? (
            <p className="text-sm text-[#86868b]">暂无模特数据。</p>
          ) : sortedModels.length === 0 ? (
            <p className="text-sm text-[#86868b]">当前筛选条件下暂无模特。</p>
          ) : (
            <>
              <div className={GRID_CLASS}>
                {visibleModels.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    disabled={busyId === m.id}
                    className="overflow-hidden rounded-xl border border-[#e5e5ea] text-left transition hover:border-[#0071e3]"
                    onClick={() => void handlePick(m)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={m.ossUrl}
                      alt={m.name}
                      loading="lazy"
                      className="aspect-[3/4] w-full object-cover"
                    />
                    <p className="truncate px-2 py-1 text-[11px] font-medium text-[#1d1d1f]">
                      {m.name}
                    </p>
                  </button>
                ))}
              </div>
              <EcomScrollLoadFooter
                sentinelRef={sentinelRef}
                hasMore={hasMore}
                loadingMore={loadingMore}
                gridClass={GRID_CLASS}
                skeletonCount={Math.min(pageSize, sortedModels.length - visibleModels.length)}
              />
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
