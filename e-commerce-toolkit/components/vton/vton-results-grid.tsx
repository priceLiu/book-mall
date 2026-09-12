"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Check, ChevronLeft, ChevronRight, Loader2, Star } from "lucide-react";

import { EcomImagePreviewHost, useEcomImagePreview } from "@/components/media";
import { EcomMediaGeneratingBusy } from "@/components/media/ecom-media-generating-busy";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import { VtonResultImageHoverActions } from "@/components/vton/vton-result-image-hover-actions";
import { downloadRemoteImageUrl } from "@/lib/ecom-download-url";
import { openVtonFittingRoomInNewTab } from "@/lib/vton-fitting-room-link";
import {
  coerceVtonModelImageSize,
  vtonDynamicResultAspectStyle,
  vtonTryonResultAspectStyle,
  type VtonModelImageSize,
} from "@/lib/vton-image-quality";
import {
  ECOM_VTON_MAX_BATCH_LOOKS,
  type VtonLockedLook,
  type VtonLookSpec,
  type VtonTryonBatchState,
  type VtonTryonResult,
} from "@/lib/vton-types";
import { formatVtonBatchTryonLabel } from "@/lib/vton-tryon-progress";
import { useSaveToCatalog } from "@/lib/use-save-to-catalog";
import {
  normalizeVtonTryonResultVersions,
  resolveVtonTryonActiveVersionIndex,
} from "@/lib/vton-tryon-result-versions";
import { cn } from "@/lib/utils";

export type VtonBatchTryonMode = "selected" | "all";

type Props = {
  batch: VtonTryonBatchState | null | undefined;
  looks: VtonLookSpec[];
  selectedLookIds: string[];
  lockedLooks: VtonLockedLook[];
  defaultLockedLookId?: string;
  tryonBusy?: boolean;
  busy?: boolean;
  disabled?: boolean;
  mode: "model-tryon" | "outfit-video";
  selectedResultIds: string[];
  onToggleResult: (resultId: string) => void;
  onLockSelected: () => Promise<void>;
  onSetDefaultLocked?: (lockedLookId: string) => Promise<void>;
  onUnlockLocked?: (lockedLookId: string) => Promise<void>;
  onBatchTryon: (mode: VtonBatchTryonMode) => Promise<void>;
  onRegenerateLook?: (lookId: string) => Promise<void>;
  onRefineResult?: (resultId: string, lookId: string) => Promise<void>;
  onSaveResultToAssets?: (ossUrl: string, title: string) => Promise<void>;
  onStopBatchTryon?: () => Promise<void>;
  /** 客户端乐观态：试衣已开始但服务端 batch 尚未写入 running */
  runningLookIds?: string[];
  /** 客户端精修进行中（按 resultId） */
  refiningResultIds?: string[];
  /** 与模特生图/扩全身尺寸一致，试衣成片同比例（aitryon resolution=-1） */
  modelImageSize?: VtonModelImageSize;
};

function lookLabel(looks: VtonLookSpec[], lookId: string): string {
  const look = looks.find((l) => l.id === lookId);
  return look?.label ?? lookId.slice(0, 6);
}

function resultForLook(results: VtonTryonResult[], lookId: string): VtonTryonResult | null {
  return results.find((r) => r.lookId === lookId) ?? null;
}

/** 试衣结果 · 最多 5 列（3:4 竖图格过窄时模特显怪），小屏自适应 */
export const VTON_RESULTS_GRID_CLASS =
  "grid grid-cols-2 items-start gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5";

export const VTON_RESULT_LABEL_CLASS =
  "mt-0.5 h-4 shrink-0 truncate px-1 text-[10px] leading-4 text-[#6e6e73]";

function friendlyTryonFailReason(raw?: string): string {
  if (!raw?.trim()) return "失败";
  if (/7000|400|resolution is invalid/i.test(raw)) {
    return "参考图尺寸不符合要求，请换更清晰的服装图后重试";
  }
  return raw.trim();
}

