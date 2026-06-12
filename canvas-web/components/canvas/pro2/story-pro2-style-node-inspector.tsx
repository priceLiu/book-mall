"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import {
  GitBranch,
  LayoutGrid,
  Loader2,
  Palette,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import Image from "next/image";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { saveStoryProStyleProfile, uploadCanvasImage } from "@/lib/canvas-api";
import {
  bindImageDragDropHandlers,
  firstImageFileFromDataTransfer,
  useImagePasteWhenActive,
} from "@/lib/canvas/image-upload-handlers";
import { useCanvasStore } from "@/lib/canvas/store";
import { busEnqueueStoryRun } from "@/lib/canvas/canvas-run-bus";
import {
  spawnStoryPro2MediaColumns,
  storyPro2HubHasMediaColumns,
} from "@/lib/canvas/spawn-story-pro2-workspace";
import { syncStoryProColumnRows } from "@/lib/canvas/story-pro-column-sync";
import { reflowStoryPro2Workspace } from "@/lib/canvas/story-pro2-workspace-layout";
import { applyDefaultStoryProColumnEngines } from "@/lib/canvas/story-workspace-output";
import {
  findProScriptHubForStyle,
  resolveStarterForHub,
} from "@/lib/canvas/story-workspace-resolver";
import type {
  StoryProScriptHubNodeData,
} from "@/lib/canvas/story-pro-workspace-types";
import type { StoryPro2StyleInspectorData } from "@/lib/canvas/story-pro2-workspace-types";
import {
  STORY_PRO_CONTROL_NODE_HEIGHT,
  STORY_PRO_CONTROL_NODE_WIDTH,
  STORY_PRO_STYLE_NODE_EXTRA_H,
} from "@/lib/canvas/story-pro-node-chrome";
import {
  PRO2_ACTION_BTN_SPLIT_CLASS,
  PRO2_HINT_LABEL_CLASS,
  PRO2_REF_THUMB_CLASS,
  PRO2_SAVE_TO_ASSETS_BTN_CLASS,
  PRO2_UPLOAD_DROPZONE_CLASS,
  PRO2_TEXTAREA_CLASS,
} from "@/lib/canvas/story-pro2-node-chrome";
import { nodeMeasuredSize } from "@/lib/canvas/normalize-graph-nodes";
import { StoryErrorLine, StoryStatusLine } from "@/components/canvas/story-status-line";
import { ProNodeShell } from "../nodes/../pro-node-shell";
import { NodeStatusBadge } from "../node-shell";
import { StoryProGuidePanel } from "../story-pro-guide-panel";
import { StoryNodeFooterShell } from "../story-node-footer-shell";
import { useUserProviders } from "@/lib/canvas/use-user-providers";
import { useGatewayLinkStatus } from "@/lib/canvas/use-gateway-link-status";
import { pickDefaultStoryLlmEngine } from "@/lib/canvas/system-providers";
import { notifyStoryProStyleProfilesChanged } from "@/lib/canvas/use-story-pro2-style-profiles";

const STYLE_NODE_EXTRA = STORY_PRO_STYLE_NODE_EXTRA_H;

function selectStyleData(
  nodes: { id: string; data: unknown }[],
  id: string,
  data: unknown,
): StoryPro2StyleInspectorData {
  const fromStore = nodes.find((n) => n.id === id)?.data;
  return { ...(data as StoryPro2StyleInspectorData), ...(fromStore as StoryPro2StyleInspectorData) };
}

