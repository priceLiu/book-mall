"use client";

import { useCallback, useEffect, useMemo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Lock, PenLine, RefreshCw, Sparkles } from "lucide-react";

import { useCanvasStore } from "@/lib/canvas/store";
import type { StoryComicStarterNodeData } from "@/lib/canvas/types";
import {
  STORY_LLM_MODEL_KEYS,
  STORY_THEME_SYSTEM_PROMPT_TEMPLATES,
  type StoryThemeSystemPromptTemplateId,
} from "@/lib/canvas/types";
import { matchStoryThemeSystemPromptTemplateId } from "@/lib/canvas/story-prompts";
import {
  STORY_NODE_ACTION_BTN_CLASS,
  storyComicStarterNodeHeight,
  storyStarterPromptTextareaMinHeight,
} from "@/lib/canvas/story-node-chrome";
import { StoryNodeFooterShell } from "../story-node-footer-shell";
import { nodeMeasuredSize } from "@/lib/canvas/normalize-graph-nodes";
import { RF_NODE_SCROLL } from "@/lib/canvas/react-flow-classes";
import { runStoryHubSectionsSequential } from "@/lib/canvas/batch-run-nodes";
import {
  findStoryScriptHubForStarter,
  spawnStoryScriptHub,
  STORY_HUB_SECTION_ORDER,
  syncStoryHubFromStarter,
} from "@/lib/canvas/spawn-story-workspace";
import {
  hubAggregateStatus,
  hubSectionRuntime,
} from "@/lib/canvas/story-hub-runtime";
import type { StoryScriptHubNodeData } from "@/lib/canvas/story-workspace-types";
import { NodeShell, ENGINE_ACCENT, NodeStatusBadge } from "../node-shell";
import { EnginePicker } from "../engine-picker";
import { useUserProviders } from "@/lib/canvas/use-user-providers";
import { pickDefaultStoryLlmEngine } from "@/lib/canvas/system-providers";

const STAGE_LABELS: Record<string, string> = {
  idle: "填写创意 → 创作剧本",
  llm_done: "剧本已生成 · 打开「故事大纲」审阅",
  finalized: "已定稿 · 工作流已输出",
};

