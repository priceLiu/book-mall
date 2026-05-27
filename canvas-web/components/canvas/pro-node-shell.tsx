"use client";

import { Handle, NodeResizer, Position } from "@xyflow/react";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { RF_NODE_DRAG_HANDLE, RF_NODE_SCROLL } from "@/lib/canvas/react-flow-classes";
import {
  PRO_NODE_ACCENT,
  PRO_NODE_SHELL_FOOTER_CLASS,
} from "@/lib/canvas/story-pro-node-chrome";
import { NodeStatusBadge } from "./node-shell";
import type { CanvasNodeRuntime } from "@/lib/canvas/types";
import { StoryProStageRail } from "./story-pro-stage-rail";
import type { StoryProStageId } from "@/lib/canvas/story-pro-node-chrome";

export type ProNodeShellProps = {
  title: string;
  subtitle?: string;
  selected?: boolean;
  runtime?: CanvasNodeRuntime;
  inputs?: Array<{ id: string; label: string; kind: "image" | "text" }>;
  outputs?: Array<{ id: string; label: string; kind: "image" | "text" }>;
  minWidth?: number;
  minHeight?: number;
  children: React.ReactNode;
  footer?: React.ReactNode;
  headerRight?: React.ReactNode;
  bodyScroll?: boolean;
  /** 五阶段进度条 */
  activeStage?: StoryProStageId;
  completedStages?: StoryProStageId[];
  /** 顶部操作指引（故事/风格等控制节点） */
  guide?: React.ReactNode;
};

const KIND_COLOR: Record<"image" | "text", string> = {
  image: "bg-violet-400",
  text: "bg-cyan-400",
};

export function ProNodeShell({
  title,
  subtitle,
  selected,
  runtime,
  inputs = [],
  outputs = [],
  minWidth = 240,
  minHeight = 160,
  children,
  footer,
  headerRight,
  bodyScroll = false,
  activeStage,
  completedStages,
  guide,
}: ProNodeShellProps) {
  const status = runtime?.status ?? "idle";
  const isGenerating = status === "running" || status === "pending";
  const tint = PRO_NODE_ACCENT;
  const borderColor = isGenerating
    ? tint
    : selected
      ? tint
      : "rgba(34, 211, 238, 0.28)";

  return (
    <div
      className={cn(
        "canvas-node-shell relative flex h-full w-full flex-col overflow-hidden rounded-xl border text-[12px] text-white shadow-lg transition-shadow",
        isGenerating && "canvas-node-generating",
      )}
      style={{
        borderColor,
        borderWidth: 2,
        background:
          "linear-gradient(165deg, rgba(8, 20, 28, 0.98) 0%, rgba(6, 12, 18, 0.99) 100%)",
        boxShadow: selected
          ? `0 0 0 2px ${tint}44, 0 0 24px ${tint}18`
          : isGenerating
            ? `0 0 0 2px ${tint}, 0 0 20px ${tint}33`
            : `0 4px 24px rgba(0,0,0,0.35)`,
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(34,211,238,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.5) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
        aria-hidden
      />

      <NodeResizer
        isVisible={selected}
        minWidth={minWidth}
        minHeight={minHeight}
        color={tint}
        lineStyle={{ borderColor: tint, opacity: 0.5 }}
        handleStyle={{ background: tint, border: "none", width: 8, height: 8 }}
      />

      <header
        className="relative z-10 shrink-0 border-b border-cyan-400/15 px-2.5 py-2"
        style={{
          background:
            "linear-gradient(180deg, rgba(34, 211, 238, 0.08), transparent)",
        }}
      >
        <div className="flex items-start justify-between gap-2">
          <div
            className={cn(
              RF_NODE_DRAG_HANDLE,
              "flex min-w-0 flex-1 cursor-grab items-start gap-1.5 active:cursor-grabbing",
            )}
            title="拖动标题栏移动节点"
          >
            <GripVertical
              className="mt-0.5 size-3.5 shrink-0 text-cyan-400/35"
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-cyan-300">
                {title}
              </p>
              {subtitle ? (
                <p className="truncate text-[11px] text-white/75">{subtitle}</p>
              ) : null}
            </div>
          </div>
          {headerRight ?? (
            <NodeStatusBadge status={status} message={runtime?.failMessage ?? null} />
          )}
        </div>
        {activeStage ? (
          <div className="mt-2">
            <StoryProStageRail
              activeStage={activeStage}
              completedStages={completedStages}
            />
          </div>
        ) : null}
      </header>

      {guide ? <div className="relative z-10 shrink-0 px-3 pt-2">{guide}</div> : null}

      <div
        className={cn(
          "relative z-10 flex flex-col px-3",
          bodyScroll
            ? cn("min-h-0 flex-1 overflow-y-auto py-3", RF_NODE_SCROLL)
            : "min-h-0 flex-1 overflow-hidden py-3",
        )}
      >
        {children}
      </div>

      {footer ? (
        <div className={cn("relative z-10", PRO_NODE_SHELL_FOOTER_CLASS)}>
          {footer}
        </div>
      ) : null}

      {inputs.map((p, i) => (
        <Handle
          key={`in-${p.id}`}
          id={p.id}
          type="target"
          position={Position.Left}
          className={cn(
            "!h-3 !w-3 !rounded-full !border-2 !border-[var(--canvas-bg)]",
            KIND_COLOR[p.kind],
          )}
          style={{ top: 24 + (inputs.length === 1 ? 24 : i * 22) }}
          title={`${p.label} (${p.kind})`}
        />
      ))}
      {outputs.map((p, i) => (
        <Handle
          key={`out-${p.id}`}
          id={p.id}
          type="source"
          position={Position.Right}
          className={cn(
            "!h-3 !w-3 !rounded-full !border-2 !border-[var(--canvas-bg)]",
            KIND_COLOR[p.kind],
          )}
          style={{ top: 24 + (outputs.length === 1 ? 24 : i * 22) }}
          title={`${p.label} (${p.kind})`}
        />
      ))}
    </div>
  );
}
