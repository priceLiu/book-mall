"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Handle,
  NodeResizer,
  Position,
  useReactFlow,
  type NodeProps,
} from "@xyflow/react";
import {
  Film,
  GripVertical,
  LayoutGrid,
  MapPin,
  Users,
  Video,
} from "lucide-react";
import { useCanvasStore } from "@/lib/canvas/store";
import { useCanvasReadonly } from "@/lib/canvas/canvas-readonly-context";
import {
  isPro2StyledGroup,
  pro2MediaGroupBackgroundColor,
  pro2MediaGroupBorderColor,
} from "@/lib/canvas/pro2-media-group-meta";
import { isSbv1MediaGroup } from "@/lib/canvas/sbv1-media-group-meta";
import {
  PRO2_MEDIA_GROUP_BORDER_WIDTH,
  PRO2_MEDIA_GROUP_EXTERNAL_TITLE_CLASS,
  PRO2_MEDIA_GROUP_EXTERNAL_TITLE_OFFSET_PX,
  PRO2_MEDIA_GROUP_SHELL_CLASS,
  PRO2_MEDIA_NODE_TITLE_CLASS,
  PRO2_NODE_HANDLE_CLASS,
  PRO2_NODE_RESIZER_COLOR,
  PRO2_NODE_RESIZER_HANDLE,
  PRO2_NODE_RESIZER_LINE,
} from "@/lib/canvas/story-pro2-node-chrome";
import {
  LIBTV_CARD_DRAG_CLASS,
  LIBTV_NODE_SIDE_PLUS_LAYER_CLASS,
  LIBTV_NODE_SIDE_PLUS_SIZE,
} from "@/lib/canvas/libtv-node-chrome";
import { Pro2NodeSidePlus } from "../pro2/pro2-node-side-plus";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { handlePro2GroupSidePick } from "@/lib/canvas/pro2-group-side-spawn";
import {
  PRO2_IMAGE_LEFT_ADD_MENU,
  PRO2_RIGHT_ADD_MENU,
} from "@/lib/canvas/pro2-add-node-menu";
import {
  SBV1_GROUP_RIGHT_ADD_MENU,
  SBV1_IMAGE_LEFT_ADD_MENU,
} from "@/lib/canvas/sbv1-add-node-menu";
import { handleSbv1GroupSidePick } from "@/lib/canvas/sbv1-spawn-nodes";
import { SBV1_NODE_HANDLE_CLASS, SBV1_VIDEO_COMPOSE_LABEL } from "@/lib/canvas/sbv1-node-chrome";
import {
  GROUP_COLOR_PRESETS,
  type GroupNodeData,
  type Pro2MediaGroupKind,
} from "@/lib/canvas/types";
import { RF_NODE_DRAG_HANDLE } from "@/lib/canvas/react-flow-classes";
import { cn } from "@/lib/utils";

function pro2MediaGroupIcon(kind?: Pro2MediaGroupKind) {
  if (kind === "frame-board") return Film;
  if (kind === "video-board") return Video;
  if (kind === "character-board") return Users;
  if (kind === "scene-board") return MapPin;
  return Film;
}

