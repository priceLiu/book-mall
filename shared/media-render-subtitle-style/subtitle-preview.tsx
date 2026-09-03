"use client";

import {
  SUBTITLE_FONT_OPTIONS,
  resolveSubtitleAssFontSize,
  type SubtitleBurnInStyle,
  type SubtitleFontKey,
} from "./subtitle-style-options";

/** 合成弹层等场景的固定示例文案 */
export const SUBTITLE_PREVIEW_SAMPLE_TEXT = "智选AI";

/** 浏览器预览用 font-family（与 ffmpeg 烧录字体 key 对应） */
export const SUBTITLE_PREVIEW_FONT_FAMILY: Record<SubtitleFontKey, string> = {
  heiti: '"PingFang SC", "Heiti SC", "Microsoft YaHei", sans-serif',
  songti: '"Songti SC", "STSong", "SimSun", serif',
  noto: '"Noto Sans SC", "Source Han Sans SC", "PingFang SC", sans-serif',
};

/** 将 ASS FontSize（PlayResY=288）换算为预览框内 px */
export function resolveSubtitlePreviewFontSizePx(
  style: SubtitleBurnInStyle,
  frameHeightPx = 200,
): number {
  const ass = resolveSubtitleAssFontSize(style);
  return Math.max(10, Math.round(ass * (frameHeightPx / 288)));
}

export function subtitleFontLabel(fontKey: SubtitleFontKey): string {
  return SUBTITLE_FONT_OPTIONS.find((o) => o.value === fontKey)?.label ?? fontKey;
}

type SubtitleBurnInPreviewProps = {
  style: SubtitleBurnInStyle;
  sampleText?: string;
  className?: string;
  /** 预览框高度（9:16 竖屏示意） */
  frameHeightPx?: number;
};

/** 竖屏成片底部字幕样式示意（字体 + 字号） */
export function SubtitleBurnInPreview({
  style,
  sampleText = SUBTITLE_PREVIEW_SAMPLE_TEXT,
  className = "",
  frameHeightPx = 200,
}: SubtitleBurnInPreviewProps) {
  const fontSizePx = resolveSubtitlePreviewFontSizePx(style, frameHeightPx);
  const assSize = resolveSubtitleAssFontSize(style);
  const frameWidthPx = Math.round(frameHeightPx * (9 / 16));

  return (
    <div
      className={className}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: "relative",
          width: frameWidthPx,
          height: frameHeightPx,
          overflow: "hidden",
          borderRadius: 10,
          border: "1px solid #d2d2d7",
          background: "linear-gradient(180deg, #3a3a3c 0%, #111111 100%)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
        }}
      >
        <p
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 10,
            margin: 0,
            textAlign: "center",
            fontSize: 10,
            color: "rgba(255,255,255,0.45)",
          }}
        >
          预览
        </p>
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 20,
            display: "flex",
            justifyContent: "center",
            padding: "0 8px",
          }}
        >
          <span
            style={{
              color: "#ffffff",
              textAlign: "center",
              lineHeight: 1.25,
              whiteSpace: "nowrap",
              fontFamily: SUBTITLE_PREVIEW_FONT_FAMILY[style.fontKey],
              fontSize: fontSizePx,
              textShadow: "0 1px 4px rgba(0,0,0,0.95)",
            }}
          >
            {sampleText}
          </span>
        </div>
      </div>
      <p
        style={{
          margin: 0,
          maxWidth: frameWidthPx + 20,
          textAlign: "center",
          fontSize: 11,
          lineHeight: 1.35,
          color: "#86868b",
        }}
      >
        {subtitleFontLabel(style.fontKey)} · ASS {assSize}
      </p>
    </div>
  );
}
