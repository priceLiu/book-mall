"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { handlePro2SideAddNodePick } from "@/lib/canvas/pro2-add-node-pick";
import { PRO2_RIGHT_ADD_MENU, PRO2_STARTER_LEFT_ADD_MENU } from "@/lib/canvas/pro2-add-node-menu";
import {
  buildPro2ImageNodeData,
  buildPro2StarterNodeData,
  spawnPro2ScriptHubAt,
} from "@/lib/canvas/pro2-spawn-nodes";
import { selectPro2NodeAfterSpawn } from "@/lib/canvas/pro2-spawn-select";
import type { NodeProps } from "@xyflow/react";
import {
  AlignLeft,
  FileText,
  GripVertical,
  Loader2,
  Play,
  User,
  Video,
} from "lucide-react";
import { Handle, Position } from "@xyflow/react";

import { useDialogs } from "@/components/dialogs/dialog-provider";
import { useCanvasStore } from "@/lib/canvas/store";
import { PRO2_SCRIPT_NODE_WIDTH } from "@/lib/canvas/story-pro2-node-chrome";
import {
  PRO2_CARD_SHELL_CLASS,
  PRO2_NODE_HANDLE_CLASS,
  PRO2_SCRIPT_NODE_MIN_HEIGHT,
  PRO2_SCRIPT_NODE_MIN_WIDTH,
  PRO2_TEXT_NODE_TITLE_CLASS,
  pro2NodeBorderColor,
} from "@/lib/canvas/story-pro2-node-chrome";
import {
  pro2HubHasCharacterTable,
  pro2HubHasScriptTable,
  pro2HubIsGenerating,
  pro2HubIsLinkedOutline,
  resolvePro2HubCharacterMd,
} from "@/lib/canvas/pro2-script-hub-helpers";
import type { Pro2ScriptHubViewTab } from "@/lib/canvas/pro2-script-hub-view-types";
import { resolveHubStoryboardMd } from "@/lib/canvas/story-hub-runtime";
import { resolvePro2HubTableTitle } from "@/lib/canvas/pro2-hub-display-title";
import { resolveStarterForHub } from "@/lib/canvas/story-workspace-resolver";
import type { StoryProScriptHubNodeData } from "@/lib/canvas/story-pro-workspace-types";
import { RF_NODE_DRAG_HANDLE } from "@/lib/canvas/react-flow-classes";
import { cn } from "@/lib/utils";
import { Pro2NodeResizer } from "./pro2-node-resizer";
import { Pro2NodeSidePlus } from "./pro2-node-side-plus";
import { Pro2ScriptHubToolbar } from "./pro2-script-hub-toolbar";
import { Pro2ScriptHubContentPreview } from "./pro2-script-hub-content-preview";

const TRY_ACTIONS = [
  { id: "script", label: "剧本生成分镜脚本", icon: FileText },
  { id: "video-ref", label: "视频参考生成分镜脚本", icon: Play },
  { id: "character", label: "角色生成分镜脚本", icon: User },
] as const;

