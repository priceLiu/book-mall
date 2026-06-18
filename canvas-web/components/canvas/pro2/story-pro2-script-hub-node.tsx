"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useDelayedPointerHover } from "@/lib/canvas/use-delayed-pointer-hover";
import { handlePro2SideAddNodePick } from "@/lib/canvas/pro2-add-node-pick";
import {
  resolveLibtvSideSpawnNodeType,
  spawnLibtvNeighborFromAnchor,
} from "@/lib/canvas/libtv-side-spawn";
import { PRO2_RIGHT_ADD_MENU, PRO2_STARTER_LEFT_ADD_MENU } from "@/lib/canvas/pro2-add-node-menu";
import type { NodeProps } from "@xyflow/react";
import {
  AlignLeft,
  FileText,
  GripVertical,
  Loader2,
  Play,
  User,
} from "lucide-react";
import { Handle, Position } from "@xyflow/react";

import { useDialogs } from "@/components/dialogs/dialog-provider";
import { LibtvMediaGeneratingState } from "../libtv-media-generating-state";
import { useCanvasStore } from "@/lib/canvas/store";
import { PRO2_SCRIPT_HUB_NODE_LABEL } from "@/lib/canvas/story-pro2-node-chrome";
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
  pro2HubHasOutlineContent,
  pro2HubHasSceneTable,
  pro2HubHasScriptTable,
  pro2HubIsGenerating,
  pro2HubIsLinkedOutline,
  resolvePro2HubCharacterMd,
  resolvePro2HubSceneMd,
} from "@/lib/canvas/pro2-script-hub-helpers";
import {
  pro2ScriptHubLinkedMessage,
  pro2ThinNodeIsLinked,
  resolveLibtvThinNodeDisplayState,
} from "@/lib/canvas/pro2-thin-node-display-state";
import type { Pro2ScriptHubViewTab } from "@/lib/canvas/pro2-script-hub-view-types";
import { resolveHubStoryboardMd } from "@/lib/canvas/story-hub-runtime";
import { resolvePro2HubTableTitle } from "@/lib/canvas/pro2-hub-display-title";
import { resolveStarterForHub } from "@/lib/canvas/story-workspace-resolver";
import type { StoryProScriptHubNodeData } from "@/lib/canvas/story-pro-workspace-types";
import {
  LIBTV_CARD_DRAG_CLASS,
  LIBTV_NODE_OUTER_CLASS,
} from "@/lib/canvas/libtv-node-chrome";
import { cn } from "@/lib/utils";
import { Pro2NodeResizer } from "./pro2-node-resizer";
import { Pro2NodeSidePlus } from "./pro2-node-side-plus";
import { Pro2ScriptHubToolbar } from "./pro2-script-hub-toolbar";
import { Pro2ScriptHubContentPreview } from "./pro2-script-hub-content-preview";
import {
  Pro2CharacterThreeViewPicker,
  type Pro2CharacterThreeViewResult,
} from "./pro2-character-three-view-picker";
import { generatePro2CharacterThreeViewFromHub } from "@/lib/canvas/pro2-script-hub-toolbar-actions";
import { resolvePro2ThreeViewBatchImageForHub } from "@/lib/canvas/pro2-three-view-batch-image";
import { useUserProviders } from "@/lib/canvas/use-user-providers";

const TRY_ACTIONS = [
  { id: "script", label: "剧本生成分镜脚本", icon: FileText },
  { id: "video-ref", label: "视频参考生成分镜脚本", icon: Play },
  { id: "character", label: "角色生成分镜脚本", icon: User },
] as const;

