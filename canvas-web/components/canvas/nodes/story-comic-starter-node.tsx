"use client";

import { useEffect, useMemo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Clapperboard, Play, RefreshCw, Sparkles } from "lucide-react";

import { useCanvasStore } from "@/lib/canvas/store";
import type {
  CanvasNodeRuntime,
  StoryComicStarterNodeData,
} from "@/lib/canvas/types";
import { STORY_LLM_MODEL_KEYS } from "@/lib/canvas/types";
import { RF_NODE_SCROLL } from "@/lib/canvas/react-flow-classes";
import { runStoryLlmPipelineSequential } from "@/lib/canvas/batch-run-nodes";
import {
  findStoryLlmEnginesForStarter,
  spawnStoryLlmEngines,
  storyLlmPipelineNodeIds,
  syncStoryLlmEnginesFromStarter,
} from "@/lib/canvas/spawn-story-llm-engines";
import { formatCanvasTaskError } from "@/lib/canvas/friendly-task-error";
import { storyLlmNodeIsComplete, storyLlmNodeNeedsRun } from "@/lib/canvas/story-llm-runtime";
import { NodeShell, ENGINE_ACCENT, NodeStatusBadge } from "../node-shell";
import { EnginePicker } from "../engine-picker";
import { useUserProviders } from "@/lib/canvas/use-user-providers";
import { pickDefaultStoryLlmEngine } from "@/lib/canvas/system-providers";

const STAGE_LABELS: Record<string, string> = {
  idle: "1/5 · 填写主题并开始",
  llm_done: "2/5 · 确认文案 → 生成三视图",
  tv_done: "3/5 · 确认三视图 → 生成分镜图",
  frames_done: "4/5 · 确认分镜图 → 视频/配音",
  media_done: "5/5 · 下载剪映包",
};

function aggregateLlmPipelineStatus(
  nodes: ReturnType<typeof useCanvasStore.getState>["nodes"],
  edges: ReturnType<typeof useCanvasStore.getState>["edges"],
  starterNodeId: string,
  storedIds?: StoryComicStarterNodeData["llmEngineIds"],
): {
  status: CanvasNodeRuntime["status"];
  failMessage: string | null;
} {
  const ids = findStoryLlmEnginesForStarter(
    nodes,
    edges,
    starterNodeId,
    storedIds,
  );
  if (!ids) return { status: "idle", failMessage: null };

  const statuses = storyLlmPipelineNodeIds(ids).map((id) => {
    const n = nodes.find((x) => x.id === id);
    return (
      (n?.data as { runtime?: CanvasNodeRuntime })?.runtime?.status ?? "idle"
    );
  });

  if (statuses.some((s) => s === "running")) {
    return { status: "running", failMessage: null };
  }
  if (statuses.some((s) => s === "pending")) {
    return { status: "pending", failMessage: null };
  }
  if (statuses.some((s) => s === "error")) {
    const errNode = storyLlmPipelineNodeIds(ids)
      .map((id) => nodes.find((x) => x.id === id))
      .find(
        (n) =>
          (n?.data as { runtime?: CanvasNodeRuntime })?.runtime?.status ===
          "error",
      );
    const msg =
      formatCanvasTaskError(
        (errNode?.data as { runtime?: CanvasNodeRuntime })?.runtime?.failCode,
        (errNode?.data as { runtime?: CanvasNodeRuntime })?.runtime
          ?.failMessage,
      ) || "文案生成失败";
    return { status: "error", failMessage: msg };
  }
  if (statuses.length > 0 && statuses.every((s) => s === "done")) {
    const allHaveText = storyLlmPipelineNodeIds(ids).every((nodeId) => {
      const n = nodes.find((x) => x.id === nodeId);
      return n ? storyLlmNodeIsComplete(n) : false;
    });
    if (allHaveText) return { status: "done", failMessage: null };
  }
  if (
    storyLlmPipelineNodeIds(ids).some((nodeId) => {
      const n = nodes.find((x) => x.id === nodeId);
      return n ? storyLlmNodeNeedsRun(n, false) : true;
    })
  ) {
    return { status: "idle", failMessage: null };
  }
  return { status: "idle", failMessage: null };
}

