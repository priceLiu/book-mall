"use client";

import { useEffect, useMemo, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { BookOpen, GitBranch } from "lucide-react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { clearScriptAssistantOnFinalize } from "@/components/canvas/script-writing-assistant-panel";
import { useCanvasStore } from "@/lib/canvas/store";
import { runStoryHubSection } from "@/lib/canvas/batch-run-nodes";
import {
  STORY_PRO_HUB_SECTION_ORDER,
  spawnStoryPro2StyleNode,
  storyPro2HubHasOutputWorkflow,
} from "@/lib/canvas/spawn-story-pro2-workspace";
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
import {
  pushStoryProFinalizedSnapshot,
  resolveStoryProFinalizedScriptView,
} from "@/lib/canvas/story-pro-finalized-script";
import { extractThemeFromStorySystemPrompt } from "@/lib/canvas/story-prompts";
import type { StoryLlmSection } from "@/lib/canvas/story-workspace-types";
import type { StoryProScriptHubNodeData } from "@/lib/canvas/story-pro-workspace-types";
import {
  findProStyleForHub,
  resolveStarterForHub,
} from "@/lib/canvas/story-workspace-resolver";
import { reflowStoryPro2Workspace } from "@/lib/canvas/story-pro2-workspace-layout";
import { ProNodeShell } from "../nodes/../pro-node-shell";
import { NodeStatusBadge } from "../node-shell";
import { StoryProGuidePanel } from "../story-pro-guide-panel";
import { useUserProviders } from "@/lib/canvas/use-user-providers";
import { pickDefaultStoryLlmEngine } from "@/lib/canvas/system-providers";
import { StoryHubNodePreviewPane } from "../story-hub-node-preview-pane";
import { StoryScriptHubModal } from "../story-script-hub-modal";
import {
  STORY_PRO_CONTROL_NODE_HEIGHT,
  STORY_PRO_CONTROL_NODE_WIDTH,
} from "@/lib/canvas/story-pro-node-chrome";
import { PRO2_INSPECTOR_ACTION_BTN_CLASS } from "@/lib/canvas/story-pro2-node-chrome";
import { storyEditionSectionChipRingClass } from "@/lib/canvas/story-edition-chrome";
import { StoryProFinalizedScriptModal } from "../story-pro-finalized-script-modal";
import { StoryNodeFooterShell } from "../story-node-footer-shell";
import { nodeMeasuredSize } from "@/lib/canvas/normalize-graph-nodes";

const SECTION_LABEL: Record<StoryLlmSection, string> = {
  outline: "大纲",
  character: "角色",
  scene: "场景",
  storyboard: "分镜",
};

function isHubLlmSection(section: HubPreviewSection): section is StoryLlmSection {
  return (
    section === "outline" ||
    section === "character" ||
    section === "scene" ||
    section === "storyboard"
  );
}

function selectHubData(
  nodes: { id: string; data: unknown }[],
  id: string,
): StoryProScriptHubNodeData {
  const n = nodes.find((x) => x.id === id);
  return (n?.data ?? {}) as StoryProScriptHubNodeData;
}

export function StoryPro2ScriptHubInspector({ id, data, selected }: NodeProps) {
  const base = useBookMallBaseUrl();
  const { confirm } = useDialogs();
  const projectId = useCanvasStore((s) => s.projectId);
  const hubFromStore = useCanvasStore((s) => selectHubData(s.nodes, id));
  const d = { ...(data as StoryProScriptHubNodeData), ...hubFromStore };
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const addNode = useCanvasStore((s) => s.addNode);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const { providers } = useUserProviders();
  const storyHubReview = useCanvasStore((s) => s.storyHubReview);
  const openStoryHubReview = useCanvasStore((s) => s.openStoryHubReview);
  const closeStoryHubReview = useCanvasStore((s) => s.closeStoryHubReview);
  const [activeSection, setActiveSection] =
    useState<HubPreviewSection>("outline");
  const [outputBusy, setOutputBusy] = useState(false);
  const [finalizedScriptOpen, setFinalizedScriptOpen] = useState(false);

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
        type: "story-pro2-script-hub",
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
    () => storyPro2HubHasOutputWorkflow(nodes, id),
    [nodes, id],
  );

  const scriptEditable = useMemo(
    () => hubScriptEditable(d, hasStyleNode || hasMediaColumns),
    [d, hasStyleNode, hasMediaColumns],
  );

  const scriptFinalized = hubIsScriptFinalized(d);

  const starterForHub = useMemo(
    () => resolveStarterForHub(nodes, edges, id),
    [nodes, edges, id],
  );

  const finalizedScriptView = useMemo(() => {
    if (!scriptFinalized) return null;
    const systemPrompt =
      (starterForHub?.data as { systemPrompt?: string } | undefined)
        ?.systemPrompt ?? "";
    return resolveStoryProFinalizedScriptView(d, systemPrompt);
  }, [
    scriptFinalized,
    starterForHub,
    d.outlineMd,
    d.characterMd,
    d.storyboardMd,
    d.finalizedScriptHistory,
  ]);

  const hubSubtitle = useMemo(() => {
    if (scriptFinalized && hasStyleNode) {
      return "故事已定稿 · 风格层已连接";
    }
    if (hasStyleNode && !scriptFinalized) {
      return "风格层已连接 · 请确认故事定稿以解锁";
    }
    if (canOutputWorkflow) return "大纲就绪 · 可故事定稿";
    if (anyRunning) return "文案生成中…";
    return "大纲 · 角色 · 分镜 · 对白";
  }, [
    scriptFinalized,
    hasStyleNode,
    canOutputWorkflow,
    anyRunning,
  ]);

  const finalizeBtnLabel = useMemo(() => {
    if (outputBusy) return "处理中…";
    if (scriptFinalized) return "故事已定稿 · 风格层已连接";
    if (hasStyleNode) return "确认故事定稿 · 解锁风格层";
    return "故事定稿 · 进入风格层";
  }, [outputBusy, scriptFinalized, hasStyleNode]);

  const finalizeDisabled =
    outputBusy || !canOutputWorkflow || scriptFinalized;

  const proCompletedStages = useMemo(
    () => (scriptFinalized ? (["story"] as const) : []),
    [scriptFinalized],
  );

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
    if (activeSection === "character") {
      return "暂无角色设定 · 创作剧本后依次生成角色段，或在大纲「主要角色」中查看";
    }
    if (activeSection === "storyboard") {
      return "暂无分镜 · 大纲/角色完成后自动生成分镜段，或打开审阅点「生成」";
    }
    if (activeSection === "dialogue") {
      return "暂无对白 · 分镜表生成后从「对白」列提取";
    }
    return "暂无大纲 · 在「影视专业·启动」点击创作剧本";
  }, [activeSection]);

  useEffect(() => {
    const starter = resolveStarterForHub(nodes, edges, id);
    if (!starter) return;
    if (!hasStyleNode && scriptFinalized && !hasMediaColumns) {
      updateNodeData(id, { scriptFinalized: false });
      if (
        (starter.data as { pipelineStage?: string }).pipelineStage ===
        "script_finalized"
      ) {
        updateNodeData(starter.id, { pipelineStage: "llm_done" });
      }
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
        d.sceneMd ?? "",
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
        promoted.sceneMd.trim() &&
        promoted.sceneMd !== (d.sceneMd ?? "")
      ) {
        patch.sceneMd = promoted.sceneMd;
        patch.sceneHistory = pushStoryRevision(
          d.sceneHistory,
          promoted.sceneMd,
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
    setNodes(() => reflowStoryPro2Workspace(state.nodes, state.edges));
  };

  const onFinalizeScript = async () => {
    const starter = resolveStarterForHub(nodes, edges, id);
    if (!starter) return;
    if (feasibilityHighRisk > 0) {
      const ok = await confirm({
        title: "可行性高风险",
        message: `AI 可行性评估发现 ${feasibilityHighRisk} 项高风险。故事定稿后进入风格层，是否继续？`,
        confirmLabel: "继续定稿",
        cancelLabel: "取消",
      });
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
        hubData?.sceneMd ?? d.sceneMd ?? "",
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
      if (
        promoted.sceneMd.trim() &&
        promoted.sceneMd !== (d.sceneMd ?? "")
      ) {
        hubPatch.sceneMd = promoted.sceneMd;
        hubPatch.sceneHistory = pushStoryRevision(
          d.sceneHistory,
          promoted.sceneMd,
        );
      }
      if (Object.keys(hubPatch).length) {
        updateNodeData(id, hubPatch);
      }

      const hubAfterPromote = {
        ...d,
        ...hubPatch,
        outlineMd: hubData?.outlineMd ?? d.outlineMd ?? "",
        characterMd:
          hubPatch.characterMd ?? hubData?.characterMd ?? d.characterMd ?? "",
        storyboardMd:
          hubPatch.storyboardMd ??
          hubData?.storyboardMd ??
          d.storyboardMd ??
          "",
        sceneMd:
          hubPatch.sceneMd ?? hubData?.sceneMd ?? d.sceneMd ?? "",
      };
      const theme = extractThemeFromStorySystemPrompt(
        (starter.data as { systemPrompt?: string }).systemPrompt ?? "",
      );
      const finalizedHistory = pushStoryProFinalizedSnapshot(
        d.finalizedScriptHistory,
        {
          theme,
          finalizedAt: new Date().toISOString(),
          outlineMd: hubAfterPromote.outlineMd,
          characterMd: hubAfterPromote.characterMd,
          storyboardMd: hubAfterPromote.storyboardMd,
        },
      );

      const state = useCanvasStore.getState();
      spawnStoryPro2StyleNode({
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
      updateNodeData(id, {
        scriptFinalized: true,
        finalizedScriptHistory: finalizedHistory,
      });
      if (base?.trim() && projectId) {
        void clearScriptAssistantOnFinalize(base, projectId, id, starter.id);
      }
      updateNodeData(starter.id, { pipelineStage: "script_finalized" });
      reflowProLayout();
      // reflow 内 reconcile 会校验风格节点；再次确保定稿标记落库
      updateNodeData(id, {
        scriptFinalized: true,
        finalizedScriptHistory: finalizedHistory,
      });
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

  const runHubSection = (section: StoryLlmSection) => {
    if (!scriptEditable) return;
    if (!canRunLlm || hubSectionIsRunning(hubNode, section)) return;
    const forceFresh = hubSectionIsReady(hubNode, section);
    runStoryHubSection(id, section, { forceFresh });
  };

  return (
    <>
      <ProNodeShell
        title="故事剧本"
        subtitle={hubSubtitle}
        selected={selected}
        activeStage="story"
        completedStages={[...proCompletedStages]}
        guide={<StoryProGuidePanel stage="story" />}
        minWidth={STORY_PRO_CONTROL_NODE_WIDTH}
        minHeight={STORY_PRO_CONTROL_NODE_HEIGHT}
        inputs={[{ id: "in_text", label: "创意", kind: "text" }]}
        outputs={[{ id: "text", label: "文案", kind: "text" }]}
        headerRight={
          <NodeStatusBadge status={aggregateStatus} message={failMsg} />
        }
        footer={
          <StoryNodeFooterShell
            hint={
              feasibilityHighRisk > 0 ? (
                <span className="text-amber-300/90">
                  可行性：{feasibilityHighRisk} 项高风险
                </span>
              ) : hasStyleNode && !scriptFinalized ? (
                <span className="text-violet-200/80">
                  风格节点已连接，确认定稿后即可编辑风格层
                </span>
              ) : undefined
            }
          >
            {scriptFinalized ? (
              <div className="flex w-full flex-col gap-2">
                <button
                  type="button"
                  disabled
                  className={PRO2_INSPECTOR_ACTION_BTN_CLASS}
                  title="故事已定稿"
                >
                  <GitBranch className="size-3.5 shrink-0" />
                  {finalizeBtnLabel}
                </button>
                <button
                  type="button"
                  disabled={!finalizedScriptView}
                  className={PRO2_INSPECTOR_ACTION_BTN_CLASS}
                  title={
                    finalizedScriptView
                      ? "以 Word 式文档查看定稿剧本（只读，含主题与版本号）"
                      : "暂无定稿内容"
                  }
                  onClick={() => setFinalizedScriptOpen(true)}
                >
                  <BookOpen className="size-3.5 shrink-0" />
                  查看定稿剧本
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={finalizeDisabled}
                className={PRO2_INSPECTOR_ACTION_BTN_CLASS}
                title={
                  hubSectionIsRunning(hubNode, "outline")
                    ? "大纲生成中…"
                    : !canOutputWorkflow
                      ? "请先创作剧本并填写故事大纲"
                      : hasStyleNode
                        ? "确认故事定稿，解锁风格定义节点"
                        : "确认故事剧本并进入风格定义（不自动生成媒体）"
                }
                onClick={() => void onFinalizeScript()}
              >
                <GitBranch className="size-3.5 shrink-0" />
                {finalizeBtnLabel}
              </button>
            )}
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
                  storyEditionSectionChipRingClass("pro", activeSection === c.key)
                } ${
                  c.running
                    ? "bg-amber-500/20 text-amber-200"
                    : c.err
                      ? "bg-red-500/20 text-red-200"
                      : c.ready
                        ? "bg-violet-500/15 text-violet-200"
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
      </ProNodeShell>

      <StoryProFinalizedScriptModal
        open={finalizedScriptOpen}
        onClose={() => setFinalizedScriptOpen(false)}
        history={d.finalizedScriptHistory}
        fallbackView={finalizedScriptView ?? undefined}
      />

      <StoryScriptHubModal
        open={reviewOpen}
        initialSection={reviewSection}
        onClose={closeStoryHubReview}
        edition="pro2"
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