export function StoryComicStarterNode({ id, data, selected }: NodeProps) {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const addNode = useCanvasStore((s) => s.addNode);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const resizeNode = useCanvasStore((s) => s.resizeNode);
  const reflowStoryComicLayout = useCanvasStore(
    (s) => s.reflowStoryComicLayout,
  );

  const promptMinHeight = storyStarterPromptTextareaMinHeight();

  const d = data as unknown as StoryComicStarterNodeData;
  const { providers } = useUserProviders();
  const stage = d.pipelineStage ?? "idle";
  const isFinalized = stage === "finalized";

  const scriptHub = useMemo(
    () =>
      findStoryScriptHubForStarter(nodes, edges, id, d.workspaceIds),
    [nodes, edges, id, d.workspaceIds],
  );

  const hubStatus = useMemo(() => {
    if (!scriptHub) return { status: "idle" as const, failMessage: null };
    const hub = nodes.find((n) => n.id === scriptHub.scriptHubId);
    if (!hub) return { status: "idle" as const, failMessage: null };
    const runtimes = ["outline", "character", "storyboard"] as const;
    if (
      runtimes.some((s) => {
        const st = hubSectionRuntime(hub, s)?.status;
        return st === "running" || st === "pending";
      })
    ) {
      return { status: "running" as const, failMessage: null };
    }
    if (runtimes.some((s) => hubSectionRuntime(hub, s)?.status === "error")) {
      return {
        status: "error" as const,
        failMessage:
          (hubSectionRuntime(hub, "outline") as { failMessage?: string })
            ?.failMessage ?? "剧本生成失败",
      };
    }
    return { status: "idle" as const, failMessage: null };
  }, [nodes, scriptHub]);

  const canRun = Boolean(
    !isFinalized && d.systemPrompt?.trim() && d.providerId && d.modelKey,
  );
  const isGenerating = hubStatus.status === "running";

  const hasScriptDraft = useMemo(() => {
    if (!scriptHub) return false;
    const hub = nodes.find((n) => n.id === scriptHub.scriptHubId);
    if (!hub) return false;
    const hd = hub.data as StoryScriptHubNodeData;
    if ((hd.outlineMd ?? "").trim()) return true;
    return hubAggregateStatus(hub) === "done";
  }, [nodes, scriptHub]);

  useEffect(() => {
    if (isFinalized || !scriptHub) return;
    const ws = d.workspaceIds;
    if (
      ws?.characterColumnId &&
      ws.frameColumnId &&
      ws.videoColumnId
    ) {
      updateNodeData(id, { pipelineStage: "finalized" });
    }
  }, [
    isFinalized,
    scriptHub,
    d.workspaceIds?.characterColumnId,
    d.workspaceIds?.frameColumnId,
    d.workspaceIds?.videoColumnId,
    id,
    updateNodeData,
  ]);

  const activeTemplateId = useMemo((): StoryThemeSystemPromptTemplateId | "custom" => {
    if (d.systemPromptTemplateId) {
      const tpl = STORY_THEME_SYSTEM_PROMPT_TEMPLATES.find(
        (t) => t.id === d.systemPromptTemplateId,
      );
      if (tpl && d.systemPrompt?.trim() === tpl.content.trim()) {
        return d.systemPromptTemplateId;
      }
    }
    return matchStoryThemeSystemPromptTemplateId(d.systemPrompt ?? "") ?? "custom";
  }, [d.systemPrompt, d.systemPromptTemplateId]);

  const applyTemplate = (templateId: StoryThemeSystemPromptTemplateId) => {
    const tpl = STORY_THEME_SYSTEM_PROMPT_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;
    updateNodeData(id, {
      systemPromptTemplateId: templateId,
      systemPrompt: tpl.content,
    });
    if (scriptHub) {
      syncStoryHubFromStarter({
        starterNodeId: id,
        systemPrompt: tpl.content,
        providerId: d.providerId,
        modelKey: d.modelKey,
        params: d.params ?? {},
        scriptHubId: scriptHub.scriptHubId,
        updateNodeData,
      });
    }
  };

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
    const targetH = storyComicStarterNodeHeight();
    const node = useCanvasStore.getState().nodes.find((n) => n.id === id);
    if (!node) return;
    const { w, h } = nodeMeasuredSize(node);
    if (Math.abs(h - targetH) < 4) return;
    resizeNode(id, { width: w, height: targetH });
    reflowStoryComicLayout();
  }, [id, resizeNode, reflowStoryComicLayout]);

  const syncHubIfConnected = useCallback(() => {
    if (!scriptHub) return;
    syncStoryHubFromStarter({
      starterNodeId: id,
      systemPrompt: d.systemPrompt ?? "",
      providerId: d.providerId,
      modelKey: d.modelKey,
      params: d.params ?? {},
      scriptHubId: scriptHub.scriptHubId,
      updateNodeData,
    });
  }, [
    scriptHub,
    id,
    d.systemPrompt,
    d.providerId,
    d.modelKey,
    d.params,
    updateNodeData,
  ]);

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
    if (scriptHub) {
      syncStoryHubFromStarter({
        starterNodeId: id,
        systemPrompt: d.systemPrompt,
        providerId: next.providerId,
        modelKey: next.modelKey,
        params: next.params ?? {},
        scriptHubId: scriptHub.scriptHubId,
        updateNodeData,
      });
    }
  };

  const onCreateScript = () => {
    if (!canRun || isGenerating) return;
    const state = useCanvasStore.getState();
    const existingHub = findStoryScriptHubForStarter(
      state.nodes,
      state.edges,
      id,
      d.workspaceIds,
    );
    const scriptHubId = existingHub
      ? existingHub.scriptHubId
      : spawnStoryScriptHub({
          starterNodeId: id,
          systemPrompt: d.systemPrompt,
          providerId: d.providerId,
          modelKey: d.modelKey,
          params: d.params ?? {},
          nodes: state.nodes,
          edges: state.edges,
          addNode: (type, position, nodeData) =>
            addNode(type, position, nodeData),
          setEdges,
          updateNodeData,
        }).scriptHubId;
    reflowStoryComicLayout();
    /** 首次：只生成大纲（1 次 LLM）；重新生成：大纲→角色→分镜顺序各 1 次 */
    const sections = hasScriptDraft
      ? STORY_HUB_SECTION_ORDER
      : (["outline"] as const);
    runStoryHubSectionsSequential(scriptHubId, sections, {
      forceFresh: hasScriptDraft,
    });
  };

  return (
    <NodeShell
      title="故事主题"
      subtitle={STAGE_LABELS[stage] ?? STAGE_LABELS.idle}
      selected={selected}
      engine
      accent={ENGINE_ACCENT}
      minWidth={400}
      minHeight={storyComicStarterNodeHeight()}
      outputs={[{ id: "text", label: "创意", kind: "text" }]}
      headerRight={
        <NodeStatusBadge
          status={scriptHub ? hubStatus.status : "idle"}
          message={hubStatus.failMessage}
        />
      }
      footer={
        <StoryNodeFooterShell
          hint={
            <span className="flex items-center gap-1">
              <Sparkles className="size-3 shrink-0" /> 自动连接「故事大纲」· 弹出层审阅
            </span>
          }
        >
          <button
            type="button"
            disabled={!canRun || isGenerating}
            className={STORY_NODE_ACTION_BTN_CLASS}
            onClick={onCreateScript}
          >
            {isFinalized ? (
              <>
                <Lock className="size-3.5" /> 已定稿
              </>
            ) : isGenerating ? (
              <>
                <RefreshCw className="size-3.5 animate-spin" /> 剧本生成中…
              </>
            ) : hasScriptDraft ? (
              <>
                <RefreshCw className="size-3.5" /> 重新生成剧本
              </>
            ) : (
              <>
                <PenLine className="size-3.5" /> 创作剧本
              </>
            )}
          </button>
        </StoryNodeFooterShell>
      }
    >
      <div className="flex h-full min-h-0 flex-col gap-2">
        <div className="flex shrink-0 flex-col">
          <div className="mb-1 flex shrink-0 flex-wrap items-center gap-1.5">
            <p className="text-[10px] uppercase tracking-wider text-[var(--canvas-muted)]">
              系统提示词
            </p>
            <div className="flex flex-wrap gap-1">
              {STORY_THEME_SYSTEM_PROMPT_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  title={tpl.description}
            disabled={isGenerating || isFinalized}
            className={`nodrag rounded px-2 py-0.5 text-[10px] font-medium transition ${
                    activeTemplateId === tpl.id
                      ? "bg-[#fb923c]/30 text-[#fdba74]"
                      : "bg-white/5 text-[var(--canvas-muted)] hover:bg-white/10 hover:text-white"
                  } disabled:opacity-50`}
                  onClick={() => applyTemplate(tpl.id)}
                >
                  {tpl.label}
                </button>
              ))}
              {activeTemplateId === "custom" ? (
                <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] text-amber-200/90">
                  自定义
                </span>
              ) : null}
            </div>
          </div>
          <textarea
            className="nodrag w-full resize-none overflow-hidden rounded-md border border-white/10 bg-black/30 p-2 text-[12px] leading-[17px] text-white placeholder:text-[var(--canvas-muted)] focus:border-[#fb923c]/60 focus:outline-none disabled:opacity-60"
            style={{ minHeight: promptMinHeight, height: promptMinHeight }}
            value={d.systemPrompt ?? ""}
            placeholder="大纲 LLM 的 system 指令（含主题与约束）…"
            disabled={isGenerating || isFinalized}
            onChange={(e) =>
              updateNodeData(id, {
                systemPrompt: e.target.value,
                systemPromptTemplateId: undefined,
              })
            }
            onBlur={syncHubIfConnected}
          />
        </div>

        <div className="space-y-1.5 border-t border-white/5 pt-2">
          <p className="text-[10px] uppercase tracking-wider text-[var(--canvas-muted)]">
            LLM 模型（文案共用）
          </p>
          <div className={isFinalized ? "pointer-events-none opacity-50" : undefined}>
            <EnginePicker
              role="LLM"
              allowedModelKeys={[...STORY_LLM_MODEL_KEYS]}
              providerId={d.providerId ?? ""}
              modelKey={d.modelKey ?? ""}
              params={d.params ?? {}}
              onChange={onPickEngine}
            />
          </div>
        </div>
      </div>
    </NodeShell>
  );
}