export function StoryComicStarterNode({ id, data, selected }: NodeProps) {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const addNode = useCanvasStore((s) => s.addNode);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const reflowStoryComicLayout = useCanvasStore(
    (s) => s.reflowStoryComicLayout,
  );

  const d = data as unknown as StoryComicStarterNodeData;
  const { providers } = useUserProviders();
  const stage = d.pipelineStage ?? "idle";
  const hasLlmEngines = useMemo(
    () =>
      Boolean(
        findStoryLlmEnginesForStarter(nodes, edges, id, d.llmEngineIds),
      ),
    [nodes, edges, id, d.llmEngineIds],
  );

  const pipeline = useMemo(
    () => aggregateLlmPipelineStatus(nodes, edges, id, d.llmEngineIds),
    [nodes, edges, id, d.llmEngineIds],
  );
  const isGenerating =
    pipeline.status === "running" || pipeline.status === "pending";
  const canRun = Boolean(d.theme?.trim() && d.providerId && d.modelKey);

  useEffect(() => {
    if (d.providerId?.trim() && d.modelKey?.trim()) return;
    const pick = pickDefaultStoryLlmEngine(providers);
    if (!pick) return;
    updateNodeData(id, {
      providerId: pick.providerId,
      modelKey: pick.modelKey,
    });
  }, [d.providerId, d.modelKey, providers, id, updateNodeData]);

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

  const runPipeline = (forceFresh: boolean) => {
    if (!canRun || isGenerating) return;

    const state = useCanvasStore.getState();
    const linked = findStoryLlmEnginesForStarter(
      state.nodes,
      state.edges,
      id,
      d.llmEngineIds,
    );
    const effectiveForceFresh =
      forceFresh ||
      pipeline.status === "error" ||
      Boolean(
        linked &&
          storyLlmPipelineNodeIds(linked).some((nodeId) => {
            const n = state.nodes.find((x) => x.id === nodeId);
            if (!n) return false;
            const rt = (n.data as { runtime?: CanvasNodeRuntime }).runtime;
            return (
              rt?.status === "error" ||
              (rt?.status === "done" && !storyLlmNodeIsComplete(n))
            );
          }),
      );

    const hadEngines = Boolean(linked);

    const ids = spawnStoryLlmEngines({
      starterNodeId: id,
      theme: d.theme,
      providerId: d.providerId,
      modelKey: d.modelKey,
      params: d.params ?? {},
      nodes: state.nodes,
      edges: state.edges,
      addNode: (type, position, nodeData) =>
        addNode(type, position, nodeData),
      setEdges,
      updateNodeData,
    });

    syncStoryLlmEnginesFromStarter({
      starterNodeId: id,
      theme: d.theme,
      providerId: d.providerId,
      modelKey: d.modelKey,
      params: d.params ?? {},
      ids,
      updateNodeData,
    });

    if (!hadEngines) {
      reflowStoryComicLayout();
    }

    const nodeIds = storyLlmPipelineNodeIds(ids);
    runStoryLlmPipelineSequential(nodeIds, {
      forceFresh: effectiveForceFresh,
    });
  };

  useEffect(() => {
    if (pipeline.status === "done" && hasLlmEngines) {
      updateNodeData(id, { pipelineStage: "llm_done" });
    }
  }, [pipeline.status, hasLlmEngines, id, updateNodeData]);

  return (
    <NodeShell
      title="漫剧启动"
      subtitle={STAGE_LABELS[stage] ?? STAGE_LABELS.idle}
      selected={selected}
      engine
      accent={ENGINE_ACCENT}
      minWidth={400}
      minHeight={360}
      outputs={[{ id: "text", label: "创意", kind: "text" }]}
      headerRight={
        <NodeStatusBadge
          status={hasLlmEngines ? pipeline.status : "idle"}
          message={pipeline.failMessage}
        />
      }
      footer={
        <span className="flex items-center gap-1 text-[10px] text-[var(--canvas-muted)]">
          <Sparkles className="size-3" /> 向导式漫剧 · 分步批量生成
        </span>
      }
    >
      <div className="flex h-full flex-col gap-3">
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-wider text-[var(--canvas-muted)]">
            主题 / 概要
          </p>
          <textarea
            className={`${RF_NODE_SCROLL} nodrag min-h-[120px] w-full resize-y rounded-md border border-white/10 bg-black/30 p-2 text-[12px] text-white placeholder:text-[var(--canvas-muted)] focus:border-[#fb923c]/60 focus:outline-none disabled:opacity-60`}
            value={d.theme ?? ""}
            placeholder="描述故事创意、风格、人物关系…"
            disabled={isGenerating}
            onChange={(e) => updateNodeData(id, { theme: e.target.value })}
          />
        </div>

        <div className="space-y-1.5 border-t border-white/5 pt-2">
          <p className="text-[10px] uppercase tracking-wider text-[var(--canvas-muted)]">
            LLM 模型（三文案引擎共用）
          </p>
          <EnginePicker
            role="LLM"
            allowedModelKeys={[...STORY_LLM_MODEL_KEYS]}
            providerId={d.providerId ?? ""}
            modelKey={d.modelKey ?? ""}
            params={d.params ?? {}}
            onChange={onPickEngine}
          />
        </div>

        <div className="mt-auto flex flex-col gap-2 border-t border-white/10 pt-2">
          <button
            type="button"
            disabled={!canRun || isGenerating}
            className="nodrag inline-flex w-full items-center justify-center gap-1 rounded-md bg-[#fb923c] px-2 py-2 text-[12px] font-medium text-black hover:bg-[#fdba74] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => runPipeline(hasLlmEngines)}
          >
            {isGenerating ? (
              <>
                <RefreshCw className="size-3.5 animate-spin" /> 文案生成中…
              </>
            ) : hasLlmEngines ? (
              <>
                <RefreshCw className="size-3.5" /> 重新生成全部文案
              </>
            ) : (
              <>
                <Play className="size-3.5" /> 开始生成（大纲+角色+分镜）
              </>
            )}
          </button>
          {hasLlmEngines ? (
            <button
              type="button"
              disabled={!canRun || isGenerating}
              className="nodrag inline-flex w-full items-center justify-center gap-1 rounded-md border border-white/15 px-2 py-1.5 text-[11px] text-white/85 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => runPipeline(true)}
            >
              <RefreshCw className="size-3" /> 强制跳过缓存重跑
            </button>
          ) : null}
          {pipeline.status === "error" && pipeline.failMessage ? (
            <p className="rounded-md border border-red-400/30 bg-red-500/10 px-2 py-1.5 text-[11px] leading-relaxed text-red-200">
              {pipeline.failMessage}
            </p>
          ) : null}
          <p className="text-[10px] text-[var(--canvas-muted)]">
            <Clapperboard className="mr-0.5 inline size-3" />
            将自动创建故事大纲、角色设定、分镜脚本三个引擎并按顺序生成
          </p>
        </div>
      </div>
    </NodeShell>
  );
}
