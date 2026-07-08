"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Play,
  Upload,
  User,
} from "lucide-react";
import { Handle, Position } from "@xyflow/react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { LibtvMediaGeneratingState } from "../libtv-media-generating-state";
import { LibtvNodeToolbarPortal } from "../libtv-node-toolbar-portal";
import { useLibtvNodeDuplicate } from "../libtv-node-header-bar";
import { Pro2CrewTaskStatusBadge } from "./pro2-crew-task-status-badge";
import { Pro2ThinNodeToolbar } from "./pro2-thin-node-toolbar";
import {
  LIBTV_NODE_STAGE_DRAG_CLASS,
  LibtvTryActionRow,
} from "../libtv-thin-node-try-row";
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
  LIBTV_NODE_SIDE_PLUS_LAYER_CLASS,
  LIBTV_NODE_SIDE_PLUS_SIZE,
  libtvNodeBorderStyle,
} from "@/lib/canvas/libtv-node-chrome";
import { ingestPro2HubScriptFile } from "@/lib/canvas/pro2-hub-script-upload";
import { STORY_PRO_UPLOAD_SCRIPT_ACCEPT } from "@/lib/canvas/story-pro-upload-script";
import { cn } from "@/lib/utils";
import { Pro2NodeResizer } from "./pro2-node-resizer";
import { Pro2NodeResizeGrip } from "./pro2-node-resize-grip";
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
import { useLibtvIsNodeSoleSelected } from "@/lib/canvas/libtv-floating-dock-selection";
import { useCanvasMarqueeSelecting } from "@/lib/canvas/use-canvas-marquee-selecting";

type HubTryActionId = "upload-script" | "video-ref" | "character";

