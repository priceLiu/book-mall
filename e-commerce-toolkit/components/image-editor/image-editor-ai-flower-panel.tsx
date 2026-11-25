"use client";

import { useEffect, useState } from "react";

import { Bold, ChevronLeft, Italic } from "lucide-react";

import { ECOM_COPY_FONT_PRESETS, normalizeCopyFontPresetId, type EcomCopyOverlayLayer } from "@private/ecom-copy-overlay";

import {
  IMAGE_EDITOR_FLOWER_STYLES,
  imageEditorFlowerStyle,
} from "@/lib/image-editor-text-flower";
import type { ImageEditorTextLayerExtras } from "@/lib/image-editor-text";
import { cn } from "@/lib/utils";

type Props = {
  layer: EcomCopyOverlayLayer;
  extras: ImageEditorTextLayerExtras;
  disabled?: boolean;
  onBack: () => void;
  onContent: (text: string) => void;
  onFont: (fontFamily: string) => void;
  onBold: () => void;
  onItalic: () => void;
  onGenerate: (flowerId: string) => void;
};

export function ImageEditorAiFlowerPanel({
  layer,
  extras,
  disabled,
  onBack,
  onContent,
  onFont,
  onBold,
  onItalic,
  onGenerate,
}: Props) {
  const [picked, setPicked] = useState(extras.flowerId || IMAGE_EDITOR_FLOWER_STYLES[0]?.id || "balloon");

  useEffect(() => {
    if (extras.flowerId) setPicked(extras.flowerId);
  }, [extras.flowerId]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-1 pb-3">
        <button
          type="button"
          aria-label="返回文字"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--ie-ink)] hover:bg-[var(--ie-cream-muted)]"
          onClick={onBack}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-[13px] font-semibold text-[var(--ie-ink)]">AI花字</span>
      </div>

      <div className="ecom-scrollbar-thin min-h-0 flex-1 space-y-3 overflow-y-auto pr-0.5">
        <label className="block space-y-1">
          <span className="text-[11px] text-[var(--ie-subtle)]">内容</span>
          <input
            value={layer.text}
            disabled={disabled}
            className="w-full rounded-lg border border-[var(--ie-border-soft)] bg-white px-2 py-1.5 text-[12px] text-[var(--ie-ink)] outline-none focus:border-[var(--ie-border)]"
            onChange={(e) => onContent(e.target.value)}
          />
        </label>

        <label className="block space-y-1">
          <span className="text-[11px] text-[var(--ie-subtle)]">字体</span>
          <select
            disabled={disabled}
            className="w-full rounded-lg border border-[var(--ie-border-soft)] bg-white px-2 py-1.5 text-[12px] text-[var(--ie-ink)] outline-none"
            value={normalizeCopyFontPresetId(layer.fontFamily)}
            onChange={(e) => onFont(normalizeCopyFontPresetId(e.target.value))}
          >
            {ECOM_COPY_FONT_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id} style={{ fontFamily: preset.css }}>
                {preset.label}
              </option>
            ))}
          </select>
        </label>

        <div className="space-y-1">
          <span className="text-[11px] text-[var(--ie-subtle)]">样式</span>
          <div className="flex gap-1">
            <button
              type="button"
              disabled={disabled}
              aria-pressed={layer.fontWeight !== "normal"}
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-lg border text-[var(--ie-ink)]",
                layer.fontWeight !== "normal" ? "border-[#3d7eff] bg-[#e7f1ff]" : "border-[var(--ie-border-soft)] bg-white",
              )}
              onClick={onBold}
            >
              <Bold className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              disabled={disabled}
              aria-pressed={Boolean(extras.italic)}
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-lg border text-[var(--ie-ink)]",
                extras.italic ? "border-[#3d7eff] bg-[#e7f1ff]" : "border-[var(--ie-border-soft)] bg-white",
              )}
              onClick={onItalic}
            >
              <Italic className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[12px] font-semibold text-[var(--ie-ink)]">精选效果</p>
          <div className="grid grid-cols-2 gap-2">
            {IMAGE_EDITOR_FLOWER_STYLES.map((style) => {
              const preview = imageEditorFlowerStyle(style.id, 28);
              const active = picked === style.id;
              return (
                <button
                  key={style.id}
                  type="button"
                  disabled={disabled}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl border border-[var(--ie-border-soft)] bg-white px-1 py-2",
                    active && "ring-2 ring-[#3d7eff]",
                  )}
                  onClick={() => {
                    setPicked(style.id);
                    onGenerate(style.id);
                  }}
                >
                  <span className="relative inline-flex h-10 items-center justify-center">
                    {preview?.underlayShadow ? (
                      <span
                        aria-hidden
                        className="absolute text-[26px] font-black leading-none"
                        style={{ color: "transparent", textShadow: preview.underlayShadow }}
                      >
                        美
                      </span>
                    ) : null}
                    <span className="relative inline-block text-[26px] font-black leading-none" style={preview?.fill}>
                      美
                    </span>
                  </span>
                  <span className="text-[10px] text-[var(--ie-subtle)]">{style.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <button
        type="button"
        disabled={disabled || !picked}
        className="mt-3 w-full rounded-xl bg-[#3d7eff] py-2.5 text-[13px] font-semibold text-white disabled:opacity-40"
        onClick={() => onGenerate(picked)}
      >
        立即生成
      </button>
    </div>
  );
}
