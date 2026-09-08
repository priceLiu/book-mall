"use client";

import { Check, Loader2, Star } from "lucide-react";

import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import {
  ECOM_VTON_MAX_BATCH_LOOKS,
  type VtonLockedLook,
  type VtonLookSpec,
  type VtonTryonBatchState,
  type VtonTryonResult,
} from "@/lib/vton-types";
import { cn } from "@/lib/utils";

type Props = {
  batch: VtonTryonBatchState | null | undefined;
  looks: VtonLookSpec[];
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
  onBatchTryon: () => Promise<void>;
};

function lookLabel(looks: VtonLookSpec[], lookId: string): string {
  const look = looks.find((l) => l.id === lookId);
  return look?.label ?? lookId.slice(0, 6);
}

function resultCellClass(result: VtonTryonResult, selected: boolean): string {
  return cn(
    "relative overflow-hidden rounded-lg border bg-[#fafafa]",
    result.status === "success" && selected && "border-[#0071e3] ring-2 ring-[#0071e3]/30",
    result.status === "success" && !selected && "border-[#e8e8ed]",
    result.status === "failed" && "border-[#ff3b30]/40",
    result.status === "running" && "border-[#0071e3]/40",
    result.status === "pending" && "border-dashed border-[#d2d2d7]",
  );
}

export function VtonResultsGrid({
  batch,
  looks,
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
}: Props) {
  const results = batch?.results ?? [];
  const slots = Array.from({ length: ECOM_VTON_MAX_BATCH_LOOKS }, (_, i) => results[i] ?? null);
  const running = batch?.status === "running" || tryonBusy;
  const hasSuccess = results.some((r) => r.status === "success" && r.ossUrl);
  const lockedResultIds = new Set(lockedLooks.map((l) => l.resultId).filter(Boolean));

  return (
    <section className="space-y-3 rounded-xl border border-[#e8e8ed] bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-semibold text-[#1d1d1f]">试衣结果</h3>
          {batch ? (
            <p className="text-[11px] text-[#6e6e73]">
              {batch.label ??
                (batch.status === "running"
                  ? `进行中 ${batch.currentIndex}/${batch.total}`
                  : batch.status === "done"
                    ? "批量试衣完成"
                    : "试衣失败")}
            </p>
          ) : (
            <p className="text-[11px] text-[#6e6e73]">编排搭配后点击批量试衣</p>
          )}
        </div>
        <EcomButtonPrimary
          type="button"
          size="sm"
          disabled={busy || disabled || running || looks.length < 1}
          onClick={() => void onBatchTryon()}
        >
          {running ? (
            <>
              <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />
              试衣中…
            </>
          ) : (
            `批量试衣 (${looks.length})`
          )}
        </EcomButtonPrimary>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-3 md:grid-cols-3">
        {slots.slice(0, Math.max(looks.length, results.length, 3)).map((result, i) => {
          if (!result) {
            return (
              <div
                key={`empty-${i}`}
                className="flex aspect-[3/4] items-center justify-center rounded-lg border border-dashed border-[#e8e8ed] bg-[#fafafa] text-[10px] text-[#86868b]"
              >
                待试衣
              </div>
            );
          }
          const selected = selectedResultIds.includes(result.id);
          const isLocked = lockedResultIds.has(result.id);
          return (
            <div key={result.id} className={resultCellClass(result, selected)}>
              {result.status === "success" && result.ossUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={result.ossUrl}
                    alt={lookLabel(looks, result.lookId)}
                    className="aspect-[3/4] w-full object-cover"
                  />
                  <button
                    type="button"
                    className={cn(
                      "absolute left-1 top-1 rounded-full p-0.5",
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
                    <span className="absolute right-1 top-1 rounded bg-[#34c759] px-1 py-0.5 text-[9px] text-white">
                      已锁定
                    </span>
                  ) : null}
                </>
              ) : result.status === "running" ? (
                <div className="flex aspect-[3/4] flex-col items-center justify-center gap-1 text-[#0071e3]">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-[10px]">试衣中</span>
                </div>
              ) : result.status === "failed" ? (
                <div className="flex aspect-[3/4] flex-col items-center justify-center p-2 text-center text-[10px] text-[#ff3b30]">
                  {result.failReason ?? "失败"}
                </div>
              ) : (
                <div className="flex aspect-[3/4] items-center justify-center text-[10px] text-[#86868b]">
                  排队中
                </div>
              )}
              <p className="truncate px-1 py-0.5 text-[10px] text-[#6e6e73]">
                {lookLabel(looks, result.lookId)}
              </p>
            </div>
          );
        })}
      </div>

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
          <div className="flex flex-wrap gap-2">
            {lockedLooks.map((look) => {
              const isDefault = look.id === defaultLockedLookId;
              return (
                <div
                  key={look.id}
                  className={cn(
                    "relative w-20 overflow-hidden rounded-lg border",
                    isDefault ? "border-[#0071e3]" : "border-[#e8e8ed]",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={look.ossUrl} alt={look.label} className="aspect-[3/4] w-full object-cover" />
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
  );
}