/** 试衣结果格外壳（需穿衣 / 文生试衣共用） */
export function vtonTryonResultShellClass(opts?: {
  running?: boolean;
  selected?: boolean;
}): string {
  return cn(
    "group/image relative overflow-hidden rounded-lg border bg-[#fafafa]",
    opts?.running && "ecom-media-generating-sweep border-[#0071e3]/40",
    opts?.selected && "border-[#0071e3] ring-2 ring-[#0071e3]/30",
    !opts?.running && !opts?.selected && "border-[#e8e8ed]",
  );
}

function resultCellClass(
  result: VtonTryonResult,
  selected: boolean,
  opts?: { cellRunning?: boolean },
): string {
  const cellRunning = opts?.cellRunning ?? false;
  return cn(
    "group/image relative overflow-hidden rounded-lg border bg-[#fafafa]",
    result.status === "success" && selected && "border-[#0071e3] ring-2 ring-[#0071e3]/30",
    result.status === "success" && !selected && "border-[#e8e8ed]",
    result.status === "failed" && "border-[#ff3b30]/40",
    cellRunning && "ecom-media-generating-sweep border-[#0071e3]/40",
    result.status === "pending" && !cellRunning && "border-dashed border-[#d2d2d7]",
    result.status === "cancelled" && "border-[#86868b]/40 bg-[#f5f5f7]",
  );
}

function isTryonLookCellRunning(
  lookId: string,
  result: VtonTryonResult | undefined,
  batchRunning: boolean,
  runningLookIds: string[],
): boolean {
  if (result?.status === "running") return true;
  if (runningLookIds.includes(lookId) && (!result || result.status === "pending")) return true;
  if (batchRunning && result?.status === "running") return true;
  return false;
}

/** 仅展示已试衣 / 正在试衣的格子，不为未试衣搭配预占位 */
function isVisibleTryonResult(
  result: VtonTryonResult,
  batchRunning: boolean,
  runningLookIds: string[],
): boolean {
  if (result.status === "success" || result.status === "failed" || result.status === "cancelled") {
    return true;
  }
  if (normalizeVtonTryonResultVersions(result).some((v) => v.ossUrl.trim())) return true;
  if (result.status === "running") return true;
  if (
    result.status === "pending" &&
    (batchRunning || runningLookIds.includes(result.lookId))
  ) {
    return true;
  }
  return false;
}

export function VtonTryonResultAspectFrame({
  modelImageSize,
  className,
  children,
}: {
  modelImageSize: VtonModelImageSize;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn("relative w-full overflow-hidden bg-[#fafafa]", className)}
      style={vtonTryonResultAspectStyle(modelImageSize)}
    >
      {children}
    </div>
  );
}

/** 文生试衣 · 按成片 width/height 或 ratio 动态比例，避免固定 3:4 裁切 */
export function VtonDynamicAspectFrame({
  width,
  height,
  ratio,
  fallbackRatio = "3:4",
  className,
  children,
}: {
  width?: number;
  height?: number;
  ratio?: string;
  fallbackRatio?: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn("relative w-full overflow-hidden bg-[#fafafa]", className)}
      style={vtonDynamicResultAspectStyle({ width, height, ratio, fallbackRatio })}
    >
      {children}
    </div>
  );
}

export function VtonTryonGeneratingSlot({
  modelImageSize,
  width,
  height,
  ratio,
  label = "试衣中",
  className,
}: {
  modelImageSize?: VtonModelImageSize;
  width?: number;
  height?: number;
  ratio?: string;
  label?: string;
  className?: string;
}) {
  const frameProps =
    width || height || ratio
      ? { width, height, ratio, fallbackRatio: "3:4" as const }
      : null;
  if (frameProps) {
    return (
      <VtonDynamicAspectFrame
        {...frameProps}
        className={cn("ecom-media-generating-sweep", className)}
      >
        <EcomMediaGeneratingBusy label={label} />
      </VtonDynamicAspectFrame>
    );
  }
  return (
    <VtonTryonResultAspectFrame
      modelImageSize={coerceVtonModelImageSize(modelImageSize)}
      className={cn("ecom-media-generating-sweep", className)}
    >
      <EcomMediaGeneratingBusy label={label} />
    </VtonTryonResultAspectFrame>
  );
}

