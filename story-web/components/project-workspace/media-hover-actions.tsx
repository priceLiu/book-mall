"use client";

import { Eye, Pencil, Play } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  /** image 显示「编辑提示词 + 全屏预览」；video 显示「编辑提示词 + 播放」 */
  kind: "image" | "video";
  /** 当前是否已有可预览的素材；没有时预览按钮禁用 */
  hasPreview: boolean;
  onEdit?: () => void;
  onPreview: () => void;
  /** 自定义 tooltip 文案 */
  editLabel?: string;
  previewLabel?: string;
  className?: string;
};

/**
 * 媒体卡 hover 时浮现的两个动作按钮（编辑 prompt + 预览/播放）。
 * 居中显示，大尺寸（size-12），便于点击。Hover 时整张卡片叠一层柔和暗色蒙层增强对比。
 * pointer-events 仅在 hover/focus 时启用，避免阻挡卡片本身的点击区域。
 *
 * 使用规约见 `.cursor/rules/media-card-hover-actions.mdc`。
 */
export function MediaHoverActions({
  kind,
  hasPreview,
  onEdit,
  onPreview,
  editLabel,
  previewLabel,
  className,
}: Props) {
  const editTip = editLabel ?? "编辑提示词";
  const previewTip =
    previewLabel ?? (kind === "video" ? "全屏播放" : "全屏预览");

  const btn =
    "inline-flex size-12 items-center justify-center rounded-full border border-white/25 bg-black/60 text-white shadow-lg backdrop-blur-md transition hover:scale-105 hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <>
      {/* 柔和暗色蒙层，让中央按钮更清晰；hover 时显示 */}
      <div
        className="pointer-events-none absolute inset-0 z-[5] bg-black/30 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100"
        aria-hidden
      />
      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-10 flex items-center justify-center gap-3 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100",
          className,
        )}
      >
        {onEdit ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            title={editTip}
            aria-label={editTip}
            className={btn}
          >
            <Pencil className="size-5" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPreview();
          }}
          title={hasPreview ? previewTip : "暂无可预览内容"}
          aria-label={previewTip}
          disabled={!hasPreview}
          className={btn}
        >
          {kind === "video" ? (
            <Play className="size-5 translate-x-[1px]" />
          ) : (
            <Eye className="size-5" />
          )}
        </button>
      </div>
    </>
  );
}
