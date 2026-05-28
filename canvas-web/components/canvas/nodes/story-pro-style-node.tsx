"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { GitBranch, Loader2, Palette, Sparkles, Upload, X } from "lucide-react";
import Image from "next/image";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { uploadCanvasImage } from "@/lib/canvas-api";
import {
  bindImageDragDropHandlers,
  firstImageFileFromDataTransfer,
  useImagePasteWhenActive,
} from "@/lib/canvas/image-upload-handlers";
import { useCanvasStore } from "@/lib/canvas/store";
import { busEnqueueStoryRun } from "@/lib/canvas/canvas-run-bus";
import {
  spawnStoryProMediaColumns,
  storyProHubHasMediaColumns,
} from "@/lib/canvas/spawn-story-pro-workspace";
import { syncStoryProColumnRows } from "@/lib/canvas/story-pro-column-sync";
import { reflowStoryProWorkspace } from "@/lib/canvas/story-pro-workspace-layout";
import {
  findProScriptHubForStyle,
  resolveStarterForHub,
} from "@/lib/canvas/story-workspace-resolver";
import type {
  StoryProColorTone,
  StoryProMainStyle,
  StoryProRenderQuality,
  StoryProScriptHubNodeData,
  StoryProStyleNodeData,
} from "@/lib/canvas/story-pro-workspace-types";
import {
  STORY_PRO_COLOR_TONE_OPTIONS,
  STORY_PRO_MAIN_STYLE_OPTIONS,
  STORY_PRO_RENDER_QUALITY_OPTIONS,
  STORY_PRO_STYLE_ANCHOR_TEMPLATES,
  buildStyleAnchorFallbackFromPickers,
  type StoryProStyleAnchorTemplate,
} from "@/lib/canvas/story-pro-style-templates";
import {
  STORY_PRO_CONTROL_NODE_HEIGHT,
  STORY_PRO_CONTROL_NODE_WIDTH,
  STORY_PRO_STYLE_NODE_EXTRA_H,
  PRO_HINT_LABEL_CLASS,
  PRO_NODE_ACTION_BTN_SPLIT_CLASS,
  PRO_SELECT_CLASS,
  PRO_TEMPLATE_CHIP_CLASS,
  PRO_TEXTAREA_CLASS,
} from "@/lib/canvas/story-pro-node-chrome";
import { nodeMeasuredSize } from "@/lib/canvas/normalize-graph-nodes";
import { ProNodeShell } from "../pro-node-shell";
import { NodeStatusBadge } from "../node-shell";
import { StoryProGuidePanel } from "../story-pro-guide-panel";
import { StoryNodeFooterShell } from "../story-node-footer-shell";
import { useUserProviders } from "@/lib/canvas/use-user-providers";
import { useGatewayLinkStatus } from "@/lib/canvas/use-gateway-link-status";
import { pickDefaultStoryLlmEngine } from "@/lib/canvas/system-providers";

const STYLE_NODE_EXTRA = STORY_PRO_STYLE_NODE_EXTRA_H;

function selectStyleData(
  nodes: { id: string; data: unknown }[],
  id: string,
  data: unknown,
): StoryProStyleNodeData {
  const fromStore = nodes.find((n) => n.id === id)?.data;
  return { ...(data as StoryProStyleNodeData), ...(fromStore as StoryProStyleNodeData) };
}

