"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Loader2, Star } from "lucide-react";

import { EcomImagePreviewHost, useEcomImagePreview } from "@/components/media";
import { EcomMediaGeneratingBusy } from "@/components/media/ecom-media-generating-busy";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import { VtonResultImageHoverActions } from "@/components/vton/vton-result-image-hover-actions";
import { downloadRemoteImageUrl } from "@/lib/ecom-download-url";
import { openVtonFittingRoomInNewTab } from "@/lib/vton-fitting-room-link";
import {
  ECOM_VTON_MAX_BATCH_LOOKS,
  type VtonLockedLook,
  type VtonLookSpec,
  type VtonTryonBatchState,
  type VtonTryonResult,
} from "@/lib/vton-types";
import { formatVtonBatchTryonLabel } from "@/lib/vton-tryon-progress";
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
  onSaveResultToAssets?: (ossUrl: string, title: string) => Promise<void>;
  onStopBatchTryon?: () => Promise<void>;
  /** 客户端乐观态：试衣已开始但服务端 batch 尚未写入 running */
  runningLookIds?: string[];
};

function lookLabel(looks: VtonLookSpec[], lookId: string): string {
  const look = looks.find((l) => l.id === lookId);
  return look?.label ?? lookId.slice(0, 6);
}

function resultForLook(results: VtonTryonResult[], lookId: string): VtonTryonResult | null {
  return results.find((r) => r.lookId === lookId) ?? null;
}

/** 试衣结果 · 最多 6 列，小屏自适应 */
const VTON_RESULTS_GRID_CLASS =
  "grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6";

function friendlyTryonFailReason(raw?: string): string {
  if (!raw?.trim()) return "失败";
  if (/7000|400|resolution is invalid/i.test(raw)) {
    return "参考图尺寸不符合要求，请换更清晰的服装图后重试";
  }
  return raw.trim();
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

/** 仅当前正在试衣的一格显示扫光；排队中/待试衣格不带动效 */
function resolveActiveTryonLookId(
  batch: VtonTryonBatchState | null | undefined,
  tryonBusy: boolean | undefined,
  runningLookIds: string[] | undefined,
): string | null {
  if (batch?.status === "running") {
    const running = batch.results.find((r) => r.status === "running");
    if (running) return running.lookId;
  }
  if (tryonBusy && runningLookIds?.length) {
    return runningLookIds[0] ?? null;
  }
  return null;
}

function VtonTryonRunningSlot({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative aspect-[3/4] overflow-hidden rounded-lg bg-[#fafafa] ecom-media-generating-sweep",
        className,
      )}
    >
      <EcomMediaGeneratingBusy label="试衣中" />
    </div>
  );
}

