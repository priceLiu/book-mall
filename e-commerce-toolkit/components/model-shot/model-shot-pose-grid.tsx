"use client";

import { EcomWorkspaceResultFrame } from "@/components/media/ecom-workspace-result-frame";
import {
  ECOM_WORKSPACE_RESULT_GRID_CLASS,
  ECOM_WORKSPACE_RESULT_LABEL_CLASS,
  ecomWorkspaceResultShellClass,
} from "@/lib/ecom-workspace-result-grid";
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
      <div className={ECOM_WORKSPACE_RESULT_GRID_CLASS}>
        {ready.map((item) => (
          <button
            key={item.index}
            type="button"
            className="min-w-0 text-left"
            onClick={() => onPreview?.(item.index)}
          >
            <div className={ecomWorkspaceResultShellClass()}>
              <EcomWorkspaceResultFrame aspect="tryon-image">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.imageUrl!}
                  alt={item.title ?? `姿势 ${item.index}`}
                  className="size-full object-contain object-top"
                />
              </EcomWorkspaceResultFrame>
            </div>
            <p className={ECOM_WORKSPACE_RESULT_LABEL_CLASS}>
              {item.title ?? `姿势 ${item.index}`}
            </p>
          </button>
        ))}
      </div>
    </section>
  );
}
