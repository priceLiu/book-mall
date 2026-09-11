"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Clapperboard, Film, Loader2, Plus } from "lucide-react";

import {
  EcomImagePreviewHost,
  useEcomImagePreview,
} from "@/components/media/ecom-image-preview-host";
import { EcomPromptMentionRefBar } from "@/components/media/ecom-prompt-mention-ref-bar";
import { EcomVideoSlot } from "@/components/media/ecom-video-slot";
import { OutfitEditableMentionCell } from "@/components/outfit-video/outfit-editable-mention-cell";
import { OutfitShotSceneSetupDialog } from "@/components/outfit-video/outfit-shot-scene-setup-dialog";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import {
  ecomDataTableBodyRowClass,
  ecomDataTableClass,
  ecomDataTableHeadRowClass,
  ecomDataTableTdClass,
  ecomDataTableThClass,
  ecomDataTableWrapClass,
} from "@/components/ui/ecom-data-table";
import { batchComposeButtonLabel } from "@/lib/seed-video-tts-selection";
import type { OutfitProductionTextField } from "@/lib/outfit-production-fields";
import { getOutfitProductionField } from "@/lib/outfit-production-fields";
import type { SceneShot, WorkflowRefs } from "@/lib/video-workflow/shot-spine";
import type { VtonLockedLook } from "@/lib/vton-types";
import type { OutfitSceneFusionMode } from "@/lib/ecom-outfit-video-api";
import { buildOutfitVideoMentionRefs } from "@/lib/outfit-video-mention-refs";
import { cn } from "@/lib/utils";

type Props = {
  scenes: SceneShot[];
  refs: WorkflowRefs;
  lockedLooks?: VtonLockedLook[];
  defaultLockedLookId?: string;
  productionReady: boolean;
  productionGenerating?: boolean;
  disabled?: boolean;
  generatingIndices?: ReadonlySet<number>;
  generateBusy?: boolean;
  renderBusy?: boolean;
  finalVideoUrl?: string;
  onPreviewVideo?: (src: string, title?: string) => void;
  onRequestGenerate: (indices: number[]) => void;
  onRequestCompose: (indices: number[]) => void;
  onCancelGeneratingSelection?: (index: number) => void;
  onProductionFieldChange: (
    sceneId: string,
    field: OutfitProductionTextField,
    value: string,
  ) => void;
  fusionModelKey?: string;
  fusingIndices?: ReadonlySet<number>;
  onPickSceneFusionMode: (
    index: number,
    mode: OutfitSceneFusionMode,
    libraryEntryId?: string,
  ) => Promise<void>;
  onUploadSceneRef: (index: number, file: File) => Promise<void>;
  onAttachSceneRefFromAssets: (
    index: number,
    assets: Array<{ id: string; ossUrl: string; title: string }>,
  ) => Promise<void>;
  onSceneFusionPromptChange: (sceneId: string, fragment: string) => void;
  onFuseScene: (index: number) => Promise<void>;
  onApplySceneFusionToAll: (sourceIndex: number) => Promise<void>;
  onClearShotVideo: (index: number) => Promise<void>;
  onClearSceneFusion: (index: number) => Promise<void>;
};

function resolveShotFailReason(shot: SceneShot): string | undefined {
  const productionReason = shot.outfitProduction?.failReason?.trim();
  if (shot.outfitProduction?.status === "failed" && productionReason) {
    return productionReason;
  }
  const videoReason = shot.failReason?.trim();
  if (shot.status === "failed" && videoReason) {
    return videoReason;
  }
  return productionReason || videoReason;
}

function shotStatusLabel(shot: SceneShot, generating: boolean): { label: string; className: string } {
  if (generating) return { label: "生成中", className: "text-[#0071e3]" };
  if (shot.outfitProduction?.status === "failed") {
    return { label: "策划失败", className: "text-[#ff3b30]" };
  }
  if (shot.status === "failed") return { label: "生成失败", className: "text-[#ff3b30]" };
  if (shot.videoUrl?.trim()) return { label: "视频 OK", className: "text-[#34c759]" };
  return { label: "待生成", className: "text-[#86868b]" };
}

function isOutfitShotComposeReady(shot: SceneShot): boolean {
  return Boolean(shot.videoUrl?.trim());
}

const OUTFIT_MIN_COMPOSE_SHOTS = 2;

