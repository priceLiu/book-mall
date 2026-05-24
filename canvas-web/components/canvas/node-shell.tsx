"use client";

import { Handle, NodeResizer, Position } from "@xyflow/react";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { RF_NODE_SCROLL } from "@/lib/canvas/react-flow-classes";
import type { CanvasNodeRuntime } from "@/lib/canvas/types";

export type NodeShellProps = {
  title: string;
  subtitle?: string;
  selected?: boolean;
  runtime?: CanvasNodeRuntime;
  /** 输入端口（左侧） */
  inputs?: Array<{ id: string; label: string; kind: "image" | "text" }>;
  /** 输出端口（右侧） */
  outputs?: Array<{ id: string; label: string; kind: "image" | "text" }>;
  /** 边框 / 选中阴影色；引擎类节点传橙色以区分 */
  accent?: string;
  /** 是否引擎节点（控制橙色边框 + accent label） */
  engine?: boolean;
  /** Resizer 尺寸下限 */
  minWidth?: number;
  minHeight?: number;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** 传入时替换默认 StatusBadge（用于引擎节点自定义标题栏右侧） */
  headerRight?: React.ReactNode;
};

const KIND_COLOR: Record<"image" | "text", string> = {
  image: "bg-violet-400",
  text: "bg-emerald-400",
};

/** 引擎节点专用橙：区分于普通节点 */
export const ENGINE_ACCENT = "#fb923c";

export function NodeShell({
  title,
  subtitle,
  selected,
  runtime,
  inputs = [],
  outputs = [],
  accent,
  engine,
  minWidth = 240,
  minHeight = 160,
  children,
  footer,
  headerRight,
}: NodeShellProps) {
  const status = runtime?.status ?? "idle";
  const tint = accent ?? (engine ? ENGINE_ACCENT : "var(--canvas-accent)");
  const borderColor = engine
    ? selected
      ? ENGINE_ACCENT
      : `${ENGINE_ACCENT}99` /* 60% 橙：未选中时的引擎边框 */
    : selected
      ? "var(--canvas-accent)"
      : "rgba(255,255,255,0.10)";
  return (
    <div
      className={cn(
        "canvas-node-shell relative flex h-full w-full flex-col rounded-xl border bg-[var(--canvas-surface)] text-[12px] text-white shadow-lg transition-shadow",
      )}
      style={{
        borderColor,
        borderWidth: engine ? 2 : 1,
        boxShadow: selected ? `0 0 0 2px ${tint}` : undefined,
      }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={minWidth}
        minHeight={minHeight}
        color={tint}
        lineStyle={{ borderColor: tint, opacity: 0.6 }}
        handleStyle={{ background: tint, border: "none", width: 8, height: 8 }}
      />

      <header
        className={cn(
          "flex items-center justify-between rounded-t-xl border-b px-3 py-2",
          engine ? "" : "border-white/10 bg-white/[0.04]",
        )}
        style={
          engine
            ? {
                borderColor: `${ENGINE_ACCENT}33`,
                background: `linear-gradient(180deg, ${ENGINE_ACCENT}1A, transparent)`,
              }
            : undefined
        }
      >
        <div className="min-w-0">
          <p
            className={cn(
              "truncate text-[11px] font-medium uppercase tracking-wider",
              engine ? "" : "text-[var(--canvas-muted)]",
            )}
            style={engine ? { color: ENGINE_ACCENT } : undefined}
          >
            {title}
          </p>
          {subtitle ? (
            <p className="truncate text-[11px] text-white/80">{subtitle}</p>
          ) : null}
        </div>
        {headerRight ?? (
          <NodeStatusBadge status={status} message={runtime?.failMessage ?? null} />
        )}
      </header>

      <div className={cn("min-h-0 flex-1 overflow-auto px-3 py-3", RF_NODE_SCROLL)}>
        {children}
      </div>

      {footer ? (
        <div className="border-t border-white/10 px-3 py-2 text-[11px] text-[var(--canvas-muted)]">
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

export function NodeStatusBadge({
  status,
  message,
}: {
  status: CanvasNodeRuntime["status"];
  message: string | null;
}) {
  switch (status) {
    case "running":
      return (
        <span
          className="inline-flex items-center gap-1 rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] text-violet-200"
          title="生成中"
        >
          <Loader2 className="size-3 animate-spin" /> 生成中
        </span>
      );
    case "pending":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-200">
          <Loader2 className="size-3 animate-spin" /> 排队
        </span>
      );
    case "done":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-200">
          <Check className="size-3" /> 完成
        </span>
      );
    case "error":
      return (
        <span
          title={message ?? undefined}
          className="inline-flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] text-red-200"
        >
          <AlertTriangle className="size-3" /> 失败
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/60">
          就绪
        </span>
      );
  }
}
