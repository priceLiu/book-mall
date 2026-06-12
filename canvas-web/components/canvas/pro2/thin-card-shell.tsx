"use client";

import { Handle, Position } from "@xyflow/react";
import { cn } from "@/lib/utils";
import {
  PRO2_CARD_SHELL_CLASS,
  PRO2_CARD_SUBTITLE_CLASS,
  PRO2_CARD_TITLE_CLASS,
  pro2NodeBorderColor,
} from "@/lib/canvas/story-pro2-node-chrome";
import { RF_NODE_DRAG_HANDLE } from "@/lib/canvas/react-flow-classes";

export type Pro2ThinCardShellProps = {
  title: string;
  subtitle?: string;
  selected?: boolean;
  badge?: React.ReactNode;
  footer?: React.ReactNode;
  children?: React.ReactNode;
  /** 左侧输入 */
  inputs?: Array<{ id: string; label: string }>;
  /** 右侧输出 */
  outputs?: Array<{ id: string; label: string }>;
  className?: string;
};

export function Pro2ThinCardShell({
  title,
  subtitle,
  selected,
  badge,
  footer,
  children,
  inputs = [],
  outputs = [],
  className,
}: Pro2ThinCardShellProps) {
  return (
    <div
      className={cn(
        PRO2_CARD_SHELL_CLASS,
        "flex h-full min-h-0 flex-col overflow-hidden",
        className,
      )}
      style={{ borderColor: pro2NodeBorderColor(!!selected) }}
    >
      {inputs.map((h) => (
        <Handle
          key={h.id}
          id={h.id}
          type="target"
          position={Position.Left}
          className="!h-2 !w-2 !border-violet-300/60 !bg-violet-400"
          title={h.label}
        />
      ))}
      {outputs.map((h) => (
        <Handle
          key={h.id}
          id={h.id}
          type="source"
          position={Position.Right}
          className="!h-2 !w-2 !border-violet-300/60 !bg-violet-400"
          title={h.label}
        />
      ))}

      <div
        className={cn(
          RF_NODE_DRAG_HANDLE,
          "flex shrink-0 cursor-grab items-start justify-between gap-2 border-b border-violet-400/12 px-3 py-2 active:cursor-grabbing",
        )}
        title="拖动标题栏移动节点"
      >
        <div className="min-w-0">
          <p className={PRO2_CARD_TITLE_CLASS}>{title}</p>
          {subtitle ? (
            <p className={cn(PRO2_CARD_SUBTITLE_CLASS, "mt-0.5 truncate")}>
              {subtitle}
            </p>
          ) : null}
        </div>
        {badge ? <div className="shrink-0">{badge}</div> : null}
      </div>

      {children ? (
        <div className="min-h-0 flex-1 px-3 py-2 text-[11px] text-white/70">
          {children}
        </div>
      ) : null}

      {footer ? (
        <div className="shrink-0 border-t border-violet-400/10 px-3 py-2">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
