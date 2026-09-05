"use client";

import {
  DEFAULT_SUBTITLE_STYLE,
  SUBTITLE_FONT_OPTIONS,
  SUBTITLE_FONT_SIZE_MAX,
  SUBTITLE_FONT_SIZE_MIN,
  resolveSubtitleAssFontSize,
  type SubtitleBurnInStyle,
  type SubtitleFontKey,
} from "./subtitle-style-options";
import { SubtitleBurnInPreview } from "./subtitle-preview";

export type SubtitleBurnInFieldsVariant = "canvas-dark" | "ecom-light" | "book-account";

const VARIANT_CLASS: Record<
  SubtitleBurnInFieldsVariant,
  {
    wrap: string;
    label: string;
    fieldLabel: string;
    select: string;
    radioGroup: string;
    radioLabel: string;
    numberInput: string;
  }
> = {
  "canvas-dark": {
    wrap: "space-y-2",
    label: "text-[13px] text-white/70",
    fieldLabel: "text-[12px] text-white/55 shrink-0",
    select:
      "nodrag h-8 rounded-md border border-white/20 bg-black/30 px-2 text-[13px] text-white disabled:opacity-40",
    radioGroup: "mt-1.5 space-y-1 border-0 p-0 pl-6 text-[13px] text-white/75",
    radioLabel: "flex items-center gap-1.5",
    numberInput:
      "nodrag h-8 w-[68px] rounded-md border border-white/20 bg-black/30 px-2 text-[13px] text-white disabled:opacity-40",
  },
  "ecom-light": {
    wrap: "space-y-2",
    label: "text-xs text-[#6e6e73]",
    fieldLabel: "text-xs text-[#86868b] shrink-0",
    select:
      "h-8 rounded-lg border border-[#d2d2d7] bg-white px-2 text-xs text-[#1d1d1f] disabled:opacity-40",
    radioGroup: "mt-1.5 space-y-1 border-0 p-0 pl-5 text-xs text-[#6e6e73]",
    radioLabel: "flex items-center gap-1.5",
    numberInput:
      "h-8 w-[68px] rounded-lg border border-[#d2d2d7] bg-white px-2 text-xs text-[#1d1d1f] disabled:opacity-40",
  },
  "book-account": {
    wrap: "space-y-2",
    label: "text-xs text-[#656d76]",
    fieldLabel: "text-xs text-[#8c959f] shrink-0",
    select:
      "h-8 rounded-md border border-[#d0d7de] bg-white px-2 text-xs text-[#1f2328] disabled:opacity-40",
    radioGroup: "mt-1.5 space-y-1 border-0 p-0 pl-5 text-xs text-[#656d76]",
    radioLabel: "flex items-center gap-1.5",
    numberInput:
      "h-8 w-[68px] rounded-md border border-[#d0d7de] bg-white px-2 text-xs text-[#1f2328] disabled:opacity-40",
  },
};

export type SubtitleBurnInFieldsProps = {
  variant: SubtitleBurnInFieldsVariant;
  burnIn: boolean;
  onBurnInChange: (value: boolean) => void;
  style: SubtitleBurnInStyle;
  onStyleChange: (style: SubtitleBurnInStyle) => void;
  disabled?: boolean;
  /** 画布 / 电商：分镜对白 vs ASR */
  subtitleMode?: "script" | "asr";
  onSubtitleModeChange?: (mode: "script" | "asr") => void;
  showSubtitleMode?: boolean;
  burnInLabel?: string;
  /** 自动成片 Dock 等窄高面板：单行/紧凑排版，避免滚动条 */
  density?: "default" | "compact";
  /** 合成弹层等：字体/字号旁展示竖屏样板 */
  showPreview?: boolean;
  /** 样板预览示例字（默认「智选AI」） */
  previewSampleText?: string;
  /** 始终烧录、隐藏开关（种草视频合成） */
  burnInLocked?: boolean;
  className?: string;
};