/** 组容器节点：不透明底色、彩色边框；顶部工具条由 Pro2MediaGroupToolbar 统一渲染（Pro2 + sbv1） */
export function GroupNode({ id, data, selected }: NodeProps) {
  const readonly = useCanvasReadonly();
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const addNode = useCanvasStore((s) => s.addNode);
  const addNodeInGroup = useCanvasStore((s) => s.addNodeInGroup);
  const connectingFromNodeId = useCanvasStore((s) => s.connectingFromNodeId);
  const canvasDraggingNodeId = useCanvasStore((s) => s.canvasDraggingNodeId);
  const { alert } = useDialogs();
  const { setNodes: rfSetNodes } = useReactFlow();

  const [pointerOverGroup, setPointerOverGroup] = useState(false);

  const d = data as unknown as GroupNodeData;
  const color = d.color || GROUP_COLOR_PRESETS[2];
  const storeNodes = useCanvasStore((s) => (readonly ? [] : s.nodes));
  const storeEdges = useCanvasStore((s) => (readonly ? [] : s.edges));
  const selfNode = useMemo(
    () => storeNodes.find((n) => n.id === id),
    [storeNodes, id],
  );
  const isPro2MediaGroup = Boolean(d.pro2Kind);
  const isSbv1Group = Boolean(
    selfNode && isSbv1MediaGroup(selfNode, storeNodes),
  );
  const isStoryTemplateGroup =
    id === "sc-group-characters" ||
    id === "sc-group-media" ||
    id === "sc-group-frames" ||
    id === "sc-group-videos";
  const isLibtvMediaGroup =
    !isStoryTemplateGroup &&
    (isSbv1Group ||
      Boolean(selfNode && isPro2StyledGroup(selfNode, storeNodes)));
  // LibTV 媒体组：拖动中绿框自由跟手（只留很小的绝对下限），松手时再按
  // 单边内容边界撑回（见 flow-canvas 提交逻辑），避免整体最小尺寸造成的拉扯。
  const resizeMin = isLibtvMediaGroup
    ? { minWidth: 40, minHeight: 40 }
    : { minWidth: 220, minHeight: 140 };
  const groupVisualHovered = pointerOverGroup || selected;
  const draggingChildInGroup = useMemo(() => {
    if (!canvasDraggingNodeId) return false;
    const dragging = storeNodes.find((n) => n.id === canvasDraggingNodeId);
    return dragging?.parentId === id;
  }, [canvasDraggingNodeId, storeNodes, id]);
  const groupBackgroundEmphasis =
    selected || groupVisualHovered || draggingChildInGroup;
  const showSidePlus = Boolean(
    isLibtvMediaGroup &&
      (selected || groupVisualHovered || connectingFromNodeId),
  );
  const groupBorderWidth =
    selected || groupVisualHovered
      ? PRO2_MEDIA_GROUP_BORDER_WIDTH + 1
      : PRO2_MEDIA_GROUP_BORDER_WIDTH;
  const groupBorderColor = pro2MediaGroupBorderColor(
    color,
    selected,
    groupVisualHovered && !selected,
  );
  const unifiedGroupShellStyle = {
    backgroundColor: pro2MediaGroupBackgroundColor(color, groupBackgroundEmphasis),
    border: `${groupBorderWidth}px solid ${groupBorderColor}`,
    transition: "border-width 120ms ease, border-color 120ms ease",
  } as const;

  const Pro2GroupIcon = pro2MediaGroupIcon(d.pro2Kind);
  const GroupHeaderIcon =
    isSbv1Group && !isPro2MediaGroup ? LayoutGrid : Pro2GroupIcon;
  const groupHeaderLabel =
    isSbv1Group && !isPro2MediaGroup
      ? d.label?.trim() || "参考图组"
      : d.label?.trim() || "未命名分组";

  const selectMediaGroup = useCallback(() => {
    rfSetNodes((prev) =>
      prev.map((n) => ({ ...n, selected: n.id === id })),
    );
  }, [id, rfSetNodes]);

  const groupSpawnStore = useMemo(
    () => ({
      nodes: storeNodes,
      edges: storeEdges,
      addNode,
      addNodeInGroup,
      setNodes,
      setEdges,
    }),
    [storeNodes, storeEdges, addNode, addNodeInGroup, setNodes, setEdges],
  );

  const onGroupSidePick = useCallback(
    (side: "left" | "right") => (itemId: string, nodeType?: string) => {
      void (isSbv1Group && !isPro2MediaGroup
        ? handleSbv1GroupSidePick(
            id,
            side,
            itemId,
            nodeType,
            alert,
            groupSpawnStore,
          )
        : handlePro2GroupSidePick(
            id,
            side,
            itemId,
            nodeType,
            alert,
            groupSpawnStore,
          ));
    },
    [
      id,
      isSbv1Group,
      isPro2MediaGroup,
      alert,
      groupSpawnStore,
    ],
  );

  return (
    <div
      className={cn(
        "canvas-group-node group/gn relative h-full w-full overflow-visible",
        isLibtvMediaGroup || !isStoryTemplateGroup
          ? cn(PRO2_MEDIA_GROUP_SHELL_CLASS, LIBTV_CARD_DRAG_CLASS)
          : "rounded-[20px]",
      )}
      data-pro2-media-group={isLibtvMediaGroup ? id : undefined}
      onPointerEnter={() => {
        if (readonly) return;
        setPointerOverGroup(true);
      }}
      onPointerLeave={() => {
        if (readonly) return;
        setPointerOverGroup(false);
      }}
      style={
        isStoryTemplateGroup
          ? {
              background: "transparent",
              border: `3px ${selected ? "solid" : "dashed"} ${color}`,
              boxShadow: selected ? `0 0 0 2px ${color}33` : "none",
            }
          : unifiedGroupShellStyle
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
              showSidePlus
                ? "pointer-events-none opacity-0"
                : selected
                  ? "opacity-100"
                  : "pointer-events-none opacity-0",
            )}
            style={{ top: "50%" }}
          />
          <Handle
            id="out_media"
            type="source"
            position={Position.Right}
            className={cn(
              PRO2_NODE_HANDLE_CLASS,
              showSidePlus
                ? "pointer-events-none opacity-0"
                : selected
                  ? "opacity-100"
                  : "pointer-events-none opacity-0",
            )}
            style={{ top: "50%" }}
          />
        </>
      ) : null}

      {isSbv1Group && !isPro2MediaGroup ? (
        <Handle
          id="out_media"
          type="source"
          position={Position.Right}
          className={cn(
            SBV1_NODE_HANDLE_CLASS,
            showSidePlus
              ? "pointer-events-none opacity-0"
              : selected
                ? "opacity-100"
                : "pointer-events-none opacity-0",
          )}
          style={{ top: "50%" }}
          title={`连线到${SBV1_VIDEO_COMPOSE_LABEL}`}
        />
      ) : null}

      {isLibtvMediaGroup ? (
        <Handle
          id="plus_left"
          type="source"
          position={Position.Left}
          className={cn(
            isPro2MediaGroup ? PRO2_NODE_HANDLE_CLASS : SBV1_NODE_HANDLE_CLASS,
            "pointer-events-none opacity-0",
          )}
          style={{ top: "50%" }}
        />
      ) : null}

      {isLibtvMediaGroup ? (
        <>
          <Pro2NodeSidePlus
            side="left"
            handleId="plus_left"
            visible={showSidePlus}
            size={LIBTV_NODE_SIDE_PLUS_SIZE}
            className={LIBTV_NODE_SIDE_PLUS_LAYER_CLASS}
            sections={
              isSbv1Group && !isPro2MediaGroup
                ? SBV1_IMAGE_LEFT_ADD_MENU
                : PRO2_IMAGE_LEFT_ADD_MENU
            }
            onPick={onGroupSidePick("left")}
          />
          <Pro2NodeSidePlus
            side="right"
            handleId="out_media"
            visible={showSidePlus}
            size={LIBTV_NODE_SIDE_PLUS_SIZE}
            className={LIBTV_NODE_SIDE_PLUS_LAYER_CLASS}
            sections={
              isSbv1Group && !isPro2MediaGroup
                ? SBV1_GROUP_RIGHT_ADD_MENU
                : PRO2_RIGHT_ADD_MENU
            }
            onPick={onGroupSidePick("right")}
          />
        </>
      ) : null}

      <NodeResizer
        color={PRO2_NODE_RESIZER_COLOR}
        minWidth={resizeMin.minWidth}
        minHeight={resizeMin.minHeight}
        isVisible={!readonly && selected}
        lineStyle={PRO2_NODE_RESIZER_LINE}
        handleClassName="canvas-group-resizer-handle"
        handleStyle={PRO2_NODE_RESIZER_HANDLE}
      />

      {!isStoryTemplateGroup ? (
        <div
          className={cn(
            PRO2_MEDIA_GROUP_EXTERNAL_TITLE_CLASS,
            isLibtvMediaGroup && LIBTV_CARD_DRAG_CLASS,
          )}
          style={{ top: -PRO2_MEDIA_GROUP_EXTERNAL_TITLE_OFFSET_PX }}
          onClick={(e) => {
            e.stopPropagation();
            if (isLibtvMediaGroup) selectMediaGroup();
          }}
        >
          {isLibtvMediaGroup ? (
            <GroupHeaderIcon className="size-3.5 shrink-0 text-white/35" />
          ) : (
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={{ background: color }}
            />
          )}
          {isLibtvMediaGroup || readonly ? (
            <span
              className={cn(
                PRO2_MEDIA_NODE_TITLE_CLASS,
                "mb-0 px-0",
                isLibtvMediaGroup &&
                  "cursor-pointer transition hover:text-white/90",
              )}
            >
              {groupHeaderLabel}
            </span>
          ) : (
            <input
              value={d.label ?? ""}
              onChange={(e) => updateNodeData(id, { label: e.target.value })}
              placeholder="未命名分组"
              className="nodrag min-w-0 flex-1 bg-transparent text-[11px] text-white outline-none placeholder:text-white/35"
              spellCheck={false}
            />
          )}
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
    </div>
  );
}
