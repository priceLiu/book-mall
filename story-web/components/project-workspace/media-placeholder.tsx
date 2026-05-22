"use client";

import Image from "next/image";
import { AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type MediaPlaceholderProps = {
  /** 风格回退图（每个 styleId 一张），用作占位底图 */
  fallbackUrl?: string;
  /** 当前状态：loading=任务进行中；empty=尚未生成；failed=已失败 */
  state: "loading" | "empty" | "failed";
  /** loading 副标题，默认「生成中…」 */
  loadingLabel?: string;
  /** empty 副标题，默认「尚未生成」 */
  emptyLabel?: string;
  /** failed 主文案，默认「生成失败」 */
  failedLabel?: string;
  /** failed 状态时来自后端的具体原因（failMessage），会在主文案下方显示 */
  failedReason?: string | null;
  /** failed 状态时来自后端的错误码，仅在 hover tooltip 中显示 */
  failedCode?: string | null;
  /** 额外 className，控制层叠等 */
  className?: string;
  /** 文字颜色调暗（默认 text-white/85） */
  subtle?: boolean;
};

/**
 * 占位 / 加载中通用图层。
 * - 有 fallbackUrl 时：底图 + 半透明遮罩 + 中央文字/spinner
 * - 没 fallbackUrl 时：纯色底 + 中央文字/spinner
 * loading 状态下，遮罩有 `animate-pulse` 呼吸动画。
 */
export function MediaPlaceholder({
  fallbackUrl,
  state,
  loadingLabel = "生成中…",
  emptyLabel = "尚未生成",
  failedLabel = "生成失败",
  failedReason,
  failedCode,
  className,
  subtle,
}: MediaPlaceholderProps) {
  const dimOpacity =
    state === "loading"
      ? "opacity-30"
      : state === "failed"
        ? "opacity-15"
        : "opacity-25";

  return (
    <div className={cn("absolute inset-0 overflow-hidden", className)}>
      {fallbackUrl ? (
        <Image
          src={fallbackUrl}
          alt=""
          fill
          sizes="320px"
          className={cn("object-cover", dimOpacity)}
          unoptimized
          aria-hidden
        />
      ) : null}
      {state === "loading" ? (
        <div
          className="absolute inset-0 animate-pulse bg-gradient-to-br from-white/5 via-white/10 to-white/5"
          aria-hidden
        />
      ) : null}
      <div
        className={cn(
          "absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-center",
          subtle ? "text-white/70" : "text-white/85",
        )}
      >
        {state === "loading" ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            <span className="text-[11px]">{loadingLabel}</span>
          </>
        ) : state === "failed" ? (
          <div
            className="flex max-w-[90%] flex-col items-center gap-1 px-3"
            title={
              [
                failedCode ? `code: ${failedCode}` : null,
                failedReason || null,
              ]
                .filter(Boolean)
                .join("\n") || undefined
            }
          >
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-300">
              <AlertCircle className="size-3" />
              {failedLabel}
            </span>
            {failedReason ? (
              <span className="line-clamp-3 text-[10px] leading-tight text-red-200/80">
                {failedReason}
              </span>
            ) : (
              <span className="text-[10px] text-white/60">
                调整提示词后重试
              </span>
            )}
          </div>
        ) : (
          <span className="text-[11px]">{emptyLabel}</span>
        )}
      </div>
    </div>
  );
}