export function StoryProStyleNode({ id, data, selected }: NodeProps) {
  const base = useBookMallBaseUrl();
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const addNode = useCanvasStore((s) => s.addNode);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const resizeNode = useCanvasStore((s) => s.resizeNode);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const { providers } = useUserProviders();
  const { linked: gatewayLinked, loading: gatewayLoading } =
    useGatewayLinkStatus();
  const d = selectStyleData(nodes, id, data);
  const [outputBusy, setOutputBusy] = useState(false);
  const [refUploadBusy, setRefUploadBusy] = useState(false);
  const refInputRef = useRef<HTMLInputElement>(null);

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
    return storyProHubHasMediaColumns(nodes, hubNodeId);
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

  useEffect(() => {
    const targetH = STORY_PRO_CONTROL_NODE_HEIGHT + STYLE_NODE_EXTRA;
    const targetW = STORY_PRO_CONTROL_NODE_WIDTH;
    const node = useCanvasStore.getState().nodes.find((n) => n.id === id);
    if (!node) return;
    const { w, h } = nodeMeasuredSize(node);
    if (Math.abs(h - targetH) < 4 && Math.abs(w - targetW) < 4) return;
    resizeNode(id, { width: targetW, height: targetH });
  }, [id, resizeNode]);

  const reflowProLayout = () => {
    const state = useCanvasStore.getState();
    setNodes(() => reflowStoryProWorkspace(state.nodes, state.edges));
  };

  const onGenerateDraft = () => {
    if (styleFinalized) {
      window.alert("风格已定稿，无需再生成草稿。");
      return;
    }
    if (!scriptFinalized) {
      window.alert(
        "请先在「故事剧本」节点完成大纲并点击「故事定稿」，再使用 AI 生成草稿。",
      );
      return;
    }
    if (isGenerating) return;
    if (!gatewayLoading && !gatewayLinked) {
      window.alert(
        "请先在 Book 个人中心关联 Gateway API Key（sk-gw-…），并在 Gateway 控制台绑定百炼凭证。",
      );
      return;
    }
    if (!d.providerId?.trim() || !d.modelKey?.trim()) {
      window.alert("未配置 LLM 模型，请稍候或到设置页检查 Provider。");
      return;
    }
    busEnqueueStoryRun({ nodeId: id, forceFresh: true });
  };

  const applyStyleTemplate = (tpl: StoryProStyleAnchorTemplate) => {
    if (styleFinalized || !scriptFinalized) return;
    const hasContent =
      Boolean(d.styleAnchorZh?.trim()) ||
      Boolean(d.styleAnchorEn?.trim()) ||
      Boolean(d.negativePrompt?.trim());
    if (
      hasContent &&
      !window.confirm(`套用「${tpl.label}」将替换当前锚定词，是否继续？`)
    ) {
      return;
    }
    updateNodeData(id, {
      mainStyle: tpl.mainStyle,
      colorTone: tpl.colorTone,
      renderQuality: tpl.renderQuality,
      styleAnchorZh: tpl.styleAnchorZh,
      styleAnchorEn: tpl.styleAnchorEn,
      negativePrompt: tpl.negativePrompt,
    });
  };

  const onFinalizeStyle = async () => {
    if (!canFinalizeStyle || hasMediaColumns) return;
    const starter = hubNodeId
      ? resolveStarterForHub(nodes, edges, hubNodeId)
      : undefined;
    if (!starter || !hubNodeId) return;
    setOutputBusy(true);
    try {
      const anchorPatch = buildStyleAnchorFallbackFromPickers(d);
      if (
        anchorPatch.styleAnchorZh ||
        anchorPatch.styleAnchorEn ||
        anchorPatch.negativePrompt
      ) {
        updateNodeData(id, anchorPatch);
      }

      const state = useCanvasStore.getState();
      const ids = spawnStoryProMediaColumns({
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
      const synced = syncStoryProColumnRows(hubPayload, {
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
      });

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

      updateNodeData(id, { styleFinalized: true });
      updateNodeData(starter.id, { pipelineStage: "style_finalized" });
      reflowProLayout();
    } finally {
      setOutputBusy(false);
    }
  };

  const fieldsLocked = styleFinalized || !scriptFinalized;

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
      const added: NonNullable<StoryProStyleNodeData["refImages"]> = [];
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
    onRefImageFile,
  );

  const refUploadDragDrop = bindImageDragDropHandlers(onRefImageFile, {
    disabled: fieldsLocked || refUploadBusy,
  });

  const removeRefImage = (refId: string, label: string) => {
    if (fieldsLocked) return;
    if (!window.confirm(`从风格参考图中移除「${label}」？`)) return;
    if (
      !window.confirm(
        "此操作不可恢复；若图片已上传至云端存储（OSS），将仅从本节点移除引用。确定删除？",
      )
    ) {
      return;
    }
    updateNodeData(id, {
      refImages: (d.refImages ?? []).filter((r) => r.id !== refId),
    });
  };

  const styleSubtitle = styleFinalized
    ? "风格已定稿 · 工作流已生成"
    : scriptFinalized
      ? "选好下拉或模板后可直接「风格定稿」；锚定词与参考图可选"
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
                ? " · 未填锚定词时将按下拉选项自动补全"
                : ""}
            </span>
          }
        >
          <div className="flex w-full gap-2">
            <button
              type="button"
              disabled={!scriptFinalized || isGenerating || styleFinalized}
              className={PRO_NODE_ACTION_BTN_SPLIT_CLASS}
              onClick={onGenerateDraft}
            >
              <Sparkles className="size-3.5 shrink-0" />
              {isGenerating ? "生成中…" : "AI 生成草稿"}
            </button>
            <button
              type="button"
              disabled={outputBusy || !canFinalizeStyle || hasMediaColumns}
              className={PRO_NODE_ACTION_BTN_SPLIT_CLASS}
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
        <div className="grid grid-cols-3 gap-2">
          <label className="space-y-1">
            <span className={PRO_HINT_LABEL_CLASS}>主风格</span>
            <select
              className={PRO_SELECT_CLASS}
              value={d.mainStyle ?? ""}
              disabled={fieldsLocked}
              onChange={(e) =>
                updateNodeData(id, {
                  mainStyle: (e.target.value || undefined) as StoryProMainStyle,
                })
              }
            >
              <option value="">选择…</option>
              {STORY_PRO_MAIN_STYLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className={PRO_HINT_LABEL_CLASS}>色调</span>
            <select
              className={PRO_SELECT_CLASS}
              value={d.colorTone ?? ""}
              disabled={fieldsLocked}
              onChange={(e) =>
                updateNodeData(id, {
                  colorTone: (e.target.value || undefined) as StoryProColorTone,
                })
              }
            >
              <option value="">选择…</option>
              {STORY_PRO_COLOR_TONE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className={PRO_HINT_LABEL_CLASS}>质感</span>
            <select
              className={PRO_SELECT_CLASS}
              value={d.renderQuality ?? ""}
              disabled={fieldsLocked}
              onChange={(e) =>
                updateNodeData(id, {
                  renderQuality: (e.target.value ||
                    undefined) as StoryProRenderQuality,
                })
              }
            >
              <option value="">选择…</option>
              {STORY_PRO_RENDER_QUALITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="space-y-1">
          <span className={PRO_HINT_LABEL_CLASS}>风格模板 · 一键填入锚定词</span>
          <div className="flex flex-wrap gap-1">
            {STORY_PRO_STYLE_ANCHOR_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                disabled={fieldsLocked}
                title={tpl.hint}
                className={PRO_TEMPLATE_CHIP_CLASS}
                onClick={() => applyStyleTemplate(tpl)}
              >
                {tpl.label}
              </button>
            ))}
          </div>
        </div>

        <label className="block space-y-1">
          <span className={PRO_HINT_LABEL_CLASS}>中文锚定词</span>
          <textarea
            className={`min-h-[64px] ${PRO_TEXTAREA_CLASS}`}
            value={d.styleAnchorZh ?? ""}
            disabled={fieldsLocked}
            onChange={(e) =>
              updateNodeData(id, { styleAnchorZh: e.target.value })
            }
            placeholder="画面风格、光影、材质…"
          />
        </label>

        <label className="block space-y-1">
          <span className={PRO_HINT_LABEL_CLASS}>English anchor</span>
          <textarea
            className={`min-h-[64px] ${PRO_TEXTAREA_CLASS}`}
            value={d.styleAnchorEn ?? ""}
            disabled={fieldsLocked}
            onChange={(e) =>
              updateNodeData(id, { styleAnchorEn: e.target.value })
            }
            placeholder="Style anchor in English…"
          />
        </label>

        <label className="block space-y-1">
          <span className={PRO_HINT_LABEL_CLASS}>Negative prompt</span>
          <textarea
            className={`min-h-[48px] ${PRO_TEXTAREA_CLASS}`}
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
            className="nodrag flex w-full items-center gap-2 rounded border border-dashed border-cyan-400/25 bg-cyan-500/8 px-2 py-2 text-left text-[11px] text-white/80 transition hover:border-cyan-400/45 hover:bg-cyan-500/12 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {refUploadBusy ? (
              <Loader2 className="size-3.5 shrink-0 animate-spin text-cyan-400" />
            ) : (
              <Palette className="size-3.5 shrink-0 text-cyan-400" />
            )}
            <span className="flex-1">
              参考图 {refCount} 张 · 点击 / 拖入 / 粘贴（可选，支持多选）
            </span>
            <Upload className="size-3.5 shrink-0 text-cyan-300/80" />
          </button>
          {refCount > 0 ? (
            <div className="flex flex-wrap gap-2">
              {(d.refImages ?? []).map((ref) => (
                <div
                  key={ref.id}
                  className="group relative size-14 overflow-hidden rounded border border-cyan-400/20 bg-black/40"
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
      </div>
    </ProNodeShell>
  );
}
