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
  BookOpen,
  FileText,
  GripVertical,
  PenLine,
  Play,
  Sparkles,
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
import { LibtvEditableNodeTitle } from "../libtv-editable-node-title";
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
  pro2ScriptHubHasLinkedOutlineContent,
  resolvePro2HubCharacterMd,
  resolvePro2HubCharacterPickerRows,
  resolvePro2HubSceneMd,
} from "@/lib/canvas/pro2-script-hub-helpers";
import {
  pro2ScriptHubLinkedMessage,
  pro2ThinNodeIsLinked,
  resolveLibtvThinNodeDisplayState,
} from "@/lib/canvas/pro2-thin-node-display-state";
import type { Pro2ScriptHubViewTab } from "@/lib/canvas/pro2-script-hub-view-types";
import { resolveHubOutlineMd, resolveHubStoryboardMd, buildHubStoryboardBackfillPatch } from "@/lib/canvas/story-hub-runtime";
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
import {
  resolveHubProductionScript,
  tryRepairHubFromStoredProductionJson,
  trySyncResolvedProductionScriptToHub,
} from "@/lib/canvas/pro2-production-script-apply";
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
import {
  PRO2_SCRIPT_CATEGORY_PRESETS,
  type Pro2ScriptCategoryId,
} from "@/lib/canvas/pro2-script-category-presets";
import { applyPro2ScriptCategoryFromHub } from "@/lib/canvas/spawn-pro2-script-category-from-hub";
import {
  useObserveNodeInternalsResize,
  useScheduleUpdateNodeInternals,
} from "@/lib/canvas/use-schedule-update-node-internals";

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

const CATEGORY_ICONS: Record<Pro2ScriptCategoryId, typeof BookOpen> = {
  "gu-feng-tian-chong": BookOpen,
  "default-master": Sparkles,
  "custom-prompt": PenLine,
};

function pro2HubThreeViewStore() {
  const state = useCanvasStore.getState();
  return {
    nodes: state.nodes,
    edges: state.edges,
    addNode: state.addNode,
    addNodeInGroup: state.addNodeInGroup,
    createGroupContaining: state.createGroupContaining,
    setEdges: state.setEdges,
    updateNodeData: state.updateNodeData,
    setNodes: state.setNodes,
  };
}

