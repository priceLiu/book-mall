"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { Lock, PenLine, RefreshCw, Sparkles } from "lucide-react";

import { useCanvasStore } from "@/lib/canvas/store";
import type { StoryComicStarterNodeData } from "@/lib/canvas/types";
import {
  STORY_LLM_MODEL_KEYS,
  STORY_THEME_SYSTEM_PROMPT_TEMPLATES,
} from "@/lib/canvas/types";
import type { StoryThemeSystemPromptTemplateId } from "@/lib/canvas/story-prompts";
import { storyThemePromptDisplayMd } from "@/lib/canvas/story-theme-prompt-display";
import {
  STORY_CONTROL_NODE_HEIGHT,
  STORY_CONTROL_NODE_WIDTH,
  STORY_NODE_ACTION_BTN_CLASS,
  STORY_NODE_ENGINE_DOCK_CLASS,
} from "@/lib/canvas/story-node-chrome";
import { STORY_HINT_LABEL_CLASS } from "@/lib/canvas/story-column-sync";
import { StoryNodeFooterShell } from "../story-node-footer-shell";
import { StoryThemePromptPreviewPane } from "../story-theme-prompt-preview-pane";
import { StoryThemePromptModal } from "../story-theme-prompt-modal";
import { StoryPreviewMagnifyButton } from "../story-preview-magnify-button";
import { nodeMeasuredSize } from "@/lib/canvas/normalize-graph-nodes";
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
  idle: "填写创意 → 创作剧本（含角色表+分镜表）",
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

  const d = data as unknown as StoryComicStarterNodeData;
  const { providers } = useUserProviders();
  const stage = d.pipelineStage ?? "idle";
  const isFinalized = stage === "finalized";
  const [promptModalOpen, setPromptModalOpen] = useState(false);

  const systemPrompt = d.systemPrompt ?? "";
  const promptPreviewMd = useMemo(
    () => storyThemePromptDisplayMd(systemPrompt),
    [systemPrompt],
  );

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
    !isFinalized && systemPrompt.trim() && d.providerId && d.modelKey,
  );
  const isGenerating = hubStatus.status === "running";
  const promptEditLocked = isGenerating || isFinalized;

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

  const activeTemplateLabel = useMemo(() => {
    if (d.systemPromptTemplateId) {
      return (
        STORY_THEME_SYSTEM_PROMPT_TEMPLATES.find(
          (t) => t.id === d.systemPromptTemplateId,
        )?.label ?? "自定义"
      );
    }
    return "自定义";
  }, [d.systemPromptTemplateId]);

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
    const targetH = STORY_CONTROL_NODE_HEIGHT;
    const targetW = STORY_CONTROL_NODE_WIDTH;
    const node = useCanvasStore.getState().nodes.find((n) => n.id === id);
    if (!node) return;
    const { w, h } = nodeMeasuredSize(node);
    if (Math.abs(h - targetH) < 4 && Math.abs(w - targetW) < 4) return;
    resizeNode(id, { width: targetW, height: targetH });
  }, [id, resizeNode]);

  const onSavePrompt = useCallback(
    (next: {
      systemPrompt: string;
      systemPromptTemplateId?: string;
    }) => {
      updateNodeData(id, {
        systemPrompt: next.systemPrompt,
        systemPromptTemplateId: next.systemPromptTemplateId as
          | StoryThemeSystemPromptTemplateId
          | undefined,
      });
      if (scriptHub) {
        syncStoryHubFromStarter({
          starterNodeId: id,
          systemPrompt: next.systemPrompt,
          providerId: d.providerId,
          modelKey: d.modelKey,
          params: d.params ?? {},
          scriptHubId: scriptHub.scriptHubId,
          updateNodeData,
        });
      }
    },
    [
      id,
      scriptHub,
      d.providerId,
      d.modelKey,
      d.params,
      updateNodeData,
    ],
  );

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
        systemPrompt,
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
          systemPrompt,
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
    if (existingHub) {
      syncStoryHubFromStarter({
        starterNodeId: id,
        systemPrompt,
        providerId: d.providerId,
        modelKey: d.modelKey,
        params: d.params ?? {},
        scriptHubId,
        updateNodeData,
      });
    }
    reflowStoryComicLayout();
    const sections = hasScriptDraft
      ? STORY_HUB_SECTION_ORDER
      : (["outline"] as const);
    runStoryHubSectionsSequential(scriptHubId, sections, {
      forceFresh: hasScriptDraft,
    });
  };

  return (
    <>
      <NodeShell
        title="故事主题"
        subtitle={STAGE_LABELS[stage] ?? STAGE_LABELS.idle}
        selected={selected}
        engine
        accent={ENGINE_ACCENT}
        minWidth={STORY_CONTROL_NODE_WIDTH}
        minHeight={STORY_CONTROL_NODE_HEIGHT}
        outputs={[{ id: "text", label: "创意", kind: "text" }]}
        headerRight={
          <div className="nodrag nowheel pointer-events-auto flex shrink-0 items-center gap-1.5">
            <StoryPreviewMagnifyButton
              variant="onDark"
              onClick={() => setPromptModalOpen(true)}
            />
            <NodeStatusBadge
              status={scriptHub ? hubStatus.status : "idle"}
              message={hubStatus.failMessage}
            />
          </div>
        }
        footer={
          <div className="nodrag flex w-full flex-col">
            <div className={STORY_NODE_ENGINE_DOCK_CLASS}>
              <p className={STORY_HINT_LABEL_CLASS}>LLM 模型（文案共用）</p>
              <div
                className={
                  isFinalized ? "pointer-events-none opacity-50" : undefined
                }
              >
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
            <StoryNodeFooterShell
              hint={
                <span className="flex items-center gap-1">
                  <Sparkles className="size-3 shrink-0" /> 自动连接「故事大纲」·
                  一次生成大纲+角色+分镜
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
          </div>
        }
      >
        <div className="flex h-full min-h-0 flex-col gap-2">
          <p className="shrink-0 text-[10px] uppercase tracking-wider text-[var(--canvas-muted)]">
            系统提示词 · {activeTemplateLabel}
          </p>
          <div className="min-h-0 flex-1 overflow-hidden">
            <StoryThemePromptPreviewPane
              displayMd={promptPreviewMd}
              emptyHint="悬停预览 · 点击打开审阅弹层编辑"
              disabled={isGenerating}
              onOpen={() => setPromptModalOpen(true)}
            />
          </div>
        </div>
      </NodeShell>

      <StoryThemePromptModal
        open={promptModalOpen}
        initialTab={d.systemPromptTemplateId ?? "custom"}
        templateId={d.systemPromptTemplateId}
        onClose={() => setPromptModalOpen(false)}
        value={systemPrompt}
        onSave={onSavePrompt}
        readOnly={promptEditLocked}
        editHint="系统提示词 · 须含 ## 角色设定 与 ## 分镜脚本 GFM 表（与右侧预览同步）"
      />
    </>
  );
}