function VtonTryonRunningSlot({
  modelImageSize,
  className,
}: {
  modelImageSize: VtonModelImageSize;
  className?: string;
}) {
  return <VtonTryonGeneratingSlot modelImageSize={modelImageSize} className={className} />;
}

function VtonTryonQueuedSlot({
  modelImageSize,
  className,
}: {
  modelImageSize: VtonModelImageSize;
  className?: string;
}) {
  return (
    <VtonTryonResultAspectFrame
      modelImageSize={modelImageSize}
      className={cn(
        "flex flex-col items-center justify-center border border-dashed border-[#e8e8ed] px-1 text-center text-[10px] text-[#86868b]",
        className,
      )}
    >
      排队中
    </VtonTryonResultAspectFrame>
  );
}

export function VtonResultsGrid({
  batch,
  looks,
  selectedLookIds,
  lockedLooks,
  defaultLockedLookId,
  tryonBusy,
  busy,
  disabled,
  mode,
  selectedResultIds,
  onToggleResult,
  onLockSelected,
  onSetDefaultLocked,
  onUnlockLocked,
  onBatchTryon,
  onRegenerateLook,
  onRefineResult,
  onSaveResultToAssets,
  onStopBatchTryon,
  runningLookIds: runningLookIdsProp,
  refiningResultIds: refiningResultIdsProp,
  modelImageSize: modelImageSizeProp,
}: Props) {
  const saveToCatalog = useSaveToCatalog();
  const modelImageSize = coerceVtonModelImageSize(modelImageSizeProp);
  const runningLookIds = runningLookIdsProp ?? [];
  const refiningResultIds = refiningResultIdsProp ?? [];
  const results = useMemo(() => batch?.results ?? [], [batch?.results]);
  const slotLooks = looks.slice(0, ECOM_VTON_MAX_BATCH_LOOKS);
  const running = batch?.status === "running" || Boolean(tryonBusy);
  const visibleLooks = useMemo(() => {
    const ids = new Set<string>();
    for (const result of results) {
      if (isVisibleTryonResult(result, running, runningLookIds)) {
        ids.add(result.lookId);
      }
    }
    for (const lookId of runningLookIds) ids.add(lookId);
    return slotLooks.filter((look) => ids.has(look.id));
  }, [results, running, runningLookIds, slotLooks]);
  const showResultsGrid = visibleLooks.length > 0;
  const hasSuccess = results.some((r) => normalizeVtonTryonResultVersions(r).length > 0);
  const lockedResultIds = new Set(lockedLooks.map((l) => l.resultId).filter(Boolean));
  const selectedTryonCount = selectedLookIds.length;
  const canGenerateSelected = selectedTryonCount > 0 && !running;

  const [versionIndexByLookId, setVersionIndexByLookId] = useState<Record<string, number>>({});

  useEffect(() => {
    setVersionIndexByLookId((prev) => {
      const next = { ...prev };
      for (const r of results) {
        const versions = normalizeVtonTryonResultVersions(r);
        if (versions.length < 1) continue;
        const serverIdx = resolveVtonTryonActiveVersionIndex(r, versions);
        const localIdx = prev[r.lookId];
        if (localIdx == null || localIdx >= versions.length - 1) {
          next[r.lookId] = serverIdx;
        } else if (localIdx >= versions.length) {
          next[r.lookId] = versions.length - 1;
        }
      }
      return next;
    });
  }, [results]);

  const previewItems = useMemo(() => {
    const seen = new Set<string>();
    const items: Array<{ src: string; title: string; thumbSrc: string }> = [];
    for (const look of visibleLooks) {
      const result = resultForLook(results, look.id);
      if (!result) continue;
      const label = lookLabel(looks, result.lookId);
      for (const v of normalizeVtonTryonResultVersions(result)) {
        const src = v.ossUrl.trim();
        if (!src || seen.has(src)) continue;
        seen.add(src);
        items.push({ src, title: label, thumbSrc: src });
      }
    }
    for (const l of lockedLooks) {
      const src = l.ossUrl.trim();
      if (!src || seen.has(src)) continue;
      seen.add(src);
      items.push({
        src,
        title: l.label ?? "已锁定参考",
        thumbSrc: src,
      });
    }
    return items;
  }, [results, looks, lockedLooks, visibleLooks]);

  const { preview, openPreview, closePreview } = useEcomImagePreview(previewItems);

  const shiftResultVersion = useCallback((lookId: string, delta: number, result: VtonTryonResult) => {
    const versions = normalizeVtonTryonResultVersions(result);
    if (versions.length <= 1) return;
    setVersionIndexByLookId((prev) => {
      const current = prev[lookId] ?? resolveVtonTryonActiveVersionIndex(result, versions);
      const nextIdx = Math.max(0, Math.min(versions.length - 1, current + delta));
      if (nextIdx === current) return prev;
      return { ...prev, [lookId]: nextIdx };
    });
  }, []);

  async function handleDownload(url: string, title: string) {
    const safe = title.replace(/[^\w\u4e00-\u9fff-]+/g, "_").slice(0, 40) || "tryon";
    await downloadRemoteImageUrl(url, `${safe}.jpg`);
  }

  return (
    <>
      <section className="space-y-3 rounded-xl border border-[#e8e8ed] bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-semibold text-[#1d1d1f]">试衣结果</h3>
            {batch ? (
              <p className="text-[11px] text-[#6e6e73]">{formatVtonBatchTryonLabel(batch)}</p>
            ) : (
              <p className="text-[11px] text-[#6e6e73]">
                勾选搭配后试衣；未勾选时可点「全部生成试衣」
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {running && onStopBatchTryon ? (
              <EcomButtonSecondary
                type="button"
                size="sm"
                disabled={busy || disabled}
                onClick={() => void onStopBatchTryon()}
              >
                停止
              </EcomButtonSecondary>
            ) : null}
            <EcomButtonSecondary
              type="button"
              size="sm"
              disabled={busy || disabled || running || looks.length < 1}
              onClick={() => void onBatchTryon("all")}
            >
              全部生成试衣
            </EcomButtonSecondary>
            <EcomButtonPrimary
              type="button"
              size="sm"
              disabled={busy || disabled || !canGenerateSelected}
              onClick={() => void onBatchTryon("selected")}
            >
              {running ? (
                <>
                  <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />
                  试衣中…
                </>
              ) : (
                `试衣 (${selectedTryonCount || 0})`
              )}
            </EcomButtonPrimary>
          </div>
        </div>

        {!showResultsGrid ? (
          <div className="flex min-h-[28vh] flex-col items-center justify-center rounded-lg border border-dashed border-[#e8e8ed] bg-[#fafafa] px-6 py-10 text-center">
            <p className="max-w-md text-sm text-[#6e6e73]">
              勾选搭配并点击「试衣」后，成片将显示在此。生成完成后可勾选结果并锁定为参考图。
            </p>
          </div>
        ) : (
          <div className={VTON_RESULTS_GRID_CLASS}>
            {visibleLooks.map((look) => {
              const result = resultForLook(results, look.id);
              const label = lookLabel(looks, look.id);

              if (!result) {
                return (
                  <div key={look.id} className="flex min-w-0 flex-col">
                    <div className={vtonTryonResultShellClass({ running: true })}>
                      <VtonTryonGeneratingSlot modelImageSize={modelImageSize} label="试衣中" />
                    </div>
                    <p className={VTON_RESULT_LABEL_CLASS}>{label}</p>
                  </div>
                );
              }

              const selected = selectedResultIds.includes(result.id);
              const isLocked = lockedResultIds.has(result.id);
              const versions = normalizeVtonTryonResultVersions(result);
              const versionIndex =
                versionIndexByLookId[result.lookId] ??
                resolveVtonTryonActiveVersionIndex(result, versions);
              const displayUrl = versions[versionIndex]?.ossUrl ?? result.ossUrl ?? null;
              const hasMultipleVersions = versions.length > 1;
              const showImage = Boolean(displayUrl);
              const cellRunning = isTryonLookCellRunning(
                look.id,
                result,
                running,
                runningLookIds,
              );
              const cellRefining = refiningResultIds.includes(result.id);
              const cellBusy = cellRunning || cellRefining;

              return (
                <div key={result.id} className="flex min-w-0 flex-col">
                  <div className={resultCellClass(result, selected, { cellRunning: cellBusy })}>
                    {showImage ? (
                      <VtonTryonResultAspectFrame
                        modelImageSize={modelImageSize}
                        className="group/image"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={displayUrl!}
                          alt={label}
                          className="h-full w-full object-contain object-top"
                          draggable={false}
                        />
                        {cellRefining ? (
                          <EcomMediaGeneratingBusy label="精修中" className="z-[2]" />
                        ) : cellRunning ? (
                          <EcomMediaGeneratingBusy label="试衣中" className="z-[2]" />
                        ) : null}
                        {result.status === "failed" && !cellBusy ? (
                          <div className="absolute inset-x-0 bottom-0 z-[2] bg-[#ff3b30]/90 px-1 py-0.5 text-center text-[9px] text-white">
                            {friendlyTryonFailReason(result.failReason)}
                          </div>
                        ) : null}
                        {!cellBusy ? (
                          <VtonResultImageHoverActions
                            disabled={busy || disabled || refiningResultIds.length > 0}
                            onPreview={() => openPreview(displayUrl!, label, previewItems)}
                            onDownload={() => void handleDownload(displayUrl!, label)}
                            onSaveToAssets={
                              onSaveResultToAssets
                                ? () => void onSaveResultToAssets(displayUrl!, label)
                                : undefined
                            }
                            onSaveToCatalog={() =>
                              saveToCatalog({
                                url: displayUrl!,
                                sourceModule: mode === "model-tryon" ? "ecom-vton" : "ecom-outfit-video",
                                sourceAssetId: result.id,
                              })
                            }
                            onOpenFittingRoom={openVtonFittingRoomInNewTab}
                            onRegenerate={
                              onRegenerateLook && !running
                                ? () => void onRegenerateLook(result.lookId)
                                : undefined
                            }
                            onRefine={
                              onRefineResult &&
                              result.status === "success" &&
                              !running &&
                              refiningResultIds.length === 0
                                ? () => void onRefineResult(result.id, result.lookId)
                                : undefined
                            }
                          />
                        ) : null}
                        {hasMultipleVersions && !cellBusy ? (
                          <>
                            <div className="pointer-events-none absolute right-1 top-1 z-[30]">
                              <span className="rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium leading-none text-white">
                                {versionIndex + 1} / {versions.length}
                              </span>
                            </div>
                            <div className="absolute inset-0 z-[4] flex items-center justify-between px-0.5 opacity-0 transition group-hover/image:opacity-100">
                              <button
                                type="button"
                                aria-label="上一版"
                                disabled={versionIndex <= 0}
                                className="pointer-events-auto flex size-7 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 disabled:opacity-30"
                                onClick={() => shiftResultVersion(result.lookId, -1, result)}
                              >
                                <ChevronLeft className="size-4" />
                              </button>
                              <button
                                type="button"
                                aria-label="下一版"
                                disabled={versionIndex >= versions.length - 1}
                                className="pointer-events-auto flex size-7 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 disabled:opacity-30"
                                onClick={() => shiftResultVersion(result.lookId, 1, result)}
                              >
                                <ChevronRight className="size-4" />
                              </button>
                            </div>
                          </>
                        ) : null}
                        <button
                          type="button"
                          className={cn(
                            "absolute left-1 top-1 z-[30] rounded-full p-0.5",
                            selected ? "bg-[#0071e3] text-white" : "bg-black/40 text-white",
                            (busy || disabled || isLocked) && "pointer-events-none opacity-50",
                          )}
                          disabled={busy || disabled || isLocked}
                          onClick={() => onToggleResult(result.id)}
                          aria-label="选择结果"
                        >
                          <Check className="h-3 w-3" />
                        </button>
                        {isLocked ? (
                          <span className="absolute right-1 top-1 z-[31] rounded bg-[#34c759] px-1 py-0.5 text-[9px] leading-none text-white">
                            已锁定
                          </span>
                        ) : null}
                      </VtonTryonResultAspectFrame>
                    ) : cellRunning ? (
                      <VtonTryonRunningSlot modelImageSize={modelImageSize} />
                    ) : result.status === "failed" ? (
                      <VtonTryonResultAspectFrame
                        modelImageSize={modelImageSize}
                        className="flex flex-col items-center justify-center gap-1 p-2 text-center text-[10px] text-[#ff3b30]"
                      >
                        <span>{friendlyTryonFailReason(result.failReason)}</span>
                        {onRegenerateLook && !running ? (
                          <button
                            type="button"
                            className="text-[#0071e3] hover:underline disabled:opacity-50"
                            disabled={busy || disabled}
                            onClick={() => void onRegenerateLook(result.lookId)}
                          >
                            重试
                          </button>
                        ) : null}
                      </VtonTryonResultAspectFrame>
                    ) : result.status === "cancelled" ? (
                      <VtonTryonResultAspectFrame
                        modelImageSize={modelImageSize}
                        className="flex flex-col items-center justify-center p-2 text-center text-[10px] text-[#86868b]"
                      >
                        {result.failReason ?? "已停止"}
                      </VtonTryonResultAspectFrame>
                    ) : (
                      <VtonTryonQueuedSlot modelImageSize={modelImageSize} />
                    )}
                  </div>
                  <p className={VTON_RESULT_LABEL_CLASS}>{label}</p>
                </div>
              );
            })}
          </div>
        )}

        {hasSuccess ? (
          <div className="flex flex-wrap gap-2">
            <EcomButtonSecondary
              type="button"
              size="sm"
              disabled={busy || disabled || selectedResultIds.length === 0}
              onClick={() => void onLockSelected()}
            >
              锁定已选 ({selectedResultIds.length})
            </EcomButtonSecondary>
          </div>
        ) : null}

        {lockedLooks.length > 0 ? (
          <div className="space-y-2 border-t border-[#e8e8ed] pt-3">
            <h4 className="text-[11px] font-medium text-[#6e6e73]">
              已锁定参考 ({lockedLooks.length})
              {mode === "outfit-video" ? " · 锁定后可进入逐镜生成" : ""}
            </h4>
            <div className={VTON_RESULTS_GRID_CLASS}>
              {lockedLooks.map((look) => {
                const isDefault = look.id === defaultLockedLookId;
                return (
                  <div key={look.id} className="flex min-w-0 flex-col">
                    <div
                      className={cn(
                        "relative w-full overflow-hidden rounded-lg border",
                        isDefault ? "border-[#0071e3]" : "border-[#e8e8ed]",
                      )}
                    >
                      <button
                        type="button"
                        className="block w-full cursor-zoom-in"
                        title="点击查看大图"
                        onClick={() =>
                          openPreview(look.ossUrl, look.label ?? "已锁定参考", previewItems)
                        }
                      >
                        <VtonTryonResultAspectFrame modelImageSize={modelImageSize}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={look.ossUrl}
                            alt={look.label}
                            className="h-full w-full object-contain object-top"
                            draggable={false}
                          />
                        </VtonTryonResultAspectFrame>
                      </button>
                      {isDefault ? (
                        <Star className="absolute left-1 top-1 z-[30] h-3 w-3 fill-[#0071e3] text-[#0071e3]" />
                      ) : null}
                    </div>
                    <div className="flex gap-0.5 p-0.5">
                      {onSetDefaultLocked && !isDefault ? (
                        <button
                          type="button"
                          className="flex-1 text-[9px] text-[#0071e3] hover:underline disabled:opacity-50"
                          disabled={busy || disabled}
                          onClick={() => void onSetDefaultLocked(look.id)}
                        >
                          设默认
                        </button>
                      ) : null}
                      {onUnlockLocked ? (
                        <button
                          type="button"
                          className="flex-1 text-[9px] text-[#ff3b30] hover:underline disabled:opacity-50"
                          disabled={busy || disabled}
                          onClick={() => void onUnlockLocked(look.id)}
                        >
                          取消
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </section>
      <EcomImagePreviewHost preview={preview} galleryItems={previewItems} onClose={closePreview} />
    </>
  );
}
