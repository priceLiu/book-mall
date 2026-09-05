"use client";

import {
  DEFAULT_SUBTITLE_STYLE,
  SUBTITLE_FONT_OPTIONS,
  SUBTITLE_FONT_SIZE_MAX,
  SUBTITLE_FONT_SIZE_MIN,
  resolveSubtitleAssFontSize,
  type SubtitleBurnInStyle,
  type SubtitleFontKey,
} from "@private/media-render-subtitle-style";

export type JianyingAutoRenderSubtitleMode = "script" | "tts" | "asr";

type Props = {
  mixDialogue: boolean;
  onMixDialogueChange: (value: boolean) => void;
  burnSubtitles: boolean;
  onBurnSubtitlesChange: (value: boolean) => void;
  subtitleMode: JianyingAutoRenderSubtitleMode;
  onSubtitleModeChange: (mode: JianyingAutoRenderSubtitleMode) => void;
  style: SubtitleBurnInStyle;
  onStyleChange: (style: SubtitleBurnInStyle) => void;
  disabled?: boolean;
  /** 已连接配音时可勾选「烧录对白」 */
  showMixDialogue?: boolean;
  className?: string;
};

/** 自动成片 Dock · 烧录对白 / 烧录字幕（可多选） */
export function JianyingAutoRenderOutputFields({
  mixDialogue,
  onMixDialogueChange,
  burnSubtitles,
  onBurnSubtitlesChange,
  subtitleMode,
  onSubtitleModeChange,
  style,
  onStyleChange,
  disabled = false,
  showMixDialogue = true,
  className = "",
}: Props) {
  const displayFontSize = resolveSubtitleAssFontSize(style);

  const setFontKey = (fontKey: SubtitleFontKey) => {
    onStyleChange({ ...style, fontKey });
  };

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

  return (
    <div className={`nodrag shrink-0 space-y-1 border-t border-white/[0.06] pt-2 ${className}`.trim()}>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
        {showMixDialogue ? (
          <label className="flex items-center gap-2 text-[13px] text-white/70">
            <input
              type="checkbox"
              checked={mixDialogue}
              disabled={disabled}
              onChange={(e) => onMixDialogueChange(e.target.checked)}
            />
            烧录对白
          </label>
        ) : null}
        <label className="flex items-center gap-2 text-[13px] text-white/70">
          <input
            type="checkbox"
            checked={burnSubtitles}
            disabled={disabled}
            onChange={(e) => onBurnSubtitlesChange(e.target.checked)}
          />
          烧录字幕
        </label>
      </div>

      {burnSubtitles ? (
        <>
          <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-1 border-0 p-0 pl-6 text-[12px] text-white/70">
            <legend className="mb-0.5 w-full text-[12px] text-white/55">字幕来源</legend>
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                checked={subtitleMode === "tts"}
                disabled={disabled}
                onChange={() => onSubtitleModeChange("tts")}
              />
              已连接 TTS 配音
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                checked={subtitleMode === "script"}
                disabled={disabled}
                onChange={() => onSubtitleModeChange("script")}
              />
              分镜对白（脚本表）
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                checked={subtitleMode === "asr"}
                disabled={disabled}
                onChange={() => onSubtitleModeChange("asr")}
              />
              从视频音频识别（ASR）
            </label>
          </fieldset>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-6">
            <label className="flex items-center gap-2 text-[12px] text-white/70">
              <span className="shrink-0 text-white/55">字体</span>
              <select
                className="nodrag h-7 rounded-md border border-white/20 bg-black/30 px-2 text-[12px] text-white disabled:opacity-40"
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
            <label className="flex items-center gap-2 text-[12px] text-white/70">
              <span className="shrink-0 text-white/55">字号</span>
              <input
                type="number"
                min={SUBTITLE_FONT_SIZE_MIN}
                max={SUBTITLE_FONT_SIZE_MAX}
                step={1}
                value={displayFontSize}
                disabled={disabled}
                className="nodrag h-7 w-[68px] rounded-md border border-white/20 bg-black/30 px-2 text-[12px] text-white disabled:opacity-40"
                onChange={(e) => setFontSize(Number(e.target.value))}
              />
              <span className="shrink-0 text-white/45 tabular-nums">ASS {displayFontSize}</span>
            </label>
          </div>
        </>
      ) : null}
    </div>
  );
}

export { DEFAULT_SUBTITLE_STYLE };
