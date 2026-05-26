"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { NodeResizer, useReactFlow, useViewport, type NodeProps } from "@xyflow/react";
import { LayoutGrid, LayoutTemplate, Palette, Trash2 } from "lucide-react";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { useCanvasStore } from "@/lib/canvas/store";
import {
  GROUP_COLOR_PRESETS,
  type GroupNodeData,
} from "@/lib/canvas/types";
import {
  CanvasPillToolbar,
  CanvasToolIcon,
  CanvasToolbarBadge,
} from "../canvas-floating-toolbar";

const TOOLBAR_GAP = 8;
/** 分组顶边以上仍算作「在分组上」，便于移向悬浮工具条 */
const TOOLBAR_HIT_TOP = 64;
/** 改色面板大致高度，用于扩大可 hover 区域 */
const EDIT_PANEL_HIT_HEIGHT = 280;
const HIDE_DELAY_MS = 160;

type ScreenRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

function pointInRect(x: number, y: number, r: ScreenRect) {
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}

/** 组容器节点：透明背景、彩色边框；hover 时在顶部边框出现屏幕固定胶囊工具条（不随画布缩放变小） */
export function GroupNode({ id, data, selected }: NodeProps) {
  const dialogs = useDialogs();
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const ungroup = useCanvasStore((s) => s.ungroup);
  const autoLayoutNodes = useCanvasStore((s) => s.autoLayoutNodes);
  const reflowStoryTemplateGroups = useCanvasStore(
    (s) => s.reflowStoryTemplateGroups,
  );
  const allNodes = useCanvasStore((s) => s.nodes);
  const { flowToScreenPosition, getInternalNode } = useReactFlow();
  const viewport = useViewport();

  const [editOpen, setEditOpen] = useState(false);
  const [pointerInside, setPointerInside] = useState(false);
  const [screenPos, setScreenPos] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [mounted, setMounted] = useState(false);
  const hideTimerRef = useRef<number | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const editPanelRef = useRef<HTMLDivElement | null>(null);

  const d = data as unknown as GroupNodeData;
  const color = d.color || GROUP_COLOR_PRESETS[0];
  const isStoryTemplateGroup =
    id === "sc-group-characters" ||
    id === "sc-group-media" ||
    id === "sc-group-frames" ||
    id === "sc-group-videos";

  const childrenIds = useMemo(
    () =>
      allNodes
        .filter((n) => n.parentId === id && n.type !== "group")
        .map((n) => n.id),
    [allNodes, id],
  );

  const showToolbar = selected || editOpen || pointerInside;

  const getGroupScreenRect = useCallback((): ScreenRect | null => {
    const internal = getInternalNode(id) as
      | {
          measured?: { width?: number; height?: number };
          position: { x: number; y: number };
          internals?: { positionAbsolute?: { x: number; y: number } };
          width?: number;
          height?: number;
        }
      | undefined;
    if (!internal) return null;

    const w =
      internal.measured?.width ??
      (typeof internal.width === "number" ? internal.width : 360);
    const h =
      internal.measured?.height ??
      (typeof internal.height === "number" ? internal.height : 240);
    const pos = internal.internals?.positionAbsolute ?? internal.position;

    const tl = flowToScreenPosition({ x: pos.x, y: pos.y });
    const br = flowToScreenPosition({ x: pos.x + w, y: pos.y + h });
    return {
      left: Math.min(tl.x, br.x),
      top: Math.min(tl.y, br.y) - TOOLBAR_HIT_TOP,
      right: Math.max(tl.x, br.x),
      bottom: Math.max(tl.y, br.y),
    };
  }, [flowToScreenPosition, getInternalNode, id]);

  const updateScreenPos = useCallback(() => {
    const rect = getGroupScreenRect();
    if (!rect) return;
    const cx = (rect.left + rect.right) / 2;
    const top = rect.top + TOOLBAR_HIT_TOP;
    setScreenPos({ x: cx, y: top });
  }, [getGroupScreenRect]);

  const pointerNearGroupUi = useCallback(
    (clientX: number, clientY: number) => {
      const groupRect = getGroupScreenRect();
      if (groupRect && pointInRect(clientX, clientY, groupRect)) return true;

      const toolbarEl = toolbarRef.current;
      if (toolbarEl) {
        const r = toolbarEl.getBoundingClientRect();
        if (
          pointInRect(clientX, clientY, {
            left: r.left - 8,
            top: r.top - 8,
            right: r.right + 8,
            bottom: r.bottom + 8,
          })
        ) {
          return true;
        }
      }

      if (editOpen && editPanelRef.current) {
        const r = editPanelRef.current.getBoundingClientRect();
        if (
          pointInRect(clientX, clientY, {
            left: r.left - 8,
            top: r.top - 8,
            right: r.right + 8,
            bottom: r.bottom + 8,
          })
        ) {
          return true;
        }
      }

      if (editOpen && screenPos) {
        const panelRect: ScreenRect = {
          left: screenPos.x - 140,
          top: screenPos.y,
          right: screenPos.x + 140,
          bottom: screenPos.y + EDIT_PANEL_HIT_HEIGHT,
        };
        if (pointInRect(clientX, clientY, panelRect)) return true;
      }

      return false;
    },
    [editOpen, getGroupScreenRect, screenPos],
  );

  const scheduleHide = useCallback(() => {
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => {
      setPointerInside(false);
      hideTimerRef.current = null;
    }, HIDE_DELAY_MS);
  }, []);

  const cancelHide = useCallback(() => {
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    return () => {
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    };
  }, []);

  useEffect(() => {
    updateScreenPos();
  }, [updateScreenPos, viewport.x, viewport.y, viewport.zoom, selected, allNodes]);

  useEffect(() => {
    if (selected || editOpen) {
      cancelHide();
      setPointerInside(true);
    }
  }, [selected, editOpen, cancelHide]);

  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      updateScreenPos();
      if (selected || editOpen) {
        cancelHide();
        setPointerInside(true);
        return;
      }
      if (pointerNearGroupUi(e.clientX, e.clientY)) {
        cancelHide();
        setPointerInside(true);
      } else {
        scheduleHide();
      }
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => window.removeEventListener("pointermove", onPointerMove);
  }, [
    selected,
    editOpen,
    updateScreenPos,
    pointerNearGroupUi,
    cancelHide,
    scheduleHide,
  ]);

  return (
    <div
      className="canvas-group-node group/gn relative h-full w-full rounded-2xl"
      style={{
        background: "transparent",
        border: `2px ${selected ? "solid" : "dashed"} ${color}`,
        boxShadow: selected ? `0 0 0 2px ${color}33` : "none",
      }}
    >
      <NodeResizer
        color={color}
        minWidth={220}
        minHeight={140}
        isVisible={selected}
        lineStyle={{ borderColor: color }}
        handleStyle={{ background: color, border: "none", width: 8, height: 8 }}
      />

      <div className="flex h-8 items-center gap-2 rounded-t-[14px] px-3 pt-1 text-[12px] font-medium text-white">
        <span
          aria-hidden
          className="size-2.5 shrink-0 rounded-full"
          style={{ background: color }}
        />
        <input
          value={d.label ?? ""}
          onChange={(e) => updateNodeData(id, { label: e.target.value })}
          placeholder="未命名分组"
          className="nodrag min-w-0 flex-1 bg-transparent text-white/95 outline-none placeholder:text-white/40"
          spellCheck={false}
        />
      </div>

      {mounted && showToolbar && screenPos
        ? createPortal(
            <>
              <div
                ref={toolbarRef}
                className="pointer-events-auto fixed z-40"
                style={{
                  left: screenPos.x,
                  top: screenPos.y - TOOLBAR_GAP,
                  transform: "translate(-50%, -100%)",
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <CanvasPillToolbar
                  badge={
                    <CanvasToolbarBadge>组内 {childrenIds.length}</CanvasToolbarBadge>
                  }
                >
                  <CanvasToolIcon
                    label="改色"
                    hint="改颜色 / 改名"
                    active={editOpen}
                    onClick={() => setEditOpen((v) => !v)}
                  >
                    <Palette className="size-[18px]" strokeWidth={1.75} />
                  </CanvasToolIcon>
                  <CanvasToolIcon
                    label="整理"
                    hint={`按拓扑顺序整理本组 ${childrenIds.length} 个子节点`}
                    disabled={childrenIds.length < 2}
                    onClick={() => autoLayoutNodes(childrenIds)}
                  >
                    <LayoutGrid className="size-[18px]" strokeWidth={1.75} />
                  </CanvasToolIcon>
                  {isStoryTemplateGroup ? (
                    <CanvasToolIcon
                      label="修复"
                      hint="收拢散落节点并重排（组内为 0 时也可用）"
                      onClick={() => reflowStoryTemplateGroups()}
                    >
                      <LayoutTemplate className="size-[18px]" strokeWidth={1.75} />
                    </CanvasToolIcon>
                  ) : null}
                  <CanvasToolIcon
                    label="解散"
                    hint="保留子节点、移除分组容器"
                    danger
                    onClick={() => ungroup(id)}
                  >
                    <Trash2 className="size-[18px]" strokeWidth={1.75} />
                  </CanvasToolIcon>
                </CanvasPillToolbar>
              </div>

              {editOpen ? (
                <div
                  ref={editPanelRef}
                  className="nodrag pointer-events-auto fixed z-40 w-[240px] rounded-2xl border border-white/15 bg-black/90 p-3 shadow-2xl backdrop-blur-md"
                  style={{
                    left: screenPos.x,
                    top: screenPos.y + 6,
                    transform: "translateX(-50%)",
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <div className="mb-2 flex items-center justify-between text-[11px] font-medium">
                    <span className="text-white/70">分组颜色与名称</span>
                    <span
                      className="rounded-full px-2 py-0.5 text-white/85"
                      style={{ background: `${color}33` }}
                    >
                      {d.label?.trim() || "未命名"}
                    </span>
                  </div>
                  <div className="mb-2 flex gap-2">
                    {GROUP_COLOR_PRESETS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-label={`选择颜色 ${c}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          updateNodeData(id, { color: c });
                        }}
                        className="size-6 rounded-full transition"
                        style={{
                          background: c,
                          outline:
                            color === c
                              ? `2px solid ${c}`
                              : "1px solid rgba(255,255,255,0.18)",
                          boxShadow: color === c ? `0 0 0 3px ${c}55` : "none",
                        }}
                      />
                    ))}
                  </div>
                  <input
                    value={d.label ?? ""}
                    onChange={(e) => updateNodeData(id, { label: e.target.value })}
                    placeholder="未命名分组"
                    className="nodrag mb-2 w-full rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-[12px] text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setEditOpen(false)}
                      className="rounded-md px-3 py-1 text-[12px] text-white/70 hover:bg-white/10"
                    >
                      完成
                    </button>
                  </div>
                </div>
              ) : null}
            </>,
            document.body,
          )
        : null}
    </div>
  );
}