export function StoryPro2StyleInspector({ id, data, selected }: NodeProps) {
  const base = useBookMallBaseUrl();
  const { alert, doubleConfirm } = useDialogs();
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const addNode = useCanvasStore((s) => s.addNode);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const { providers } = useUserProviders();
  const { linked: gatewayLinked, loading: gatewayLoading } =
    useGatewayLinkStatus();
  const d = selectStyleData(nodes, id, data);
  const [outputBusy, setOutputBusy] = useState(false);
  const [refUploadBusy, setRefUploadBusy] = useState(false);
  const [styleSaveBusy, setStyleSaveBusy] = useState(false);
  const [styleSaveHint, setStyleSaveHint] = useState<string | null>(null);
  const refInputRef = useRef<HTMLInputElement>(null);
  const projectId = useCanvasStore((s) => s.projectId);

  const scriptHub = useMemo(
    () => findProScriptHubForStyle(nodes, edges, id, d.hubNodeId),
    [nodes, edges, id, d.hubNodeId],
  );
  const hubNodeId = scriptHub?.id ?? d.hubNodeId;
  const hubData = (scriptHub?.data ?? {}) as StoryProScriptHubNodeData;
  const scriptFinalized = Boolean(hubData.scriptFinalized);
  const styleFinalized = Boolean(d.styleFinalized);

  useEffect(() => {
    if (!scriptHub || d.hubNodeId === scriptHub.id) return;
    updateNodeData(id, { hubNodeId: scriptHub.id });
  }, [d.hubNodeId, id, scriptHub, updateNodeData]);

  const refCount = d.refImages?.length ?? 0;
  const canFinalizeStyle = scriptFinalized && !styleFinalized;

  const hasMediaColumns = useMemo(() => {
    if (!hubNodeId) return false;
    return storyPro2HubHasMediaColumns(nodes, hubNodeId);
  }, [nodes, hubNodeId]);

  useEffect(() => {
    if (!hubNodeId || !styleFinalized || hasMediaColumns) return;
    updateNodeData(id, { styleFinalized: false });
    const starter = resolveStarterForHub(nodes, edges, hubNodeId);
    const stage = (starter?.data as { pipelineStage?: string } | undefined)
      ?.pipelineStage;
    if (
      starter &&
      (stage === "style_finalized" || stage === "finalized")
    ) {
      updateNodeData(starter.id, { pipelineStage: "script_finalized" });
    }
  }, [
    hubNodeId,
    styleFinalized,
    hasMediaColumns,
    id,
    nodes,
    edges,
    updateNodeData,
  ]);

  const runtimeStatus = d.runtime?.status ?? "idle";
  const isGenerating = runtimeStatus === "running" || runtimeStatus === "pending";

  useEffect(() => {
    if (d.providerId?.trim() && d.modelKey?.trim()) return;
    const pick = pickDefaultStoryLlmEngine(providers);
    if (!pick) return;
    updateNodeData(id, {
      providerId: pick.providerId,
      modelKey: pick.modelKey,
    });
  }, [d.providerId, d.modelKey, providers, id, updateNodeData]);

  const reflowProLayout = () => {
    const state = useCanvasStore.getState();
    setNodes(() => reflowStoryPro2Workspace(state.nodes, state.edges));
  };

  const onGenerateDraft = async () => {
    if (styleFinalized) {
      await alert({
        title: "风格已定稿",
        message: "风格已定稿，无需再生成草稿。",
      });
      return;
    }
    if (!scriptFinalized) {
      await alert({
        title: "请先故事定稿",
        message:
          "请先在「故事剧本」节点完成大纲并点击「故事定稿」，再使用 AI 生成草稿。",
      });
      return;
    }
    if (isGenerating) return;
    if (!gatewayLoading && !gatewayLinked) {
      await alert({
        title: "需要 Gateway",
        message:
          "请先在 Book 个人中心关联 Gateway API Key（sk-gw-…），并在 Gateway 控制台绑定百炼凭证。",
      });
      return;
    }
    if (!d.providerId?.trim() || !d.modelKey?.trim()) {
      await alert({
        title: "未配置模型",
        message: "未配置 LLM 模型，请稍候或到设置页检查 Provider。",
      });
      return;
    }
    busEnqueueStoryRun({ nodeId: id, forceFresh: true });
  };

  const openStyleLibrary = () => {
    if (fieldsLocked) return;
    window.dispatchEvent(new CustomEvent("canvas:open-style-library"));
  };

  const onFinalizeStyle = async () => {
    if (!canFinalizeStyle || hasMediaColumns) return;
    const starter = hubNodeId
      ? resolveStarterForHub(nodes, edges, hubNodeId)
      : undefined;
    if (!starter || !hubNodeId) return;

    if (!d.styleAnchorZh?.trim() && !d.styleAnchorEn?.trim()) {
      await alert({
        title: "请先选择风格",
        message:
          "请从「风格库」套用条目，或手动填写中文/英文锚定词后再点击「风格定稿」。",
        variant: "warning",
      });
      return;
    }

    setOutputBusy(true);
    try {
      const state = useCanvasStore.getState();
      const ids = spawnStoryPro2MediaColumns({
        starterNodeId: starter.id,
        scriptHubId: hubNodeId,
        systemPrompt:
          (starter.data as { systemPrompt?: string }).systemPrompt ?? "",
        providerId: d.providerId ?? hubData.providerId,
        modelKey: d.modelKey ?? hubData.modelKey,
        params: d.params ?? hubData.params ?? {},
        nodes: state.nodes,
        edges: state.edges,
        addNode: (type, position, nodeData) =>
          addNode(type, position, nodeData),
        setEdges,
        updateNodeData,
      });

      const afterSpawn = useCanvasStore.getState().nodes;
      const hubNode = afterSpawn.find((n) => n.id === hubNodeId);
      const hubPayload = (hubNode?.data ?? hubData) as StoryProScriptHubNodeData;
      const synced = syncStoryProColumnRows(
        hubPayload,
        {
        characterRows: (
          afterSpawn.find((n) => n.id === ids.characterColumnId)?.data as {
            rows?: unknown[];
          }
        )?.rows as import("@/lib/canvas/story-pro-workspace-types").StoryProCharacterRow[],
        sceneRows: (
          afterSpawn.find((n) => n.id === ids.sceneColumnId)?.data as {
            rows?: unknown[];
          }
        )?.rows as import("@/lib/canvas/story-pro-workspace-types").StoryProSceneRow[],
        frameRows: (
          afterSpawn.find((n) => n.id === ids.frameColumnId)?.data as {
            rows?: unknown[];
          }
        )?.rows as import("@/lib/canvas/story-pro-workspace-types").StoryProFrameRow[],
        videoRows: (
          afterSpawn.find((n) => n.id === ids.videoColumnId)?.data as {
            rows?: unknown[];
          }
        )?.rows as import("@/lib/canvas/story-pro-workspace-types").StoryProVideoRow[],
        },
        hubNodeId,
      );

      if (ids.characterColumnId) {
        updateNodeData(ids.characterColumnId, {
          rows: synced.characterRows,
          hubNodeId,
        });
      }
      if (ids.sceneColumnId) {
        updateNodeData(ids.sceneColumnId, {
          rows: synced.sceneRows,
          hubNodeId,
        });
      }
      if (ids.frameColumnId) {
        updateNodeData(ids.frameColumnId, {
          rows: synced.frameRows,
          hubNodeId,
        });
      }
      if (ids.videoColumnId) {
        updateNodeData(ids.videoColumnId, {
          rows: synced.videoRows,
          hubNodeId,
          frameColumnId: ids.frameColumnId,
        });
      }

      const afterEngines = useCanvasStore.getState().nodes;
      applyDefaultStoryProColumnEngines(
        updateNodeData,
        afterEngines,
        ids,
        providers,
      );

      updateNodeData(id, { styleFinalized: true });
      updateNodeData(starter.id, { pipelineStage: "style_finalized" });
      reflowProLayout();
    } finally {
      setOutputBusy(false);
    }
  };

  const fieldsLocked = styleFinalized || !scriptFinalized;

  const saveStyleToProjectAssets = async () => {
    if (!base?.trim() || fieldsLocked || styleSaveBusy) return;
    setStyleSaveBusy(true);
    setStyleSaveHint(null);
    try {
      await saveStoryProStyleProfile(base, {
        projectId: projectId ?? null,
        displayName: "项目全局风格",
        mainStyle: d.mainStyle ?? null,
        colorTone: d.colorTone ?? null,
        renderQuality: d.renderQuality ?? null,
        anchorZh: d.styleAnchorZh ?? null,
        anchorEn: d.styleAnchorEn ?? null,
        negativePrompt: d.negativePrompt ?? null,
        refImageUrls: (d.refImages ?? [])
          .map((r) => r.url)
          .filter((u): u is string => Boolean(u && /^https?:\/\//.test(u))),
      });
      notifyStoryProStyleProfilesChanged();
      setStyleSaveHint("已保存到项目资产 · 全局风格");
    } catch (e) {
      setStyleSaveHint(e instanceof Error ? e.message : String(e));
    } finally {
      setStyleSaveBusy(false);
    }
  };

  const onPickRefImages = () => {
    if (fieldsLocked || refUploadBusy) return;
    refInputRef.current?.click();
  };

  const onRefFilesSelected = async (files: File[]) => {
    const imageFiles = files.filter((f) => f.type.startsWith("image/"));
    if (!imageFiles.length || fieldsLocked) return;
    setRefUploadBusy(true);
    try {
      const existing = d.refImages ?? [];
      const added: NonNullable<StoryPro2StyleInspectorData["refImages"]> = [];
      for (const file of imageFiles) {
        const url = await uploadCanvasImage(base, file);
        added.push({
          id: `ref-style-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          label: file.name.replace(/\.[^.]+$/, "") || "参考图",
          url,
        });
      }
      updateNodeData(id, { refImages: [...existing, ...added] });
    } finally {
      setRefUploadBusy(false);
    }
  };

  const onRefInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    await onRefFilesSelected(files);
  };

  const onRefImageFile = useCallback(
    (file: File) => {
      void onRefFilesSelected([file]);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fieldsLocked/d refImages read at invoke time
    [base, fieldsLocked, id, updateNodeData],
  );

  useImagePasteWhenActive(
    Boolean(selected) && !fieldsLocked && !refUploadBusy,
    { onFile: onRefImageFile },
    true,
    `style-${id}`,
  );

  const refUploadDragDrop = bindImageDragDropHandlers(onRefImageFile, {
    disabled: fieldsLocked || refUploadBusy,
  });

  const removeRefImage = async (refId: string, label: string) => {
    if (fieldsLocked) return;
    const ok = await doubleConfirm({
      first: {
        title: "移除风格参考图",
        message: `从风格参考图中移除「${label}」？`,
        confirmLabel: "继续",
        cancelLabel: "取消",
        danger: true,
      },
      second: {
        title: "不可恢复",
        message:
          "此操作不可恢复；若图片已上传至云端存储（OSS），将仅从本节点移除引用。确定删除？",
        confirmLabel: "确定删除",
        cancelLabel: "取消",
        danger: true,
      },
    });
    if (!ok) return;
    updateNodeData(id, {
      refImages: (d.refImages ?? []).filter((r) => r.id !== refId),
    });
  };

  const styleSubtitle = styleFinalized
    ? "风格已定稿 · 工作流已生成"
    : scriptFinalized
      ? "从风格库套用或填写锚定词后可「风格定稿」；参考图可选"
      : "请先在「故事剧本」确认定稿以解锁";

  const proCompletedStages = scriptFinalized ? (["story"] as const) : [];

  return (
    <ProNodeShell
      title="风格定义"
      subtitle={styleSubtitle}
      selected={selected}
      activeStage="style"
      completedStages={[...proCompletedStages]}
      guide={<StoryProGuidePanel stage="style" />}
      bodyScroll
      minWidth={STORY_PRO_CONTROL_NODE_WIDTH}
      minHeight={STORY_PRO_CONTROL_NODE_HEIGHT + STYLE_NODE_EXTRA}
      inputs={[{ id: "in_text", label: "故事剧本", kind: "text" }]}
      outputs={[{ id: "text", label: "风格", kind: "text" }]}
      headerRight={
        <NodeStatusBadge
          status={
            isGenerating
              ? "running"
              : runtimeStatus === "error"
                ? "error"
                : styleFinalized
                  ? "done"
                  : "idle"
          }
          message={d.runtime?.failMessage ?? null}
        />
      }
      footer={
        <StoryNodeFooterShell
          hint={
            <span>
              参考图 {refCount} 张（可选）
              {!d.styleAnchorZh?.trim() && !d.styleAnchorEn?.trim()
                ? " · 定稿前请从风格库套用或填写锚定词"
                : ""}
            </span>
          }
        >
          <div className="flex w-full gap-2">
            <button
              type="button"
              disabled={!scriptFinalized || isGenerating || styleFinalized}
              className={PRO2_ACTION_BTN_SPLIT_CLASS}
              onClick={onGenerateDraft}
            >
              <Sparkles className="size-3.5 shrink-0" />
              {isGenerating ? "生成中…" : "AI 生成草稿"}
            </button>
            <button
              type="button"
              disabled={outputBusy || !canFinalizeStyle || hasMediaColumns}
              className={PRO2_ACTION_BTN_SPLIT_CLASS}
              onClick={() => void onFinalizeStyle()}
            >
              <GitBranch className="size-3.5 shrink-0" />
              {outputBusy
                ? "生成中…"
                : hasMediaColumns
                  ? "工作流已生成"
                  : "风格定稿 · 生成工作流"}
            </button>
          </div>
        </StoryNodeFooterShell>
      }
    >
      <div className="nodrag flex h-full min-h-0 flex-col gap-2.5 overflow-y-auto">
        <div className="rounded-lg border border-violet-400/25 bg-violet-500/8 px-3 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={PRO2_HINT_LABEL_CLASS}>风格库 · 推荐</span>
            <button
              type="button"
              disabled={fieldsLocked}
              className="nodrag inline-flex items-center gap-1.5 rounded-md border border-violet-400/45 bg-violet-500/20 px-2.5 py-1 text-[11px] font-medium text-violet-50 hover:bg-violet-500/30 disabled:cursor-not-allowed disabled:opacity-40"
              onClick={openStyleLibrary}
            >
              <LayoutGrid className="size-3.5 shrink-0" />
              打开风格库…
            </button>
          </div>
          <p className="mt-1.5 text-[10px] leading-snug text-white/50">
            平台内置 135+ 风格预设，按分类浏览；套用后自动写入中文锚定词与参考图，可再手动微调。
          </p>
        </div>

        <label className="block space-y-1">
          <span className={PRO2_HINT_LABEL_CLASS}>中文锚定词</span>
          <textarea
            className={`min-h-[64px] ${PRO2_TEXTAREA_CLASS}`}
            value={d.styleAnchorZh ?? ""}
            disabled={fieldsLocked}
            onChange={(e) =>
              updateNodeData(id, { styleAnchorZh: e.target.value })
            }
            placeholder="画面风格、光影、材质…"
          />
        </label>

        <label className="block space-y-1">
          <span className={PRO2_HINT_LABEL_CLASS}>English anchor</span>
          <textarea
            className={`min-h-[64px] ${PRO2_TEXTAREA_CLASS}`}
            value={d.styleAnchorEn ?? ""}
            disabled={fieldsLocked}
            onChange={(e) =>
              updateNodeData(id, { styleAnchorEn: e.target.value })
            }
            placeholder="Style anchor in English…"
          />
        </label>

        <label className="block space-y-1">
          <span className={PRO2_HINT_LABEL_CLASS}>Negative prompt</span>
          <textarea
            className={`min-h-[48px] ${PRO2_TEXTAREA_CLASS}`}
            value={d.negativePrompt ?? ""}
            disabled={fieldsLocked}
            onChange={(e) =>
              updateNodeData(id, { negativePrompt: e.target.value })
            }
            placeholder="low quality, blurry, …"
          />
        </label>

        <div className="space-y-2">
          <input
            ref={refInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => void onRefInputChange(e)}
          />
          <button
            type="button"
            disabled={fieldsLocked || refUploadBusy}
            onClick={onPickRefImages}
            {...refUploadDragDrop}
            onDrop={(e) => {
              if (fieldsLocked || refUploadBusy) return;
              e.preventDefault();
              e.stopPropagation();
              const files = Array.from(e.dataTransfer.files).filter((f) =>
                f.type.startsWith("image/"),
              );
              if (files.length) void onRefFilesSelected(files);
              else {
                const one = firstImageFileFromDataTransfer(e.dataTransfer);
                if (one) void onRefFilesSelected([one]);
              }
            }}
            className={PRO2_UPLOAD_DROPZONE_CLASS}
          >
            {refUploadBusy ? (
              <Loader2 className="size-3.5 shrink-0 animate-spin text-violet-400" />
            ) : (
              <Palette className="size-3.5 shrink-0 text-violet-400" />
            )}
            <span className="flex-1">
              参考图 {refCount} 张 · 点击 / 拖入 / 粘贴（可选，支持多选）
            </span>
            <Upload className="size-3.5 shrink-0 text-violet-300/80" />
          </button>
          {refCount > 0 ? (
            <div className="flex flex-wrap gap-2">
              {(d.refImages ?? []).map((ref) => (
                <div
                  key={ref.id}
                  className={PRO2_REF_THUMB_CLASS}
                >
                  {ref.url ? (
                    <Image
                      src={ref.url}
                      alt={ref.label}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <span className="flex size-full items-center justify-center text-[9px] text-white/50">
                      {ref.label}
                    </span>
                  )}
                  {!fieldsLocked ? (
                    <button
                      type="button"
                      aria-label={`删除 ${ref.label}`}
                      className="absolute right-0.5 top-0.5 rounded bg-black/70 p-0.5 text-white/80 opacity-0 transition group-hover:opacity-100"
                      onClick={() => removeRefImage(ref.id, ref.label)}
                    >
                      <X className="size-3" />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
        {styleSaveHint ? (
          styleSaveHint.startsWith("已") ? (
            <StoryStatusLine message={styleSaveHint} className="mt-1" />
          ) : (
            <StoryErrorLine message={styleSaveHint} className="mt-1" />
          )
        ) : null}
        <button
          type="button"
          disabled={fieldsLocked || styleSaveBusy}
          className={`nodrag mt-1 ${PRO2_SAVE_TO_ASSETS_BTN_CLASS}`}
          onClick={() => void saveStyleToProjectAssets()}
        >
          {styleSaveBusy ? "保存中…" : "保存到项目资产（全局风格）"}
        </button>
      </div>
    </ProNodeShell>
  );
}
