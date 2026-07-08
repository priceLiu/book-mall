"use client";

import { useMemo, useState, useCallback } from "react";
import { Download, LayoutGrid, MapPin, Megaphone, Package, RotateCw, Users, BookmarkPlus, Copy } from "lucide-react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { useCanvasStore } from "@/lib/canvas/store";
import { parseStoryboardRows } from "@/lib/canvas/parse-md-tables";
import { resolveHubStoryboardMd } from "@/lib/canvas/story-hub-runtime";
import { confirmAndPublishPro2ScriptHub } from "@/lib/canvas/pro2-publish-script-hub";
import { syncScriptPackageAssetOnPublish } from "@/lib/canvas/sync-script-package-on-publish";
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
  resolvePro2HubSceneMd,
  resolvePro2HubSceneRows,
} from "@/lib/canvas/pro2-script-hub-helpers";
import {
  resolvePro2ThreeViewBatchImageForHub,
} from "@/lib/canvas/pro2-three-view-batch-image";
import {
  resolvePro2SceneBatchImageForHub,
} from "@/lib/canvas/pro2-scene-batch-image";
import type { StoryProScriptHubNodeData } from "@/lib/canvas/story-pro-workspace-types";
import { useSaveNodeAsAsset } from "@/lib/canvas/use-save-node-as-asset";
import { exportScriptPackageDraft } from "@/lib/canvas/export-script-package";
import { openSaveProjectAssetDialog } from "@/components/canvas/save-project-asset-dialog";
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
import { hubHasPro2FrameBoardGroup } from "@/lib/canvas/pro2-resolve-frame-board-group";
import {
  Pro2CharacterThreeViewPicker,
  type Pro2CharacterThreeViewResult,
} from "./pro2-character-three-view-picker";
import {
  Pro2FrameGeneratePicker,
  type Pro2FrameGenerateResult,
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
    addNode: (
      type:
        | "story-pro2-character"
        | "story-pro2-scene"
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

/** 脚本节点 · 顶部浮动工具条（图 1） */
export function Pro2ScriptHubToolbar({
  hubId,
  hubData,
  tableTitle,
  className,
  onDuplicateNode,
}: Pro2ScriptHubToolbarProps) {
  const { alert, confirm } = useDialogs();
  const base = useBookMallBaseUrl();
  const { providers } = useUserProviders();
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const [framePickerOpen, setFramePickerOpen] = useState(false);
  const [framePickerMode, setFramePickerMode] = useState<
    "first" | "regenerate" | "spawnNew"
  >("first");
  const [tvPickerOpen, setTvPickerOpen] = useState(false);
  const [scenePickerOpen, setScenePickerOpen] = useState(false);
  const projectId = useCanvasStore((s) => s.projectId) ?? "";

  const saveAsAsset = useSaveNodeAsAsset();
  const dockInput = hubData.dockInput ?? "";
  const dockRefImages = (hubData.dockRefImages ?? []) as StoryRefImage[];
  const hasTable = pro2HubHasScriptTable(hubData);
  const hasCharacterTable = pro2HubHasCharacterTable(hubData);
  const hasSceneTable = pro2HubHasSceneTable(hubData, { nodes, edges, hubId });
  const linked = pro2HubIsLinkedOutline(nodes, edges, hubId, hubData);
  const isGenerating = pro2HubIsGenerating({
    id: hubId,
    data: hubData,
    type: "story-pro2-script-hub",
    position: { x: 0, y: 0 },
  } as never);

  const storyboardRows = useMemo(() => {
    if (!hasTable) return [];
    return parseStoryboardRows(resolveHubStoryboardMd(hubData));
  }, [hasTable, hubData]);

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

  const hasFrameBoardGroup = useMemo(
    () => hubHasPro2FrameBoardGroup(hubId, nodes),
    [hubId, nodes],
  );

  const runFrameGenerate = (result: Pro2FrameGenerateResult) => {
    const kickoffOptions =
      framePickerMode === "spawnNew"
        ? { spawnNewGroup: true as const }
        : framePickerMode === "regenerate"
          ? { forceFresh: true as const }
          : undefined;
    generatePro2FrameBoardFromHub(
      hubId,
      hubData,
      dockInput,
      dockRefImages,
      providers,
      pro2HubBatchStore,
      result.frameIndices,
      result.batchImage,
      kickoffOptions,
    );
    setFramePickerMode("first");
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
    if (!hubData.providerId?.trim() || !hubData.modelKey?.trim()) {
      await alert({
        title: "请选择模型",
        message: "在底部输入坞选择 LLM 模型后再重新生成。",
        variant: "warning",
      });
      return;
    }
    regeneratePro2ScriptHub(
      hubId,
      hubData,
      nodes,
      edges,
      dockInput,
      dockRefImages,
      updateNodeData,
    );
  };

  const onGenerateFrames = async (mode: "first" | "regenerate" | "spawnNew") => {
    if (isGenerating) return;
    if (!hasTable) {
      await alert({
        title: "请先生成分镜脚本",
        message:
          "在底部输入坞发送生成专业版分镜脚本后，再点击「生成分镜组」。",
        variant: "warning",
      });
      return;
    }
    setFramePickerMode(mode);
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

  const onExportScriptPackage = async () => {
    if (!projectId) {
      await alert({
        title: "无法导出",
        message: "请先保存画布项目后再导出剧本包。",
        variant: "warning",
      });
      return;
    }
    const starter = nodes.find(
      (n) =>
        n.type === "story-pro2-starter" &&
        (n.data as StoryProStarterNodeData).workspaceIds?.scriptHubId === hubId,
    );
    const starterData = (starter?.data ?? {}) as StoryProStarterNodeData;
    const draft = exportScriptPackageDraft({
      projectId,
      edition: "pro2",
      starterId: starter?.id ?? hubId,
      starterData,
      hubId,
      hubData,
    });
    if (!String(draft.payload.markdown ?? "").trim()) {
      await alert({
        title: "暂无剧本内容",
        message: "请先生成至少一批工业化剧本后再导出。",
        variant: "warning",
      });
      return;
    }
    updateNodeData(hubId, { scriptFinalized: true });
    openSaveProjectAssetDialog(draft, { showTeamShare: true });
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
    const pub = await confirmAndPublishPro2ScriptHub(hubId, liveData, {
      alert,
      confirm,
    }, {
      requireBatch: liveData.scriptStudioMode === true,
      batchIndex: liveData.scriptStudioBatchIndex,
    });
    if (pub) {
      updateNodeData(hubId, pub);
      if (base?.trim() && projectId) {
        const starter = useCanvasStore
          .getState()
          .nodes.find(
            (n) =>
              n.type === "story-pro2-starter" &&
              (n.data as StoryProStarterNodeData).workspaceIds?.scriptHubId ===
                hubId,
          );
        const assetId = await syncScriptPackageAssetOnPublish({
          base,
          projectId,
          hubId,
          hubData: { ...liveData, ...pub } as StoryProScriptHubNodeData,
          starterId: starter?.id,
          starterData: (starter?.data ?? {}) as StoryProStarterNodeData,
        });
        if (assetId) {
          updateNodeData(hubId, { linkedScriptPackageAssetId: assetId });
        }
      }
    }
  }, [hubId, hubData, isGenerating, alert, confirm, updateNodeData, base, projectId]);

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
          title="重新生成分镜脚本"
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
              ? "选择角色并生成正/侧/背三视图"
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
              ? "选择场景并生成场景参考图"
              : "请先生成含场景设定的分镜脚本"
          }
          onClick={() => void onGenerateScene()}
        >
          <MapPin className="size-3.5" />
          <span>生成场景图</span>
        </button>
        {hasFrameBoardGroup ? (
          <button
            type="button"
            className={TOOL_BTN}
            disabled={isGenerating || !hasTable}
            title="选择镜号并重新生成当前分镜组（覆盖已有分镜图）"
            onClick={() => void onGenerateFrames("regenerate")}
          >
            <RotateCw className="size-3.5" />
            <span>重新生成分镜组</span>
          </button>
        ) : null}
        <button
          type="button"
          className={TOOL_BTN}
          disabled={isGenerating || !hasTable}
          title={
            hasFrameBoardGroup
              ? "选择镜号并新增一个分镜组（保留已有分镜组）"
              : "选择镜号并生成分镜图（自动关联角色三视图与场景图）"
          }
          onClick={() =>
            void onGenerateFrames(hasFrameBoardGroup ? "spawnNew" : "first")
          }
        >
          <LayoutGrid className="size-3.5" />
          <span>生成分镜组</span>
        </button>
        <div className={PRO2_IMAGE_NODE_TOOLBAR_DIVIDER_CLASS} />
        <button
          type="button"
          className={TOOL_BTN}
          disabled={isGenerating}
          title="发布剧本 · 剧组可在公告条参与制作（发布者也可参与）"
          onClick={() => void onPublishScript()}
        >
          <Megaphone className="size-3.5" />
          <span>发布剧本</span>
        </button>
        <button
          type="button"
          className={TOOL_BTN}
          title="导出定稿剧本包（SCRIPT_PACKAGE）"
          onClick={() => void onExportScriptPackage()}
        >
          <Package className="size-3.5" />
          <span>导出剧本包</span>
        </button>
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
        onClose={() => {
          setFramePickerOpen(false);
          setFramePickerMode("first");
        }}
        onConfirm={runFrameGenerate}
      />

      <Pro2CharacterThreeViewPicker
        open={tvPickerOpen}
        characterMd={resolvePro2HubCharacterMd(hubData)}
        initialBatchImage={initialThreeViewBatchImage}
        onClose={() => setTvPickerOpen(false)}
        onConfirm={runThreeViewGenerate}
      />

      <Pro2SceneImagePicker
        open={scenePickerOpen}
        sceneMd={resolvePro2HubSceneMd(hubData, { nodes, edges, hubId })}
        sceneRowKeys={resolvePro2HubSceneRows(hubId, hubData, nodes, edges).map(
          (r) => ({ name: r.name, key: r.key }),
        )}
        initialBatchImage={initialSceneBatchImage}
        onClose={() => setScenePickerOpen(false)}
        onConfirm={runSceneGenerate}
      />
    </>
  );
}
