"use client";

import { useCallback, useMemo } from "react";
import type { NodeProps } from "@xyflow/react";
import { AlignLeft, GripVertical, MessageSquareText } from "lucide-react";
import { Handle, Position } from "@xyflow/react";

import { useCanvasStore } from "@/lib/canvas/store";
import {
  PRO2_CARD_SHELL_CLASS,
  pro2NodeBorderColor,
  PRO2_NODE_HANDLE_CLASS,
  PRO2_TEXT_NODE_MIN_HEIGHT,
  PRO2_TEXT_NODE_MIN_WIDTH,
  PRO2_TEXT_NODE_TITLE_CLASS,
} from "@/lib/canvas/story-pro2-node-chrome";
import {
  LIBTV_CARD_DRAG_CLASS,
  LIBTV_NODE_OUTER_CLASS,
  LIBTV_NODE_SIDE_PLUS_LAYER_CLASS,
  LIBTV_NODE_SIDE_PLUS_SIZE,
  libtvNodeBorderStyle,
} from "@/lib/canvas/libtv-node-chrome";
import {
  pro2ThinNodeIsLinked,
  resolveLibtvThinNodeDisplayState,
  isPro2StarterTextGenerating,
} from "@/lib/canvas/pro2-thin-node-display-state";
import { formatCanvasTaskError } from "@/lib/canvas/friendly-task-error";
import { PRO2_RIGHT_ADD_MENU, PRO2_STARTER_LEFT_ADD_MENU } from "@/lib/canvas/pro2-add-node-menu";
import type { StoryPro2PromptNodeData } from "@/lib/canvas/story-pro2-workspace-types";
import { handlePro2SideAddNodePick } from "@/lib/canvas/pro2-add-node-pick";
import {
  resolveLibtvSideSpawnNodeType,
  spawnLibtvNeighborFromAnchor,
} from "@/lib/canvas/libtv-side-spawn";
import { useDelayedPointerHover } from "@/lib/canvas/use-delayed-pointer-hover";
import { useLibtvIsNodeSoleSelected } from "@/lib/canvas/libtv-floating-dock-selection";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { cn } from "@/lib/utils";
import { Pro2NodeScrollArea } from "./pro2-node-scroll-area";
import { Pro2NodeResizer } from "./pro2-node-resizer";
import { Pro2NodeResizeGrip } from "./pro2-node-resize-grip";
import { Pro2NodeSidePlus } from "./pro2-node-side-plus";
import { Pro2NodeErrorBanner } from "./pro2-node-error-banner";
import { LibtvEditableNodeTitle } from "../libtv-editable-node-title";
import { LibtvMediaGeneratingState } from "../libtv-media-generating-state";
import { LIBTV_PLAIN_TEXT_WRAP_CLASS } from "@/lib/canvas/libtv-plain-text-display";
import { LIBTV_NODE_STAGE_DRAG_CLASS } from "../libtv-thin-node-try-row";

function pro2PromptHasContent(data: StoryPro2PromptNodeData): boolean {
  return Boolean(data.generatedText?.trim() || data.prompt?.trim());
}

