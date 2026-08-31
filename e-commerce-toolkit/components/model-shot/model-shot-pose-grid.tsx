"use client";

import type { ModelShotPoseItem } from "@/lib/model-shot-types";

type Props = {
  items: ModelShotPoseItem[];
  onPreview?: (index: number) => void;
};

export function ModelShotPoseGrid({ items, onPreview }: Props) {
  const ready = items.filter((i) => i.imageUrl);
  if (ready.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-[#d2d2d7] p-6 text-center text-sm text-[#86868b]">
        确认计划并出图后，成图将显示在这里。
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-[#1d1d1f]">出图结果</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {ready.map((item) => (
          <button
            key={item.index}
            type="button"
            className="overflow-hidden rounded-xl border border-[#e5e5ea] text-left"
            onClick={() => onPreview?.(item.index)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.imageUrl!}
              alt={item.title ?? `姿势 ${item.index}`}
              className="aspect-[3/4] w-full object-cover"
            />
            <p className="truncate px-2 py-1.5 text-xs text-[#424245]">
              {item.title ?? `姿势 ${item.index}`}
            </p>
          </button>
        ))}
      </div>
    </section>
  );
}
