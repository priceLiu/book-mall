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
import { THREE_VIEW_ENGINE_MODEL_KEYS } from "@/lib/canvas/types";
import { batchRunNodesSequential } from "@/lib/canvas/batch-run-nodes";
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
import {
  batchCreateThreeView,
  batchCreateFrameImages,
  collectFrameEngineIds,
  findStoryboardFramesMissingThreeView,
  allFrameImageNodesExist,
  collectThreeViewEngineIdsForCharacters,
  wireFrameImageCharacterRefs,
  applyEnginePickToNodes,
} from "@/lib/canvas/story-batch-spawn";
import {
  parseCharacterRows,
  parseStoryboardRows,
} from "@/lib/canvas/parse-md-tables";
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

const NODE_QUICK_ACTIONS: Record<
  StoryLlmNodeType,
  Array<{ tab: StoryEngineModalTab; label: string }>
> = {
  "story-outline-engine": [
    { tab: "copy", label: "文案" },
    { tab: "preview", label: "预览" },
  ],
  "character-engine": [
    { tab: "copy", label: "文案" },
    { tab: "next", label: "三视图" },
  ],
  "storyboard-engine": [
    { tab: "copy", label: "文案" },
    { tab: "next", label: "分镜图" },
  ],
};

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
}: NodeProps & {
  nodeType: StoryLlmNodeType;
  onRunNext?: (opts: StoryBatchRunOptions) => void;
  onRunNextForce?: (opts: StoryBatchRunOptions) => void;
  isNextRunning?: boolean;
  batchSelectItems?: BatchSelectItem[];
  batchImageAllowedKeys?: readonly string[];
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
  const quickActions = NODE_QUICK_ACTIONS[nodeType];

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
        minWidth={320}
        minHeight={220}
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
            <div className="flex gap-1.5 border-t border-white/10 pt-2">
              {quickActions.map(({ tab, label }) => (
                <button
                  key={tab}
                  type="button"
                  className={NODE_BTN_STORY_ACTION}
                  onClick={() => openModal(tab)}
                >
                  {label}
                </button>
              ))}
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

          <div className="min-h-[72px] flex-1 rounded-md border border-white/10 bg-black/30 p-2">
            {runtimeStatus === "error" && d.runtime?.failMessage ? (
              <p className="text-[11px] leading-relaxed text-red-200">
                {formatCanvasTaskError(d.runtime.failCode, d.runtime.failMessage)}
              </p>
            ) : previewLine ? (
              <p className="line-clamp-4 text-[11px] leading-relaxed text-white/75">
                {previewLine}
              </p>
            ) : (
              <p className="text-[11px] text-[var(--canvas-muted)]">
                点下方「文案」编辑 Prompt 并生成本步
              </p>
            )}
          </div>
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
  return (
    <StoryEngineNodeInner {...props} nodeType="story-outline-engine" />
  );
}

export function CharacterEngineNode(props: NodeProps) {
  return <CharacterEngineNodeWithBatch {...props} />;
}

function CharacterEngineNodeWithBatch(props: NodeProps) {
  const dialogs = useDialogs();
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

  const isNextRunning = useMemo(
    () =>
      nodes.some((n) => {
        if (n.type !== "three-view-engine") return false;
        const st = (n.data as { runtime?: { status?: string } }).runtime
          ?.status;
        return isNodeRunning(st);
      }),
    [nodes],
  );

  const charMd =
    (props.data as unknown as StoryEngineNodeData).runtime?.textOutput ?? "";
  const batchSelectItems = useMemo<BatchSelectItem[]>(
    () =>
      parseCharacterRows(charMd).map((c) => ({
        key: c.name,
        label: c.name,
        hint: c.role,
      })),
    [charMd],
  );

  const batchBase = {
    sourceNodeId: props.id,
    nodes,
    getNodes: () => useCanvasStore.getState().nodes,
    edges,
    addNode,
    addNodeInGroup,
    setEdges,
    reparentNode: (nodeId: string, groupId: string) =>
      reparentNode(nodeId, groupId),
  };

  const runThreeViewBatch = async ({
    forceFresh,
    selectedKeys,
  }: StoryBatchRunOptions) => {
    const d = props.data as unknown as StoryEngineNodeData;
    const md = d.runtime?.textOutput ?? "";
    const batchImage = d.batchImage;
    if (!selectedKeys.length) {
      await dialogs.alert({
        title: "未选择角色",
        message: "请至少勾选一个要生成三视图的角色。",
        variant: "warning",
      });
      return;
    }
    if (!batchImage?.providerId?.trim() || !batchImage?.modelKey?.trim()) {
      await dialogs.alert({
        title: "请选择 IMAGE 模型",
        message: "点节点「三视图」选择生图 Provider 后再批量生成。",
        variant: "warning",
      });
      return;
    }
    if (!md.trim()) {
      await dialogs.alert({
        title: "请先运行角色设定",
        message: "需要先生成角色 Markdown 表格，再批量创建三视图。",
        variant: "warning",
      });
      return;
    }
    const parsed = parseCharacterRows(md);
    if (!parsed.length) {
      await dialogs.alert({
        title: "无法解析角色表",
        message:
          "请确认输出为 GFM 表格，且含「角色 / Character」与「外观描述 / Appearance」列。",
        variant: "warning",
      });
      return;
    }

    batchCreateThreeView({
      ...batchBase,
      markdown: md,
      onlyCharacterNames: selectedKeys,
      imageDefaults: {
        providerId: batchImage.providerId,
        modelKey: batchImage.modelKey,
        params: batchImage.params ?? {},
      },
    });
    reflowStoryComicLayout();

    const live = () => useCanvasStore.getState().nodes;
    const tvIds = collectThreeViewEngineIdsForCharacters(live(), selectedKeys);
    applyEnginePickToNodes(tvIds, batchImage, updateNodeData);

    window.setTimeout(() => {
      batchRunNodesSequential(tvIds, { forceFresh });
    }, 0);
    patchStarterPipelineStage("tv_done");
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
    />
  );
}

