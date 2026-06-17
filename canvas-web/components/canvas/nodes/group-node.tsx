"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Handle,
  NodeResizer,
  Position,
  useReactFlow,
  type NodeProps,
} from "@xyflow/react";
import { useViewportTransformActive } from "@/lib/canvas/use-viewport-transform-active";
import {
  Film,
  LayoutGrid,
  LayoutTemplate,
  Palette,
  Trash2,
  GripVertical,
  Users,
} from "lucide-react";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { useCanvasStore } from "@/lib/canvas/store";
import {
  PRO2_IMAGE_LEFT_ADD_MENU,
  PRO2_RIGHT_ADD_MENU,
} from "@/lib/canvas/pro2-add-node-menu";
import { handlePro2GroupSidePick } from "@/lib/canvas/pro2-group-side-spawn";
import { SBV1_GROUP_RIGHT_ADD_MENU } from "@/lib/canvas/sbv1-add-node-menu";
import { isSbv1MediaGroup } from "@/lib/canvas/sbv1-media-group-meta";
import { handleSbv1GroupSidePick } from "@/lib/canvas/sbv1-spawn-nodes";
import { relayoutPro2MediaGroup, PRO2_MEDIA_GROUP_LAYOUT_VERSION } from "@/lib/canvas/pro2-media-group-layout";
import {
  isPro2MediaChildNode,
  isPro2StyledGroup,
  pro2MediaGroupBorderColor,
} from "@/lib/canvas/pro2-media-group-meta";
import {
  PRO2_MEDIA_GROUP_BG,
  PRO2_MEDIA_GROUP_DOT_GRID,
  PRO2_MEDIA_GROUP_DOT_SIZE,
  PRO2_MEDIA_GROUP_SHELL_CLASS,
  PRO2_NODE_HANDLE_CLASS,
  PRO2_NODE_RESIZER_COLOR,
  PRO2_NODE_RESIZER_HANDLE,
  PRO2_NODE_RESIZER_LINE,
} from "@/lib/canvas/story-pro2-node-chrome";
import { LIBTV_CARD_DRAG_CLASS } from "@/lib/canvas/libtv-node-chrome";
import { SBV1_NODE_HANDLE_CLASS, SBV1_VIDEO_COMPOSE_LABEL } from "@/lib/canvas/sbv1-node-chrome";
import {
  GROUP_COLOR_PRESETS,
  type GroupNodeData,
  type Pro2MediaGroupKind,
} from "@/lib/canvas/types";
import { RF_NODE_DRAG_HANDLE } from "@/lib/canvas/react-flow-classes";
import { cn } from "@/lib/utils";
import {
  CanvasPillToolbar,
  CanvasToolIcon,
  CanvasToolbarBadge,
} from "../canvas-floating-toolbar";
import { Pro2NodeSidePlus } from "../pro2/pro2-node-side-plus";
const TOOLBAR_GAP = 8;

