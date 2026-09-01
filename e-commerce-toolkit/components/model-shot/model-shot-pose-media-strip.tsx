"use client";

import { useCallback, useMemo, useState } from "react";

import { ModelShotGeneratedImagesSidebar } from "@/components/model-shot/model-shot-generated-images-sidebar";
import { ModelShotPoseCard } from "@/components/model-shot/model-shot-pose-card";
import { EcomButtonSecondary } from "@/components/ui/ecom-button";
import { patchModelShotPoseItem } from "@/lib/ecom-model-shot-api";
import {
  listModelShotAllGeneratedImages,
  resolveModelShotPoseImageHistory,
} from "@/lib/model-shot-pose-images";
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
  projectId: string;
  items: ModelShotPoseItem[];
  selectedIndexes: ReadonlySet<number>;
  onToggleSelect: (index: number) => void;
  activeGenIndexes: ReadonlySet<number>;
  onGenerateAll: (indexes?: number[]) => void;
  onGenerateOne: (index: number) => void;
  onPreviewImage?: (src: string, title: string) => void;
  onPreviewPrompt?: (index: number) => void;
  onProjectChange?: () => void | Promise<void>;
  onGenerateAllBlocked?: () => void;
};

export function ModelShotPoseMediaStrip({
  projectId,
  items,
  selectedIndexes,
  onToggleSelect,
  activeGenIndexes,
  onGenerateAll,
  onGenerateOne,
  onPreviewImage,
  onPreviewPrompt,
  onProjectChange,
  onGenerateAllBlocked,
}: Props) {
  const [focusPoseIndex, setFocusPoseIndex] = useState<number | null>(null);
  const [focusVersionIndex, setFocusVersionIndex] = useState<number | null>(null);

  const selectedList = useMemo(
    () => [...selectedIndexes].sort((a, b) => a - b),
    [selectedIndexes],
  );
  const pendingIndexes = useMemo(() => {
    const all = items.map((i) => i.index);
    const candidates = selectedList.length > 0 ? selectedList : all;
    return candidates.filter((index) => !activeGenIndexes.has(index));
  }, [activeGenIndexes, items, selectedList]);
  const readyCount = items.filter((i) => resolveModelShotPoseImageHistory(i).length > 0).length;
  const allGeneratedImages = useMemo(() => listModelShotAllGeneratedImages(items), [items]);

  const handleActiveImageIndexChange = useCallback(
    async (poseIndex: number, versionIndex: number) => {
      setFocusPoseIndex(poseIndex);
      setFocusVersionIndex(versionIndex);
      try {
        await patchModelShotPoseItem(projectId, poseIndex, { activeImageIndex: versionIndex });
        await onProjectChange?.();
      } catch {
        /* 切换版本失败时保留本地展示 */
      }
    },
    [onProjectChange, projectId],
  );

  return (
    <section
      id="model-shot-pose-media-strip"
      className="rounded-xl border border-[#e8e8ed] bg-white p-5"
    >
      <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[#1d1d1f]">模特图</h3>
          <p className="mt-0.5 text-[11px] text-[#86868b]">
            已生成 {readyCount} / {items.length} 张 · 重生成保留历史，悬停可切换版本
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
            onGenerateAll(selectedList.length > 0 ? pendingIndexes : undefined);
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
      <p className="mb-4 shrink-0 text-[11px] leading-relaxed text-[#86868b]">
        参考顺序：服装 → 模特 → 场景。同格多次生成会叠层保留；右侧栏可浏览全部成图。
      </p>

      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,max(8.75rem,calc((100%-3*1rem)/4))),1fr))]">
            {items.map((item) => {
              const panel = poseItemToPanel(item);
              const title = item.title ?? `姿势 ${item.index}`;
              return (
                <ModelShotPoseCard
                  key={`model-shot-pose-${item.index}`}
                  item={item}
                  panel={panel}
                  aspectRatio="9:16"
                  indexLabel="姿势"
                  generateImageTitle="生成此姿势模特图"
                  selectable
                  selected={selectedIndexes.has(item.index)}
                  onToggleSelect={() => onToggleSelect(item.index)}
                  busy={activeGenIndexes.has(item.index)}
                  onRegenerateImage={() => onGenerateOne(item.index)}
                  onPreviewImage={
                    onPreviewImage
                      ? (url) => {
                          setFocusPoseIndex(item.index);
                          const history = resolveModelShotPoseImageHistory(item);
                          const versionIndex = history.findIndex((v) => v.url === url);
                          setFocusVersionIndex(versionIndex >= 0 ? versionIndex : null);
                          onPreviewImage(url, title);
                        }
                      : undefined
                  }
                  onPreviewImagePrompt={
                    onPreviewPrompt ? () => onPreviewPrompt(item.index) : undefined
                  }
                  onActiveImageIndexChange={(versionIndex) => {
                    void handleActiveImageIndexChange(item.index, versionIndex);
                  }}
                />
              );
            })}
          </div>
        </div>

        {allGeneratedImages.length > 0 && onPreviewImage ? (
          <ModelShotGeneratedImagesSidebar
            entries={allGeneratedImages}
            activePoseIndex={focusPoseIndex}
            activeVersionIndex={focusVersionIndex}
            onPreview={(url, label) => {
              const entry = allGeneratedImages.find((e) => e.url === url);
              if (entry) {
                setFocusPoseIndex(entry.poseIndex);
                setFocusVersionIndex(entry.versionIndex);
              }
              onPreviewImage(url, label);
            }}
          />
        ) : null}
      </div>
    </section>
  );
}
