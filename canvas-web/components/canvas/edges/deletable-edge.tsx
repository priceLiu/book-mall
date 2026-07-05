"use client";

import { useCallback, useRef, useState } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react";
import { Scissors } from "lucide-react";
import { useCanvasStore } from "@/lib/canvas/store";

const HOVER_REVEAL_MS = 1000;
const HIT_STROKE_WIDTH = 36;

/**
 * 可删除连线：在连线上任意位置悬停 1s，于鼠标处显示剪刀；点击剪断。
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
  } = props;

  const setEdges = useCanvasStore((s) => s.setEdges);
  const onRemove = useCallback(() => {
    setEdges((edges) => edges.filter((e) => e.id !== id));
  }, [id, setEdges]);

  const [cutAnchor, setCutAnchor] = useState<{ x: number; y: number } | null>(
    null,
  );
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const scheduleCutAnchor = useCallback(
    (clientX: number, clientY: number) => {
      clearTimer();
      timerRef.current = setTimeout(() => {
        setCutAnchor({ x: clientX, y: clientY });
      }, HOVER_REVEAL_MS);
    },
    [clearTimer],
  );

  const onEdgePointerLeave = useCallback(() => {
    clearTimer();
    setCutAnchor(null);
  }, [clearTimer]);

  const [edgePath] = getBezierPath({
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
        className="deletable-edge"
      />
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={HIT_STROKE_WIDTH}
        pointerEvents="stroke"
        className="deletable-edge-hit nodrag nopan"
        onPointerEnter={(e) => scheduleCutAnchor(e.clientX, e.clientY)}
        onPointerMove={(e) => {
          if (cutAnchor) {
            setCutAnchor({ x: e.clientX, y: e.clientY });
            return;
          }
          scheduleCutAnchor(e.clientX, e.clientY);
        }}
        onPointerLeave={onEdgePointerLeave}
      />
      {cutAnchor ? (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "fixed",
              left: cutAnchor.x,
              top: cutAnchor.y,
              transform: "translate(-50%, -50%)",
              pointerEvents: "all",
              zIndex: 1000,
            }}
            className="canvas-edge-delete is-hover-cut"
            onPointerLeave={onEdgePointerLeave}
          >
            <button
              type="button"
              aria-label="剪断连线"
              title="剪断连线（也可选中后按 Delete）"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="nodrag flex size-7 items-center justify-center rounded-full border border-white/20 bg-black/85 text-white/80 shadow-md hover:border-red-400/60 hover:bg-red-500/30 hover:text-red-200"
            >
              <Scissors className="size-3.5" />
            </button>
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}