function pro2MediaGroupIcon(kind?: Pro2MediaGroupKind) {
  if (kind === "frame-board") return Film;
  if (kind === "character-board") return Users;
  return Film;
}
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
  const setNodes = useCanvasStore((s) => s.setNodes);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const addNode = useCanvasStore((s) => s.addNode);
  const addNodeInGroup = useCanvasStore((s) => s.addNodeInGroup);
  const edges = useCanvasStore((s) => s.edges);
  const ungroup = useCanvasStore((s) => s.ungroup);
  const autoLayoutNodes = useCanvasStore((s) => s.autoLayoutNodes);
  const reflowStoryTemplateGroups = useCanvasStore(
    (s) => s.reflowStoryTemplateGroups,
  );
  const allNodes = useCanvasStore((s) => s.nodes);
  const { flowToScreenPosition, getInternalNode } = useReactFlow();
  const viewportMoving = useCanvasStore((s) => s.canvasViewportMoving);

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
  const color = d.color || GROUP_COLOR_PRESETS[2];
  const selfNode = useMemo(
    () => allNodes.find((n) => n.id === id),
    [allNodes, id],
  );
  const isPro2MediaGroup = selfNode
    ? isPro2StyledGroup(selfNode, allNodes)
    : Boolean(d.pro2Kind);
  const isSbv1Group = selfNode
    ? isSbv1MediaGroup(selfNode, allNodes)
    : Boolean(d.sbv1Styled);
  const isLibtvMediaGroup = isPro2MediaGroup || isSbv1Group;
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

  const showToolbar =
    !isPro2MediaGroup &&
    !isSbv1Group &&
    (selected || editOpen || pointerInside);
  const showPro2GroupSidePlus = isPro2MediaGroup && selected;
  const showSbv1GroupSidePlus = isSbv1Group && !isPro2MediaGroup && selected;

  const viewport = useViewportTransformActive(
    showToolbar || editOpen || selected || pointerInside,
  );

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

  // 旧媒体组迁移：仅 layout 版本落后时重排一次（禁止每次 mount 覆盖用户坐标）
  const relayoutDoneRef = useRef(false);
  const hasMediaChildren = useMemo(
    () =>
      allNodes.some(
        (n) =>
          n.parentId === id &&
          (isPro2MediaChildNode(n) || n.type === "sbv1-image"),
      ),
    [allNodes, id],
  );
  useEffect(() => {
    if (!hasMediaChildren) return;
    if (isSbv1Group) return;
    if (relayoutDoneRef.current) return;
    const version = (d as { pro2LayoutVersion?: number }).pro2LayoutVersion;
    if (version === PRO2_MEDIA_GROUP_LAYOUT_VERSION) {
      relayoutDoneRef.current = true;
      return;
    }
    relayoutDoneRef.current = true;
    relayoutPro2MediaGroup(setNodes, id);
    updateNodeData(id, {
      pro2LayoutVersion: PRO2_MEDIA_GROUP_LAYOUT_VERSION,
    });
  }, [hasMediaChildren, isSbv1Group, id, setNodes, updateNodeData, d]);

  useEffect(() => {
    if (viewportMoving) return;
    updateScreenPos();
  }, [updateScreenPos, viewport.x, viewport.y, viewport.zoom, selected, allNodes, viewportMoving]);

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

  const Pro2GroupIcon = pro2MediaGroupIcon(d.pro2Kind);
  const GroupHeaderIcon =
    isSbv1Group && !isPro2MediaGroup ? LayoutGrid : Pro2GroupIcon;
  const groupHeaderLabel =
    isSbv1Group && !isPro2MediaGroup
      ? d.label?.trim() || "参考图组"
      : d.label?.trim() || "媒体组";

  const selectMediaGroup = useCallback(() => {
    setNodes((prev) => prev.map((n) => ({ ...n, selected: n.id === id })));
  }, [id, setNodes]);

  const onGroupSidePick = useCallback(
    (side: "left" | "right") => (itemId: string, nodeType?: string) => {
      void handlePro2GroupSidePick(
        id,
        side,
        itemId,
        nodeType,
        dialogs.alert,
        { nodes: allNodes, addNode, setNodes, setEdges },
      );
    },
    [id, allNodes, addNode, setNodes, setEdges, dialogs.alert],
  );

  const onSbv1GroupSidePick = useCallback(
    (_side: "left" | "right") => (itemId: string, nodeType?: string) => {
      void handleSbv1GroupSidePick(
        id,
        itemId,
        nodeType,
        dialogs.alert,
        {
          nodes: allNodes,
          edges,
          addNode,
          addNodeInGroup,
          setNodes,
          setEdges,
        },
      );
    },
    [id, allNodes, edges, addNode, addNodeInGroup, setNodes, setEdges, dialogs.alert],
  );

  return (
    <div
      className={cn(
        "canvas-group-node group/gn relative h-full w-full overflow-visible",
        isLibtvMediaGroup
          ? cn(PRO2_MEDIA_GROUP_SHELL_CLASS, LIBTV_CARD_DRAG_CLASS)
          : "rounded-[20px]",
      )}
      data-pro2-media-group={isLibtvMediaGroup ? id : undefined}
      style={
        isLibtvMediaGroup
          ? {
              backgroundColor: PRO2_MEDIA_GROUP_BG,
              backgroundImage: PRO2_MEDIA_GROUP_DOT_GRID,
              backgroundSize: PRO2_MEDIA_GROUP_DOT_SIZE,
              border: `1px solid ${pro2MediaGroupBorderColor(color, selected)}`,
            }
          : {
              background: "transparent",
              border: `2px ${selected ? "solid" : "dashed"} ${color}`,
              boxShadow: selected ? `0 0 0 2px ${color}33` : "none",
            }
      }
    >
      {isPro2MediaGroup ? (
        <>
          <Handle
            id="in_text"
            type="target"
            position={Position.Left}
            className={cn(
              PRO2_NODE_HANDLE_CLASS,
              showPro2GroupSidePlus
                ? "pointer-events-none opacity-0"
                : selected
                  ? "opacity-100"
                  : "opacity-0 pointer-events-none",
            )}
            style={{ top: "50%" }}
          />
          {showPro2GroupSidePlus ? (
            <>
              <Pro2NodeSidePlus
                side="left"
                handleId="plus_left"
                visible
                className="z-[100] -left-5"
                sections={PRO2_IMAGE_LEFT_ADD_MENU}
                onPick={onGroupSidePick("left")}
              />
              <Pro2NodeSidePlus
                side="right"
                handleId="out_media"
                visible
                className="z-[100] -right-5"
                sections={PRO2_RIGHT_ADD_MENU}
                onPick={onGroupSidePick("right")}
              />
            </>
          ) : null}
        </>
      ) : null}

      {isSbv1Group && !isPro2MediaGroup ? (
        <>
          <Handle
            id="out_media"
            type="source"
            position={Position.Right}
            className={cn(
              SBV1_NODE_HANDLE_CLASS,
              showSbv1GroupSidePlus
                ? "pointer-events-none opacity-0"
                : selected
                  ? "opacity-100"
                  : "pointer-events-none opacity-0",
            )}
            style={{ top: "50%" }}
            title={`连线到${SBV1_VIDEO_COMPOSE_LABEL}`}
          />
          {showSbv1GroupSidePlus ? (
            <Pro2NodeSidePlus
              side="right"
              handleId="out_media"
              visible
              className="z-[100] -right-5"
              sections={SBV1_GROUP_RIGHT_ADD_MENU}
              onPick={onSbv1GroupSidePick("right")}
            />
          ) : null}
        </>
      ) : null}

      <NodeResizer
        color={isLibtvMediaGroup ? PRO2_NODE_RESIZER_COLOR : color}
        minWidth={220}
        minHeight={140}
        isVisible={selected}
        lineStyle={
          isLibtvMediaGroup
            ? PRO2_NODE_RESIZER_LINE
            : { borderColor: color }
        }
        handleStyle={
          isLibtvMediaGroup
            ? PRO2_NODE_RESIZER_HANDLE
            : { background: color, border: "none", width: 8, height: 8 }
        }
      />

      {isLibtvMediaGroup ? (
        <div className="relative z-10 flex h-8 shrink-0 items-center gap-1 px-2 pt-2">
          {/* 整卡可拖：标题栏不加 nodrag，单击仍选中、按住可整组拖动 */}
          <div
            role="button"
            tabIndex={0}
            className={cn(
              LIBTV_CARD_DRAG_CLASS,
              "flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 py-0.5 text-left text-[11px] text-white/55 transition hover:bg-white/6 hover:text-white/75",
            )}
            onClick={(e) => {
              e.stopPropagation();
              selectMediaGroup();
            }}
          >
            <GroupHeaderIcon className="size-3.5 shrink-0 text-white/40" />
            <span className="truncate font-medium tracking-wide">
              {groupHeaderLabel}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex h-8 items-center gap-1 rounded-t-[14px] px-2 pt-1 text-[12px] font-medium text-white">
          <div
            className={`${RF_NODE_DRAG_HANDLE} flex shrink-0 cursor-grab items-center active:cursor-grabbing`}
            title="拖动移动分组"
          >
            <GripVertical className="size-3.5 text-white/35" aria-hidden />
          </div>
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
      )}

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