const TRY_ACTIONS: Array<{
  id: HubTryActionId;
  label: string;
  icon: typeof Upload;
}> = [
  { id: "upload-script", label: "上传剧本生成分镜脚本", icon: Upload },
  { id: "video-ref", label: "视频参考生成分镜脚本", icon: Play },
  { id: "character", label: "角色生成分镜脚本", icon: User },
];

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
  const base = useBookMallBaseUrl();
  const { alert } = useDialogs();
  const { providers } = useUserProviders();
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const addNode = useCanvasStore((s) => s.addNode);
  const addNodeInGroup = useCanvasStore((s) => s.addNodeInGroup);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const openTableEditor = useCanvasStore((s) => s.openPro2ScriptTableEditor);
  const [tvPickerOpen, setTvPickerOpen] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const scriptUploadRef = useRef<HTMLInputElement>(null);

  const d = data as unknown as StoryProScriptHubNodeData;
  const onDuplicateNode = useLibtvNodeDuplicate(id, "story-pro2-script-hub");
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
  const { hovered, onPointerEnter, onPointerLeave } = useDelayedPointerHover();
  const marqueeSelecting = useCanvasMarqueeSelecting();
  const soleSelected = useLibtvIsNodeSoleSelected(id, Boolean(selected));
  const scriptTableEditorOpen = useCanvasStore(
    (s) => s.pro2ScriptTableEditorNodeId === id,
  );
  const showToolbar = Boolean(
    soleSelected && hasPreviewContent && !isGenerating && !scriptTableEditorOpen,
  );
  const showThinTitle = displayState !== "generated" || isGenerating;
  const previewTitle =
    displayState === "generated" && !isGenerating ? tableTitle : undefined;
  const showSidePlus = Boolean(
    !marqueeSelecting &&
      (hovered || soleSelected || connectingFromNodeId) &&
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
            edges,
            addNode,
            addNodeInGroup,
            setNodes,
            setEdges,
          });
        },
      );
    },
    [id, nodes, edges, addNode, addNodeInGroup, setNodes, setEdges, alert, onGenerateThreeView],
  );

  const openEditor = useCallback(() => {
    if (!hasPreviewContent) return;
    openTableEditor(id, previewTab);
  }, [hasPreviewContent, id, openTableEditor, previewTab]);

  const onTryUploadScript = useCallback(() => {
    if (isGenerating || uploadBusy) return;
    scriptUploadRef.current?.click();
  }, [isGenerating, uploadBusy]);

  const onScriptFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file || isGenerating) return;
      setUploadBusy(true);
      try {
        await ingestPro2HubScriptFile(
          id,
          file,
          base,
          { nodes, edges, updateNodeData },
          { alert },
        );
      } finally {
        setUploadBusy(false);
      }
    },
    [id, base, nodes, edges, updateNodeData, alert, isGenerating],
  );

  const onTryAction = useCallback(
    (actionId: HubTryActionId) => {
      if (actionId === "upload-script") {
        onTryUploadScript();
        return;
      }
      void alert({
        title: "即将推出",
        message:
          actionId === "video-ref"
            ? "视频参考生成分镜脚本正在开发中，请稍后再试。"
            : "角色生成分镜脚本正在开发中，请稍后再试。",
        variant: "info",
      });
    },
    [onTryUploadScript, alert],
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
        minWidth={PRO2_SCRIPT_NODE_MIN_WIDTH}
        minHeight={PRO2_SCRIPT_NODE_MIN_HEIGHT}
      />
      {selected ? <Pro2NodeResizeGrip /> : null}

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
        id="plus_left"
        type="source"
        position={Position.Left}
        className={cn(PRO2_NODE_HANDLE_CLASS, "pointer-events-none opacity-0")}
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

      {soleSelected && !showToolbar ? (
        <Pro2ThinNodeToolbar style={{ top: -60 }} onDuplicateNode={onDuplicateNode} />
      ) : null}

      {showThinTitle ? (
        <div className={cn(PRO2_TEXT_NODE_TITLE_CLASS, "relative mb-1.5 shrink-0")}>
          <GripVertical className="size-3.5 shrink-0 text-white/30" />
          <FileText className="size-3.5 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{PRO2_SCRIPT_HUB_NODE_LABEL}</span>
          <Pro2CrewTaskStatusBadge nodeId={id} />
        </div>
      ) : null}

      {showToolbar ? (
        <LibtvNodeToolbarPortal nodeId={id} visible={showToolbar}>
          <Pro2ScriptHubToolbar
            hubId={id}
            hubData={d}
            tableTitle={tableTitle}
            onDuplicateNode={onDuplicateNode}
          />
        </LibtvNodeToolbarPortal>
      ) : null}

      <div className="relative min-h-0 flex-1 overflow-visible">
      <div
        className={cn(
          PRO2_CARD_SHELL_CLASS,
          LIBTV_CARD_DRAG_CLASS,
          "relative flex h-full min-h-0 flex-col overflow-hidden",
        )}
        style={
          libtvNodeBorderStyle({
            selected: !!selected,
            hovered: hovered && !selected,
            edition: "neutral",
          }) ?? { borderColor: pro2NodeBorderColor(!!selected) }
        }
      >
        {isGenerating ? (
          <LibtvMediaGeneratingState variant="violet" />
        ) : displayState === "generated" ? (
          <div
            className={cn(
              LIBTV_NODE_STAGE_DRAG_CLASS,
              "flex h-full min-h-0 flex-col px-2 py-2",
            )}
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
          <div
            className={cn(
              LIBTV_NODE_STAGE_DRAG_CLASS,
              "flex flex-col items-center justify-center gap-2 px-4 text-center text-[11px] text-white/45",
            )}
          >
            <AlignLeft className="size-8 text-white/20" />
            <p>{linkedMessage.title}</p>
            <p className="text-[10px] text-white/35">{linkedMessage.hint}</p>
          </div>
        ) : (
          <div
            className={cn(
              LIBTV_NODE_STAGE_DRAG_CLASS,
              "flex flex-col overflow-y-auto px-3 pb-3 pt-2",
            )}
          >
            <div className="mb-3 flex justify-center pt-1">
              <AlignLeft className="size-8 text-white/20" />
            </div>
            <p className="mb-2 text-[11px] text-white/45">尝试：</p>
            <ul className="space-y-0.5">
              {TRY_ACTIONS.map((action) => (
                <li key={action.id}>
                  <LibtvTryActionRow
                    icon={action.icon}
                    label={action.label}
                    disabled={
                      isGenerating ||
                      (action.id === "upload-script" && uploadBusy)
                    }
                    onClick={() => onTryAction(action.id)}
                  />
                </li>
              ))}
            </ul>
            <div className="mt-3 space-y-1 text-center text-[10px] leading-relaxed text-white/30">
              <p>一句话生成剧本：在下方 Dock 输入剧情后发送</p>
              <p>上传剧本生成分镜脚本：点击上方按钮选择 .md / .txt 文件</p>
              <p className="pt-1 text-white/25">
                完成剧本后在节点顶栏发布，即可在公告条参与制作任务
              </p>
            </div>
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

      <input
        ref={scriptUploadRef}
        type="file"
        accept={STORY_PRO_UPLOAD_SCRIPT_ACCEPT}
        className="hidden"
        onChange={(e) => void onScriptFileChange(e)}
      />
    </div>
  );
}
