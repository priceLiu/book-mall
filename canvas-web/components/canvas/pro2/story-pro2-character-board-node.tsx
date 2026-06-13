"use client";

import { useMemo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Loader2, Users } from "lucide-react";
import { Handle, Position } from "@xyflow/react";

import { useCanvasStore } from "@/lib/canvas/store";
import {
  PRO2_CARD_SHELL_CLASS,
  PRO2_FRAME_BOARD_MIN_HEIGHT,
  PRO2_FRAME_BOARD_MIN_WIDTH,
  pro2NodeBorderColor,
} from "@/lib/canvas/story-pro2-node-chrome";
import type { StoryProCharacterRow } from "@/lib/canvas/story-pro-workspace-types";
import { RF_NODE_DRAG_HANDLE } from "@/lib/canvas/react-flow-classes";
import { cn } from "@/lib/utils";
import {
  Pro2CharacterBoardCell,
  pro2CharacterCellStatus,
} from "./pro2-character-board-cell";
import { Pro2NodeResizer } from "./pro2-node-resizer";

export function StoryPro2CharacterBoardNode({ id, data, selected }: NodeProps) {
  const nodes = useCanvasStore((s) => s.nodes);
  const setNodes = useCanvasStore((s) => s.setNodes);

  const d = data as {
    rows?: StoryProCharacterRow[];
    hubNodeId?: string;
    pro2VisualGroupId?: string;
  };
  const isVisualGroupPlaceholder = Boolean(d.pro2VisualGroupId);

  const label = useMemo(() => {
    const hubs = nodes.filter((n) => n.type === "story-pro2-script-hub");
    const hubIdx = hubs.findIndex((h) => h.id === d.hubNodeId);
    const scriptNo = hubIdx >= 0 ? hubIdx + 1 : 1;
    return `三视图 · 脚本 ${scriptNo}`;
  }, [nodes, d.hubNodeId]);

  const sortedRows = useMemo(
    () => [...(d.rows ?? [])].sort((a, b) => a.name.localeCompare(b.name, "zh")),
    [d.rows],
  );

  if (isVisualGroupPlaceholder) {
    return (
      <div
        className="pointer-events-none opacity-0"
        style={{ width: 1, height: 1 }}
        aria-hidden
      />
    );
  }

  const anyRunning = sortedRows.some(
    (r) => pro2CharacterCellStatus(r) === "running",
  );
  const hasAnyImage = sortedRows.some(
    (r) => pro2CharacterCellStatus(r) === "done",
  );

  const selectNode = () => {
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
        <Users className="size-3.5 shrink-0" />
        {label}
        {sortedRows.length ? (
          <span className="text-white/35">· {sortedRows.length} 角色</span>
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
            生成三视图中…
          </div>
        ) : sortedRows.length ? (
          <div className="nodrag min-h-0 flex-1 overflow-y-auto pr-0.5">
            <div className="grid grid-cols-2 gap-2">
              {sortedRows.map((row) => (
                <Pro2CharacterBoardCell
                  key={row.key}
                  row={row}
                  focused={!!selected}
                  onSelect={selectNode}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-[11px] text-white/40">
            等待角色设定
          </div>
        )}
      </div>
    </div>
  );
}
