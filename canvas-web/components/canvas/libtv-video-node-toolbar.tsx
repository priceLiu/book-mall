"use client";

import { useEffect, useState } from "react";
import { useStore } from "@xyflow/react";
import {
  AudioLines,
  BookmarkPlus,
  ChevronDown,
  Copy,
  Crop,
  Download,
  Loader2,
  Maximize2,
  Scan,
  Sparkles,
  Type,
  VolumeX,
} from "lucide-react";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import {
  downloadMediaUrl,
  guessMediaDownloadFilename,
} from "@/lib/canvas/download-media-url";
import { computeLibtvNodeToolbarTransformScale } from "@/lib/canvas/libtv-node-toolbar-scale";
import { useLibtvToolbarPortaled } from "@/components/canvas/libtv-node-toolbar-portal";
import type { LibtvVideoTrackSplitMode } from "@/lib/canvas/libtv-video-track-split-run";
import {
  PRO2_IMAGE_NODE_TOOLBAR_DIVIDER_CLASS,
  PRO2_IMAGE_NODE_TOOLBAR_ICON_BTN_CLASS,
  PRO2_IMAGE_NODE_TOOLBAR_SHELL_CLASS,
  PRO2_IMAGE_NODE_TOOLBAR_TOOL_BTN_CLASS,
} from "@/components/canvas/pro2/pro2-image-node-toolbar";
import {
  Pro2ToolbarDropdownItem,
  Pro2ToolbarDropdownMenu,
  usePro2ToolbarDropdownAnchor,
} from "@/components/canvas/pro2/pro2-toolbar-dropdown-menu";
import { cn } from "@/lib/utils";

const TOOL_BTN = PRO2_IMAGE_NODE_TOOLBAR_TOOL_BTN_CLASS;
const ICON_BTN = PRO2_IMAGE_NODE_TOOLBAR_ICON_BTN_CLASS;

/** 视频合成节点 · 顶部浮动工具条（图 5 · 后续接入 + 保留复制） */
export function LibtvVideoNodeToolbar({
  previewUrl,
  trackSplitSourceUrl,
  trackSplitBusy,
  onTrackSplitPick,
  onExpandPreview,
  onSaveAsAsset,
  onDuplicateNode,
  onReversePrompt,
  reversePromptBusy = false,
  className,
  style,
  passNodeDrag = false,
}: {
  previewUrl?: string;
  /** OSS/HTTPS 成片 · 去原音 / 分离音轨 */
  trackSplitSourceUrl?: string;
  trackSplitBusy?: boolean;
  onTrackSplitPick?: (mode: LibtvVideoTrackSplitMode) => void;
  onExpandPreview?: () => void;
  onSaveAsAsset?: () => void;
  onDuplicateNode?: () => void;
  onReversePrompt?: () => void;
  reversePromptBusy?: boolean;
  className?: string;
  style?: React.CSSProperties;
  passNodeDrag?: boolean;
}) {
  const { alert } = useDialogs();
  const [downloading, setDownloading] = useState(false);
  const audioMenu = usePro2ToolbarDropdownAnchor();
  const zoom = useStore((s) => s.transform[2]);
  const portaled = useLibtvToolbarPortaled();
  const toolbarScale = portaled
    ? 1
    : computeLibtvNodeToolbarTransformScale(zoom);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (audioMenu.open) {
      root.setAttribute("data-canvas-toolbar-popover-open", "1");
    } else {
      root.removeAttribute("data-canvas-toolbar-popover-open");
    }
    return () => {
      root.removeAttribute("data-canvas-toolbar-popover-open");
    };
  }, [audioMenu.open]);

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

  const trackSplitEnabled = Boolean(
    trackSplitSourceUrl && onTrackSplitPick && !trackSplitBusy,
  );

  const pickTrackSplit = (mode: LibtvVideoTrackSplitMode) => {
    audioMenu.setOpen(false);
    if (!trackSplitEnabled || !onTrackSplitPick) return;
    onTrackSplitPick(mode);
  };

  return (
    <>
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
                transform:
                  style?.transform ?? `translateX(-50%) scale(${toolbarScale})`,
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
        {onReversePrompt ? (
          <button
            type="button"
            className={cn(
              TOOL_BTN,
              reversePromptBusy && "pointer-events-none opacity-80",
            )}
            disabled={!previewUrl || reversePromptBusy}
            title="反推提示词 · Qwen3.8 Max"
            onClick={onReversePrompt}
          >
            {reversePromptBusy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            <span>反推提示词</span>
          </button>
        ) : (
          <button type="button" className={TOOL_BTN} onClick={() => void soon("解析")}>
            <Scan className="size-3.5" />
            <span>解析</span>
          </button>
        )}
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
          ref={audioMenu.anchorRef}
          type="button"
          className={cn(
            TOOL_BTN,
            audioMenu.open && "bg-white/[0.08]",
            !trackSplitEnabled && "opacity-50",
          )}
          disabled={!trackSplitSourceUrl || trackSplitBusy}
          title={
            !trackSplitSourceUrl
              ? "请先生成或上传成片"
              : trackSplitBusy
                ? "处理中…"
                : undefined
          }
          onClick={() => audioMenu.setOpen(!audioMenu.open)}
        >
          {trackSplitBusy ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <AudioLines className="size-3.5" />
          )}
          <span>音频分离</span>
          <ChevronDown className="size-3 opacity-50" />
        </button>

        <div className={PRO2_IMAGE_NODE_TOOLBAR_DIVIDER_CLASS} />

        {onSaveAsAsset ? (
          <button
            type="button"
            className={ICON_BTN}
            title="保存为资产"
            disabled={!previewUrl}
            onClick={onSaveAsAsset}
          >
            <BookmarkPlus className="size-5" />
          </button>
        ) : null}
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

      <Pro2ToolbarDropdownMenu
        open={audioMenu.open}
        setOpen={audioMenu.setOpen}
        rect={audioMenu.rect}
        minWidth={200}
      >
        <Pro2ToolbarDropdownItem
          icon={VolumeX}
          label="去原音"
          disabled={!trackSplitEnabled}
          onClick={() => pickTrackSplit("strip-audio")}
        />
        <Pro2ToolbarDropdownItem
          icon={AudioLines}
          label="音频分离"
          disabled={!trackSplitEnabled}
          onClick={() => pickTrackSplit("extract-audio")}
        />
      </Pro2ToolbarDropdownMenu>
    </>
  );
}
