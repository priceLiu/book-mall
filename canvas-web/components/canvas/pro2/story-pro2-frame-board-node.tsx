"use client";

import { useMemo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Film, Loader2 } from "lucide-react";
import { Handle, Position } from "@xyflow/react";

import { useCanvasStore } from "@/lib/canvas/store";
import {
  PRO2_CARD_SHELL_CLASS,
  PRO2_FRAME_BOARD_MIN_HEIGHT,
  PRO2_FRAME_BOARD_MIN_WIDTH,
  pro2NodeBorderColor,
} from "@/lib/canvas/story-pro2-node-chrome";
import type { StoryProFrameRow } from "@/lib/canvas/story-pro-workspace-types";
import { RF_NODE_DRAG_HANDLE } from "@/lib/canvas/react-flow-classes";
import { cn } from "@/lib/utils";
import { Pro2FrameBoardCell, pro2FrameCellStatus } from "./pro2-frame-board-cell";
import { Pro2NodeResizer } from "./pro2-node-resizer";

export function StoryPro2FrameBoardNode({ id, data, selected }: NodeProps) {
  const nodes = useCanvasStore((s) => s.nodes);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const focus = useCanvasStore((s) => s.pro2FrameDockFocus);
  const setPro2FrameDockFocus = useCanvasStore((s) => s.setPro2FrameDockFocus);

  const d = data as {
    rows?: StoryProFrameRow[];
    hubNodeId?: string;
    pro2VisualGroupId?: string;
  };
  if (d.pro2VisualGroupId) {
    return (
      <div
        className="pointer-events-none opacity-0"
        style={{ width: 1, height: 1 }}
        aria-hidden
      />
    );
  }
  const rows = d.rows ?? [];

  const label = useMemo(() => {
    const hubs = nodes.filter((n) => n.type === "story-pro2-script-hub");
    const hubIdx = hubs.findIndex((h) => h.id === d.hubNodeId);
    const scriptNo = hubIdx >= 0 ? hubIdx + 1 : 1;
    return `分镜图 · 脚本 ${scriptNo}`;
  }, [nodes, d.hubNodeId]);

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => a.frameIndex - b.frameIndex),
    [rows],
  );

  const anyRunning = sortedRows.some((r) => pro2FrameCellStatus(r) === "running");
  const hasAnyImage = sortedRows.some(
    (r) => pro2FrameCellStatus(r) === "done",
  );

  const selectCell = (rowKey: string) => {
    setPro2FrameDockFocus({ nodeId: id, rowKey });
    setNodes((prev) =>
      prev.map((n) => ({ ...n, selected: n.id === id })),
    );
  };

  return (
    <div className="relative flex h-full w-full min-h-0 min-w-0 flex-col">
      <Pro2NodeResizer
        isVisible={!!selected}
        minWidth={PRO2_FRAME_BOARD_MIN_WIDTH}
        minHeight={PRO2_FRAME_BOARD_MIN_HEIGHT}
      />

      <Handle
        id="in_text"
        type="target"
        position={Position.Left}
        className="!h-2 !w-2 !border-violet-300/60 !bg-violet-400"
      />

      <p
        className={cn(
          RF_NODE_DRAG_HANDLE,
          "mb-1.5 flex shrink-0 cursor-grab items-center gap-1.5 px-0.5 text-[11px] text-white/55 active:cursor-grabbing",
        )}
      >
        <Film className="size-3.5 shrink-0" />
        {label}
        {sortedRows.length ? (
          <span className="text-white/35">· {sortedRows.length} 镜</span>
        ) : null}
      </p>

      <div
        className={cn(
          PRO2_CARD_SHELL_CLASS,
          "flex min-h-0 flex-1 flex-col overflow-hidden p-2",
        )}
        style={{ borderColor: pro2NodeBorderColor(!!selected) }}
      >
        {anyRunning && !hasAnyImage ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-[11px] text-violet-200/70">
            <Loader2 className="size-5 animate-spin" />
            生成分镜图中…
          </div>
        ) : sortedRows.length ? (
          <div className="nodrag min-h-0 flex-1 overflow-y-auto pr-0.5">
            <div className="grid grid-cols-2 gap-2">
              {sortedRows.map((row) => (
                <Pro2FrameBoardCell
                  key={row.key}
                  row={row}
                  cellId={`${id}:${row.key}`}
                  focused={
                    !!selected &&
                    focus?.nodeId === id &&
                    focus.rowKey === row.key
                  }
                  onSelect={() => selectCell(row.key)}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-[11px] text-white/40">
            等待脚本生成
          </div>
        )}
      </div>
    </div>
  );
}
