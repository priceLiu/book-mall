"use client";

import { useCallback, useMemo } from "react";
import type { NodeProps } from "@xyflow/react";
import {
  AlignLeft,
  FileText,
  GripVertical,
  ImageIcon,
  Loader2,
  Music,
  PenLine,
  Play,
} from "lucide-react";
import { Handle, Position } from "@xyflow/react";

import { useDialogs } from "@/components/dialogs/dialog-provider";
import { useDelayedPointerHover } from "@/lib/canvas/use-delayed-pointer-hover";
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
  libtvNodeBorderStyle,
} from "@/lib/canvas/libtv-node-chrome";
import {
  pro2StarterHasContent,
  pro2StarterLinkedMessage,
  pro2ThinNodeIsLinked,
  resolveLibtvThinNodeDisplayState,
} from "@/lib/canvas/pro2-thin-node-display-state";
import { formatCanvasTaskError } from "@/lib/canvas/friendly-task-error";
import {
  PRO2_RIGHT_ADD_MENU,
  PRO2_STARTER_LEFT_ADD_MENU,
} from "@/lib/canvas/pro2-add-node-menu";
import { MarkdownView } from "@/components/canvas/markdown-view";
import type { StoryPro2StarterNodeData } from "@/lib/canvas/story-pro2-workspace-types";
import { resolvePro2TextPurpose } from "@/lib/canvas/pro2-text-purpose";
import { STORY_PRO_LLM_PARAMS_DEFAULT } from "@/lib/canvas/story-pro-prompts";
import { handlePro2SideAddNodePick } from "@/lib/canvas/pro2-add-node-pick";
import {
  resolveLibtvSideSpawnNodeType,
  spawnLibtvNeighborFromAnchor,
} from "@/lib/canvas/libtv-side-spawn";
import {
  buildPro2ImageNodeData,
  buildPro2StarterNodeData,
  spawnPro2ScriptHubFromSource,
} from "@/lib/canvas/pro2-spawn-nodes";
import {
  attachPro2StarterShortcutPreset,
  type Pro2ShortcutPresetId,
} from "@/lib/canvas/pro2-spawn-shortcut-presets";
import { promoteEmbeddedPackFromOutline } from "@/lib/canvas/story-hub-runtime";
import { selectPro2NodeAfterSpawn } from "@/lib/canvas/pro2-spawn-select";
import { useSaveNodeAsAsset } from "@/lib/canvas/use-save-node-as-asset";
import { cn } from "@/lib/utils";
import { Pro2NodeScrollArea } from "./pro2-node-scroll-area";
import { Pro2ThinNodeToolbar } from "./pro2-thin-node-toolbar";
import { Pro2NodeResizer } from "./pro2-node-resizer";
import { Pro2NodeResizeGrip } from "./pro2-node-resize-grip";
import { Pro2NodeSidePlus } from "./pro2-node-side-plus";
import { Pro2NodeErrorBanner } from "./pro2-node-error-banner";
import { useLibtvNodeDuplicate } from "../libtv-node-header-bar";
import { Pro2CrewTaskStatusBadge } from "./pro2-crew-task-status-badge";
import {
  LIBTV_NODE_STAGE_DRAG_CLASS,
  LibtvTryActionRow,
} from "../libtv-thin-node-try-row";

type StarterTryAction =
  | { id: "write"; label: string; icon: typeof PenLine; kind: "write" }
  | {
      id: Pro2ShortcutPresetId;
      label: string;
      icon: typeof Play;
      kind: "preset";
    }
  | { id: "text-to-music"; label: string; icon: typeof Music; kind: "soon" };

const STARTER_TRY_ACTIONS: StarterTryAction[] = [
  { id: "write", label: "自己编写内容", icon: PenLine, kind: "write" },
  { id: "text-to-video", label: "文生视频", icon: Play, kind: "preset" },
  {
    id: "image-to-prompt",
    label: "图片反推提示词",
    icon: ImageIcon,
    kind: "preset",
  },
  { id: "text-to-music", label: "文字生音乐", icon: Music, kind: "soon" },
];

