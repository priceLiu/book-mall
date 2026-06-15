"use client";

import { useCallback } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react";
import { X } from "lucide-react";
import { useCanvasStore } from "@/lib/canvas/store";

/**
 * 可删除的连线：hover / 选中 时在中点显示 ✕。
 *
 * - 默认走 React Flow 内置的 select+Delete/Backspace 删除（无障碍 + 键盘党）。
 * - 这个 ✕ 是给鼠标用户的"显式入口"，hover 才出，避免画面过乱。
 */
export function DeletableEdge(props: EdgeProps) {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style,
    markerEnd,
    selected,
  } = props;

  const setEdges = useCanvasStore((s) => s.setEdges);
  const onRemove = useCallback(() => {
    setEdges((edges) => edges.filter((e) => e.id !== id));
  }, [id, setEdges]);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={style}
        // 让 group/.deletable-edge:hover 能命中整条 path
        className="deletable-edge"
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: "all",
          }}
          className={`canvas-edge-delete ${selected ? "is-selected" : ""}`}
        >
          <button
            type="button"
            aria-label="删除连线"
            title="删除连线（也可选中后按 Delete）"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="nodrag flex size-7 items-center justify-center rounded-full border border-white/20 bg-black/85 text-white/80 shadow-md hover:border-red-400/60 hover:bg-red-500/30 hover:text-red-200"
          >
            <X className="size-4" />
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
