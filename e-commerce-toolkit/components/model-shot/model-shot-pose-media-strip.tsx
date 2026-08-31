"use client";

import { useMemo } from "react";

import { StoryboardPanelCard } from "@/components/storyboard/storyboard-panel-card";
import { EcomButtonSecondary } from "@/components/ui/ecom-button";
import type { ModelShotPoseItem } from "@/lib/model-shot-types";
import type { StoryboardPanel } from "@/lib/storyboard-types";

function poseItemToPanel(item: ModelShotPoseItem): StoryboardPanel {
  return {
    index: item.index,
    timeline: item.title?.trim() || undefined,
    shotType: item.category ?? "—",
    scene: item.sceneText?.trim() || "—",
    action: item.poseDescription?.trim() || item.title?.trim() || "—",
    imageUrl: item.imageUrl,
    imagePrompt: item.prompt,
  };
}

type Props = {
  items: ModelShotPoseItem[];
  selectedIndexes: ReadonlySet<number>;
  onToggleSelect: (index: number) => void;
  activeGenIndexes: ReadonlySet<number>;
  onGenerateAll: (indexes?: number[]) => void;
  onGenerateOne: (index: number) => void;
  onPreviewImage?: (src: string, title: string) => void;
  onPreviewPrompt?: (index: number) => void;
  /** 无可提交姿势时点击批量按钮（如全部在生成中） */
  onGenerateAllBlocked?: () => void;
};

export function ModelShotPoseMediaStrip({
  items,
  selectedIndexes,
  onToggleSelect,
  activeGenIndexes,
  onGenerateAll,
  onGenerateOne,
  onPreviewImage,
  onPreviewPrompt,
  onGenerateAllBlocked,
}: Props) {
  const selectedList = useMemo(
    () => [...selectedIndexes].sort((a, b) => a - b),
    [selectedIndexes],
  );
  const pendingIndexes = useMemo(() => {
    const all = items.map((i) => i.index);
    const candidates = selectedList.length > 0 ? selectedList : all;
    return candidates.filter((index) => !activeGenIndexes.has(index));
  }, [activeGenIndexes, items, selectedList]);
  const readyCount = items.filter((i) => i.imageUrl?.trim()).length;

  return (
    <section className="rounded-xl border border-[#e8e8ed] bg-white p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[#1d1d1f]">模特图</h3>
          <p className="mt-0.5 text-[11px] text-[#86868b]">
            已生成 {readyCount} / {items.length} 张 · 点击空卡片或勾选后批量生成
          </p>
        </div>
        <EcomButtonSecondary
          size="sm"
          type="button"
          disabled={items.length === 0}
          onClick={(e) => {
            e.stopPropagation();
            if (pendingIndexes.length === 0) {
              onGenerateAllBlocked?.();
              return;
            }
            onGenerateAll(
              selectedList.length > 0 ? pendingIndexes : undefined,
            );
          }}
        >
          {selectedList.length > 0
            ? pendingIndexes.length > 0
              ? `生成模特图（${pendingIndexes.length}）`
              : "所选姿势生成中"
            : pendingIndexes.length < items.length && activeGenIndexes.size > 0
              ? `生成其余模特图（${pendingIndexes.length}）`
              : "生成全部模特图"}
        </EcomButtonSecondary>
      </div>
      <p className="mb-4 text-[11px] leading-relaxed text-[#86868b]">
        参考顺序：服装 → 模特 → 场景。单张生成请点卡片「待生成」；已有图可悬停预览、重生成或查看 Prompt。
      </p>
      <div className="flex flex-wrap gap-4">
        {items.map((item) => {
          const panel = poseItemToPanel(item);
          return (
            <StoryboardPanelCard
              key={`model-shot-pose-${item.index}`}
              panel={panel}
              aspectRatio="9:16"
              indexLabel="姿势"
              generateImageTitle="生成此姿势模特图"
              imageUrl={item.imageUrl}
              selectable
              selected={selectedIndexes.has(item.index)}
              onToggleSelect={() => onToggleSelect(item.index)}
              busy={activeGenIndexes.has(item.index)}
              onRegenerateImage={() => onGenerateOne(item.index)}
              onPreviewImage={
                item.imageUrl && onPreviewImage
                  ? () =>
                      onPreviewImage(
                        item.imageUrl!,
                        item.title ?? `姿势 ${item.index}`,
                      )
                  : undefined
              }
              onPreviewImagePrompt={
                onPreviewPrompt ? () => onPreviewPrompt(item.index) : undefined
              }
            />
          );
        })}
      </div>
    </section>
  );
}