export function OutfitShotProductionPanel({
  scenes,
  refs,
  lockedLooks,
  defaultLockedLookId,
  productionReady,
  productionGenerating,
  disabled,
  generatingIndices,
  generateBusy,
  renderBusy,
  finalVideoUrl,
  onPreviewVideo,
  onRequestGenerate,
  onRequestCompose,
  onCancelGeneratingSelection,
  onProductionFieldChange,
  fusionModelKey = "qwen-image-edit",
  fusingIndices,
  onPickSceneFusionMode,
  onUploadSceneRef,
  onAttachSceneRefFromAssets,
  onSceneFusionPromptChange,
  onFuseScene,
  onApplySceneFusionToAll,
  onClearShotVideo,
  onClearSceneFusion,
}: Props) {
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [sceneDialogIndex, setSceneDialogIndex] = useState<number | null>(null);
  const prevGenerateBusyRef = useRef(false);
  const columnCount = 10;

  useEffect(() => {
    if (prevGenerateBusyRef.current && !generateBusy) {
      setSelected(new Set());
    }
    prevGenerateBusyRef.current = Boolean(generateBusy);
  }, [generateBusy]);

  const mentionRefs = useMemo(() => buildOutfitVideoMentionRefs(refs), [refs]);

  const refGallery = useMemo(() => {
    const items: Array<{ label: string; url: string; isDefault?: boolean }> = [];
    if (lockedLooks?.length) {
      for (const look of lockedLooks) {
        items.push({
          label: look.label ?? "锁定参考",
          url: look.ossUrl,
          isDefault: look.id === defaultLockedLookId,
        });
      }
    } else if (refs.modelGallery?.length) {
      for (const [index, item] of refs.modelGallery.entries()) {
        items.push({
          label:
            index === 0
              ? `${item.label ?? `穿搭参考 ${index + 1}`} · 默认参考`
              : item.label ?? `穿搭参考 ${index + 1}`,
          url: item.ossUrl,
          isDefault: index === 0,
        });
      }
    } else if (refs.dressedImage?.ossUrl) {
      items.push({
        label: refs.dressedImage.label ?? "穿搭成片",
        url: refs.dressedImage.ossUrl,
        isDefault: true,
      });
    } else if (refs.model?.ossUrl) {
      items.push({
        label: refs.model.label ?? "穿搭参考",
        url: refs.model.ossUrl,
        isDefault: true,
      });
    }
    return items;
  }, [
    defaultLockedLookId,
    lockedLooks,
    refs.dressedImage?.label,
    refs.dressedImage?.ossUrl,
    refs.model?.label,
    refs.model?.ossUrl,
    refs.modelGallery,
  ]);

  const previewGallery = useMemo(() => {
    const items: Array<{ src: string; title: string }> = [];
    const seen = new Set<string>();
    const push = (src: string, title: string) => {
      const url = src.trim();
      if (!url || seen.has(url)) return;
      seen.add(url);
      items.push({ src: url, title });
    };
    for (const ref of mentionRefs) {
      push(ref.url, `${ref.token} · ${ref.label}`);
    }
    for (const item of refGallery) {
      push(item.url, item.label);
    }
    for (const scene of scenes) {
      const fused = scene.sceneFusion?.fusedImageUrl?.trim();
      if (fused) push(fused, `镜 ${scene.index} 场景融图`);
    }
    return items;
  }, [mentionRefs, refGallery, scenes]);

  const { preview, openPreview, closePreview, galleryItems } =
    useEcomImagePreview(previewGallery);

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

  const composeReadyIndices = useMemo(
    () => scenes.filter(isOutfitShotComposeReady).map((s) => s.index),
    [scenes],
  );

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
  const hasSelection = selectedList.length > 0;
  const generateTargets = hasSelection ? selectedActionList : idleIndices;
  const canGenerate = productionReady && generateTargets.length > 0;

  const selectedComposeList = selectedList.filter((index) => {
    const shot = scenes.find((s) => s.index === index);
    return shot && isOutfitShotComposeReady(shot);
  });
  const selectedComposeCount = selectedComposeList.length;
  const composeTargets =
    hasSelection && selectedComposeCount > 0 ? selectedComposeList : composeReadyIndices;
  const canCompose = composeTargets.length >= OUTFIT_MIN_COMPOSE_SHOTS;
  const composeLabelCount =
    hasSelection && selectedComposeCount > 0 ? selectedComposeCount : composeReadyIndices.length;
  const composeLabel = batchComposeButtonLabel({
    busy: renderBusy,
    selectedCount: composeLabelCount >= OUTFIT_MIN_COMPOSE_SHOTS ? composeLabelCount : 0,
  });
  const generateLabel = hasSelection
    ? `生成 (${selectedList.length})`
    : idleIndices.length > 0
      ? `生成 (${idleIndices.length})`
      : "生成";

  const anyGenerating = (generatingIndices?.size ?? 0) > 0 || generateBusy;
  const tableBusy = Boolean(disabled || renderBusy || productionGenerating);
  const generateButtonsBusy = Boolean(disabled || renderBusy || generateBusy || productionGenerating);

  const sceneDialogShot =
    sceneDialogIndex != null
      ? scenes.find((s) => s.index === sceneDialogIndex) ?? null
      : null;

  if (!productionReady && !productionGenerating) {
    return (
      <section className="space-y-2 rounded-xl border border-dashed border-[#e8e8ed] bg-[#fafafa] p-4">
        <h2 className="text-sm font-semibold text-[#1d1d1f]">分镜制作表</h2>
        <p className="text-xs leading-relaxed text-[#6e6e73]">
          完成上方「拆解分镜表」调整、上传模特参考并完成「识别服装」后，点击「生成分镜制作表」，AI
          将根据卖点与服装信息生成可编辑的制作表（运镜/动作/光影/场景/Prompt、场景融图、逐镜视频）。
        </p>
      </section>
    );
  }

  return (
    <section
      className="min-w-0 max-w-full space-y-3 overflow-hidden rounded-xl border border-[#e8e8ed] bg-white p-4"
      aria-busy={anyGenerating || renderBusy || productionGenerating || undefined}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-[#1d1d1f]">分镜制作表</h2>
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
            disabled={generateButtonsBusy || Boolean(finalVideoUrl) || !canCompose}
            onClick={() => onRequestCompose(composeTargets)}
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
        可编辑各镜字段；动作/场景/Prompt 支持 @ 引用下方参考资产（点击缩略图可放大）。至少 2 镜「视频 OK」即可合成；勾选后仅合成选中且已生成的镜头。
      </p>

      {mentionRefs.length > 0 ? (
        <div className="rounded-lg border border-[#e8e8ed] bg-[#fafafa] px-3 py-2.5">
          <EcomPromptMentionRefBar
            refs={mentionRefs}
            hint="参考资产 · 分镜表内输入 @ 可插入代号（@图片1=全片模特/穿搭参考，场景参考在后）"
            onPreviewImage={(url, label) => openPreview(url, label, previewGallery)}
          />
        </div>
      ) : null}

      {productionGenerating ? (
        <div className="flex items-center gap-2 rounded-lg border border-[#0071e3]/25 bg-[#f0f6ff] px-3 py-2 text-xs text-[#0058c7]">
          <Loader2 className="h-4 w-4 animate-spin" />
          正在 AI 生成分镜制作表…
        </div>
      ) : null}

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

      {refGallery.length > 0 ? (
        <div className="rounded-lg border border-[#e8e8ed] bg-[#fafafa] px-3 py-2.5">
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-[#6e6e73]">
            全片参考
          </p>
          <div className="flex flex-wrap gap-2">
            {refGallery.map((item) => (
              <button
                key={item.url}
                type="button"
                className="flex items-center gap-1.5 rounded-lg border border-[#e8e8ed] bg-white px-1.5 py-1 text-left transition hover:border-[#0071e3]/35 hover:bg-[#f0f6ff]"
                title={`${item.label} · 点击放大`}
                onClick={() => openPreview(item.url, item.label, previewGallery)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.url}
                  alt={item.label}
                  className="h-10 w-10 shrink-0 rounded-md border border-[#e8e8ed] object-cover"
                />
                <span className="pr-1 text-[10px] font-medium text-[#1d1d1f]">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className={cn(ecomDataTableWrapClass, "min-w-0 max-w-full w-full ecom-scrollbar-overlay")}>
        <table className={cn("min-w-full", ecomDataTableClass)}>
          <thead>
            <tr className={ecomDataTableHeadRowClass}>
              {["", "镜号", "时长", "运镜", "动作", "光影", "场景", "场景图", "镜头视频", "状态"].map(
                (h, i) => (
                  <th key={h || i} className={`whitespace-nowrap ${ecomDataTableThClass}`}>
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {scenes.map((row) => {
              const generating = generatingIndices?.has(row.index) ?? false;
              const status = shotStatusLabel(row, generating);
              const isSelected = selected.has(row.index);
              const fusedUrl = row.sceneFusion?.fusedImageUrl?.trim();
              const productionBusy =
                row.outfitProduction?.status === "generating" || productionGenerating;
              return (
                <Fragment key={row.sceneId}>
                  <tr className={ecomDataTableBodyRowClass}>
                    <td className={ecomDataTableTdClass}>
                      <input
                        type="checkbox"
                        className="size-3.5 rounded border-[#d2d2d7] text-[#0071e3] focus:ring-[#0071e3]/30 disabled:opacity-40"
                        checked={isSelected}
                        disabled={tableBusy || !productionReady}
                        aria-label={`选择镜 ${row.index}`}
                        onChange={(e) => toggle(row.index, e.target.checked)}
                      />
                    </td>
                    <td className={ecomDataTableTdClass}>
                      <span className="font-medium text-[#1d1d1f]">{row.index}</span>
                    </td>
                    <td className={ecomDataTableTdClass}>{row.durationSec}s</td>
                    <td className={ecomDataTableTdClass}>
                      <OutfitEditableMentionCell
                        value={getOutfitProductionField(row, "cameraMove")}
                        mentionRefs={mentionRefs}
                        disabled={tableBusy || productionBusy}
                        onChange={(v) => onProductionFieldChange(row.sceneId, "cameraMove", v)}
                      />
                    </td>
                    <td className={ecomDataTableTdClass}>
                      <OutfitEditableMentionCell
                        value={getOutfitProductionField(row, "characterAction")}
                        mentionRefs={mentionRefs}
                        disabled={tableBusy || productionBusy}
                        minRows={3}
                        onChange={(v) => onProductionFieldChange(row.sceneId, "characterAction", v)}
                      />
                    </td>
                    <td className={ecomDataTableTdClass}>
                      <OutfitEditableMentionCell
                        value={getOutfitProductionField(row, "lightingSetup")}
                        mentionRefs={mentionRefs}
                        disabled={tableBusy || productionBusy}
                        onChange={(v) => onProductionFieldChange(row.sceneId, "lightingSetup", v)}
                      />
                    </td>
                    <td className={ecomDataTableTdClass}>
                      <OutfitEditableMentionCell
                        value={getOutfitProductionField(row, "sceneBackground")}
                        mentionRefs={mentionRefs}
                        disabled={tableBusy || productionBusy}
                        minRows={3}
                        onChange={(v) => onProductionFieldChange(row.sceneId, "sceneBackground", v)}
                      />
                    </td>
                    <td className={`${ecomDataTableTdClass} align-top`}>
                      <button
                        type="button"
                        disabled={tableBusy || productionBusy}
                        className={cn(
                          "relative flex aspect-[9/16] w-14 items-center justify-center overflow-hidden rounded-md border border-[#e8e8ed] bg-[#fafafa] transition-colors hover:border-[#0071e3]",
                          fusingIndices?.has(row.index) && "opacity-70",
                        )}
                        aria-label={`镜 ${row.index} 场景设置`}
                        onClick={() => setSceneDialogIndex(row.index)}
                      >
                        {fusedUrl ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={fusedUrl} alt="" className="h-full w-full object-cover" />
                            {fusingIndices?.has(row.index) ? (
                              <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                                <Loader2 className="h-4 w-4 animate-spin text-[#0071e3]" />
                              </div>
                            ) : null}
                          </>
                        ) : (
                          <Plus className="h-5 w-5 text-[#86868b]" />
                        )}
                      </button>
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
                        onRemove={
                          row.videoUrl?.trim() && !generating && !tableBusy
                            ? () => void onClearShotVideo(row.index)
                            : undefined
                        }
                        removeLabel={`删除镜 ${row.index} 视频`}
                      />
                    </td>
                    <td className={`${ecomDataTableTdClass} ${status.className}`}>
                      <div className="space-y-0.5">
                        <span>{productionBusy ? "生成中" : status.label}</span>
                        {(() => {
                          const failReason = resolveShotFailReason(row);
                          return failReason ? (
                            <p
                              className="max-w-[12rem] text-[10px] leading-snug text-[#ff3b30]"
                              title={failReason}
                            >
                              {failReason}
                            </p>
                          ) : null;
                        })()}
                      </div>
                    </td>
                  </tr>
                  {getOutfitProductionField(row, "adjustLogic") ? (
                    <tr className="border-0 bg-[#fafafa]">
                      <td colSpan={columnCount} className="px-3 py-1.5 text-[10px] leading-relaxed text-[#6e6e73]">
                        <span className="font-medium text-[#86868b]">适配说明：</span>
                        {getOutfitProductionField(row, "adjustLogic")}
                      </td>
                    </tr>
                  ) : null}
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
                    disabled={generateButtonsBusy || Boolean(finalVideoUrl) || !canCompose}
                    onClick={() => onRequestCompose(composeTargets)}
                  >
                    {composeLabel}
                  </EcomButtonPrimary>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <OutfitShotSceneSetupDialog
        open={sceneDialogIndex != null}
        shot={sceneDialogShot}
        globalSceneRef={refs.sceneRef}
        globalScenePreset={refs.sceneLibraryPreset}
        fusionModelKey={fusionModelKey}
        fusing={sceneDialogIndex != null && (fusingIndices?.has(sceneDialogIndex) ?? false)}
        disabled={tableBusy}
        onClose={() => setSceneDialogIndex(null)}
        onScenePromptChange={onSceneFusionPromptChange}
        onPickMode={onPickSceneFusionMode}
        onUploadSceneRef={onUploadSceneRef}
        onAttachSceneRefFromAssets={onAttachSceneRefFromAssets}
        onFuse={onFuseScene}
        onClearFusion={onClearSceneFusion}
      />

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

      <EcomImagePreviewHost
        preview={preview}
        galleryItems={galleryItems}
        onClose={closePreview}
        nativeOverlay
      />
    </section>
  );
}
