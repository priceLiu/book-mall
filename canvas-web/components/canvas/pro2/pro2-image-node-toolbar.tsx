"use client";

import {
  BookmarkPlus,
  ChevronDown,
  Copy,
  Download,
  Grid3x3,
  Lamp,
  LayoutGrid,
  Maximize2,
  RotateCw,
  Scan,
  Sparkles,
  Wand2,
} from "lucide-react";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { cn } from "@/lib/utils";

/** LibTV 节点顶栏工具条 · 壳层（规范见 libtv-node-interaction-spec.md §5） */
export const PRO2_IMAGE_NODE_TOOLBAR_SHELL_CLASS =
  "flex items-center gap-0.5 rounded-xl border border-white/10 bg-[#1c1c1e]/96 px-1.5 py-1 shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-xl";

/** 带文案的操作钮 */
export const PRO2_IMAGE_NODE_TOOLBAR_TOOL_BTN_CLASS =
  "nodrag flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] text-white/75 transition hover:bg-white/8 hover:text-white/95 disabled:cursor-not-allowed disabled:opacity-40";

/** 仅图标操作钮 */
export const PRO2_IMAGE_NODE_TOOLBAR_ICON_BTN_CLASS =
  "nodrag flex size-10 shrink-0 items-center justify-center rounded-lg text-white/60 transition hover:bg-white/8 hover:text-white/90 disabled:cursor-not-allowed disabled:opacity-40";

/** 工具条内分隔线 */
export const PRO2_IMAGE_NODE_TOOLBAR_DIVIDER_CLASS = "mx-0.5 h-5 w-px bg-white/10";

/** 卡片上方居中；节点内联 style={{ top: -60 }} */
export const PRO2_IMAGE_NODE_TOOLBAR_OFFSET_TOP_PX = 60;

const TOOL_BTN = PRO2_IMAGE_NODE_TOOLBAR_TOOL_BTN_CLASS;
const ICON_BTN = PRO2_IMAGE_NODE_TOOLBAR_ICON_BTN_CLASS;

export type Pro2ImageNodeToolbarProps = {
  previewUrl?: string;
  onExpandPreview?: () => void;
  onSaveAsAsset?: () => void;
  /** 复制节点（含生成结果与 Dock 配置） */
  onDuplicateNode?: () => void;
  className?: string;
  style?: React.CSSProperties;
  /** sbv1：工具条空白区仍可拖节点，仅按钮 nodrag */
  passNodeDrag?: boolean;
  /** 精简模式：仅预览 / 下载 / 复制（视频合成节点） */
  minimal?: boolean;
};

/** 有图图片节点 · 顶部浮动工具条（LibTV 图 2） */
export function Pro2ImageNodeToolbar({
  previewUrl,
  onExpandPreview,
  onSaveAsAsset,
  onDuplicateNode,
  className,
  style,
  passNodeDrag = false,
  minimal = false,
}: Pro2ImageNodeToolbarProps) {
  const { alert } = useDialogs();

  const soon = async (label: string) => {
    await alert({
      title: "即将推出",
      message: `「${label}」将在后续版本接入。`,
      variant: "info",
    });
  };

  const onDownload = () => {
    if (!previewUrl) return;
    const a = document.createElement("a");
    a.href = previewUrl;
    a.download = minimal ? "video" : "image";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.click();
  };

  if (minimal) {
    return (
      <ToolbarShell
        passNodeDrag={passNodeDrag}
        className={className}
        style={style}
      >
        <button
          type="button"
          className={ICON_BTN}
          title="放大预览"
          disabled={!previewUrl}
          onClick={onExpandPreview}
        >
          <Maximize2 className="size-5" />
        </button>
        <button
          type="button"
          className={ICON_BTN}
          title="下载"
          disabled={!previewUrl}
          onClick={onDownload}
        >
          <Download className="size-5" />
        </button>
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
        {onSaveAsAsset ? (
          <button type="button" className={ICON_BTN} title="保存为资产" onClick={onSaveAsAsset}>
            <BookmarkPlus className="size-5" />
          </button>
        ) : null}
      </ToolbarShell>
    );
  }

  return (
    <ToolbarShell passNodeDrag={passNodeDrag} className={className} style={style}>
      <button
        type="button"
        className={TOOL_BTN}
        onClick={() => void soon("全景")}
      >
        <Scan className="size-3.5" />
        <span>全景</span>
        <span className="rounded bg-sky-500/90 px-1 py-px text-[8px] font-semibold text-white">
          NEW
        </span>
      </button>
      <button
        type="button"
        className={TOOL_BTN}
        onClick={() => void soon("多角度")}
      >
        <RotateCw className="size-3.5" />
        <span>多角度</span>
      </button>
      <button
        type="button"
        className={TOOL_BTN}
        onClick={() => void soon("打光")}
      >
        <Lamp className="size-3.5" />
        <span>打光</span>
      </button>

      <div className={PRO2_IMAGE_NODE_TOOLBAR_DIVIDER_CLASS} />

      <button
        type="button"
        className={TOOL_BTN}
        onClick={() => void soon("九宫格")}
      >
        <Grid3x3 className="size-3.5" />
        <span>九宫格</span>
        <ChevronDown className="size-3 opacity-50" />
      </button>
      <button
        type="button"
        className={TOOL_BTN}
        onClick={() => void soon("高清")}
      >
        <Sparkles className="size-3.5" />
        <span>高清</span>
        <ChevronDown className="size-3 opacity-50" />
      </button>
      <button
        type="button"
        className={TOOL_BTN}
        onClick={() => void soon("宫格切分")}
      >
        <LayoutGrid className="size-3.5" />
        <span>宫格切分</span>
        <ChevronDown className="size-3 opacity-50" />
      </button>

      <div className={PRO2_IMAGE_NODE_TOOLBAR_DIVIDER_CLASS} />

      {onSaveAsAsset ? (
        <button type="button" className={TOOL_BTN} onClick={onSaveAsAsset}>
          <BookmarkPlus className="size-3.5" />
          <span>保存为资产</span>
        </button>
      ) : null}

      <button
        type="button"
        className={ICON_BTN}
        title="智能编辑"
        onClick={() => void soon("智能编辑")}
      >
        <Wand2 className="size-5" />
      </button>
      <button
        type="button"
        className={ICON_BTN}
        title="下载"
        disabled={!previewUrl}
        onClick={onDownload}
      >
        <Download className="size-5" />
      </button>
      <button
        type="button"
        className={ICON_BTN}
        title="放大预览"
        disabled={!previewUrl}
        onClick={onExpandPreview}
      >
        <Maximize2 className="size-5" />
      </button>
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
    </ToolbarShell>
  );
}

function ToolbarShell({
  passNodeDrag,
  className,
  style,
  children,
}: {
  passNodeDrag: boolean;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        PRO2_IMAGE_NODE_TOOLBAR_SHELL_CLASS,
        passNodeDrag
          ? "pointer-events-none [&_button]:pointer-events-auto"
          : "nodrag pointer-events-auto",
        !style && "absolute left-1/2 z-30 -translate-x-1/2",
        className,
      )}
      style={style}
      {...(passNodeDrag
        ? {}
        : {
            onMouseDown: (e: React.MouseEvent) => e.stopPropagation(),
            onClick: (e: React.MouseEvent) => e.stopPropagation(),
          })}
    >
      {children}
    </div>
  );
}
