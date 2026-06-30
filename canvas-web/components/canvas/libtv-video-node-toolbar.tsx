"use client";

import { useState } from "react";
import { useStore } from "@xyflow/react";
import {
  AudioLines,
  ChevronDown,
  Copy,
  Crop,
  Download,
  Loader2,
  Maximize2,
  Scan,
  Type,
} from "lucide-react";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import {
  downloadMediaUrl,
  guessMediaDownloadFilename,
} from "@/lib/canvas/download-media-url";
import { computeLibtvNodeToolbarTransformScale } from "@/lib/canvas/libtv-node-toolbar-scale";
import { useLibtvToolbarPortaled } from "@/components/canvas/libtv-node-toolbar-portal";
import {
  PRO2_IMAGE_NODE_TOOLBAR_DIVIDER_CLASS,
  PRO2_IMAGE_NODE_TOOLBAR_ICON_BTN_CLASS,
  PRO2_IMAGE_NODE_TOOLBAR_SHELL_CLASS,
  PRO2_IMAGE_NODE_TOOLBAR_TOOL_BTN_CLASS,
} from "@/components/canvas/pro2/pro2-image-node-toolbar";
import { cn } from "@/lib/utils";

const TOOL_BTN = PRO2_IMAGE_NODE_TOOLBAR_TOOL_BTN_CLASS;
const ICON_BTN = PRO2_IMAGE_NODE_TOOLBAR_ICON_BTN_CLASS;

/** 视频合成节点 · 顶部浮动工具条（图 5 · 后续接入 + 保留复制） */
export function LibtvVideoNodeToolbar({
  previewUrl,
  onExpandPreview,
  onDuplicateNode,
  className,
  style,
  passNodeDrag = false,
}: {
  previewUrl?: string;
  onExpandPreview?: () => void;
  onDuplicateNode?: () => void;
  className?: string;
  style?: React.CSSProperties;
  passNodeDrag?: boolean;
}) {
  const { alert } = useDialogs();
  const [downloading, setDownloading] = useState(false);
  const zoom = useStore((s) => s.transform[2]);
  const portaled = useLibtvToolbarPortaled();
  const toolbarScale = portaled
    ? 1
    : computeLibtvNodeToolbarTransformScale(zoom);

  const soon = async (label: string) => {
    await alert({
      title: "即将推出",
      message: `「${label}」将在后续版本接入。`,
      variant: "info",
    });
  };

  const onDownload = async () => {
    if (!previewUrl || downloading) return;
    setDownloading(true);
    try {
      await downloadMediaUrl(
        previewUrl,
        guessMediaDownloadFilename(previewUrl, "video.mp4"),
      );
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className={cn(
        PRO2_IMAGE_NODE_TOOLBAR_SHELL_CLASS,
        passNodeDrag
          ? "pointer-events-none [&_button]:pointer-events-auto"
          : "nodrag pointer-events-auto",
        !portaled && !style && "absolute left-1/2 z-30",
        className,
      )}
      style={
        portaled
          ? style
          : {
              ...style,
              transform: style?.transform ?? `translateX(-50%) scale(${toolbarScale})`,
              transformOrigin: "50% 100%",
            }
      }
    >
      <button type="button" className={TOOL_BTN} onClick={() => void soon("裁剪")}>
        <Crop className="size-3.5" />
        <span>裁剪</span>
      </button>
      <button type="button" className={TOOL_BTN} onClick={() => void soon("高清")}>
        <Scan className="size-3.5" />
        <span>高清</span>
      </button>
      <button type="button" className={TOOL_BTN} onClick={() => void soon("解析")}>
        <Scan className="size-3.5" />
        <span>解析</span>
      </button>
      <button
        type="button"
        className={TOOL_BTN}
        onClick={() => void soon("智能去字幕")}
      >
        <Type className="size-3.5" />
        <span>智能去字幕</span>
        <ChevronDown className="size-3 opacity-50" />
      </button>
      <button
        type="button"
        className={TOOL_BTN}
        onClick={() => void soon("音频分离")}
      >
        <AudioLines className="size-3.5" />
        <span>音频分离</span>
        <ChevronDown className="size-3 opacity-50" />
      </button>

      <div className={PRO2_IMAGE_NODE_TOOLBAR_DIVIDER_CLASS} />

      <button
        type="button"
        className={ICON_BTN}
        title="下载"
        disabled={!previewUrl || downloading}
        onClick={() => void onDownload()}
      >
        {downloading ? (
          <Loader2 className="size-5 animate-spin" />
        ) : (
          <Download className="size-5" />
        )}
      </button>
      {onExpandPreview ? (
        <button
          type="button"
          className={ICON_BTN}
          title="放大预览"
          disabled={!previewUrl}
          onClick={onExpandPreview}
        >
          <Maximize2 className="size-5" />
        </button>
      ) : null}
      {onDuplicateNode ? (
        <button
          type="button"
          className={ICON_BTN}
          title="复制节点"
          onClick={onDuplicateNode}
        >
          <Copy className="size-5" />
        </button>
      ) : null}
    </div>
  );
}