function pro2HubThreeViewStore() {
  const state = useCanvasStore.getState();
  return {
    nodes: state.nodes,
    edges: state.edges,
    addNode: (
      type:
        | "story-pro2-character"
        | "story-pro2-frame"
        | "story-pro2-image"
        | "story-pro2-three-view"
        | "group",
      position: { x: number; y: number },
      data: Record<string, unknown>,
    ) => state.addNode(type, position, data),
    addNodeInGroup: (
      type: "story-pro2-image" | "story-pro2-three-view",
      groupId: string,
      relativePosition: { x: number; y: number },
      data: Record<string, unknown>,
    ) => state.addNodeInGroup(type, groupId, relativePosition, data),
    createGroupContaining: (
      childIds: string[],
      opts: { label: string; color: string },
    ) => state.createGroupContaining(childIds, opts),
    setEdges: state.setEdges,
    updateNodeData: state.updateNodeData,
    setNodes: state.setNodes,
  };
}

export function StoryPro2ScriptHubNode({ id, data, selected }: NodeProps) {
  const { alert } = useDialogs();
  const { providers } = useUserProviders();
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const addNode = useCanvasStore((s) => s.addNode);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const openTableEditor = useCanvasStore((s) => s.openPro2ScriptTableEditor);
  const [tvPickerOpen, setTvPickerOpen] = useState(false);

  const d = data as unknown as StoryProScriptHubNodeData;
  const storyboardMd = resolveHubStoryboardMd(d);
  const characterMd = resolvePro2HubCharacterMd(d);
  const sceneCtx = useMemo(
    () => ({ nodes, edges, hubId: id }),
    [nodes, edges, id],
  );
  const sceneMd = resolvePro2HubSceneMd(d, sceneCtx);
  const outlineMd = d.outlineMd ?? "";
  const hasTable = pro2HubHasScriptTable(d);
  const hasCharacter = pro2HubHasCharacterTable(d);
  const hasScene = pro2HubHasSceneTable(d, sceneCtx);
  const hasOutline = pro2HubHasOutlineContent(d);
  const hasPreviewContent = hasTable || hasCharacter || hasScene || hasOutline;
  const [previewTab, setPreviewTab] = useState<Pro2ScriptHubViewTab>("script");

  useEffect(() => {
    if (previewTab === "script" && !hasTable && hasCharacter) {
      setPreviewTab("character");
    } else if (previewTab === "character" && !hasCharacter && hasTable) {
      setPreviewTab("script");
    } else if (previewTab === "scene" && !hasScene && (hasTable || hasCharacter)) {
      setPreviewTab(hasTable ? "script" : "character");
    } else if (
      previewTab === "outline" &&
      !hasOutline &&
      (hasTable || hasCharacter || hasScene)
    ) {
      setPreviewTab(
        hasTable ? "script" : hasCharacter ? "character" : "scene",
      );
    } else if (
      !hasTable &&
      !hasCharacter &&
      !hasScene &&
      hasOutline &&
      previewTab !== "outline"
    ) {
      setPreviewTab("outline");
    }
  }, [hasTable, hasCharacter, hasScene, hasOutline, previewTab]);

  const isGenerating = pro2HubIsGenerating({
    id,
    data: d,
    type: "story-pro2-script-hub",
    position: { x: 0, y: 0 },
  } as never);
  const outlineLinked = pro2HubIsLinkedOutline(nodes, edges, id, d);
  const isLinked = pro2ThinNodeIsLinked(id, edges);
  const displayState = resolveLibtvThinNodeDisplayState({
    hasGeneratedContent: hasPreviewContent,
    isGenerating,
    isLinked,
  });
  const linkedMessage = pro2ScriptHubLinkedMessage({
    edges,
    nodes,
    hubId: id,
    hasOutlineLink: Boolean(outlineLinked?.outlineMd?.trim()),
  });
  const tableTitle = useMemo(() => {
    const starter = resolveStarterForHub(nodes, edges, id);
    return resolvePro2HubTableTitle(starter, d.outlineMd ?? "");
  }, [nodes, edges, id, d.outlineMd]);
  const connectingFromNodeId = useCanvasStore((s) => s.connectingFromNodeId);
  const { hovered: sideHover, onPointerEnter, onPointerLeave } = useDelayedPointerHover();
  const showToolbar = Boolean(selected && hasTable && !isGenerating);
  const showThinTitle = displayState !== "generated" || isGenerating;
  const previewTitle =
    displayState === "generated" && !isGenerating ? tableTitle : undefined;
  const showSidePlus = Boolean(
    (sideHover || selected || connectingFromNodeId) &&
      (hasPreviewContent || isLinked) &&
      !isGenerating,
  );

  const onGenerateThreeView = useCallback(async () => {
    if (isGenerating) return;
    if (!hasCharacter) {
      await alert({
        title: "请先生成角色设定",
        message:
          "在底部输入坞发送生成专业版分镜脚本（含角色表）后，再生成角色三视图。",
        variant: "warning",
      });
      return;
    }
    setTvPickerOpen(true);
  }, [isGenerating, hasCharacter, alert]);

  const runThreeViewGenerate = useCallback(
    (result: Pro2CharacterThreeViewResult) => {
      generatePro2CharacterThreeViewFromHub(
        id,
        d,
        providers,
        pro2HubThreeViewStore,
        result.characterKeys,
        result.batchImage,
      );
    },
    [id, d, providers],
  );

  const onSidePick = useCallback(
    (side: "left" | "right") => (itemId: string, nodeType?: string) => {
      // 右侧 + 「三视图」与顶部工具栏「生成角色三视图」对齐：基于角色表生成三视图
      if (itemId === "three-view" || nodeType === "story-pro2-three-view") {
        void onGenerateThreeView();
        return;
      }
      void handlePro2SideAddNodePick(
        itemId,
        nodeType,
        { alert },
        () => {
          const spawnType = resolveLibtvSideSpawnNodeType(itemId, nodeType);
          if (!spawnType) return;
          spawnLibtvNeighborFromAnchor(id, side, spawnType, {
            nodes,
            addNode,
            setNodes,
            setEdges,
          });
        },
      );
    },
    [id, nodes, addNode, setNodes, setEdges, alert, onGenerateThreeView],
  );

  const openEditor = useCallback(() => {
    if (!hasPreviewContent) return;
    openTableEditor(id, previewTab);
  }, [hasPreviewContent, id, openTableEditor, previewTab]);

  return (
    <div
      className={cn(LIBTV_NODE_OUTER_CLASS, LIBTV_CARD_DRAG_CLASS)}
      data-pro2-dock-anchor={id}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
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

      {showThinTitle ? (
        <div className={cn(PRO2_TEXT_NODE_TITLE_CLASS, "mb-1.5 shrink-0")}>
          <GripVertical className="size-3.5 shrink-0 text-white/30" />
          <FileText className="size-3.5 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{PRO2_SCRIPT_HUB_NODE_LABEL}</span>
        </div>
      ) : null}

      <div className="relative min-h-0 flex-1 overflow-visible">
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
          "relative flex h-full min-h-0 flex-col overflow-hidden",
        )}
        style={{ borderColor: pro2NodeBorderColor(!!selected) }}
      >
        {isGenerating ? (
          <LibtvMediaGeneratingState label="文案生成中…" variant="violet" />
        ) : displayState === "generated" ? (
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
              sceneMd={sceneMd}
              storyboardMd={storyboardMd}
              outlineMd={outlineMd}
              title={previewTitle}
              tab={previewTab}
              onTabChange={setPreviewTab}
              onExpand={openEditor}
            />
          </div>
        ) : displayState === "connected" ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-[11px] text-white/45">
            <AlignLeft className="size-8 text-white/20" />
            <p>{linkedMessage.title}</p>
            <p className="text-[10px] text-white/35">{linkedMessage.hint}</p>
          </div>
        ) : (
          <div className="flex h-full min-h-0 flex-col overflow-y-auto px-3 pb-3 pt-2">
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
        )}
      </div>
      </div>

      <Pro2CharacterThreeViewPicker
        open={tvPickerOpen}
        characterMd={characterMd}
        initialBatchImage={resolvePro2ThreeViewBatchImageForHub(id, nodes, edges)}
        onClose={() => setTvPickerOpen(false)}
        onConfirm={runThreeViewGenerate}
      />
    </div>
  );
}
