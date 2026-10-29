"use client";

import { useEffect, useRef, useState } from "react";

import {
  SUBTITLE_FONT_OPTIONS,
  resolveSubtitleAssFontSize,
  type SubtitleBurnInStyle,
  type SubtitleFontKey,
} from "./subtitle-style-options";

/** ffmpeg 把 SRT 转 ASS 时的默认脚本画布高度 */
export const SUBTITLE_ASS_PLAY_RES_Y = 288;
/** libass 默认底边距（PlayRes 像素） */
const SUBTITLE_ASS_MARGIN_V = 10;

/** 合成弹层等场景的固定示例文案 */
export const SUBTITLE_PREVIEW_SAMPLE_TEXT = "智选AI";

/** 浏览器预览用 font-family（与 ffmpeg 烧录字体 key 对应） */
export const SUBTITLE_PREVIEW_FONT_FAMILY: Record<SubtitleFontKey, string> = {
  heiti: '"PingFang SC", "Heiti SC", "Microsoft YaHei", sans-serif',
  songti: '"Songti SC", "STSong", "SimSun", serif',
  noto: '"Noto Sans SC", "Source Han Sans SC", "PingFang SC", sans-serif',
};

/** 将 ASS FontSize（PlayResY=288）换算为预览框内 px，与成片烧录同一比例 */
export function resolveSubtitlePreviewFontSizePx(
  style: SubtitleBurnInStyle,
  frameHeightPx = 200,
): number {
  const ass = resolveSubtitleAssFontSize(style);
  if (!(frameHeightPx > 0)) return ass;
  return Math.max(1, (ass * frameHeightPx) / SUBTITLE_ASS_PLAY_RES_Y);
}

export function resolveSubtitlePreviewMarginPx(frameHeightPx: number): number {
  if (!(frameHeightPx > 0)) return SUBTITLE_ASS_MARGIN_V;
  return Math.max(
    1,
    (SUBTITLE_ASS_MARGIN_V * frameHeightPx) / SUBTITLE_ASS_PLAY_RES_Y,
  );
}

/** 在最大宽高内放下给定画面比例的预览框 */
export function resolveSubtitlePreviewFrameSize(input: {
  aspectWidth: number;
  aspectHeight: number;
  maxWidthPx: number;
  maxHeightPx: number;
}): { width: number; height: number } {
  const aw = input.aspectWidth > 0 ? input.aspectWidth : 9;
  const ah = input.aspectHeight > 0 ? input.aspectHeight : 16;
  const ratio = aw / ah;
  let width = input.maxWidthPx;
  let height = width / ratio;
  if (height > input.maxHeightPx) {
    height = input.maxHeightPx;
    width = height * ratio;
  }
  return {
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
  };
}

export function formatSubtitlePreviewAspectLabel(
  aspectWidth: number,
  aspectHeight: number,
): string {
  if (!(aspectWidth > 0) || !(aspectHeight > 0)) return "";
  const ratio = aspectWidth / aspectHeight;
  const presets: Array<[number, string]> = [
    [16 / 9, "16:9"],
    [9 / 16, "9:16"],
    [4 / 3, "4:3"],
    [3 / 4, "3:4"],
    [1, "1:1"],
    [21 / 9, "21:9"],
  ];
  for (const [value, label] of presets) {
    if (Math.abs(ratio - value) < 0.04) return label;
  }
  return `${aspectWidth}×${aspectHeight}`;
}

export function subtitleFontLabel(fontKey: SubtitleFontKey): string {
  return SUBTITLE_FONT_OPTIONS.find((o) => o.value === fontKey)?.label ?? fontKey;
}

type SubtitleBurnInPreviewProps = {
  style: SubtitleBurnInStyle;
  sampleText?: string;
  className?: string;
  /** 未传画面比例时的预览框高度 */
  frameHeightPx?: number;
  /** 成片画面宽高（像素）。缺省保持 9:16 */
  aspectWidth?: number;
  aspectHeight?: number;
  /** 按容器宽度铺满，高度随画面比例 */
  fillWidth?: boolean;
};

/** 按成片画面比例预览底部字幕（字体 + 相对字号） */
export function SubtitleBurnInPreview({
  style,
  sampleText = SUBTITLE_PREVIEW_SAMPLE_TEXT,
  className = "",
  frameHeightPx = 200,
  aspectWidth,
  aspectHeight,
  fillWidth = false,
}: SubtitleBurnInPreviewProps) {
  const aspectW = aspectWidth && aspectWidth > 0 ? aspectWidth : 9;
  const aspectH = aspectHeight && aspectHeight > 0 ? aspectHeight : 16;
  const frameRef = useRef<HTMLDivElement>(null);
  const [measuredHeightPx, setMeasuredHeightPx] = useState(0);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const sync = () => setMeasuredHeightPx(el.clientHeight);
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => observer.disconnect();
  }, [aspectW, aspectH, fillWidth, frameHeightPx]);

  const layoutHeightPx = fillWidth
    ? measuredHeightPx
    : frameHeightPx;
  const fontSizePx = resolveSubtitlePreviewFontSizePx(
    style,
    layoutHeightPx > 0 ? layoutHeightPx : frameHeightPx,
  );
  const marginPx = resolveSubtitlePreviewMarginPx(
    layoutHeightPx > 0 ? layoutHeightPx : frameHeightPx,
  );
  const assSize = resolveSubtitleAssFontSize(style);
  const fixedFrame = resolveSubtitlePreviewFrameSize({
    aspectWidth: aspectW,
    aspectHeight: aspectH,
    maxWidthPx: Math.round(frameHeightPx * (aspectW / aspectH)),
    maxHeightPx: frameHeightPx,
  });
  const aspectLabel = formatSubtitlePreviewAspectLabel(aspectW, aspectH);

  return (
    <div
      className={className}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: fillWidth ? "stretch" : "center",
        gap: 8,
        flexShrink: 0,
        width: fillWidth ? "100%" : undefined,
      }}
    >
      <div
        ref={frameRef}
        style={{
          position: "relative",
          width: fillWidth
            ? `min(100%, calc(220px * ${aspectW} / ${aspectH}))`
            : fixedFrame.width,
          height: fillWidth ? undefined : fixedFrame.height,
          aspectRatio: `${aspectW} / ${aspectH}`,
          overflow: "hidden",
          borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.16)",
          background: "linear-gradient(180deg, #3a3a3c 0%, #111111 100%)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
          alignSelf: fillWidth ? "center" : undefined,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: marginPx,
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
              whiteSpace: "pre-wrap",
              maxWidth: "100%",
              wordBreak: "break-word",
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
          maxWidth: "100%",
          textAlign: "center",
          fontSize: 11,
          lineHeight: 1.35,
          color: "#86868b",
        }}
      >
        {aspectLabel ? `${aspectLabel} · ` : ""}
        {subtitleFontLabel(style.fontKey)} · ASS {assSize}
      </p>
    </div>
  );
}
