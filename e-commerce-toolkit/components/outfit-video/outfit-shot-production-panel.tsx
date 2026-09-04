"use client";

import { Fragment, useMemo, useState } from "react";
import { Clapperboard, Film, Loader2 } from "lucide-react";

import { EcomVideoSlot } from "@/components/media/ecom-video-slot";
import { OutfitShotGeneratePromptPanel } from "@/components/outfit-video/outfit-shot-generate-prompt-panel";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import {
  ecomDataTableBodyRowClass,
  ecomDataTableClass,
  ecomDataTableHeadRowClass,
  ecomDataTableTdClass,
  ecomDataTableThClass,
  ecomDataTableWrapClass,
} from "@/components/ui/ecom-data-table";
import { AnalysisCell } from "@/components/outfit-video/outfit-scene-analysis-cell";
import { OutfitShotSceneFusionCell } from "@/components/outfit-video/outfit-shot-scene-fusion-cell";
import { batchComposeButtonLabel } from "@/lib/seed-video-tts-selection";
import type { SceneShot, WorkflowRefs } from "@/lib/video-workflow/shot-spine";
import {
  outfitSceneActionLabel,
  outfitSceneBackgroundLabel,
  outfitSceneCameraLabel,
  outfitSceneLightingLabel,
} from "@/lib/video-workflow/templates/outfit-v1/shot-analysis";

type Props = {
  scenes: SceneShot[];
  refs: WorkflowRefs;
  disabled?: boolean;
  generatingIndices?: ReadonlySet<number>;
  generateBusy?: boolean;
  renderBusy?: boolean;
  finalVideoUrl?: string;
  onPreviewVideo?: (src: string, title?: string) => void;
  onRequestGenerate: (indices: number[]) => void;
  onRequestCompose: () => void;
  /** 生成中取消勾选某镜（仅更新 UI 选中态；服务端任务可能仍在跑） */
  onCancelGeneratingSelection?: (index: number) => void;
  onScenePromptChange: (sceneId: string, prompt: string) => void;
  onScenePromptReset: (sceneId: string) => void;
  fusionModelKey?: string;
  fusingIndices?: ReadonlySet<number>;
  onPickSceneFusionMode: (
    index: number,
    mode: "follow_reference" | "library" | "upload_ref",
    libraryEntryId?: string,
  ) => Promise<void>;
  onUploadSceneRef: (index: number, file: File) => Promise<void>;
  onFuseScene: (index: number) => Promise<void>;
  onApplySceneFusionToAll: (sourceIndex: number) => Promise<void>;
};

function shotStatusLabel(shot: SceneShot, generating: boolean): { label: string; className: string } {
  if (generating) return { label: "生成中", className: "text-[#0071e3]" };
  if (shot.status === "failed") return { label: "失败", className: "text-[#ff3b30]" };
  if (shot.videoUrl?.trim()) return { label: "视频 OK", className: "text-[#34c759]" };
  return { label: "待生成", className: "text-[#86868b]" };
}

function isOutfitShotComposeReady(shot: SceneShot): boolean {
  return Boolean(shot.videoUrl?.trim());
}

