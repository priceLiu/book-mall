"use client";

import type { ReactNode } from "react";
import { Play, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { RF_FORM_CONTROL, RF_NODE_SCROLL } from "@/lib/canvas/react-flow-classes";

/** 含图片/视频的节点统一尺寸（与 types.NODE_DEFAULT_SIZE 对齐） */
export const NODE_MEDIA_MIN_WIDTH = 380;
export const NODE_MEDIA_ENGINE_HEIGHT = 560;
export const NODE_MEDIA_PREVIEW_HEIGHT = 320;
export const NODE_MEDIA_UPLOAD_HEIGHT = 320;

/** 16:9 预览区固定高度，媒体 object-contain 居中 */
export const NODE_MEDIA_STAGE_HEIGHT_PX = 168;

/** 漫剧分镜图节点（横向矩形，左右 5:5） */
export const NODE_STORY_FRAME_MIN_WIDTH = 640;
export const NODE_STORY_FRAME_MIN_HEIGHT = 480;
export const NODE_STORY_FRAME_SPLIT_MIN_H = 240;

/** 三视图节点：上下结构（Prompt 上 · 图下） */
export const NODE_THREE_VIEW_MIN_WIDTH = 670;
export const NODE_THREE_VIEW_MIN_HEIGHT = 880;

export const NODE_THREE_VIEW_PROMPT_CLASS = `${RF_FORM_CONTROL} max-h-[72px] min-h-[52px] w-full resize-none overflow-y-auto rounded-md border border-white/10 bg-black/30 p-2 font-mono text-[11px] leading-relaxed text-white placeholder:text-[var(--canvas-muted)] focus:border-[var(--canvas-accent)]/60 focus:outline-none`;

export const NODE_STORY_FRAME_PROMPT_CLASS = `${RF_FORM_CONTROL} min-h-0 flex-1 w-full resize-none overflow-y-auto rounded-md border border-white/10 bg-black/30 p-2 font-mono text-[12px] leading-relaxed text-white placeholder:text-[var(--canvas-muted)] focus:border-[var(--canvas-accent)]/60 focus:outline-none`;

export const NODE_SECTION_LABEL =
  "shrink-0 text-[10px] uppercase tracking-wider text-[var(--canvas-muted)]";

export const NODE_PROMPT_CLASS = `${RF_FORM_CONTROL} max-h-[120px] min-h-[64px] w-full resize-y overflow-y-auto rounded-md border border-white/10 bg-black/30 p-2 font-mono text-[12px] text-white placeholder:text-[var(--canvas-muted)] focus:border-[var(--canvas-accent)]/60 focus:outline-none`;

const BTN_BASE =
  "nodrag inline-flex items-center justify-center gap-1 rounded-md font-medium transition disabled:cursor-not-allowed disabled:opacity-50";

/** 引擎主按钮：生成 / 重新生成 */
export const NODE_BTN_ENGINE_PRIMARY = `${BTN_BASE} w-full bg-[#fb923c] px-3 py-2 text-[12px] text-black hover:bg-[#fdba74]`;

/** 画布主按钮（非引擎 orange 场景，如 ai-engine） */
export const NODE_BTN_PRIMARY = `${BTN_BASE} w-full bg-[var(--canvas-accent)] px-3 py-2 text-[12px] text-white hover:bg-[var(--canvas-accent-soft)]`;

export const NODE_BTN_SECONDARY = `${BTN_BASE} border border-white/15 px-2.5 py-1.5 text-[11px] text-white/85 hover:bg-white/10`;

export const NODE_BTN_ACCENT = `${BTN_BASE} border border-[var(--canvas-accent)]/40 bg-[var(--canvas-accent)]/10 px-2.5 py-1.5 text-[11px] text-white hover:border-[var(--canvas-accent)]/70 hover:bg-[var(--canvas-accent)]/20`;

export const NODE_BTN_GHOST = `${BTN_BASE} border border-white/10 px-2 py-1 text-[11px] text-white/75 hover:border-white/30 hover:text-white`;

/** Story LLM 节点底栏：文案 / 分镜图 等，点击打开弹窗 */
export const NODE_BTN_STORY_ACTION = `${BTN_BASE} flex-1 border border-[#fb923c]/55 bg-black/50 py-2 text-[12px] text-[#fb923c] hover:border-[#fb923c]/80 hover:bg-[#fb923c]/10 hover:text-[#fdba74]`;

/** 分镜图节点底栏：四按钮一行，字号略小 */
export const NODE_BTN_FRAME_ACTION = `${BTN_BASE} min-w-0 flex-1 border border-[#fb923c]/55 bg-black/50 px-1 py-2 text-[10px] leading-tight text-[#fb923c] hover:border-[#fb923c]/80 hover:bg-[#fb923c]/10 hover:text-[#fdba74] sm:text-[11px]`;

export const NODE_MEDIA_GALLERY = `max-h-[340px] min-h-0 space-y-2 overflow-y-auto rounded-lg border border-white/10 bg-black/40 p-1.5 ${RF_NODE_SCROLL}`;

export const NODE_HISTORY_THUMB = "relative size-12 shrink-0 cursor-pointer overflow-hidden rounded border bg-black/60";

type NodeMediaStageProps = {
  children: ReactNode;
  className?: string;
  /** 列表项外框高亮 */
  active?: boolean;
  /** 填满父级高度（分镜图 5:5 右栏） */
  fill?: boolean;
  /** 固定高度（三视图上下布局等） */
  height?: number;
};

/** 固定比例预览槽：子元素应 h-full w-full object-contain */
export function NodeMediaStage({
  children,
  className,
  active,
  fill,
  height,
}: NodeMediaStageProps) {
  const fixedHeight = height ?? (fill ? undefined : NODE_MEDIA_STAGE_HEIGHT_PX);
  return (
    <div
      className={cn(
        "relative flex w-full shrink-0 items-center justify-center overflow-hidden rounded-md border bg-black/50",
        fill && "h-full min-h-[200px] shrink",
        active ? "border-[var(--canvas-accent)]" : "border-white/10",
        className,
      )}
      style={fixedHeight != null ? { height: fixedHeight } : undefined}
    >
      {children}
    </div>
  );
}

export function NodeMediaGallery({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn(NODE_MEDIA_GALLERY, className)}>{children}</div>;
}

export function NodeMediaItem({
  active,
  stage,
  actions,
}: {
  active?: boolean;
  stage: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border",
        active ? "border-[var(--canvas-accent)]" : "border-white/10",
      )}
    >
      {stage}
      {actions ? (
        <div className="flex flex-wrap items-center gap-1 border-t border-white/5 bg-black/50 px-2 py-1">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

export function NodeMediaEmpty({
  icon,
  message,
  fill,
}: {
  icon: ReactNode;
  message?: string;
  /** 填满父级（分镜图 5:5 右栏） */
  fill?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex w-full flex-col items-center justify-center gap-2 text-[var(--canvas-muted)]",
        fill && "h-full min-h-[200px]",
      )}
      style={fill ? undefined : { height: NODE_MEDIA_STAGE_HEIGHT_PX }}
    >
      {icon}
      {message ? <p className="text-[11px]">{message}</p> : null}
    </div>
  );
}

export function NodeEngineFooter({
  picker,
  runLabel,
  runAgainLabel,
  runningLabel = "生成中…",
  isGenerating,
  hasGenerated,
  runDisabled,
  onRun,
  primaryClassName = NODE_BTN_ENGINE_PRIMARY,
}: {
  picker: ReactNode;
  runLabel: string;
  runAgainLabel: string;
  runningLabel?: string;
  isGenerating: boolean;
  hasGenerated?: boolean;
  runDisabled?: boolean;
  onRun: () => void;
  primaryClassName?: string;
}) {
  return (
    <div className="mt-1 shrink-0 space-y-1.5 border-t border-white/5 pt-2">
      <div className="flex items-center gap-2">
        <p className={NODE_SECTION_LABEL}>模型</p>
        <div className="min-w-0 flex-1">{picker}</div>
      </div>
      <button
        type="button"
        className={primaryClassName}
        onClick={onRun}
        disabled={runDisabled || isGenerating}
      >
        {isGenerating ? (
          <>
            <RefreshCw className="size-3 animate-spin" />
          </>
        ) : hasGenerated ? (
          <>
            <RefreshCw className="size-3" /> {runAgainLabel}
          </>
        ) : (
          <>
            <Play className="size-3" /> {runLabel}
          </>
        )}
      </button>
    </div>
  );
}

export function NodeHistoryStrip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className={NODE_SECTION_LABEL}>{label}</p>
      <div className={cn("flex gap-1 overflow-x-auto pb-1", RF_NODE_SCROLL)}>
        {children}
      </div>
    </div>
  );
}

/** NodeShell 底栏：左提示 + 右类型标签（与分镜图节点一致） */
export function NodeEngineShellFooter({
  hint,
  tag,
}: {
  hint: string;
  tag: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="min-w-0 truncate">{hint}</span>
      <span className="shrink-0 rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-[var(--canvas-muted)]">
        {tag}
      </span>
    </div>
  );
}

/**
 * 引擎节点内容区：中间可滚动/可拉伸，模型+生成按钮 + Shell 底栏始终贴底。
 */
export function NodeEngineLayout({
  children,
  engineFooter,
}: {
  children: ReactNode;
  engineFooter: ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto",
          RF_NODE_SCROLL,
        )}
      >
        {children}
      </div>
      <div className="shrink-0">{engineFooter}</div>
    </div>
  );
}