export function StoryPro2StarterNode({ id, data, selected }: NodeProps) {
  const { alert } = useDialogs();
  const { hovered, onPointerEnter, onPointerLeave } = useDelayedPointerHover();
  const nodes = useCanvasStore((s) => s.nodes);
  const addNode = useCanvasStore((s) => s.addNode);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const openOutlineEditor = useCanvasStore((s) => s.openPro2TextOutlineEditor);

  const d = data as unknown as StoryPro2StarterNodeData;
  const saveAsAsset = useSaveNodeAsAsset();
  const onDuplicateNode = useLibtvNodeDuplicate(id, "story-pro2-starter");
  const edges = useCanvasStore((s) => s.edges);
  const outlineMd = d.generatedOutlineMd?.trim() ?? "";
  const uploadedMd = d.uploadedScriptMd?.trim() ?? "";
  const hasOutline = Boolean(outlineMd);
  const hasUploadedScript = Boolean(uploadedMd);
  const hasCardContent = pro2StarterHasContent(d);
  const isStoryOutlineMode =
    resolvePro2TextPurpose(d, { nodeId: id, nodes, edges }) === "story-outline";
  const isGenerating =
    isStoryOutlineMode &&
    (d.themeOutlineRuntime?.status === "pending" ||
      d.themeOutlineRuntime?.status === "running");
  const outlineErrorMessage =
    isStoryOutlineMode && d.themeOutlineRuntime?.status === "error"
      ? formatCanvasTaskError(
          d.themeOutlineRuntime.failCode,
          d.themeOutlineRuntime.failMessage,
          d.modelKey,
        )
      : null;
  const isLinked = pro2ThinNodeIsLinked(id, edges);
  const displayState = resolveLibtvThinNodeDisplayState({
    hasGeneratedContent: hasCardContent,
    isGenerating,
    isLinked,
  });
  const linkedMessage = pro2StarterLinkedMessage(edges, nodes, id);
  const displayMd = useMemo(() => {
    if (uploadedMd) return uploadedMd;
    if (hasOutline) return outlineMd;
    return "";
  }, [uploadedMd, hasOutline, outlineMd]);

  const nodeLabel = useMemo(() => {
    const starters = nodes.filter((n) => n.type === "story-pro2-starter");
    const idx = starters.findIndex((n) => n.id === id);
    return `文本节点 ${idx >= 0 ? idx + 1 : ""}`.trim();
  }, [nodes, id]);

  const leftAddMenuSections = PRO2_STARTER_LEFT_ADD_MENU;

  const openEditor = useCallback(() => {
    if (!hasCardContent || isGenerating) return;
    openOutlineEditor(id);
  }, [hasCardContent, isGenerating, id, openOutlineEditor]);

  const dismissOutlineError = useCallback(() => {
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

  const onTryWrite = useCallback(() => {
    updateNodeData(id, { pro2TextPurpose: "general" });
    openOutlineEditor(id);
  }, [id, updateNodeData, openOutlineEditor]);

  const onTryPreset = useCallback(
    (preset: Pro2ShortcutPresetId) => {
      attachPro2StarterShortcutPreset(id, preset, nodes, {
        addNode: (type, position, nodeData) =>
          addNode(type as never, position, nodeData),
        setEdges,
        setNodes,
        updateNodeData,
      });
    },
    [id, nodes, addNode, setEdges, setNodes, updateNodeData],
  );

  const onTryAction = useCallback(
    (action: StarterTryAction) => {
      if (action.kind === "write") {
        onTryWrite();
        return;
      }
      if (action.kind === "soon") {
        void alert({
          title: "即将推出",
          message: "文字生音乐预设正在开发中，请稍后再试。",
          variant: "info",
        });
        return;
      }
      onTryPreset(action.id);
    },
    [onTryWrite, onTryPreset, alert],
  );

  const spawnNeighbor = useCallback(
    (side: "left" | "right", nodeType?: string) => {
      if (!nodeType) return;
      const self = nodes.find((n) => n.id === id);
      if (!self) return;
      const gap = 48;
      const w = self.width ?? PRO2_TEXT_NODE_MIN_WIDTH;

      if (nodeType === "story-pro2-script-hub") {
        const outline =
          d.generatedOutlineMd?.trim() ?? d.uploadedScriptMd?.trim() ?? "";
        const promoted = promoteEmbeddedPackFromOutline(outline, "", "", "");
        spawnPro2ScriptHubFromSource({
          sourceId: id,
          sourceHandle: "text",
          position: { x: self.position.x + w + gap, y: self.position.y },
          hubData: {
            outlineMd: promoted.outlineMd,
            characterMd: promoted.characterMd,
            sceneMd: promoted.sceneMd,
            storyboardMd: promoted.storyboardMd,
            providerId: d.providerId ?? "",
            modelKey: d.modelKey ?? "",
            params: { ...STORY_PRO_LLM_PARAMS_DEFAULT, ...(d.params ?? {}) },
            referencedNodeIds: outline ? [id] : [],
          },
          nodes,
          edges,
          updateNodeData,
          addNode: (type, position, nodeData) =>
            addNode(type, position, nodeData),
          setEdges,
          setNodes,
        });
        return;
      }

      if (nodeType === "story-pro2-image") {
        const x =
          side === "left"
            ? self.position.x - w - gap
            : self.position.x + w + gap;
        const newId = addNode(
          "story-pro2-image",
          { x, y: self.position.y },
          buildPro2ImageNodeData(),
        );
        if (!newId) return;
        const edge =
          side === "left"
            ? {
                id: `e-${newId}-${id}`,
                source: newId,
                target: id,
                sourceHandle: "image",
                targetHandle: "in_text",
              }
            : {
                id: `e-${id}-${newId}`,
                source: id,
                target: newId,
                sourceHandle: "text",
                targetHandle: "in_image",
              };
        setEdges((prev) => [...prev, edge]);
        selectPro2NodeAfterSpawn(setNodes, newId);
        return;
      }

      if (nodeType === "story-pro2-starter") {
        const x =
          side === "left"
            ? self.position.x - w - gap
            : self.position.x + w + gap;
        const newId = addNode(
          "story-pro2-starter",
          { x, y: self.position.y },
          buildPro2StarterNodeData({
            providerId: d.providerId ?? "",
            modelKey: d.modelKey ?? "",
            params: { ...STORY_PRO_LLM_PARAMS_DEFAULT, ...(d.params ?? {}) },
          }),
        );
        if (!newId) return;
        if (side === "left") {
          setEdges((prev) => [
            ...prev,
            {
              id: `e-${newId}-${id}`,
              source: newId,
              target: id,
              sourceHandle: "text",
              targetHandle: "in_text",
            },
          ]);
        } else {
          setEdges((prev) => [
            ...prev,
            {
              id: `e-${id}-${newId}`,
              source: id,
              target: newId,
              sourceHandle: "text",
              targetHandle: "in_text",
            },
          ]);
        }
        selectPro2NodeAfterSpawn(setNodes, newId);
      }
    },
    [
      nodes,
      edges,
      id,
      d,
      addNode,
      setEdges,
      setNodes,
      updateNodeData,
      alert,
    ],
  );

  const onSidePick = useCallback(
    (side: "left" | "right") => (itemId: string, nodeType?: string) => {
      void handlePro2SideAddNodePick(
        itemId,
        nodeType,
        { alert },
        () => {
          const spawnType = resolveLibtvSideSpawnNodeType(itemId, nodeType);
          if (
            spawnType === "story-pro2-three-view" ||
            spawnType === "sbv1-video-engine"
          ) {
            spawnLibtvNeighborFromAnchor(id, side, spawnType, {
              nodes,
              addNode,
              setNodes,
              setEdges,
            });
            return;
          }
          if (itemId === "script" || nodeType === "story-pro2-script-hub") {
            spawnNeighbor("right", "story-pro2-script-hub");
            return;
          }
          if (itemId === "text" || nodeType === "story-pro2-starter") {
            spawnNeighbor(side, "story-pro2-starter");
            return;
          }
          if (itemId === "image" || nodeType === "story-pro2-image") {
            spawnNeighbor(side, "story-pro2-image");
          }
        },
      );
    },
    [spawnNeighbor, alert],
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
          selected ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
      />
      <Handle
        id="text"
        type="source"
        position={Position.Right}
        className={cn(
          PRO2_NODE_HANDLE_CLASS,
          "pointer-events-none opacity-0",
        )}
      />

      {selected ? (
        <>
          <Pro2NodeSidePlus
            side="left"
            handleId="plus_left"
            visible
            sections={leftAddMenuSections}
            onPick={onSidePick("left")}
          />
          <Pro2NodeSidePlus
            side="right"
            handleId="text"
            visible
            sections={PRO2_RIGHT_ADD_MENU}
            onPick={onSidePick("right")}
          />
        </>
      ) : null}

      {selected ? (
        <Pro2ThinNodeToolbar
          style={{ top: -60 }}
          onSaveAsAsset={() =>
            saveAsAsset(
              id,
              "story-pro2-starter",
              d as unknown as Record<string, unknown>,
              "OUTLINE",
            )
          }
          onDuplicateNode={onDuplicateNode}
        />
      ) : null}

      <div className={cn(PRO2_TEXT_NODE_TITLE_CLASS, "relative mb-1.5 shrink-0")}>
        <GripVertical className="size-3.5 shrink-0 text-white/30" />
        <FileText className="size-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{nodeLabel}</span>
        <Pro2CrewTaskStatusBadge nodeId={id} />
      </div>

      <div
        className={cn(
          PRO2_CARD_SHELL_CLASS,
          LIBTV_CARD_DRAG_CLASS,
          "flex min-h-0 flex-1 flex-col overflow-hidden",
        )}
        style={
          libtvNodeBorderStyle({
            selected: !!selected,
            hovered: hovered && !selected,
            edition: "neutral",
          }) ?? { borderColor: pro2NodeBorderColor(!!selected) }
        }
      >
        {outlineErrorMessage && !isGenerating ? (
          <Pro2NodeErrorBanner
            message={outlineErrorMessage}
            onDismiss={dismissOutlineError}
          />
        ) : null}
        {isGenerating ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-3">
            <Loader2 className="size-5 animate-spin text-violet-200/70" />
          </div>
        ) : displayState === "generated" ? (
          <div
            className={cn(LIBTV_NODE_STAGE_DRAG_CLASS, "h-full min-h-0 p-2")}
            title={hasUploadedScript ? "已上传剧本 · 双击放大查看" : "双击放大编辑"}
            onDoubleClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              openEditor();
            }}
          >
            <Pro2NodeScrollArea className="h-full pr-1">
              {hasUploadedScript ? (
                <pre className="whitespace-pre-wrap font-sans text-[11px] leading-relaxed text-white/75">
                  {displayMd}
                </pre>
              ) : (
                <MarkdownView
                  content={displayMd}
                  variant="darkPreview"
                  className="text-[11px]"
                />
              )}
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
            <p className="text-[11px] text-white/45">{linkedMessage}</p>
          </div>
        ) : (
          <div
            className={cn(
              LIBTV_NODE_STAGE_DRAG_CLASS,
              "flex flex-col px-3 pb-3 pt-2",
            )}
          >
            <div className="mb-3 flex justify-center pt-1">
              <AlignLeft className="size-8 text-white/20" />
            </div>
            <p className="mb-2 text-[11px] text-white/45">尝试：</p>
            <ul className="space-y-0.5">
              {STARTER_TRY_ACTIONS.map((action) => (
                <li key={action.id}>
                  <LibtvTryActionRow
                    icon={action.icon}
                    label={action.label}
                    disabled={action.kind === "soon"}
                    onClick={() => onTryAction(action)}
                  />
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[10px] leading-relaxed text-white/35">
              在脚本生成器中创作并发布剧本后，可在公告条参与制作任务；本节点也可用于提示词与下游生图/生视频。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