function VtonTryonQueuedSlot({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative flex aspect-[3/4] flex-col items-center justify-center rounded-lg border border-dashed border-[#e8e8ed] bg-[#fafafa] px-1 text-center text-[10px] text-[#86868b]",
        className,
      )}
    >
      排队中
    </div>
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
  onSaveResultToAssets,
  onStopBatchTryon,
  runningLookIds,
}: Props) {
  const results = useMemo(() => batch?.results ?? [], [batch?.results]);
  const slotLooks = looks.slice(0, ECOM_VTON_MAX_BATCH_LOOKS);
  const running = batch?.status === "running" || tryonBusy;
  const activeTryonLookId = useMemo(
    () => resolveActiveTryonLookId(batch, tryonBusy, runningLookIds),
    [batch, tryonBusy, runningLookIds],
  );
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
    for (const look of slotLooks) {
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
  }, [results, looks, lockedLooks, slotLooks]);

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

        {slotLooks.length > 0 ? (
          <div className={VTON_RESULTS_GRID_CLASS}>
            {slotLooks.map((look) => {
              const result = resultForLook(results, look.id);
              if (!result) {
                if (activeTryonLookId === look.id) {
                  return (
                    <div key={look.id}>
                      <VtonTryonRunningSlot className="border border-[#0071e3]/40" />
                      <p className="truncate px-1 py-0.5 text-[10px] text-[#6e6e73]">
                        {lookLabel(looks, look.id)}
                      </p>
                    </div>
                  );
                }
                return (
                  <div key={look.id}>
                    <div className="flex aspect-[3/4] flex-col items-center justify-center rounded-lg border border-dashed border-[#e8e8ed] bg-[#fafafa] px-1 text-center text-[10px] text-[#86868b]">
                      待试衣
                    </div>
                    <p className="truncate px-1 py-0.5 text-[10px] text-[#6e6e73]">
                      {lookLabel(looks, look.id)}
                    </p>
                  </div>
                );
              }

              const selected = selectedResultIds.includes(result.id);
              const isLocked = lockedResultIds.has(result.id);
              const label = lookLabel(looks, result.lookId);
              const versions = normalizeVtonTryonResultVersions(result);
              const versionIndex =
                versionIndexByLookId[result.lookId] ??
                resolveVtonTryonActiveVersionIndex(result, versions);
              const displayUrl = versions[versionIndex]?.ossUrl ?? result.ossUrl ?? null;
              const hasMultipleVersions = versions.length > 1;
              const showImage = Boolean(displayUrl);
              const cellRunning = activeTryonLookId === look.id && running;

              return (
                <div
                  key={result.id}
                  className={resultCellClass(result, selected, { cellRunning })}
                >
                  {showImage ? (
                    <>
                      <div className="relative block w-full group/image">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={displayUrl!}
                          alt={label}
                          className="aspect-[3/4] w-full object-cover"
                          draggable={false}
                        />
                        {cellRunning ? (
                          <EcomMediaGeneratingBusy label="试衣中" className="z-[2]" />
                        ) : null}
                        {result.status === "failed" && !cellRunning ? (
                          <div className="absolute inset-x-0 bottom-0 z-[2] bg-[#ff3b30]/90 px-1 py-0.5 text-center text-[9px] text-white">
                            {friendlyTryonFailReason(result.failReason)}
                          </div>
                        ) : null}
                        {!cellRunning ? (
                          <VtonResultImageHoverActions
                            disabled={busy || disabled}
                            onPreview={() => openPreview(displayUrl!, label, previewItems)}
                            onDownload={() => void handleDownload(displayUrl!, label)}
                            onSaveToAssets={
                              onSaveResultToAssets
                                ? () => void onSaveResultToAssets(displayUrl!, label)
                                : undefined
                            }
                            onOpenFittingRoom={openVtonFittingRoomInNewTab}
                          />
                        ) : null}
                        {hasMultipleVersions && !cellRunning ? (
                          <>
                            <div className="pointer-events-none absolute inset-x-0 top-2 z-[3] flex justify-center">
                              <span className="rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white">
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
                      </div>
                      <button
                        type="button"
                        className={cn(
                          "absolute left-1 top-1 z-30 rounded-full p-0.5",
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
                        <span className="absolute right-1 top-1 z-30 rounded bg-[#34c759] px-1 py-0.5 text-[9px] text-white">
                          已锁定
                        </span>
                      ) : null}
                      {onRegenerateLook && !running ? (
                        <button
                          type="button"
                          className="absolute bottom-6 right-1 z-30 rounded bg-white/90 px-1 py-0.5 text-[9px] text-[#0071e3] shadow hover:bg-white disabled:opacity-50"
                          disabled={busy || disabled}
                          onClick={() => void onRegenerateLook(result.lookId)}
                        >
                          重生成
                        </button>
                      ) : null}
                    </>
                  ) : cellRunning ? (
                    <VtonTryonRunningSlot />
                  ) : result.status === "failed" ? (
                    <div className="flex aspect-[3/4] flex-col items-center justify-center gap-1 p-2 text-center text-[10px] text-[#ff3b30]">
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
                    </div>
                  ) : result.status === "cancelled" ? (
                    <div className="flex aspect-[3/4] flex-col items-center justify-center p-2 text-center text-[10px] text-[#86868b]">
                      {result.failReason ?? "已停止"}
                    </div>
                  ) : (
                    <VtonTryonQueuedSlot />
                  )}
                  <p className="truncate px-1 py-0.5 text-[10px] text-[#6e6e73]">{label}</p>
                </div>
              );
            })}
          </div>
        ) : null}

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
                  <div
                    key={look.id}
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
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={look.ossUrl}
                        alt={look.label}
                        className="aspect-[3/4] w-full object-cover"
                        draggable={false}
                      />
                    </button>
                    {isDefault ? (
                      <Star className="absolute left-1 top-1 h-3 w-3 fill-[#0071e3] text-[#0071e3]" />
                    ) : null}
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
