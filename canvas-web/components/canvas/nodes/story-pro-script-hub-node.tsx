"use client";

import { useEffect, useMemo, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { GitBranch } from "lucide-react";

import { useCanvasStore } from "@/lib/canvas/store";
import { runStoryHubSection } from "@/lib/canvas/batch-run-nodes";
import {
  STORY_PRO_HUB_SECTION_ORDER,
  spawnStoryProStyleNode,
  storyProHubHasOutputWorkflow,
} from "@/lib/canvas/spawn-story-pro-workspace";
import {
  hubAggregateStatus,
  hubCanOutputWorkflow,
  hubDialogueIsReady,
  hubIsScriptFinalized,
  hubScriptEditable,
  hubSectionIsReady,
  hubSectionIsRunning,
  hubSectionPreviewContent,
  hubSectionRuntime,
  promoteEmbeddedPackFromOutline,
  resolveHubStoryboardMd,
  type HubPreviewSection,
} from "@/lib/canvas/story-hub-runtime";
import { normalizeOutlineSection } from "@/lib/canvas/parse-md-tables";
import { pushStoryRevision } from "@/lib/canvas/story-revision";
import type { StoryLlmSection } from "@/lib/canvas/story-workspace-types";
import type { StoryProScriptHubNodeData } from "@/lib/canvas/story-pro-workspace-types";
import {
  findProStyleForHub,
  resolveStarterForHub,
} from "@/lib/canvas/story-workspace-resolver";
import { reflowStoryProWorkspace } from "@/lib/canvas/story-pro-workspace-layout";
import { NodeShell, ENGINE_ACCENT, NodeStatusBadge } from "../node-shell";
import { useUserProviders } from "@/lib/canvas/use-user-providers";
import { pickDefaultStoryLlmEngine } from "@/lib/canvas/system-providers";
import { StoryHubNodePreviewPane } from "../story-hub-node-preview-pane";
import { StoryPreviewMagnifyButton } from "../story-preview-magnify-button";
import { StoryScriptHubModal } from "../story-script-hub-modal";
import {
  STORY_CONTROL_NODE_HEIGHT,
  STORY_CONTROL_NODE_WIDTH,
  STORY_NODE_ACTION_BTN_CLASS,
} from "@/lib/canvas/story-node-chrome";
import { StoryNodeFooterShell } from "../story-node-footer-shell";
import { nodeMeasuredSize } from "@/lib/canvas/normalize-graph-nodes";

const SECTION_LABEL: Record<StoryLlmSection, string> = {
  outline: "大纲",
  character: "角色",
  storyboard: "分镜",
};

function isHubLlmSection(section: HubPreviewSection): section is StoryLlmSection {
  return section === "outline" || section === "character" || section === "storyboard";
}

function selectHubData(
  nodes: { id: string; data: unknown }[],
  id: string,
): StoryProScriptHubNodeData {
  const n = nodes.find((x) => x.id === id);
  return (n?.data ?? {}) as StoryProScriptHubNodeData;
}

export function StoryProScriptHubNode({ id, data, selected }: NodeProps) {
  const hubFromStore = useCanvasStore((s) => selectHubData(s.nodes, id));
  const d = { ...(data as StoryProScriptHubNodeData), ...hubFromStore };
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const addNode = useCanvasStore((s) => s.addNode);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const resizeNode = useCanvasStore((s) => s.resizeNode);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const { providers } = useUserProviders();
  const storyHubReview = useCanvasStore((s) => s.storyHubReview);
  const openStoryHubReview = useCanvasStore((s) => s.openStoryHubReview);
  const closeStoryHubReview = useCanvasStore((s) => s.closeStoryHubReview);
  const [activeSection, setActiveSection] =
    useState<HubPreviewSection>("outline");
  const [outputBusy, setOutputBusy] = useState(false);

  const reviewOpen = storyHubReview?.hubId === id;
  const reviewSection = storyHubReview?.section ?? activeSection;

  const openPreview = (section: HubPreviewSection = activeSection) => {
    openStoryHubReview(id, section);
  };

  useEffect(() => {
    const stray = (data as { runtime?: unknown }).runtime;
    if (stray) {
      updateNodeData(id, { runtime: undefined });
    }
  }, [id, data, updateNodeData]);

  useEffect(() => {
    if (d.providerId?.trim() && d.modelKey?.trim()) return;
    const pick = pickDefaultStoryLlmEngine(providers);
    if (!pick) return;
    updateNodeData(id, {
      providerId: pick.providerId,
      modelKey: pick.modelKey,
    });
  }, [d.providerId, d.modelKey, providers, id, updateNodeData]);

  const hubNode = useMemo(
    () =>
      ({
        id,
        data: d,
        type: "story-pro-script-hub",
        position: { x: 0, y: 0 },
      }) as const,
    [id, d],
  );

  const aggregateStatus = hubAggregateStatus(hubNode);
  const canOutputWorkflow = hubCanOutputWorkflow(hubNode);
  const anyRunning = aggregateStatus === "running";

  const hasStyleNode = useMemo(
    () => Boolean(findProStyleForHub(nodes, edges, id)),
    [nodes, edges, id],
  );

  const hasMediaColumns = useMemo(
    () => storyProHubHasOutputWorkflow(nodes, id),
    [nodes, id],
  );

  const scriptEditable = useMemo(
    () => hubScriptEditable(d, hasStyleNode || hasMediaColumns),
    [d, hasStyleNode, hasMediaColumns],
  );

  const scriptFinalized = hubIsScriptFinalized(d);

  const feasibilityHighRisk = d.feasibility?.highRiskCount ?? 0;

  const sectionChips = useMemo(() => {
    const llm = STORY_PRO_HUB_SECTION_ORDER.map((s) => {
      const ready = hubSectionIsReady(hubNode, s);
      const running = hubSectionIsRunning(hubNode, s);
      const err = hubSectionRuntime(hubNode, s)?.status === "error";
      return { key: s, label: SECTION_LABEL[s], ready, running, err };
    });
    const dialogueReady = hubDialogueIsReady(resolveHubStoryboardMd(d));
    return [
      ...llm,
      {
        key: "dialogue" as const,
        label: "对白",
        ready: dialogueReady,
        running: false,
        err: false,
      },
    ];
  }, [
    id,
    d.outlineMd,
    d.characterMd,
    d.storyboardMd,
    d.outlineRuntime,
    d.characterRuntime,
    d.storyboardRuntime,
  ]);

  const previewMd = useMemo(
    () => hubSectionPreviewContent(d, activeSection),
    [d.outlineMd, d.characterMd, d.storyboardMd, activeSection],
  );

  const previewEmptyHint = useMemo(() => {
    const labels: Record<HubPreviewSection, string> = {
      outline: "大纲",
      character: "角色设定",
      storyboard: "分镜脚本",
      dialogue: "对白",
    };
    return `暂无${labels[activeSection]} · 创作剧本后悬停白纸区，点击打开审阅`;
  }, [activeSection]);

  useEffect(() => {
    const starter = resolveStarterForHub(nodes, edges, id);
    if (!starter) return;
    if (!hasStyleNode && scriptFinalized && !hasMediaColumns) {
      updateNodeData(id, { scriptFinalized: false });
    }
    if (
      hasStyleNode &&
      !hasMediaColumns &&
      (starter.data as { pipelineStage?: string }).pipelineStage ===
        "style_finalized"
    ) {
      updateNodeData(starter.id, { pipelineStage: "script_finalized" });
    }
  }, [
    nodes,
    edges,
    id,
    scriptFinalized,
    hasStyleNode,
    hasMediaColumns,
    updateNodeData,
  ]);

  const patchSectionMd = (section: StoryLlmSection, value: string) => {
    if (!scriptEditable) return;
    if (section === "outline") {
      const promoted = promoteEmbeddedPackFromOutline(
        value,
        d.characterMd ?? "",
        d.storyboardMd ?? "",
      );
      const { outlineMd, characterMd } = normalizeOutlineSection(
        promoted.outlineMd,
        promoted.characterMd,
      );
      const outlineHist = pushStoryRevision(d.outlineHistory, outlineMd);
      const patch: Partial<StoryProScriptHubNodeData> = {
        outlineMd,
        outlineHistory: outlineHist,
      };
      if (characterMd !== (d.characterMd ?? "")) {
        patch.characterMd = characterMd;
        patch.characterHistory = pushStoryRevision(
          d.characterHistory,
          characterMd,
        );
      }
      if (
        promoted.storyboardMd.trim() &&
        promoted.storyboardMd !== (d.storyboardMd ?? "")
      ) {
        patch.storyboardMd = promoted.storyboardMd;
        patch.storyboardHistory = pushStoryRevision(
          d.storyboardHistory,
          promoted.storyboardMd,
        );
      }
      updateNodeData(id, patch);
      return;
    }
    const field =
      section === "character" ? "characterMd" : "storyboardMd";
    const historyField =
      section === "character" ? "characterHistory" : "storyboardHistory";
    const prevHist = d[historyField as keyof StoryProScriptHubNodeData] as
      | import("@/lib/canvas/story-revision").StoryTextRevision[]
      | undefined;
    updateNodeData(id, {
      [field]: value,
      [historyField]: pushStoryRevision(prevHist, value),
    });
  };

  const reflowProLayout = () => {
    const state = useCanvasStore.getState();
    setNodes(() => reflowStoryProWorkspace(state.nodes, state.edges));
  };

  const onFinalizeScript = async () => {
    const starter = resolveStarterForHub(nodes, edges, id);
    if (!starter) return;
    if (feasibilityHighRisk > 0) {
      const ok = window.confirm(
        `AI 可行性评估发现 ${feasibilityHighRisk} 项高风险。故事定稿后进入风格层，是否继续？`,
      );
      if (!ok) return;
    }
    setOutputBusy(true);
    try {
      const hubData = useCanvasStore.getState().nodes.find((n) => n.id === id)
        ?.data as StoryProScriptHubNodeData | undefined;
      const promoted = promoteEmbeddedPackFromOutline(
        hubData?.outlineMd ?? d.outlineMd ?? "",
        hubData?.characterMd ?? d.characterMd ?? "",
        hubData?.storyboardMd ?? d.storyboardMd ?? "",
      );
      const hubPatch: Partial<StoryProScriptHubNodeData> = {};
      if (
        promoted.characterMd.trim() &&
        promoted.characterMd !== (d.characterMd ?? "")
      ) {
        hubPatch.characterMd = promoted.characterMd;
        hubPatch.characterHistory = pushStoryRevision(
          d.characterHistory,
          promoted.characterMd,
        );
      }
      if (
        promoted.storyboardMd.trim() &&
        promoted.storyboardMd !== (d.storyboardMd ?? "")
      ) {
        hubPatch.storyboardMd = promoted.storyboardMd;
        hubPatch.storyboardHistory = pushStoryRevision(
          d.storyboardHistory,
          promoted.storyboardMd,
        );
      }
      if (Object.keys(hubPatch).length) {
        updateNodeData(id, hubPatch);
      }

      const state = useCanvasStore.getState();
      spawnStoryProStyleNode({
        starterNodeId: starter.id,
        scriptHubId: id,
        systemPrompt:
          (starter.data as { systemPrompt?: string }).systemPrompt ?? "",
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
      updateNodeData(id, { scriptFinalized: true });
      updateNodeData(starter.id, { pipelineStage: "script_finalized" });
      reflowProLayout();
    } finally {
      setOutputBusy(false);
    }
  };

  const failMsg =
    STORY_PRO_HUB_SECTION_ORDER.map(
      (s) =>
        (hubSectionRuntime(hubNode, s) as { failMessage?: string } | undefined)
          ?.failMessage,
    ).find(Boolean) ?? null;

  const canRunLlm = Boolean(d.providerId?.trim() && d.modelKey?.trim());
  const reviewSectionRunning =
    reviewOpen && isHubLlmSection(reviewSection)
      ? hubSectionIsRunning(hubNode, reviewSection)
      : false;

  useEffect(() => {
    const targetH = STORY_CONTROL_NODE_HEIGHT;
    const targetW = STORY_CONTROL_NODE_WIDTH;
    const node = useCanvasStore.getState().nodes.find((n) => n.id === id);
    if (!node) return;
    const { w, h } = nodeMeasuredSize(node);
    if (Math.abs(h - targetH) < 4 && Math.abs(w - targetW) < 4) return;
    resizeNode(id, { width: targetW, height: targetH });
  }, [id, resizeNode]);

  const runHubSection = (section: StoryLlmSection) => {
    if (!scriptEditable) return;
    if (!canRunLlm || hubSectionIsRunning(hubNode, section)) return;
    const forceFresh = hubSectionIsReady(hubNode, section);
    runStoryHubSection(id, section, { forceFresh });
  };

  return (
    <>
      <NodeShell
        title="故事剧本"
        subtitle={
          hasStyleNode && scriptFinalized
            ? "故事已定稿 · 风格层已连接"
            : canOutputWorkflow
              ? "大纲就绪 · 可故事定稿"
              : anyRunning
                ? "文案生成中…"
                : "大纲 · 角色 · 分镜 · 对白"
        }
        selected={selected}
        engine
        accent={ENGINE_ACCENT}
        minWidth={STORY_CONTROL_NODE_WIDTH}
        minHeight={STORY_CONTROL_NODE_HEIGHT}
        inputs={[{ id: "in_text", label: "创意", kind: "text" }]}
        outputs={[{ id: "text", label: "文案", kind: "text" }]}
        headerRight={
          <div className="nodrag nowheel pointer-events-auto flex shrink-0 items-center gap-1.5">
            <StoryPreviewMagnifyButton
              variant="onDark"
              onClick={() => openPreview(activeSection)}
            />
            <NodeStatusBadge status={aggregateStatus} message={failMsg} />
          </div>
        }
        footer={
          <StoryNodeFooterShell
            hint={
              feasibilityHighRisk > 0 ? (
                <span className="text-amber-300/90">
                  可行性：{feasibilityHighRisk} 项高风险
                </span>
              ) : undefined
            }
          >
            <button
              type="button"
              disabled={outputBusy || !canOutputWorkflow || hasStyleNode}
              className={STORY_NODE_ACTION_BTN_CLASS}
              title={
                hubSectionIsRunning(hubNode, "outline")
                  ? "大纲生成中…"
                  : !canOutputWorkflow
                    ? "请先创作剧本并填写故事大纲"
                    : hasStyleNode
                      ? "故事已定稿 · 风格层已连接"
                      : "确认故事剧本并进入风格定义（不自动生成媒体）"
              }
              onClick={() => void onFinalizeScript()}
            >
              <GitBranch className="size-3.5 shrink-0" />
              {outputBusy
                ? "处理中…"
                : hasStyleNode
                  ? "故事已定稿 · 风格层已连接"
                  : "故事定稿 · 进入风格层"}
            </button>
          </StoryNodeFooterShell>
        }
      >
        <div className="flex h-full min-h-0 flex-col gap-2">
          <div className="flex shrink-0 flex-wrap gap-1">
            {sectionChips.map((c) => (
              <button
                key={c.key}
                type="button"
                className={`nodrag rounded px-1.5 py-0.5 text-[10px] transition ${
                  activeSection === c.key ? "ring-1 ring-[#fb923c]/60" : ""
                } ${
                  c.running
                    ? "bg-amber-500/20 text-amber-200"
                    : c.err
                      ? "bg-red-500/20 text-red-200"
                      : c.ready
                        ? "bg-emerald-500/15 text-emerald-200"
                        : "bg-white/5 text-[var(--canvas-muted)]"
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveSection(c.key);
                }}
              >
                {c.label}
                {c.running ? " …" : c.ready ? " ✓" : ""}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-hidden">
            <StoryHubNodePreviewPane
              content={previewMd}
              emptyHint={previewEmptyHint}
              onOpenPreview={() => openPreview(activeSection)}
            />
          </div>
        </div>
      </NodeShell>

      <StoryScriptHubModal
        open={reviewOpen}
        initialSection={reviewSection}
        onClose={closeStoryHubReview}
        data={d}
        onSaveOutline={(md) => patchSectionMd("outline", md)}
        onSaveCharacter={(md) => patchSectionMd("character", md)}
        onSaveStoryboard={(md) => patchSectionMd("storyboard", md)}
        onSaveStoryboardMd={(md) => {
          if (!scriptEditable) return;
          updateNodeData(id, {
            storyboardMd: md,
            storyboardHistory: pushStoryRevision(d.storyboardHistory, md),
          });
        }}
        onRunSection={runHubSection}
        sectionIsRunning={reviewSectionRunning}
        canRunLlm={canRunLlm}
        readOnly={!scriptEditable}
      />
    </>
  );
}
