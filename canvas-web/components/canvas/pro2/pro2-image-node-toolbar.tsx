"use client";

import {
  ChevronDown,
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

const TOOL_BTN =
  "nodrag flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] text-white/75 transition hover:bg-white/8 hover:text-white/95 disabled:cursor-not-allowed disabled:opacity-40";

const ICON_BTN =
  "nodrag flex size-8 shrink-0 items-center justify-center rounded-lg text-white/60 transition hover:bg-white/8 hover:text-white/90 disabled:cursor-not-allowed disabled:opacity-40";

export type Pro2ImageNodeToolbarProps = {
  previewUrl?: string;
  onExpandPreview?: () => void;
  className?: string;
  style?: React.CSSProperties;
};

/** 有图图片节点 · 顶部浮动工具条（LibTV 图 2） */
export function Pro2ImageNodeToolbar({
  previewUrl,
  onExpandPreview,
  className,
  style,
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
    a.download = "image";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.click();
  };

  return (
    <div
      className={cn(
        "nodrag pointer-events-auto flex items-center gap-0.5 rounded-xl border border-white/10 bg-[#1c1c1e]/96 px-1.5 py-1 shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-xl",
        !style && "absolute left-1/2 z-30 -translate-x-1/2",
        className,
      )}
      style={style}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
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

      <div className="mx-0.5 h-5 w-px bg-white/10" />

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

      <div className="mx-0.5 h-5 w-px bg-white/10" />

      <button
        type="button"
        className={ICON_BTN}
        title="智能编辑"
        onClick={() => void soon("智能编辑")}
      >
        <Wand2 className="size-4" />
      </button>
      <button
        type="button"
        className={ICON_BTN}
        title="下载"
        disabled={!previewUrl}
        onClick={onDownload}
      >
        <Download className="size-4" />
      </button>
      <button
        type="button"
        className={ICON_BTN}
        title="放大预览"
        disabled={!previewUrl}
        onClick={onExpandPreview}
      >
        <Maximize2 className="size-4" />
      </button>
    </div>
  );
}
