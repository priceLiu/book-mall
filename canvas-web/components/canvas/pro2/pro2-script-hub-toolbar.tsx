"use client";

import { useMemo, useState, useCallback } from "react";
import { Download, LayoutGrid, MapPin, Megaphone, RotateCw, Users, BookmarkPlus, Copy } from "lucide-react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { useCanvasStore } from "@/lib/canvas/store";
import { runPro2ScriptPublishFlow } from "@/lib/canvas/pro2-script-publish-flow";
import { useCrewCollaborationAccess } from "@/lib/canvas/use-crew-collaboration-access";
import {
  downloadPro2ScriptMarkdown,
  generatePro2CharacterThreeViewFromHub,
  generatePro2FrameBoardFromHub,
  generatePro2SceneImageFromHub,
  pro2ScriptHubExportMarkdown,
  regeneratePro2ScriptHub,
} from "@/lib/canvas/pro2-script-hub-toolbar-actions";
import {
  pro2HubHasCharacterTable,
  pro2HubHasSceneTable,
  pro2HubHasScriptTable,
  pro2HubIsGenerating,
  pro2HubIsLinkedOutline,
  resolvePro2HubCharacterMd,
  resolvePro2HubCharacterPickerRows,
  resolvePro2HubSceneMd,
  resolvePro2HubSceneRows,
  resolvePro2HubStoryboardPickerRows,
  enqueuePro2ShotPromptPolish,
  persistPro2StoryboardTableEditsToHub,
} from "@/lib/canvas/pro2-script-hub-helpers";
import {
  resolvePro2ThreeViewBatchImageForHub,
} from "@/lib/canvas/pro2-three-view-batch-image";
import {
  resolvePro2SceneBatchImageForHub,
} from "@/lib/canvas/pro2-scene-batch-image";
import type { StoryProScriptHubNodeData } from "@/lib/canvas/story-pro-workspace-types";
import { useSaveNodeAsAsset } from "@/lib/canvas/use-save-node-as-asset";
import type { StoryProStarterNodeData } from "@/lib/canvas/story-pro-workspace-types";
import type { StoryRefImage } from "@/lib/canvas/story-ref-image";
import { useUserProviders } from "@/lib/canvas/use-user-providers";
import { cn } from "@/lib/utils";
import {
  PRO2_IMAGE_NODE_TOOLBAR_DIVIDER_CLASS,
  PRO2_IMAGE_NODE_TOOLBAR_ICON_BTN_CLASS,
  PRO2_IMAGE_NODE_TOOLBAR_SHELL_CLASS,
  PRO2_IMAGE_NODE_TOOLBAR_TOOL_BTN_CLASS,
} from "./pro2-image-node-toolbar";
import {
  resolvePro2FrameBatchImageForHub,
} from "@/lib/canvas/pro2-frame-batch-image";
import {
  Pro2CharacterThreeViewPicker,
  type Pro2CharacterThreeViewResult,
} from "./pro2-character-three-view-picker";
import {
  Pro2FrameGeneratePicker,
  type Pro2StoryboardSpawnResult,
} from "./pro2-frame-generate-picker";
import {
  Pro2SceneImagePicker,
  type Pro2SceneImageResult,
} from "./pro2-scene-image-picker";

/** 与图片节点顶部工具条统一样式（字号 / 尺寸 / 外壳） */
const TOOL_BTN = PRO2_IMAGE_NODE_TOOLBAR_TOOL_BTN_CLASS;

const ICON_BTN = PRO2_IMAGE_NODE_TOOLBAR_ICON_BTN_CLASS;

export type Pro2ScriptHubToolbarProps = {
  hubId: string;
  hubData: StoryProScriptHubNodeData;
  tableTitle: string;
  className?: string;
  onDuplicateNode?: () => void;
};