export function StoryPro2ScriptHubNode({ id, data, selected }: NodeProps) {
  const { alert } = useDialogs();
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const addNode = useCanvasStore((s) => s.addNode);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const openTableEditor = useCanvasStore((s) => s.openPro2ScriptTableEditor);

  const d = data as unknown as StoryProScriptHubNodeData;
  const storyboardMd = resolveHubStoryboardMd(d);
  const characterMd = resolvePro2HubCharacterMd(d);
  const hasTable = pro2HubHasScriptTable(d);
  const hasCharacter = pro2HubHasCharacterTable(d);
  const hasPreviewContent = hasTable || hasCharacter;
  const [previewTab, setPreviewTab] = useState<Pro2ScriptHubViewTab>("script");

  useEffect(() => {
    if (previewTab === "script" && !hasTable && hasCharacter) {
      setPreviewTab("character");
    } else if (previewTab === "character" && !hasCharacter && hasTable) {
      setPreviewTab("script");
    }
  }, [hasTable, hasCharacter, previewTab]);

  const isGenerating = pro2HubIsGenerating({
    id,
    data: d,
    type: "story-pro2-script-hub",
    position: { x: 0, y: 0 },
  } as never);
  const linked = pro2HubIsLinkedOutline(nodes, edges, id, d);
  const showTryMenu = !hasTable && !isGenerating && !linked;
  const showToolbar = Boolean(selected && hasTable && !isGenerating);
  const showSidePlus = Boolean(
    selected && (hasPreviewContent || linked) && !isGenerating,
  );

  const spawnNeighbor = useCallback(
    (side: "left" | "right", nodeType?: string) => {
      if (!nodeType) return;
      const self = nodes.find((n) => n.id === id);
      if (!self) return;
      const gap = 48;
      const w = self.width ?? PRO2_SCRIPT_NODE_WIDTH;
      const x =
        side === "left"
          ? self.position.x - w - gap
          : self.position.x + w + gap;
      const y = self.position.y;

      if (nodeType === "story-pro2-starter") {
        const newId = addNode("story-pro2-starter", { x, y }, buildPro2StarterNodeData());
        if (!newId) return;
        const edge =
          side === "left"
            ? {
                id: `e-${newId}-${id}`,
                source: newId,
                target: id,
                sourceHandle: "text",
                targetHandle: "in_text",
              }
            : {
                id: `e-${id}-${newId}`,
                source: id,
                target: newId,
                sourceHandle: "text",
                targetHandle: "in_text",
              };
        setEdges((prev) => [...prev, edge]);
        selectPro2NodeAfterSpawn(setNodes, newId);
        return;
      }

      if (nodeType === "story-pro2-image") {
        const newId = addNode("story-pro2-image", { x, y }, buildPro2ImageNodeData());
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

      if (nodeType === "story-pro2-script-hub") {
        const newId = spawnPro2ScriptHubAt(addNode, { x, y });
        if (!newId) return;
        const edge =
          side === "left"
            ? {
                id: `e-${newId}-${id}`,
                source: newId,
                target: id,
                sourceHandle: "text",
                targetHandle: "in_text",
              }
            : {
                id: `e-${id}-${newId}`,
                source: id,
                target: newId,
                sourceHandle: "text",
                targetHandle: "in_text",
              };
        setEdges((prev) => [...prev, edge]);
        selectPro2NodeAfterSpawn(setNodes, newId);
      }
    },
    [nodes, id, addNode, setNodes, setEdges],
  );

  const onSidePick = useCallback(
    (side: "left" | "right") => (itemId: string, nodeType?: string) => {
      void handlePro2SideAddNodePick(
        itemId,
        nodeType,
        { alert },
        () => {
          if (itemId === "text" || nodeType === "story-pro2-starter") {
            spawnNeighbor(side, "story-pro2-starter");
            return;
          }
          if (itemId === "image" || nodeType === "story-pro2-image") {
            spawnNeighbor(side, "story-pro2-image");
            return;
          }
          if (itemId === "script" || nodeType === "story-pro2-script-hub") {
            spawnNeighbor(side, "story-pro2-script-hub");
          }
        },
      );
    },
    [spawnNeighbor, alert],
  );

  const tableTitle = useMemo(() => {
    const starter = resolveStarterForHub(nodes, edges, id);
    return resolvePro2HubTableTitle(starter, d.outlineMd ?? "");
  }, [nodes, edges, id, d.outlineMd]);

  const openEditor = useCallback(() => {
    if (!hasPreviewContent) return;
    openTableEditor(id, previewTab);
  }, [hasPreviewContent, id, openTableEditor, previewTab]);

  return (
    <div
      className="relative flex h-full w-full min-h-0 min-w-0 cursor-grab flex-col active:cursor-grabbing"
      data-pro2-dock-anchor={id}
    >
      <Pro2NodeResizer
        isVisible={!!selected}
        minWidth={PRO2_SCRIPT_NODE_MIN_WIDTH}
        minHeight={PRO2_SCRIPT_NODE_MIN_HEIGHT}
      />

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
              : "opacity-0 pointer-events-none",
        )}
      />
      <Handle
        id="text"
        type="source"
        position={Position.Right}
        className={cn(
          PRO2_NODE_HANDLE_CLASS,
          showSidePlus ? "pointer-events-none opacity-0" : selected ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
      />

      {showSidePlus ? (
        <>
          <Pro2NodeSidePlus
            side="left"
            handleId="plus_left"
            visible
            sections={PRO2_STARTER_LEFT_ADD_MENU}
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

      {!hasPreviewContent ? (
        <div
          className={cn(RF_NODE_DRAG_HANDLE, PRO2_TEXT_NODE_TITLE_CLASS, "mb-1.5")}
          title="拖动标题栏移动节点"
        >
          <GripVertical className="size-3.5 shrink-0 text-white/30" />
          <FileText className="size-3.5 shrink-0" />
          <span className="min-w-0 flex-1 truncate">脚本生成器</span>
        </div>
      ) : null}

      <div className="relative min-h-0 flex-1">
        {showToolbar ? (
          <Pro2ScriptHubToolbar
            className="-top-[4.25rem]"
            hubId={id}
            hubData={d}
            tableTitle={tableTitle}
          />
        ) : null}

      <div
        className={cn(
          PRO2_CARD_SHELL_CLASS,
          "flex h-full min-h-0 flex-col overflow-hidden",
        )}
        style={{ borderColor: pro2NodeBorderColor(!!selected) }}
      >
        {isGenerating ? (
          <div className="nodrag flex h-full flex-col items-center justify-center gap-2 px-3 text-[12px] text-violet-200/70">
            <Loader2 className="size-5 animate-spin" />
            生成中…
          </div>
        ) : hasPreviewContent ? (
          <div
            className="flex h-full min-h-0 flex-col px-2 py-2"
            title="双击放大编辑"
            onDoubleClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              openEditor();
            }}
          >
            <Pro2ScriptHubContentPreview
              className="h-full min-h-0"
              characterMd={characterMd}
              storyboardMd={storyboardMd}
              title={tableTitle}
              tab={previewTab}
              onTabChange={setPreviewTab}
              onExpand={openEditor}
            />
          </div>
        ) : linked ? (
          <div className="nodrag flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-[11px] text-white/45">
            <AlignLeft className="size-8 text-white/20" />
            <p>已链接故事大纲</p>
            <p className="text-[10px] text-white/35">
              在下方输入框补充剧情或参考图后发送
            </p>
          </div>
        ) : showTryMenu ? (
          <div className="nodrag flex h-full min-h-0 flex-col overflow-y-auto px-3 pb-3 pt-2">
            <div className="mb-3 flex justify-center pt-1">
              <AlignLeft className="size-8 text-white/20" />
            </div>
            <p className="mb-2 text-[11px] text-white/45">尝试：</p>
            <ul className="space-y-0.5">
              {TRY_ACTIONS.map((action) => {
                const Icon = action.icon;
                return (
                  <li key={action.id}>
                    <span className="flex items-center gap-2 rounded-md px-1 py-1.5 text-[12px] text-white/55">
                      <Icon className="size-4 shrink-0" />
                      {action.label}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-center text-[10px] text-white/30">
              从文本节点右侧 + 连接脚本以自动链接大纲
            </p>
          </div>
        ) : (
          <div className="nodrag flex h-full items-center justify-center px-3 text-[11px] text-white/40">
            <Video className="mr-1.5 size-4 opacity-40" />
            等待输入
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