export function SubtitleBurnInFields({
  variant,
  burnIn,
  onBurnInChange,
  style,
  onStyleChange,
  disabled = false,
  subtitleMode = "script",
  onSubtitleModeChange,
  showSubtitleMode = false,
  burnInLabel = "烧录台词字幕",
  density = "default",
  showPreview = false,
  previewSampleText,
  burnInLocked = false,
  className = "",
}: SubtitleBurnInFieldsProps) {
  const v = VARIANT_CLASS[variant];
  const compact = density === "compact";
  const styleVisible = burnInLocked || burnIn;

  const setFontKey = (fontKey: SubtitleFontKey) => {
    onStyleChange({ ...style, fontKey });
  };

  const displayFontSize = resolveSubtitleAssFontSize(style);

  const setFontSize = (raw: number) => {
    if (!Number.isFinite(raw)) return;
    onStyleChange({
      ...style,
      fontSize: Math.min(
        SUBTITLE_FONT_SIZE_MAX,
        Math.max(SUBTITLE_FONT_SIZE_MIN, Math.round(raw)),
      ),
    });
  };

  const numberInputClass = compact && variant === "canvas-dark"
    ? `${v.numberInput} h-7 text-[12px]`
    : v.numberInput;

  const modeFieldsetClass = compact
    ? "flex flex-wrap items-center gap-x-4 gap-y-1 border-0 p-0 pl-6 text-[12px] text-white/70"
    : v.radioGroup;

  const styleRowClass = compact
    ? "flex flex-wrap items-center gap-x-3 gap-y-1 pl-6"
    : "flex flex-wrap items-center gap-x-4 gap-y-2 pl-6";

  const selectClass = compact && variant === "canvas-dark"
    ? `${v.select} h-7 text-[12px]`
    : v.select;

  return (
    <div
      className={`${compact ? "space-y-1" : v.wrap} ${className}`.trim()}
    >
      {burnInLocked ? null : (
        <label className={`flex items-center gap-2 ${v.label}`}>
          <input
            type="checkbox"
            checked={burnIn}
            disabled={disabled}
            onChange={(e) => onBurnInChange(e.target.checked)}
          />
          {burnInLabel}
        </label>
      )}

      {styleVisible && showSubtitleMode && onSubtitleModeChange ? (
        <fieldset className={modeFieldsetClass}>
          <legend className={compact ? "mb-0.5 w-full text-[12px] text-white/55" : "sr-only"}>
            字幕来源
          </legend>
          <label className={v.radioLabel}>
            <input
              type="radio"
              checked={subtitleMode === "script"}
              disabled={disabled}
              onChange={() => onSubtitleModeChange("script")}
            />
            分镜对白（脚本表）
          </label>
          <label className={v.radioLabel}>
            <input
              type="radio"
              checked={subtitleMode === "asr"}
              disabled={disabled}
              onChange={() => onSubtitleModeChange("asr")}
            />
            从视频音频识别（ASR）
          </label>
        </fieldset>
      ) : null}

      {styleVisible ? (
        <div
          className={
            showPreview
              ? "flex flex-wrap items-start gap-4 pl-6"
              : styleRowClass
          }
        >
          <div className={showPreview ? "flex flex-wrap items-center gap-x-4 gap-y-2" : "contents"}>
            <label className={`flex items-center gap-2 ${v.label}`}>
              <span className={v.fieldLabel}>字体</span>
              <select
                className={selectClass}
                value={style.fontKey}
                disabled={disabled}
                onChange={(e) => setFontKey(e.target.value as SubtitleFontKey)}
              >
                {SUBTITLE_FONT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={`flex items-center gap-2 ${v.label}`}>
              <span className={v.fieldLabel}>字号</span>
              <input
                type="number"
                min={SUBTITLE_FONT_SIZE_MIN}
                max={SUBTITLE_FONT_SIZE_MAX}
                step={1}
                value={displayFontSize}
                disabled={disabled}
                className={numberInputClass}
                onChange={(e) => setFontSize(Number(e.target.value))}
              />
              <span className={`${v.fieldLabel} tabular-nums`}>
                ASS {displayFontSize}
              </span>
            </label>
          </div>
          {showPreview ? (
            <SubtitleBurnInPreview style={style} sampleText={previewSampleText} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export { DEFAULT_SUBTITLE_STYLE };