export function StoryboardEngineNode(props: NodeProps) {
  return <StoryboardEngineNodeWithBatch {...props} />;
}

function StoryboardEngineNodeWithBatch(props: NodeProps) {
  const dialogs = useDialogs();
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

  const d = props.data as unknown as StoryEngineNodeData;
  const md = d.runtime?.textOutput ?? "";

  const isNextRunning = useMemo(
    () =>
      nodes.some((n) => {
        if (n.type !== "image-engine") return false;
        if ((n.data as { frameIndex?: number }).frameIndex == null) return false;
        const st = (n.data as { runtime?: { status?: string } }).runtime
          ?.status;
        return isNodeRunning(st);
      }),
    [nodes],
  );

  const batchSelectItems = useMemo<BatchSelectItem[]>(
    () =>
      parseStoryboardRows(md).map((r) => {
        const tipLines = [
          r.scene ? `场景：${r.scene}` : null,
          r.description ? `画面：${r.description}` : null,
          r.dialogue ? `对白：${r.dialogue}` : null,
          r.videoPrompt ? `视频：${r.videoPrompt}` : null,
        ].filter(Boolean);
        return {
          key: String(r.frameIndex),
          label: `镜 ${r.frameIndex}`,
          hint: r.scene || r.description.slice(0, 24),
          tip: tipLines.length ? tipLines.join("\n") : undefined,
        };
      }),
    [md],
  );

  const batchBase = {
    sourceNodeId: props.id,
    nodes,
    getNodes: () => useCanvasStore.getState().nodes,
    edges,
    addNode,
    addNodeInGroup,
    setEdges,
    reparentNode: (nodeId: string, groupId: string) =>
      reparentNode(nodeId, groupId),
  };

  const runFrameImagesBatch = async ({
    selectedKeys,
  }: StoryBatchRunOptions) => {
    const batchImage = d.batchImage;
    const frameIndices = selectedKeys
      .map((k) => parseInt(k, 10))
      .filter((n) => !Number.isNaN(n));
    if (!frameIndices.length) {
      await dialogs.alert({
        title: "未选择镜号",
        message: "请至少勾选一镜要创建的分镜图节点。",
        variant: "warning",
      });
      return;
    }
    if (!batchImage?.providerId?.trim() || !batchImage?.modelKey?.trim()) {
      await dialogs.alert({
        title: "请选择 IMAGE 模型",
        message: "点节点「分镜图」选择生图 Provider 后再创建节点。",
        variant: "warning",
      });
      return;
    }
    if (!md.trim()) return;

    const updateOnly = allFrameImageNodesExist(nodes, frameIndices);

    if (!updateOnly) {
      const frameGaps = findStoryboardFramesMissingThreeView({
        markdown: md,
        nodes,
        onlyFrameIndices: frameIndices,
      });
      if (frameGaps.length) {
        const lines = frameGaps.map((g) => {
          const chars = g.characters
            .map((c) =>
              c.reason === "no_node"
                ? `${c.name}（未创建三视图）`
                : `${c.name}（三视图未生成）`,
            )
            .join("、");
          return `镜 ${g.frameIndex}：${chars}`;
        });
        await dialogs.alert({
          title: "请先完成本镜涉及的角色三视图",
          message: `以下选中镜号涉及的角色三视图尚未就绪：\n\n${lines.map((l) => `· ${l}`).join("\n")}\n\n请先到「角色设定」→ 三视图，为对应角色创建并生成；无需一次性创建全部角色。`,
          variant: "warning",
        });
        return;
      }
    }

    batchCreateFrameImages({
      ...batchBase,
      markdown: md,
      onlyFrameIndices: frameIndices,
      imageDefaults: {
        providerId: batchImage.providerId,
        modelKey: batchImage.modelKey,
        params: batchImage.params ?? {},
      },
    });
    wireFrameImageCharacterRefs({
      ...batchBase,
      markdown: md,
      onlyFrameIndices: frameIndices,
      updateNodeData,
    });
    reflowStoryComicLayout();

    const live = useCanvasStore.getState().nodes;
    const imgIds = collectFrameEngineIds(live, "image-engine", frameIndices);
    applyEnginePickToNodes(imgIds, batchImage, updateNodeData);

    patchStarterPipelineStage("frames_done");
  };

  return (
    <StoryEngineNodeInner
      {...props}
      nodeType="storyboard-engine"
      onRunNext={runFrameImagesBatch}
      onRunNextForce={runFrameImagesBatch}
      isNextRunning={isNextRunning}
      batchSelectItems={batchSelectItems}
    />
  );
}