export function OutfitShotProductionPanel({
  scenes,
  refs,
  disabled,
  generatingIndices,
  generateBusy,
  renderBusy,
  finalVideoUrl,
  onPreviewVideo,
  onRequestGenerate,
  onRequestCompose,
  onCancelGeneratingSelection,
  onScenePromptChange,
  onScenePromptReset,
  fusionModelKey = "qwen-image-edit",
  fusingIndices,
  onPickSceneFusionMode,
  onUploadSceneRef,
  onFuseScene,
  onApplySceneFusionToAll,
}: Props) {
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const columnCount = 10;

  const refGallery = useMemo(() => {
    const items: Array<{ label: string; url: string }> = [];
    if (refs.dressedImage?.ossUrl) {
      items.push({
        label: refs.dressedImage.label ?? "穿搭成片",
        url: refs.dressedImage.ossUrl,
      });
    }
    return items;
  }, [refs.dressedImage?.label, refs.dressedImage?.ossUrl]);

  const idleIndices = useMemo(
    () =>
      scenes
        .filter(
          (s) =>
            !s.videoUrl?.trim() && !(generatingIndices?.has(s.index) ?? false),
        )
        .map((s) => s.index),
    [generatingIndices, scenes],
  );

  const regeneratableIndices = useMemo(
    () =>
      scenes
        .filter(
          (s) =>
            Boolean(s.videoUrl?.trim()) &&
            !(generatingIndices?.has(s.index) ?? false),
        )
        .map((s) => s.index),
    [generatingIndices, scenes],
  );

  const composeReadyIndices = useMemo(
    () => scenes.filter(isOutfitShotComposeReady).map((s) => s.index),
    [scenes],
  );

  const allShotsReady =
    scenes.length > 0 && scenes.every((s) => isOutfitShotComposeReady(s));

  function toggle(index: number, checked: boolean) {
    if (!checked && (generatingIndices?.has(index) ?? false)) {
      onCancelGeneratingSelection?.(index);
    }
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(index);
      else next.delete(index);
      return next;
    });
  }

  const selectedList = scenes.filter((s) => selected.has(s.index)).map((s) => s.index);
  const selectedActionList = selectedList.filter(
    (index) => !(generatingIndices?.has(index) ?? false),
  );
  const selectedGeneratableCount = selectedActionList.length;
  const generateTargets =
    selectedGeneratableCount > 0 ? selectedActionList : idleIndices;
  const canGenerate = generateTargets.length > 0;

  const selectedComposeList = selectedList.filter((index) => {
    const shot = scenes.find((s) => s.index === index);
    return shot && isOutfitShotComposeReady(shot);
  });
  const selectedComposeCount = selectedComposeList.length;
  const composeLabel = batchComposeButtonLabel({
    busy: renderBusy,
    selectedCount: selectedComposeCount,
  });
  const generateLabel =
    selectedGeneratableCount > 0
      ? `生成 (${selectedGeneratableCount})`
      : idleIndices.length > 0
        ? `生成 (${idleIndices.length})`
        : regeneratableIndices.length > 0
          ? "生成"
          : "生成";

  const anyGenerating = (generatingIndices?.size ?? 0) > 0 || generateBusy;
  const generatingStatusLabel =
    generateBusy && (generatingIndices?.size ?? 0) === 0
      ? "正在提交逐镜生成任务…"
      : (generatingIndices?.size ?? 0) > 0
        ? `正在生成 ${generatingIndices!.size} 镜视频…（取消勾选可移出队列显示）`
        : "逐镜生成中…";

  const tableBusy = Boolean(disabled || renderBusy);
  const generateButtonsBusy = Boolean(disabled || renderBusy || generateBusy);

  const focusScene = useMemo(() => {
    if (focusIndex != null) {
      return scenes.find((s) => s.index === focusIndex) ?? null;
    }
    if (selectedList.length === 1) {
      return scenes.find((s) => s.index === selectedList[0]) ?? null;
    }
    return null;
  }, [focusIndex, scenes, selectedList]);

  return (
    <section className="space-y-3 rounded-xl border border-[#e8e8ed] bg-white p-4" aria-busy={anyGenerating || renderBusy || undefined}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-[#1d1d1f]">逐镜动作迁移</h2>
        <div className="flex flex-wrap gap-2">
          <EcomButtonSecondary
            size="sm"
            type="button"
            disabled={generateButtonsBusy || !canGenerate}
            onClick={() => onRequestGenerate(generateTargets)}
          >
            <Clapperboard className="mr-1 h-3.5 w-3.5" />
            {generateLabel}
          </EcomButtonSecondary>
          <EcomButtonPrimary
            size="sm"
            type="button"
            disabled={
              generateButtonsBusy ||
              Boolean(finalVideoUrl) ||
              !allShotsReady ||
              composeReadyIndices.length === 0
            }
            onClick={() => onRequestCompose()}
          >
            {renderBusy ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Film className="mr-1 h-3.5 w-3.5" />
            )}
            {composeLabel}
          </EcomButtonPrimary>
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-[#6e6e73]">
        推荐顺序：① 每镜「选场景 → 融图」生成人物+场景参考（可应用全部共用）→ ② 勾选后「生成 (N)」逐镜动作迁移 → ③ 全部镜头就绪后「合成成片」。背景无法 100% 锁定，片段间可能存在轻微跳动。
      </p>

      <div className="flex flex-wrap gap-2">
        <EcomButtonSecondary
          type="button"
          size="sm"
          disabled={tableBusy || selectedList.length !== 1}
          onClick={() => {
            const idx = selectedList[0];
            if (idx != null) void onApplySceneFusionToAll(idx);
          }}
        >
          应用全部（共用选中镜场景图）
        </EcomButtonSecondary>
      </div>

      {anyGenerating ? (
        <div
          className="flex flex-wrap items-center gap-3 rounded-xl border border-[#0071e3]/25 bg-[#f0f6ff] px-3 py-2.5"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#0071e3]" />
          <span className="min-w-0 flex-1 text-xs leading-relaxed text-[#0058c7]">
            {generatingStatusLabel}
          </span>
          <div className="ecom-upload-progress ecom-upload-progress-indeterminate w-full min-w-[8rem] sm:w-32">
            <span />
          </div>
        </div>
      ) : null}

      {renderBusy ? (
        <div
          className="flex flex-wrap items-center gap-3 rounded-xl border border-[#0071e3]/25 bg-[#f0f6ff] px-3 py-2.5"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#0071e3]" />
          <span className="min-w-0 flex-1 text-xs leading-relaxed text-[#0058c7]">
            正在合成竖屏成片…
          </span>
          <div className="ecom-upload-progress ecom-upload-progress-indeterminate w-full min-w-[8rem] sm:w-32">
            <span />
          </div>
        </div>
      ) : null}

      {refGallery.length > 0 ? (
        <div className="rounded-lg border border-[#e8e8ed] bg-[#fafafa] px-3 py-2.5">
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-[#6e6e73]">
            全片参考
          </p>
          <div className="flex flex-wrap gap-2">
            {refGallery.map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-1.5 rounded-lg border border-[#e8e8ed] bg-white px-1.5 py-1"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.url}
                  alt={item.label}
                  className="h-10 w-10 shrink-0 rounded-md border border-[#e8e8ed] object-cover"
                />
                <span className="pr-1 text-[10px] font-medium text-[#1d1d1f]">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <OutfitShotGeneratePromptPanel
        scene={focusScene}
        disabled={tableBusy || generateBusy}
        onPromptChange={onScenePromptChange}
        onResetPrefill={onScenePromptReset}
      />

      <div className={ecomDataTableWrapClass}>
        <table className={`min-w-full ${ecomDataTableClass}`}>
          <thead>
            <tr className={ecomDataTableHeadRowClass}>
              {["", "镜号", "时长", "运镜", "动作", "光影", "场景", "场景图", "镜头视频", "状态"].map((h, i) => (
                <th key={h || i} className={`whitespace-nowrap ${ecomDataTableThClass}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {scenes.map((row) => {
              const generating = generatingIndices?.has(row.index) ?? false;
              const status = shotStatusLabel(row, generating);
              const isSelected = selected.has(row.index);
              return (
                <Fragment key={row.sceneId}>
                  <tr className={ecomDataTableBodyRowClass}>
                    <td className={ecomDataTableTdClass}>
                      <input
                        type="checkbox"
                        className="size-3.5 rounded border-[#d2d2d7] text-[#0071e3] focus:ring-[#0071e3]/30 disabled:opacity-40"
                        checked={isSelected}
                        disabled={tableBusy}
                        aria-label={`选择镜 ${row.index}`}
                        onChange={(e) => toggle(row.index, e.target.checked)}
                      />
                    </td>
                    <td className={ecomDataTableTdClass}>
                      <button
                        type="button"
                        className="font-medium text-[#0071e3] hover:underline"
                        disabled={tableBusy}
                        onClick={() => setFocusIndex(row.index)}
                      >
                        {row.index}
                      </button>
                    </td>
                    <td className={ecomDataTableTdClass}>{row.durationSec}s</td>
                    <td className={ecomDataTableTdClass}>
                      <AnalysisCell text={outfitSceneCameraLabel(row)} />
                    </td>
                    <td className={ecomDataTableTdClass}>
                      <AnalysisCell text={outfitSceneActionLabel(row)} />
                    </td>
                    <td className={ecomDataTableTdClass}>
                      <AnalysisCell text={outfitSceneLightingLabel(row)} />
                    </td>
                    <td className={ecomDataTableTdClass}>
                      <AnalysisCell text={outfitSceneBackgroundLabel(row)} />
                    </td>
                    <td className={`${ecomDataTableTdClass} align-top`}>
                      <OutfitShotSceneFusionCell
                        shot={row}
                        disabled={tableBusy}
                        fusing={fusingIndices?.has(row.index)}
                        fusionModelKey={fusionModelKey}
                        onPickMode={onPickSceneFusionMode}
                        onUploadSceneRef={onUploadSceneRef}
                        onFuse={onFuseScene}
                      />
                    </td>
                    <td className={ecomDataTableTdClass}>
                      <EcomVideoSlot
                        src={row.videoUrl}
                        aspectRatio="9:16"
                        compact
                        generating={generating}
                        generatingPosterUrl={row.previewImageUrl}
                        emptyLabel="待生成"
                        playSize="sm"
                        onPreview={
                          row.videoUrl
                            ? () => onPreviewVideo?.(row.videoUrl!, `镜 ${row.index}`)
                            : undefined
                        }
                      />
                    </td>
                    <td className={`${ecomDataTableTdClass} ${status.className}`}>{status.label}</td>
                  </tr>
                  {generating ? (
                    <tr aria-hidden="true" className="pointer-events-none border-0">
                      <td colSpan={columnCount} className="border-0 px-3 py-0">
                        <div className="flex justify-center pb-2 pt-0.5">
                          <div
                            className="ecom-upload-progress ecom-upload-progress-indeterminate h-0.5 w-40 overflow-hidden rounded-full bg-[#e8e8ed]"
                            role="progressbar"
                            aria-label={`镜 ${row.index} 生成中`}
                          >
                            <span />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-[#e8e8ed] bg-[#fafafa]">
              <td colSpan={columnCount} className="px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <EcomButtonSecondary
                    type="button"
                    size="sm"
                    className="min-w-[9rem] px-6"
                    disabled={generateButtonsBusy || !canGenerate}
                    onClick={() => onRequestGenerate(generateTargets)}
                  >
                    {generateLabel}
                  </EcomButtonSecondary>
                  <EcomButtonPrimary
                    type="button"
                    size="sm"
                    className="min-w-[9rem] px-6"
                    disabled={
                      generateButtonsBusy ||
                      Boolean(finalVideoUrl) ||
                      !allShotsReady ||
                      composeReadyIndices.length === 0
                    }
                    onClick={() => onRequestCompose()}
                  >
                    {composeLabel}
                  </EcomButtonPrimary>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {finalVideoUrl ? (
        <div className="space-y-2 border-t border-[#e8e8ed] pt-4">
          <h3 className="text-sm font-semibold text-[#1d1d1f]">成片视频</h3>
          <p className="text-[11px] text-[#6e6e73]">逐镜合成已完成，可预览或保存到「我的资产」。</p>
          <EcomVideoSlot
            src={finalVideoUrl}
            layout="gallery-workspace"
            onPreview={() => onPreviewVideo?.(finalVideoUrl, "穿搭成片")}
            playSize="lg"
          />
        </div>
      ) : null}
    </section>
  );
}
