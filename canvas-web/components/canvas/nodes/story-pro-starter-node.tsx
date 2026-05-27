"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { Lock, PenLine, RefreshCw, Sparkles } from "lucide-react";

import { useCanvasStore } from "@/lib/canvas/store";
import { STORY_LLM_MODEL_KEYS } from "@/lib/canvas/types";
import {
  STORY_PRO_OUTLINE_USER_PROMPT,
  STORY_PRO_CHARACTER_PROMPT,
  STORY_PRO_STORYBOARD_PROMPT,
} from "@/lib/canvas/story-pro-prompts";
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
  findStoryProScriptHubForStarter,
  spawnStoryProScriptHub,
  STORY_PRO_HUB_SECTION_ORDER,
  findStoryProWorkspaceForStarter,
} from "@/lib/canvas/spawn-story-pro-workspace";
import { reflowStoryProWorkspace } from "@/lib/canvas/story-pro-workspace-layout";
import {
  hubAggregateStatus,
  hubSectionRuntime,
} from "@/lib/canvas/story-hub-runtime";
import type { StoryProStarterNodeData } from "@/lib/canvas/story-pro-workspace-types";
import type { StoryProScriptHubNodeData } from "@/lib/canvas/story-pro-workspace-types";
import { NodeShell, ENGINE_ACCENT, NodeStatusBadge } from "../node-shell";
import { EnginePicker } from "../engine-picker";
import { useUserProviders } from "@/lib/canvas/use-user-providers";
import { pickDefaultStoryLlmEngine } from "@/lib/canvas/system-providers";

const STAGE_LABELS: Record<string, string> = {
  idle: "填写创意 → 创作剧本",
  llm_done: "剧本已生成 · 打开「故事剧本」审阅",
  script_finalized: "故事已定稿 · 打开「风格定义」",
  style_finalized: "风格已定稿 · 工作流已输出",
  finalized: "已定稿 · 工作流已输出",
};

function syncStoryProHubFromStarter(args: {
  starterNodeId: string;
  systemPrompt: string;
  providerId: string;
  modelKey: string;
  params: Record<string, unknown>;
  scriptHubId: string;
  updateNodeData: (id: string, patch: Record<string, unknown>) => void;
}) {
  args.updateNodeData(args.scriptHubId, {
    providerId: args.providerId,
    modelKey: args.modelKey,
    params: {
      reasoning_effort: "low",
      max_tokens: 4000,
      temperature: 0.7,
      ...args.params,
    },
    referencedNodeIds: [args.starterNodeId],
    outlineSystemPrompt: args.systemPrompt.trim(),
    promptOutline: STORY_PRO_OUTLINE_USER_PROMPT,
    promptCharacter: STORY_PRO_CHARACTER_PROMPT,
    promptStoryboard: STORY_PRO_STORYBOARD_PROMPT,
  });
}

export function StoryProStarterNode({ id, data, selected }: NodeProps) {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const addNode = useCanvasStore((s) => s.addNode);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const resizeNode = useCanvasStore((s) => s.resizeNode);
  const setNodes = useCanvasStore((s) => s.setNodes);

  const d = data as unknown as StoryProStarterNodeData;
  const { providers } = useUserProviders();
  const stage = d.pipelineStage ?? "idle";
  const isFinalized = stage === "finalized" || stage === "style_finalized";
  const [promptModalOpen, setPromptModalOpen] = useState(false);

  const systemPrompt = d.systemPrompt ?? "";
  const promptPreviewMd = useMemo(
    () => storyThemePromptDisplayMd(systemPrompt),
    [systemPrompt],
  );

  const scriptHub = useMemo(
    () => findStoryProScriptHubForStarter(nodes, edges, id, d.workspaceIds),
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
    const hd = hub.data as StoryProScriptHubNodeData;
    if ((hd.outlineMd ?? "").trim()) return true;
    return hubAggregateStatus(hub) === "done";
  }, [nodes, scriptHub]);

  const reflowProLayout = useCallback(() => {
    const state = useCanvasStore.getState();
    setNodes(() =>
      reflowStoryProWorkspace(state.nodes, state.edges),
    );
  }, [setNodes]);

  useEffect(() => {
    if (!scriptHub) return;
    const ws = findStoryProWorkspaceForStarter(
      nodes,
      edges,
      id,
      d.workspaceIds,
    );
    if (!ws) return;
    const patch: Partial<StoryProStarterNodeData> = {};
    if (JSON.stringify(d.workspaceIds ?? {}) !== JSON.stringify(ws)) {
      patch.workspaceIds = ws;
    }
    const hub = nodes.find((n) => n.id === ws.scriptHubId);
    const hubFinalized = Boolean(
      (hub?.data as StoryProScriptHubNodeData)?.scriptFinalized,
    );
    if (ws.characterColumnId && ws.frameColumnId && ws.videoColumnId) {
      if (stage !== "style_finalized" && stage !== "finalized") {
        patch.pipelineStage = "style_finalized";
      }
    } else if (ws.styleNodeId && hubFinalized) {
      if (
        stage !== "script_finalized" &&
        stage !== "style_finalized" &&
        stage !== "finalized"
      ) {
        patch.pipelineStage = "script_finalized";
      }
    } else if (hasScriptDraft && stage === "idle") {
      patch.pipelineStage = "llm_done";
    }
    if (Object.keys(patch).length) {
      updateNodeData(id, patch);
    }
  }, [
    isFinalized,
    scriptHub,
    nodes,
    edges,
    id,
    d.workspaceIds,
    stage,
    hasScriptDraft,
    updateNodeData,
  ]);

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
    (next: { systemPrompt: string; systemPromptTemplateId?: string }) => {
      updateNodeData(id, { systemPrompt: next.systemPrompt });
      if (scriptHub) {
        syncStoryProHubFromStarter({
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
    [id, scriptHub, d.providerId, d.modelKey, d.params, updateNodeData],
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
      syncStoryProHubFromStarter({
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
    const existingHub = findStoryProScriptHubForStarter(
      state.nodes,
      state.edges,
      id,
      d.workspaceIds,
    );
    const scriptHubId = existingHub
      ? existingHub.scriptHubId
      : spawnStoryProScriptHub({
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
      syncStoryProHubFromStarter({
        starterNodeId: id,
        systemPrompt,
        providerId: d.providerId,
        modelKey: d.modelKey,
        params: d.params ?? {},
        scriptHubId,
        updateNodeData,
      });
    }
    reflowProLayout();
    const sections = hasScriptDraft
      ? STORY_PRO_HUB_SECTION_ORDER
      : (["outline"] as const);
    runStoryHubSectionsSequential(scriptHubId, sections, {
      forceFresh: hasScriptDraft,
    });
    if (!hasScriptDraft) {
      updateNodeData(id, { pipelineStage: "llm_done" });
    }
  };

  return (
    <>
      <NodeShell
        title="影视专业 · 启动"
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
                  <Sparkles className="size-3 shrink-0" /> 自动连接「故事剧本」·
                  弹出层审阅
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
            系统提示词 · 影视专业版
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
        initialTab="custom"
        onClose={() => setPromptModalOpen(false)}
        value={systemPrompt}
        onSave={onSavePrompt}
        readOnly={promptEditLocked}
      />
    </>
  );
}