export function StoryPro2PromptNode({ id, data, selected }: NodeProps) {
  const { alert } = useDialogs();
  const { hovered, onPointerEnter, onPointerLeave } = useDelayedPointerHover();
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const addNode = useCanvasStore((s) => s.addNode);
  const addNodeInGroup = useCanvasStore((s) => s.addNodeInGroup);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);

  const d = data as unknown as StoryPro2PromptNodeData;
  const displayText = d.generatedText?.trim() || d.prompt?.trim() || "";
  const hasContent = pro2PromptHasContent(d);
  const isGenerating = isPro2StarterTextGenerating(d);
  const errorMessage =
    d.themeOutlineRuntime?.status === "error"
      ? formatCanvasTaskError(
          d.themeOutlineRuntime.failCode,
          d.themeOutlineRuntime.failMessage,
          d.modelKey,
        )
      : null;
  const isLinked = pro2ThinNodeIsLinked(id, edges);
  const displayState = resolveLibtvThinNodeDisplayState({
    hasGeneratedContent: hasContent,
    isGenerating,
    isLinked,
  });
  const connectingFromNodeId = useCanvasStore((s) => s.connectingFromNodeId);
  const showSidePlus = Boolean(
    (hovered || selected || connectingFromNodeId) && !isGenerating,
  );
  const soleSelected = useLibtvIsNodeSoleSelected(id, Boolean(selected));

  const nodeLabel = useMemo(() => {
    const custom = d.label?.trim();
    if (custom) return custom;
    const prompts = nodes.filter((n) => n.type === "story-pro2-prompt");
    const idx = prompts.findIndex((n) => n.id === id);
    return `提示词 ${idx >= 0 ? idx + 1 : ""}`.trim();
  }, [nodes, id, d.label]);

  const dismissError = useCallback(() => {
    const rt = d.themeOutlineRuntime;
    if (!rt?.taskId) {
      updateNodeData(id, {
        themeOutlineRuntime: {
          ...rt,
          status: "idle",
          failCode: undefined,
          failMessage: undefined,
        },
      });
      return;
    }
    updateNodeData(id, {
      themeOutlineRuntime: {
        ...rt,
        status: "idle",
        failCode: undefined,
        failMessage: undefined,
        dismissedFailTaskId: rt.taskId,
      },
    });
  }, [d.themeOutlineRuntime, id, updateNodeData]);

  const onSidePick = useCallback(
    (side: "left" | "right") => (itemId: string, nodeType?: string) => {
      void handlePro2SideAddNodePick(
        itemId,
        nodeType,
        { alert },
        (pickId, pickType) => {
          const spawnType = resolveLibtvSideSpawnNodeType(pickId, pickType);
          if (!spawnType) return;
          spawnLibtvNeighborFromAnchor(id, side, spawnType, {
            nodes: useCanvasStore.getState().nodes,
            edges: useCanvasStore.getState().edges,
            addNode,
            addNodeInGroup,
            setNodes,
            setEdges,
          });
        },
      );
    },
    [alert, id, addNode, addNodeInGroup, setNodes, setEdges],
  );

  return (
    <div
      className={cn(LIBTV_NODE_OUTER_CLASS, LIBTV_CARD_DRAG_CLASS)}
      data-pro2-dock-anchor={id}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <Pro2NodeResizer
        isVisible={!!selected}
        minWidth={PRO2_TEXT_NODE_MIN_WIDTH}
        minHeight={PRO2_TEXT_NODE_MIN_HEIGHT}
      />
      {selected ? <Pro2NodeResizeGrip /> : null}

      <Handle
        id="in_text"
        type="target"
        position={Position.Left}
        className={cn(
          PRO2_NODE_HANDLE_CLASS,
          "libtv-node-inbound-handle",
          "libtv-node-inbound-text-handle",
          "pointer-events-none !opacity-0 !border-transparent !bg-transparent",
        )}
      />

      <Pro2NodeSidePlus
        side="left"
        handleId="plus_left"
        visible={showSidePlus}
        size={LIBTV_NODE_SIDE_PLUS_SIZE}
        className={LIBTV_NODE_SIDE_PLUS_LAYER_CLASS}
        sections={PRO2_STARTER_LEFT_ADD_MENU}
        onPick={onSidePick("left")}
      />
      <Pro2NodeSidePlus
        side="right"
        handleId="text"
        visible={showSidePlus}
        size={LIBTV_NODE_SIDE_PLUS_SIZE}
        className={LIBTV_NODE_SIDE_PLUS_LAYER_CLASS}
        sections={PRO2_RIGHT_ADD_MENU}
        onPick={onSidePick("right")}
      />

      <div className={cn(PRO2_TEXT_NODE_TITLE_CLASS, "relative mb-1.5 shrink-0")}>
        <GripVertical className="size-3.5 shrink-0 text-white/30" />
        <MessageSquareText className="size-3.5 shrink-0" />
        <LibtvEditableNodeTitle
          nodeId={id}
          defaultLabel={nodeLabel}
          textClassName="text-[11px] text-white"
        />
      </div>

      <div
        className={cn(
          PRO2_CARD_SHELL_CLASS,
          LIBTV_CARD_DRAG_CLASS,
          "relative flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden",
        )}
        style={
          libtvNodeBorderStyle({
            selected: !!selected,
            hovered: hovered && !selected,
            edition: "neutral",
          }) ?? { borderColor: pro2NodeBorderColor(!!selected) }
        }
      >
        {errorMessage && !isGenerating ? (
          <Pro2NodeErrorBanner message={errorMessage} onDismiss={dismissError} />
        ) : null}
        {isGenerating ? (
          <LibtvMediaGeneratingState variant="violet" cancelNodeId={id} />
        ) : displayState === "generated" ? (
          <div
            className={cn(
              LIBTV_NODE_STAGE_DRAG_CLASS,
              "h-full min-h-0 min-w-0 w-full p-2",
            )}
          >
            <Pro2NodeScrollArea wrapContent className="h-full min-w-0 w-full pr-1">
              <div
                className={cn(
                  LIBTV_PLAIN_TEXT_WRAP_CLASS,
                  "font-sans text-[11px] leading-relaxed text-white/75",
                )}
              >
                {displayText}
              </div>
            </Pro2NodeScrollArea>
          </div>
        ) : displayState === "connected" ? (
          <div
            className={cn(
              LIBTV_NODE_STAGE_DRAG_CLASS,
              "flex flex-col items-center justify-center gap-2 px-4 text-center",
            )}
          >
            <AlignLeft className="size-8 text-white/20" />
            <p className="text-[11px] text-white/45">
              已链接上游 · 在下方 Dock 输入提示词后发送
            </p>
          </div>
        ) : (
          <div
            className={cn(
              LIBTV_NODE_STAGE_DRAG_CLASS,
              "flex flex-col items-center justify-center gap-2 px-4 text-center",
            )}
          >
            <AlignLeft className="size-8 text-white/20" />
            <p className="text-[11px] text-white/45">
              纯文本提示词节点 · 可链接任意上游，@ 引用后调用 LLM
            </p>
            {soleSelected ? (
              <p className="text-[10px] text-white/35">在下方 Dock 编写并发送</p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