function pro2HubBatchStore() {
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

/** 脚本节点 · 顶部浮动工具条（图 1） */
export function Pro2ScriptHubToolbar({
  hubId,
  hubData,
  tableTitle,
  className,
  onDuplicateNode,
}: Pro2ScriptHubToolbarProps) {
  const { alert, confirm } = useDialogs();
  const collaboration = useCrewCollaborationAccess();
  const base = useBookMallBaseUrl();
  const { providers } = useUserProviders();
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const liveHubNode = nodes.find((n) => n.id === hubId);
  const liveHubData =
    (liveHubNode?.data as StoryProScriptHubNodeData | undefined) ?? hubData;
  const [framePickerOpen, setFramePickerOpen] = useState(false);
  const [shotPromptPolishBusy, setShotPromptPolishBusy] = useState(false);
  const [tvPickerOpen, setTvPickerOpen] = useState(false);
  const [scenePickerOpen, setScenePickerOpen] = useState(false);
  const projectId = useCanvasStore((s) => s.projectId) ?? "";

  const saveAsAsset = useSaveNodeAsAsset();
  const dockInput = liveHubData.dockInput ?? "";
  const dockRefImages = (liveHubData.dockRefImages ?? []) as StoryRefImage[];
  const hasTable = pro2HubHasScriptTable(liveHubData);
  const hasCharacterTable = pro2HubHasCharacterTable(liveHubData);
  const hasSceneTable = pro2HubHasSceneTable(liveHubData, { nodes, edges, hubId });
  const linked = pro2HubIsLinkedOutline(nodes, edges, hubId, liveHubData);
  const isGenerating = pro2HubIsGenerating({
    id: hubId,
    data: liveHubData,
    type: "story-pro2-script-hub",
    position: { x: 0, y: 0 },
  } as never);

  const storyboardRows = useMemo(() => {
    if (!hasTable && !(liveHubData.productionScript?.shots?.length ?? 0)) {
      return [];
    }
    return resolvePro2HubStoryboardPickerRows(liveHubData);
  }, [hasTable, liveHubData]);

  const initialFrameBatchImage = useMemo(
    () => resolvePro2FrameBatchImageForHub(hubId, nodes, edges),
    [hubId, nodes, edges],
  );

  const initialThreeViewBatchImage = useMemo(
    () => resolvePro2ThreeViewBatchImageForHub(hubId, nodes, edges),
    [hubId, nodes, edges],
  );

  const initialSceneBatchImage = useMemo(
    () => resolvePro2SceneBatchImageForHub(hubId, nodes, edges),
    [hubId, nodes, edges],
  );

  const runFrameGenerate = (result: Pro2StoryboardSpawnResult) => {
    const hubPatch = persistPro2StoryboardTableEditsToHub(
      hubData,
      result.rows,
      hubId,
    );
    updateNodeData(hubId, hubPatch);
    const mergedHub = { ...hubData, ...hubPatch };
    generatePro2FrameBoardFromHub(
      hubId,
      mergedHub,
      dockInput,
      dockRefImages,
      providers,
      pro2HubBatchStore,
      result.frameIndices,
      result.batchImage ?? undefined,
      { spawnNewGroup: true },
    );
  };

  const runShotPromptPolish = (frameIndices: number[]) => {
    if (!liveHubData.providerId?.trim() || !liveHubData.modelKey?.trim()) {
      void alert({
        title: "请选择模型",
        message: "在底部输入坞选择 LLM 模型后再生成提示词。",
        variant: "warning",
      });
      return;
    }
    setShotPromptPolishBusy(true);
    enqueuePro2ShotPromptPolish(
      hubId,
      frameIndices,
      liveHubData,
      updateNodeData,
    );
    window.setTimeout(() => setShotPromptPolishBusy(false), 1200);
  };

  const runThreeViewGenerate = (result: Pro2CharacterThreeViewResult) => {
    generatePro2CharacterThreeViewFromHub(
      hubId,
      hubData,
      providers,
      pro2HubBatchStore,
      result.characterKeys,
      result.batchImage,
    );
  };

  const runSceneGenerate = (result: Pro2SceneImageResult) => {
    generatePro2SceneImageFromHub(
      hubId,
      hubData,
      providers,
      pro2HubBatchStore,
      result.sceneKeys,
      result.batchImage,
    );
  };

  const onRegenerate = async () => {
    if (isGenerating) return;
    if (!hasTable && !linked) {
      await alert({
        title: "无法重新生成",
        message: "请先链接故事大纲，或已有分镜脚本后再重新生成。",
        variant: "warning",
      });
      return;
    }
    if (!liveHubData.providerId?.trim() || !liveHubData.modelKey?.trim()) {
      await alert({
        title: "请选择模型",
        message: "在底部输入坞选择 LLM 模型后再重新生成。",
        variant: "warning",
      });
      return;
    }
    regeneratePro2ScriptHub(
      hubId,
      liveHubData,
      nodes,
      edges,
      dockInput,
      dockRefImages,
      updateNodeData,
    );
  };

  const onGenerateFrames = async () => {
    if (isGenerating) return;
    if (!hasTable) {
      await alert({
        title: "请先生成分镜脚本",
        message:
          "在底部输入坞发送生成专业版分镜脚本后，再点击「生成分镜」。",
        variant: "warning",
      });
      return;
    }
    setFramePickerOpen(true);
  };

  const onGenerateThreeView = async () => {
    if (isGenerating) return;
    if (!hasCharacterTable) {
      await alert({
        title: "请先生成角色设定",
        message:
          "在底部输入坞发送生成专业版分镜脚本（含角色表）后，再点击「生成角色三视图」。",
        variant: "warning",
      });
      return;
    }
    setTvPickerOpen(true);
  };

  const onGenerateScene = async () => {
    if (isGenerating) return;
    if (!hasSceneTable) {
      await alert({
        title: "请先生成场景设定",
        message:
          "请在大纲 Tab 中确认含「场景视觉辞典」表，或生成场景段后再点击「生成场景图」。",
        variant: "warning",
      });
      return;
    }
    setScenePickerOpen(true);
  };

  const onDownload = () => {
    const md = pro2ScriptHubExportMarkdown(hubData);
    if (!md.trim()) return;
    downloadPro2ScriptMarkdown(md, tableTitle);
  };

  const onPublishScript = useCallback(async () => {
    if (isGenerating) return;
    const live = useCanvasStore.getState().nodes.find((n) => n.id === hubId);
    const liveData = (live?.data ?? hubData) as StoryProScriptHubNodeData;
    await runPro2ScriptPublishFlow({
      hubId,
      hubData: liveData,
      projectId,
      base,
      dialogs: { alert, confirm },
      collaboration,
      updateNodeData,
      findStarter: () => {
        const starter = useCanvasStore
          .getState()
          .nodes.find(
            (n) =>
              n.type === "story-pro2-starter" &&
              (n.data as StoryProStarterNodeData).workspaceIds?.scriptHubId ===
                hubId,
          );
        return starter
          ? {
              id: starter.id,
              data: starter.data as StoryProStarterNodeData,
            }
          : undefined;
      },
    });
  }, [
    hubId,
    hubData,
    isGenerating,
    alert,
    confirm,
    updateNodeData,
    base,
    projectId,
    collaboration,
  ]);

  const hubSceneRows = useMemo(
    () => resolvePro2HubSceneRows(hubId, hubData, nodes, edges),
    [hubId, hubData, nodes, edges],
  );

  return (
    <>
      <div
        className={cn(
          "nodrag pointer-events-auto min-w-max whitespace-nowrap",
          PRO2_IMAGE_NODE_TOOLBAR_SHELL_CLASS,
          className,
        )}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className={TOOL_BTN}
          disabled={isGenerating}
          title="重新生成角色、场景与分镜脚本（已链接大纲时不重复跑大纲 LLM）"
          onClick={() => void onRegenerate()}
        >
          <RotateCw className="size-3.5" />
          <span>重新生成</span>
        </button>
        <button
          type="button"
          className={TOOL_BTN}
          disabled={isGenerating}
          title={
            hasCharacterTable
              ? "选择角色并新建一组三视图（保留已有组，可多次抽卡）"
              : "请先生成含角色设定的分镜脚本"
          }
          onClick={() => void onGenerateThreeView()}
        >
          <Users className="size-3.5" />
          <span>生成角色三视图</span>
        </button>
        <button
          type="button"
          className={TOOL_BTN}
          disabled={isGenerating}
          title={
            hasSceneTable
              ? "选择场景并新建一组场景图（保留已有组，可多次抽卡）"
              : "请先生成含场景设定的分镜脚本"
          }
          onClick={() => void onGenerateScene()}
        >
          <MapPin className="size-3.5" />
          <span>生成场景图</span>
        </button>
        <button
          type="button"
          className={TOOL_BTN}
          disabled={isGenerating || !hasTable}
          title="编辑分镜表并创建分镜图组 + 分镜视频组（不自动生图/生视频）"
          onClick={() => void onGenerateFrames()}
        >
          <LayoutGrid className="size-3.5" />
          <span>生成分镜</span>
        </button>
        {collaboration.canPublishScript ? (
          <>
            <div className={PRO2_IMAGE_NODE_TOOLBAR_DIVIDER_CLASS} />
            <button
              type="button"
              className={TOOL_BTN}
              disabled={isGenerating}
              title="发布剧本 · 同步剧本包并更新公告栏（可选团队共享）"
              onClick={() => void onPublishScript()}
            >
              <Megaphone className="size-3.5" />
              <span>发布剧本</span>
            </button>
          </>
        ) : null}
        <button
          type="button"
          className={TOOL_BTN}
          title="保存为资产"
          onClick={() =>
            saveAsAsset(
              hubId,
              "story-pro2-script-hub",
              hubData as unknown as Record<string, unknown>,
              "STORYBOARD_SCRIPT",
            )
          }
        >
          <BookmarkPlus className="size-3.5" />
          <span>保存为资产</span>
        </button>
        <button
          type="button"
          className={ICON_BTN}
          title="下载脚本 Markdown"
          disabled={!hasTable}
          onClick={onDownload}
        >
          <Download className="size-5" />
        </button>
        {onDuplicateNode ? (
          <button
            type="button"
            className={ICON_BTN}
            title="复制节点"
            onClick={onDuplicateNode}
          >
            <Copy className="size-5" />
          </button>
        ) : null}
      </div>

      <Pro2FrameGeneratePicker
        open={framePickerOpen}
        rows={storyboardRows}
        initialBatchImage={initialFrameBatchImage}
        generatingPrompts={shotPromptPolishBusy}
        onClose={() => {
          setFramePickerOpen(false);
        }}
        onConfirm={runFrameGenerate}
        onGeneratePrompts={runShotPromptPolish}
      />

      <Pro2CharacterThreeViewPicker
        open={tvPickerOpen}
        characterRows={resolvePro2HubCharacterPickerRows(hubData)}
        initialBatchImage={initialThreeViewBatchImage}
        onClose={() => setTvPickerOpen(false)}
        onConfirm={runThreeViewGenerate}
      />

      <Pro2SceneImagePicker
        open={scenePickerOpen}
        sceneMd={resolvePro2HubSceneMd(hubData, { nodes, edges, hubId })}
        sceneRows={hubSceneRows}
        sceneRowKeys={hubSceneRows.map((r) => ({ name: r.name, key: r.key }))}
        initialBatchImage={initialSceneBatchImage}
        onClose={() => setScenePickerOpen(false)}
        onConfirm={runSceneGenerate}
      />
    </>
  );
}
