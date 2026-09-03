"use client";

import { useEffect, useState } from "react";

import {
  DEFAULT_SUBTITLE_STYLE,
  SubtitleBurnInFields,
  SubtitleBurnInPreview,
  SUBTITLE_PREVIEW_SAMPLE_TEXT,
  type SubtitleBurnInStyle,
} from "@private/media-render-subtitle-style";

import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import { EcomDialogCloseButton } from "@/components/ui/dialog";
import { SEED_VIDEO_LEGACY_SUBTITLE_ASS_SIZE } from "@/lib/seed-video-render-profile";

type Props = {
  open: boolean;
  shotCount: number;
  busy?: boolean;
  initialStyle?: SubtitleBurnInStyle;
  onOpenChange: (open: boolean) => void;
  onConfirm: (style: SubtitleBurnInStyle) => void | Promise<void>;
};

/** 合成成片前：字幕字体 / 字号 + 竖屏样板预览 */
export function SeedVideoComposeDialog({
  open,
  shotCount,
  busy,
  initialStyle = DEFAULT_SUBTITLE_STYLE,
  onOpenChange,
  onConfirm,
}: Props) {
  const [style, setStyle] = useState<SubtitleBurnInStyle>(initialStyle);

  useEffect(() => {
    if (open) setStyle(initialStyle);
  }, [open, initialStyle]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal
      aria-labelledby="seed-video-compose-title"
    >
      <div className="relative w-full max-w-lg rounded-2xl border border-[#e8e8ed] bg-white p-5 pr-12 shadow-xl">
        <EcomDialogCloseButton disabled={busy} onClick={() => onOpenChange(false)} />
        <h2 id="seed-video-compose-title" className="text-base font-semibold text-[#1d1d1f]">
          合成成片 · 字幕样式
        </h2>
        <p className="mt-1 text-[12px] leading-relaxed text-[#6e6e73]">
          将合并 {shotCount} 个镜头并烧录口播字幕。此前未设置时默认 ASS 字号{" "}
          <span className="font-medium text-[#1d1d1f]">{SEED_VIDEO_LEGACY_SUBTITLE_ASS_SIZE}</span>
          （偏大）；可在下方调整字体与字号，右侧以「{SUBTITLE_PREVIEW_SAMPLE_TEXT}」预览效果。
        </p>

        <div className="mt-4 rounded-xl border border-[#e8e8ed] bg-[#fafafa] px-4 py-3">
          <div className="flex flex-nowrap items-start gap-5">
            <div className="min-w-0 flex-1">
              <SubtitleBurnInFields
                variant="ecom-light"
                burnIn
                burnInLocked
                disabled={busy}
                style={style}
                onStyleChange={setStyle}
                onBurnInChange={() => {}}
              />
            </div>
            <SubtitleBurnInPreview
              style={style}
              sampleText={SUBTITLE_PREVIEW_SAMPLE_TEXT}
              frameHeightPx={200}
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <EcomButtonSecondary disabled={busy} onClick={() => onOpenChange(false)}>
            取消
          </EcomButtonSecondary>
          <EcomButtonPrimary disabled={busy} onClick={() => void onConfirm(style)}>
            {busy ? "提交中…" : "开始合成"}
          </EcomButtonPrimary>
        </div>
      </div>
    </div>
  );
}
