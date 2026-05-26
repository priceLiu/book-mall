"use client";

import { useEffect, useMemo, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { BookOpen, Clapperboard, Copy, Users } from "lucide-react";

import { useCanvasStore } from "@/lib/canvas/store";
import type {
  StoryComicPipelineStage,
  StoryEngineNodeData,
  StoryLlmNodeType,
} from "@/lib/canvas/types";
import {
  THREE_VIEW_ENGINE_MODEL_KEYS,
  STORY_VIDEO_MODEL_KEYS,
} from "@/lib/canvas/types";
import { batchRunNodesSequential } from "@/lib/canvas/batch-run-nodes";
import { busEnqueueStoryRun } from "@/lib/canvas/canvas-run-bus";
import { findStoryWorkspaceIds } from "@/lib/canvas/story-column-display";
import {
  runThreeViewBatchAction,
  runFrameImagesBatchAction,
  runFrameMediaBatchAction,
  getCharacterMarkdown,
  getStoryboardMarkdown,
  buildCharacterBatchSelectItems,
  buildStoryboardBatchSelectItems,
  resolveStoryEngineIds,
  type StoryBatchStore,
} from "@/lib/canvas/story-batch-actions";
import {
  collectCharacterColumnRows,
  collectStoryboardColumnRows,
} from "@/lib/canvas/story-column-bindings";
import {
  StoryCharacterColumnPanel,
  StoryFrameColumnPanel,
} from "../story-column-panel";
import { resolveReferencedNodeIds } from "@/lib/canvas/referenced-nodes";
import { NodeShell } from "../node-shell";
import { EnginePreviewTrigger } from "../engine-preview-trigger";
import { NodeEngineLayout, NODE_BTN_STORY_ACTION } from "../node-ui";
import {
  StoryEngineActionsModal,
  type BatchSelectItem,
  type StoryBatchRunOptions,
  type StoryEngineModalKind,
  type StoryEngineModalTab,
} from "../story-engine-actions-modal";
import {
  UpstreamChipRow,
  useUpstreamChips,
  sortUpstreamChips,
} from "../upstream-chips";
import { formatCanvasTaskError } from "@/lib/canvas/friendly-task-error";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { useUserProviders } from "@/lib/canvas/use-user-providers";
import { pickDefaultStoryLlmEngine } from "@/lib/canvas/system-providers";
import type { MentionableItem } from "../mentions/MentionsTextarea";

const ERROR_TOAST_MS = 8000;

const META: Record<
  StoryLlmNodeType,
  { title: string; icon: React.ReactNode; outputLabel: string }
> = {
  "story-outline-engine": {
    title: "故事大纲",
    icon: <BookOpen className="size-3" />,
    outputLabel: "大纲 MD",
  },
  "character-engine": {
    title: "角色设定",
    icon: <Users className="size-3" />,
    outputLabel: "角色表 MD",
  },
  "storyboard-engine": {
    title: "分镜脚本",
    icon: <Clapperboard className="size-3" />,
    outputLabel: "分镜表 MD",
  },
};

const MODAL_KIND: Record<StoryLlmNodeType, StoryEngineModalKind> = {
  "story-outline-engine": "outline",
  "character-engine": "character",
  "storyboard-engine": "storyboard",
};

function useStoryBatchStore(): StoryBatchStore {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const addNode = useCanvasStore((s) => s.addNode);
  const addNodeInGroup = useCanvasStore((s) => s.addNodeInGroup);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const reparentNode = useCanvasStore((s) => s.reparentNode);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const reflowStoryComicLayout = useCanvasStore(
    (s) => s.reflowStoryComicLayout,
  );
  return {
    nodes,
    edges,
    getNodes: () => useCanvasStore.getState().nodes,
    addNode,
    addNodeInGroup,
    setEdges,
    reparentNode,
    updateNodeData,
    reflowStoryComicLayout,
  };
}

function patchStarterPipelineStage(stage: StoryComicPipelineStage) {
  const starter = useCanvasStore
    .getState()
    .nodes.find((n) => n.type === "story-comic-starter");
  if (starter) {
    useCanvasStore.getState().updateNodeData(starter.id, { pipelineStage: stage });
  }
}

function statusLabel(status: string, isGenerating: boolean): string {
  if (isGenerating) return "生成中…";
  if (status === "done") return "已完成";
  if (status === "error") return "失败";
  if (status === "pending") return "排队中";
  return "待生成";
}

function isNodeRunning(status?: string) {
  return status === "running" || status === "pending";
}

function storyLlmIcon(nodeType: StoryLlmNodeType, className = "size-3") {
  const cls = className;
  if (nodeType === "story-outline-engine") {
    return <BookOpen className={cls} />;
  }
  if (nodeType === "character-engine") {
    return <Users className={cls} />;
  }
  return <Clapperboard className={cls} />;
}

function StoryEngineNodeInner({
  id,
  data,
  selected,
  nodeType,
  onRunNext,
  onRunNextForce,
  isNextRunning,
  batchSelectItems,
  batchImageAllowedKeys,
  footerExtra,
  columnPanel,
  minHeight = 220,
}: NodeProps & {
  nodeType: StoryLlmNodeType;
  onRunNext?: (opts: StoryBatchRunOptions) => void;
  onRunNextForce?: (opts: StoryBatchRunOptions) => void;
  isNextRunning?: boolean;
  batchSelectItems?: BatchSelectItem[];
  batchImageAllowedKeys?: readonly string[];
  footerExtra?: React.ReactNode;
  columnPanel?: React.ReactNode;
  minHeight?: number;
}) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const d = data as unknown as StoryEngineNodeData;
  const { providers } = useUserProviders();
  const meta = META[nodeType];
  const runtimeStatus = d.runtime?.status ?? "idle";
  const [modalState, setModalState] = useState<{
    open: boolean;
    tab?: StoryEngineModalTab;
  }>({ open: false });
  const openModal = (tab: StoryEngineModalTab) => {
    setModalState({ open: true, tab });
  };

  const [errorToast, setErrorToast] = useState<{
    code?: string;
    message: string;
  } | null>(null);

  const chips = sortUpstreamChips(useUpstreamChips(id));
  const mentionables = useMemo<MentionableItem[]>(
    () => chips.map((c) => ({ id: c.id, label: c.label, kind: c.kind })),
    [chips],
  );
  const referenced = useMemo(
    () => resolveReferencedNodeIds(d.prompt ?? "", chips),
    [d.prompt, chips],
  );

  const text = d.runtime?.textOutput;
  const hasGenerated = Boolean(text?.trim()) || d.runtime?.status === "done";
  const isGenerating =
    runtimeStatus === "running" || runtimeStatus === "pending";

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
    if (runtimeStatus === "running" || runtimeStatus === "pending") {
      setErrorToast(null);
      return;
    }
    if (runtimeStatus !== "error" || !d.runtime?.failMessage) return;
    setErrorToast({
      code: d.runtime.failCode,
      message: d.runtime.failMessage,
    });
    const timer = window.setTimeout(() => setErrorToast(null), ERROR_TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [runtimeStatus, d.runtime?.failCode, d.runtime?.failMessage]);

  const onPickEngine = (next: {
    providerId: string;
    modelKey: string;
    params: Record<string, unknown>;
  }) => {
    updateNodeData(id, {
      providerId: next.providerId,
      modelKey: next.modelKey,
      params: next.params,
    });
  };

  const onPromptChange = (value: string) => {
    updateNodeData(id, {
      prompt: value,
      referencedNodeIds: resolveReferencedNodeIds(value, chips),
    });
  };

  const onPickBatchImage = (next: {
    providerId: string;
    modelKey: string;
    params?: Record<string, unknown>;
  }) => {
    updateNodeData(id, {
      batchImage: {
        providerId: next.providerId,
        modelKey: next.modelKey,
        params: next.params ?? {},
      },
    });
  };

  const onRunCopy = (forceFresh: boolean) => {
    window.dispatchEvent(
      new CustomEvent("canvas:run-node", { detail: { nodeId: id, forceFresh } }),
    );
  };

  const onCopy = async () => {
    if (!text?.trim()) return;
    await navigator.clipboard.writeText(text);
  };

  const previewLine = text?.trim()
    ? text.trim().replace(/\s+/g, " ").slice(0, 120) +
      (text.trim().length > 120 ? "…" : "")
    : null;

  return (
    <>
      <NodeShell
        title={meta.title}
        subtitle={d.modelKey || "推荐 DeepSeek / Gemini"}
        selected={selected}
        engine
        minWidth={nodeType === "story-outline-engine" ? 360 : 520}
        minHeight={minHeight}
        inputs={[{ id: "in_text", label: "上游文本", kind: "text" }]}
        outputs={[{ id: "text", label: meta.outputLabel, kind: "text" }]}
        headerRight={
          <EnginePreviewTrigger
            title={meta.title}
            kind="markdown"
            content={text}
            status={runtimeStatus}
            failMessage={errorToast?.message ?? d.runtime?.failMessage}
            extra={
              <>
                {errorToast ? (
                  <span
                    className="max-w-[100px] truncate rounded bg-red-500/20 px-1 py-0.5 text-[9px] text-red-200"
                    title={errorToast.message}
                  >
                    {errorToast.message}
                  </span>
                ) : null}
                {text?.trim() ? (
                  <button
                    type="button"
                    className="nodrag rounded border border-white/15 px-1 py-0.5 text-[9px] hover:bg-white/10"
                    onClick={() => void onCopy()}
                  >
                    <Copy className="inline size-2.5" />
                  </button>
                ) : null}
              </>
            }
          />
        }
        footer={
          <div className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="text-[#fb923c]">
                {storyLlmIcon(nodeType)}
              </span>
              <span className="truncate text-[var(--canvas-muted)]">
                Story LLM
              </span>
            </span>
            <span
              className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${
                isGenerating
                  ? "bg-amber-500/20 text-amber-200"
                  : runtimeStatus === "done"
                    ? "bg-emerald-500/15 text-emerald-200"
                    : "bg-white/5 text-[var(--canvas-muted)]"
              }`}
            >
              {statusLabel(runtimeStatus, isGenerating)}
            </span>
          </div>
        }
      >
        <NodeEngineLayout
          engineFooter={
            <div className="flex flex-wrap gap-1.5 border-t border-white/10 pt-2">
              <button
                type="button"
                className={NODE_BTN_STORY_ACTION}
                onClick={() => openModal("copy")}
              >
                文案
              </button>
              {nodeType === "story-outline-engine" ? (
                <button
                  type="button"
                  className={NODE_BTN_STORY_ACTION}
                  onClick={() => openModal("preview")}
                >
                  预览
                </button>
              ) : null}
              {footerExtra}
            </div>
          }
        >
          {chips.length > 0 ? (
            <UpstreamChipRow chips={chips} referenced={referenced} />
          ) : (
            <p className="shrink-0 text-[10px] text-[var(--canvas-muted)]">
              由漫剧启动节点自动创建
            </p>
          )}

          {columnPanel ?? (
            <div className="min-h-[72px] flex-1 rounded-md border border-white/10 bg-black/30 p-2">
              {runtimeStatus === "error" && d.runtime?.failMessage ? (
                <p className="text-[11px] leading-relaxed text-red-200">
                  {formatCanvasTaskError(
                    d.runtime.failCode,
                    d.runtime.failMessage,
                  )}
                </p>
              ) : previewLine ? (
                <p className="line-clamp-4 text-[11px] leading-relaxed text-white/75">
                  {previewLine}
                </p>
              ) : (
                <p className="text-[11px] text-[var(--canvas-muted)]">
                  点「文案」编辑 Prompt 并生成本步
                </p>
              )}
            </div>
          )}
        </NodeEngineLayout>
      </NodeShell>

      <StoryEngineActionsModal
        open={modalState.open}
        initialTab={modalState.tab}
        onClose={() => setModalState({ open: false })}
        title={meta.title}
        kind={MODAL_KIND[nodeType]}
        prompt={d.prompt ?? ""}
        onPromptChange={onPromptChange}
        mentionables={mentionables}
        providerId={d.providerId ?? ""}
        modelKey={d.modelKey ?? ""}
        params={d.params ?? {}}
        onPickEngine={onPickEngine}
        batchImage={d.batchImage}
        onPickBatchImage={onPickBatchImage}
        textOutput={text}
        isGenerating={isGenerating}
        hasGenerated={hasGenerated}
        isNextRunning={isNextRunning}
        onRunCopy={onRunCopy}
        onRunNext={onRunNext}
        onRunNextForce={onRunNextForce}
        batchSelectItems={batchSelectItems}
        batchImageAllowedKeys={batchImageAllowedKeys}
      />
    </>
  );
}

export function StoryOutlineEngineNode(props: NodeProps) {
  return <StoryOutlineEngineNodeWithActions {...props} />;
}

function StoryOutlineEngineNodeWithActions(props: NodeProps) {
  const dialogs = useDialogs();
  const store = useStoryBatchStore();
  const [busy, setBusy] = useState(false);
  const ids = resolveStoryEngineIds(store);
  const charNode = store.nodes.find((n) => n.id === ids?.characterId);
  const charData = charNode?.data as StoryEngineNodeData | undefined;
  const charMd = getCharacterMarkdown(store);
  const batchItems = buildCharacterBatchSelectItems(charMd);

  const onGenerateThreeView = async () => {
    if (!ids?.characterId) {
      await dialogs.alert({
        title: "缺少角色设定节点",
        message: "请先完成漫剧启动的文案生成。",
        variant: "warning",
      });
      return;
    }
    const batchImage = charData?.batchImage;
    if (!batchImage?.providerId || !batchImage.modelKey) {
      await dialogs.alert({
        title: "请选择 IMAGE 模型",
        message: "请打开「角色设定」→「文案」弹层，在「三视图」Tab 选择生图模型。",
        variant: "warning",
      });
      return;
    }
    const keys = batchItems.map((b) => b.key);
    if (!keys.length) return;
    setBusy(true);
    const res = await runThreeViewBatchAction(store, {
      selectedKeys: keys,
      forceFresh: false,
      characterNodeId: ids.characterId,
      batchImage,
    });
    setBusy(false);
    if (!res.ok) {
      await dialogs.alert({
        title: res.title,
        message: res.message,
        variant: "warning",
      });
    }
  };

  return (
    <StoryEngineNodeInner
      {...props}
      nodeType="story-outline-engine"
      minHeight={280}
      footerExtra={
        <button
          type="button"
          className={NODE_BTN_STORY_ACTION}
          disabled={busy}
          onClick={() => void onGenerateThreeView()}
        >
          {busy ? "生成中…" : "生成三视图"}
        </button>
      }
    />
  );
}

export function CharacterEngineNode(props: NodeProps) {
  return <CharacterEngineNodeWithBatch {...props} />;
}

function CharacterEngineNodeWithBatch(props: NodeProps) {
  const dialogs = useDialogs();
  const store = useStoryBatchStore();
  const storeNodes = store.nodes;
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [footerBusy, setFooterBusy] = useState(false);

  const isNextRunning = useMemo(
    () =>
      storeNodes.some((n) => {
        if (n.type !== "three-view-engine") return false;
        const st = (n.data as { runtime?: { status?: string } }).runtime
          ?.status;
        return isNodeRunning(st);
      }),
    [storeNodes],
  );

  const d = props.data as unknown as StoryEngineNodeData;
  const charMd = d.runtime?.textOutput ?? "";
  const batchSelectItems = useMemo(
    () => buildCharacterBatchSelectItems(charMd),
    [charMd],
  );
  const columnRows = useMemo(
    () => collectCharacterColumnRows(store.getNodes(), charMd),
    [store.nodes, charMd],
  );

  const runThreeViewBatch = async (opts: StoryBatchRunOptions) => {
    const batchImage = d.batchImage;
    if (!batchImage?.providerId || !batchImage.modelKey) return;
    const res = await runThreeViewBatchAction(store, {
      ...opts,
      characterNodeId: props.id,
      batchImage,
    });
    if (!res.ok) {
      await dialogs.alert({
        title: res.title,
        message: res.message,
        variant: "warning",
      });
    }
  };

  const onRegenerateAll = async () => {
    setFooterBusy(true);
    window.dispatchEvent(
      new CustomEvent("canvas:run-node", {
        detail: { nodeId: props.id, forceFresh: true },
      }),
    );
    await new Promise((r) => window.setTimeout(r, 800));
    const keys = batchSelectItems.map((b) => b.key);
    if (keys.length && d.batchImage?.providerId && d.batchImage.modelKey) {
      await runThreeViewBatch({ selectedKeys: keys, forceFresh: true });
    }
    setFooterBusy(false);
  };

  const onSpawnFrames = async () => {
    const ids = resolveStoryEngineIds(store);
    if (!ids?.storyboardId) {
      await dialogs.alert({
        title: "缺少分镜脚本",
        message: "请先完成漫剧启动的全文案生成。",
        variant: "warning",
      });
      return;
    }
    const sbMd = getStoryboardMarkdown(store);
    const sbNode = store.nodes.find((n) => n.id === ids.storyboardId);
    const batchImage =
      (sbNode?.data as StoryEngineNodeData).batchImage ?? d.batchImage;
    if (!batchImage?.providerId || !batchImage.modelKey) {
      await dialogs.alert({
        title: "请选择 IMAGE 模型",
        message: "请在分镜脚本或本节点配置分镜图模型。",
        variant: "warning",
      });
      return;
    }
    const keys = buildStoryboardBatchSelectItems(sbMd).map((b) => b.key);
    const autoRun = await dialogs.confirm({
      title: "生成分镜图节点",
      message: `将为 ${keys.length} 镜创建分镜图节点。创建后立即批量生图？`,
      confirmLabel: "创建并生图",
      cancelLabel: "仅创建",
    });
    setFooterBusy(true);
    const res = await runFrameImagesBatchAction(store, {
      selectedKeys: keys,
      storyboardNodeId: ids.storyboardId,
      batchImage,
      autoRunImages: autoRun,
    });
    setFooterBusy(false);
    if (!res.ok) {
      await dialogs.alert({
        title: res.title,
        message: res.message,
        variant: "warning",
      });
    }
  };

  return (
    <StoryEngineNodeInner
      {...props}
      nodeType="character-engine"
      onRunNext={runThreeViewBatch}
      onRunNextForce={runThreeViewBatch}
      isNextRunning={isNextRunning}
      batchSelectItems={batchSelectItems}
      batchImageAllowedKeys={THREE_VIEW_ENGINE_MODEL_KEYS}
      minHeight={420}
      columnPanel={
        <StoryCharacterColumnPanel
          rows={columnRows}
          busyKey={busyKey}
          onRegenerateRow={(row) => {
            const ws = findStoryWorkspaceIds(store.getNodes());
            const columnId = ws?.characterColumnId;
            setBusyKey(row.key);
            if (columnId) {
              busEnqueueStoryRun({
                nodeId: columnId,
                rowKey: row.key,
                mediaKind: "threeView",
                forceFresh: true,
              });
            } else if (row.threeViewNodeId) {
              window.dispatchEvent(
                new CustomEvent("canvas:run-node", {
                  detail: { nodeId: row.threeViewNodeId, forceFresh: true },
                }),
              );
            } else {
              setBusyKey(null);
              return;
            }
            window.setTimeout(() => setBusyKey(null), 2000);
          }}
        />
      }
      footerExtra={
        <>
          <button
            type="button"
            className={NODE_BTN_STORY_ACTION}
            disabled={footerBusy}
            onClick={() => void onRegenerateAll()}
          >
            {footerBusy ? "处理中…" : "全部重新生成"}
          </button>
          <button
            type="button"
            className={NODE_BTN_STORY_ACTION}
            disabled={footerBusy}
            onClick={() => void onSpawnFrames()}
          >
            生成分镜
          </button>
        </>
      }
    />
  );
}

export function StoryboardEngineNode(props: NodeProps) {
  return <StoryboardEngineNodeWithBatch {...props} />;
}

function StoryboardEngineNodeWithBatch(props: NodeProps) {
  const dialogs = useDialogs();
  const store = useStoryBatchStore();
  const updateNodeData = store.updateNodeData;
  const storeNodes = store.nodes;
  const [footerBusy, setFooterBusy] = useState(false);

  const d = props.data as unknown as StoryEngineNodeData;
  const md = d.runtime?.textOutput ?? "";

  const isNextRunning = useMemo(
    () =>
      storeNodes.some((n) => {
        if (n.type !== "image-engine") return false;
        if ((n.data as { frameIndex?: number }).frameIndex == null) return false;
        const st = (n.data as { runtime?: { status?: string } }).runtime
          ?.status;
        return isNodeRunning(st);
      }),
    [storeNodes],
  );

  const batchSelectItems = useMemo(
    () => buildStoryboardBatchSelectItems(md),
    [md],
  );
  const columnRows = useMemo(
    () => collectStoryboardColumnRows(store.getNodes(), md),
    [store.nodes, md],
  );

  const runFrameImagesBatch = async (opts: StoryBatchRunOptions) => {
    const batchImage = d.batchImage;
    if (!batchImage?.providerId || !batchImage.modelKey) return;
    const res = await runFrameImagesBatchAction(store, {
      ...opts,
      storyboardNodeId: props.id,
      batchImage,
    });
    if (!res.ok) {
      await dialogs.alert({
        title: res.title,
        message: res.message,
        variant: "warning",
      });
    }
  };

  const onRegenerateScript = async () => {
    setFooterBusy(true);
    window.dispatchEvent(
      new CustomEvent("canvas:run-node", {
        detail: { nodeId: props.id, forceFresh: true },
      }),
    );
    await new Promise((r) => window.setTimeout(r, 800));
    const keys = batchSelectItems.map((b) => b.key);
    if (keys.length && d.batchImage?.providerId && d.batchImage.modelKey) {
      await runFrameImagesBatch({ selectedKeys: keys });
    }
    setFooterBusy(false);
  };

  const onSpawnMedia = async () => {
    const video =
      d.batchVideo ??
      (d.providerId && d.modelKey ?
        {
          providerId: d.providerId,
          modelKey: STORY_VIDEO_MODEL_KEYS[0] ?? d.modelKey,
          params: d.params ?? {},
        }
      : undefined);
    const tts = d.batchTts;
    if (!video?.providerId || !video.modelKey) {
      await dialogs.alert({
        title: "请选择 VIDEO 模型",
        message: "请先在「文案」弹层配置 LLM/Provider，或设置 batchVideo。",
        variant: "warning",
      });
      return;
    }
    if (!d.batchVideo) {
      updateNodeData(props.id, { batchVideo: video });
    }
    setFooterBusy(true);
    const res = await runFrameMediaBatchAction(store, {
      storyboardNodeId: props.id,
      videoDefaults: video,
      ttsDefaults: tts,
    });
    setFooterBusy(false);
    if (!res.ok) {
      await dialogs.alert({
        title: res.title,
        message: res.message,
        variant: "warning",
      });
    }
  };

  return (
    <StoryEngineNodeInner
      {...props}
      nodeType="storyboard-engine"
      onRunNext={runFrameImagesBatch}
      onRunNextForce={runFrameImagesBatch}
      isNextRunning={isNextRunning}
      batchSelectItems={batchSelectItems}
      minHeight={420}
      columnPanel={
        <StoryFrameColumnPanel
          rows={columnRows}
          onOpenRow={(row) => {
            const targetId = row.imageNodeId;
            if (!targetId) return;
            useCanvasStore.getState().setNodes((nodes) =>
              nodes.map((n) => ({
                ...n,
                selected: n.id === targetId,
              })),
            );
          }}
        />
      }
      footerExtra={
        <>
          <button
            type="button"
            className={NODE_BTN_STORY_ACTION}
            disabled={footerBusy}
            onClick={() => void onRegenerateScript()}
          >
            {footerBusy ? "处理中…" : "重新生成"}
          </button>
          <button
            type="button"
            className={NODE_BTN_STORY_ACTION}
            disabled={footerBusy}
            onClick={() => void onSpawnMedia()}
          >
            生成分镜视频+对白
          </button>
        </>
      }
    />
  );
}