export function StoryPro2ScriptHubNode({ id, data, selected }: NodeProps) {
  const scheduleUpdateNodeInternals = useScheduleUpdateNodeInternals(id);
  const outerRef = useRef<HTMLDivElement>(null);
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

  // 生成态写在 zustand；RF props 经 mergeStoreNodesIntoRf 可能晚一帧，须读 store 才能立刻扫光
  const liveHubNode = nodes.find((n) => n.id === id);
  const d = (liveHubNode?.data ?? data) as unknown as StoryProScriptHubNodeData;
  const onDuplicateNode = useLibtvNodeDuplicate(id, "story-pro2-script-hub");
  const storyboardMd = resolveHubStoryboardMd(d);
  const characterMd = resolvePro2HubCharacterMd(d);
  const sceneCtx = useMemo(
    () => ({ nodes, edges, hubId: id }),
    [nodes, edges, id],
  );
  const sceneMd = resolvePro2HubSceneMd(d, sceneCtx);
  const outlineMd = resolveHubOutlineMd(d);
  const productionScript = useMemo(() => resolveHubProductionScript(d), [d]);

  useEffect(() => {
    const storyboardPatch = buildHubStoryboardBackfillPatch(d);
    const repairPatch = tryRepairHubFromStoredProductionJson(d, id);
    const merged = { ...d, ...storyboardPatch, ...(repairPatch ?? {}) };
    const syncPatch = trySyncResolvedProductionScriptToHub(merged);
    const patch =
      storyboardPatch && Object.keys(storyboardPatch).length
        ? storyboardPatch
        : null;
    const finalPatch =
      repairPatch || syncPatch || patch
        ? {
            ...(patch ?? {}),
            ...(repairPatch ?? {}),
            ...(syncPatch ?? {}),
          }
        : null;
    if (finalPatch) updateNodeData(id, finalPatch);
  }, [
    d.outlineMd,
    d.storyboardMd,
    d.outlineRuntime?.textOutput,
    d.storyboardRuntime?.textOutput,
    id,
    updateNodeData,
  ]);
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
    hasOutlineLink: pro2ScriptHubHasLinkedOutlineContent(nodes, edges, id, d),
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
    soleSelected && hasPreviewContent && !scriptTableEditorOpen,
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

  /** 生成中保留底图（预览/连线/空态），扫光叠层，避免 unmount 闪一下 */
  const hubStageVariant = useMemo((): "preview" | "connected" | "initial" => {
    if (hasPreviewContent && (displayState === "generated" || isGenerating)) {
      return "preview";
    }
    if (displayState === "connected" || (isGenerating && isLinked)) {
      return "connected";
    }
    return "initial";
  }, [
    displayState,
    hasPreviewContent,
    isGenerating,
    isLinked,
  ]);

  useEffect(() => {
    scheduleUpdateNodeInternals(
      [
        displayState,
        showToolbar ? 1 : 0,
        showThinTitle ? 1 : 0,
        showSidePlus ? 1 : 0,
        isGenerating ? 1 : 0,
        selected ? 1 : 0,
        hasPreviewContent ? 1 : 0,
        isLinked ? 1 : 0,
        previewTab,
      ].join("|"),
    );
  }, [
    scheduleUpdateNodeInternals,
    displayState,
    showToolbar,
    showThinTitle,
    showSidePlus,
    isGenerating,
    selected,
    hasPreviewContent,
    isLinked,
    previewTab,
  ]);

  useObserveNodeInternalsResize(id, outerRef);

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
      void handlePro2SideAddNodePick(
        itemId,
        nodeType,
        { alert },
        async (pickId, pickType) => {
          const spawnType = resolveLibtvSideSpawnNodeType(pickId, pickType);
          if (!spawnType) return;
          const newId = spawnLibtvNeighborFromAnchor(id, side, spawnType, {
            nodes: useCanvasStore.getState().nodes,
            edges: useCanvasStore.getState().edges,
            addNode,
            addNodeInGroup,
            setNodes,
            setEdges,
          });
          if (!newId) {
            await alert({
              title: "无法添加节点",
              message: "当前画布未能创建该节点，请刷新后重试或检查工作流版本。",
              variant: "warning",
            });
          }
        },
      );
    },
    [id, addNode, addNodeInGroup, setNodes, setEdges, alert],
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

  const onCategoryPick = useCallback(
    (categoryId: Pro2ScriptCategoryId) => {
      if (isGenerating) return;
      const result = applyPro2ScriptCategoryFromHub(id, categoryId, {
        nodes,
        edges,
        addNode: (type, position, data) =>
          addNode(type as "story-pro2-starter", position, data),
        setEdges,
        setNodes,
        updateNodeData,
      });
      if (!result) {
        void alert({
          title: "无法应用剧本类别",
          message: "请刷新页面后重试。",
          variant: "warning",
        });
        return;
      }
      if (!result.spawnedStarter) {
        void alert({
          title: "已更新剧本类别",
          message: "已切换类别配置；上游文本节点已保留。",
          variant: "info",
        });
      }
    },
    [
      id,
      isGenerating,
      nodes,
      edges,
      addNode,
      setEdges,
      setNodes,
      updateNodeData,
      alert,
    ],
  );

  return (
    <div
      ref={outerRef}
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

      {/* 左侧入边吸附；plus_left / text 由 Pro2NodeSidePlus 提供，勿重复声明（会露出左右竖条） */}
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

      {showThinTitle ? (
        <div className={cn(PRO2_TEXT_NODE_TITLE_CLASS, "relative mb-1.5 shrink-0")}>
          <GripVertical className="size-3.5 shrink-0 text-white/30" />
          <FileText className="size-3.5 shrink-0" />
          <LibtvEditableNodeTitle
            nodeId={id}
            defaultLabel={PRO2_SCRIPT_HUB_NODE_LABEL}
            textClassName="text-[11px] text-white"
          />
          <Pro2CrewTaskStatusBadge nodeId={id} />
        </div>
      ) : null}

      {soleSelected && !scriptTableEditorOpen ? (
        <LibtvNodeToolbarPortal nodeId={id} visible={soleSelected}>
          {showToolbar ? (
            <Pro2ScriptHubToolbar
              hubId={id}
              hubData={d}
              tableTitle={tableTitle}
              onDuplicateNode={onDuplicateNode}
            />
          ) : (
            <Pro2ThinNodeToolbar onDuplicateNode={onDuplicateNode} />
          )}
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
        {hubStageVariant === "preview" ? (
          <div
            className={cn(
              LIBTV_NODE_STAGE_DRAG_CLASS,
              "flex h-full min-h-0 flex-col px-2 py-2",
              isGenerating && "pointer-events-none",
            )}
            title="双击放大编辑"
            onDoubleClick={(e) => {
              if (isGenerating) return;
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
              productionScript={productionScript}
              title={previewTitle}
              tab={previewTab}
              onTabChange={setPreviewTab}
              onExpand={openEditor}
            />
          </div>
        ) : hubStageVariant === "connected" ? (
          <div
            className={cn(
              LIBTV_NODE_STAGE_DRAG_CLASS,
              "flex flex-col items-center justify-center gap-2 px-4 text-center text-[11px] text-white/45",
              isGenerating && "pointer-events-none",
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
              isGenerating && "pointer-events-none",
            )}
          >
            <div className="mb-3 flex justify-center pt-1">
              <AlignLeft className="size-8 text-white/20" />
            </div>
            <p className="mb-2 text-[11px] text-white/45">尝试：</p>
            <div className="grid min-h-0 flex-1 grid-cols-2 gap-3">
              <div className="min-w-0">
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
              </div>
              <div className="min-w-0 border-l border-white/10 pl-3">
                <p className="mb-2 text-[11px] text-white/45">提示词模板</p>
                <ul className="space-y-0.5">
                  {PRO2_SCRIPT_CATEGORY_PRESETS.map((preset) => (
                    <li key={preset.id}>
                      <LibtvTryActionRow
                        icon={CATEGORY_ICONS[preset.id]}
                        label={preset.label}
                        disabled={isGenerating}
                        onClick={() => onCategoryPick(preset.id)}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
        {isGenerating ? (
          <LibtvMediaGeneratingState variant="violet" className="z-10" cancelNodeId={id} />
        ) : null}
      </div>
      </div>

      <Pro2CharacterThreeViewPicker
        open={tvPickerOpen}
        characterRows={resolvePro2HubCharacterPickerRows(d)}
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
