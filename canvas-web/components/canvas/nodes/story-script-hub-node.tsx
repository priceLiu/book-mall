"use client";

import { useEffect, useMemo, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { GitBranch, Play, RefreshCw } from "lucide-react";

import { useCanvasStore } from "@/lib/canvas/store";
import { runStoryHubSection } from "@/lib/canvas/batch-run-nodes";
import {
  spawnStoryMediaColumns,
  STORY_HUB_SECTION_ORDER,
} from "@/lib/canvas/spawn-story-workspace";
import {
  hubAggregateStatus,
  hubDialogueIsReady,
  hubSectionIsReady,
  hubSectionIsRunning,
  hubSectionPreviewContent,
  hubSectionRuntime,
  type HubPreviewSection,
} from "@/lib/canvas/story-hub-runtime";
import { normalizeOutlineSection } from "@/lib/canvas/parse-md-tables";
import { syncColumnsFromHub } from "@/lib/canvas/story-column-sync";
import { pushStoryRevision } from "@/lib/canvas/story-revision";
import type {
  StoryLlmSection,
  StoryScriptHubNodeData,
  StoryWorkspaceIds,
} from "@/lib/canvas/story-workspace-types";
import { NodeShell, ENGINE_ACCENT, NodeStatusBadge } from "../node-shell";
import { useUserProviders } from "@/lib/canvas/use-user-providers";
import { pickDefaultStoryLlmEngine } from "@/lib/canvas/system-providers";
import { StoryHubNodePreviewPane } from "../story-hub-node-preview-pane";
import { StoryPreviewMagnifyButton } from "../story-preview-magnify-button";
import { StoryScriptHubModal } from "../story-script-hub-modal";
import { STORY_NODE_ACTION_BTN_CLASS } from "@/lib/canvas/story-node-chrome";
import { StoryNodeFooterShell } from "../story-node-footer-shell";

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
): StoryScriptHubNodeData {
  const n = nodes.find((x) => x.id === id);
  return (n?.data ?? {}) as StoryScriptHubNodeData;
}

export function StoryScriptHubNode({ id, data, selected }: NodeProps) {
  const hubFromStore = useCanvasStore((s) => selectHubData(s.nodes, id));
  const d = { ...(data as StoryScriptHubNodeData), ...hubFromStore };
  const nodes = useCanvasStore((s) => s.nodes);
  const addNode = useCanvasStore((s) => s.addNode);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const reflowStoryComicLayout = useCanvasStore(
    (s) => s.reflowStoryComicLayout,
  );
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
        type: "story-script-hub",
        position: { x: 0, y: 0 },
      }) as const,
    [id, d],
  );

  const aggregateStatus = hubAggregateStatus(hubNode);
  const anyRunning = aggregateStatus === "running";

  const sectionChips = useMemo(() => {
    const llm = STORY_HUB_SECTION_ORDER.map((s) => {
      const ready = hubSectionIsReady(hubNode, s);
      const running = hubSectionIsRunning(hubNode, s);
      const err = hubSectionRuntime(hubNode, s)?.status === "error";
      return {
        key: s,
        label: SECTION_LABEL[s],
        ready,
        running,
        err,
      };
    });
    const dialogueReady = hubDialogueIsReady(d.storyboardMd ?? "");
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
    [
      d.outlineMd,
      d.characterMd,
      d.storyboardMd,
      activeSection,
    ],
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

  const hasMediaColumns = useMemo(() => {
    const starter = nodes.find((n) => n.type === "story-comic-starter");
    const ws = (starter?.data as { workspaceIds?: StoryWorkspaceIds })
      ?.workspaceIds;
    return Boolean(
      ws?.characterColumnId && ws.frameColumnId && ws.videoColumnId,
    );
  }, [nodes]);

  const syncColumnsIfPresent = (
    patch: Partial<StoryScriptHubNodeData>,
  ) => {
    const starter = nodes.find((n) => n.type === "story-comic-starter");
    const ws = (starter?.data as { workspaceIds?: StoryWorkspaceIds })
      ?.workspaceIds;
    if (!ws?.scriptHubId || ws.scriptHubId !== id) return;
    if (!ws.characterColumnId || !ws.frameColumnId || !ws.videoColumnId) {
      return;
    }
    const nextNodes = useCanvasStore.getState().nodes.map((n) =>
      n.id === id ? { ...n, data: { ...n.data, ...patch } } : n,
    );
    const synced = syncColumnsFromHub(
      nextNodes,
      id,
      ws.characterColumnId,
      ws.frameColumnId,
      ws.videoColumnId,
    );
    if (!synced) return;
    updateNodeData(ws.characterColumnId, synced.characterPatch);
    updateNodeData(ws.frameColumnId, synced.framePatch);
    updateNodeData(ws.videoColumnId, synced.videoPatch);
    reflowStoryComicLayout();
  };

  useEffect(() => {
    if (!hasMediaColumns) return;
    syncColumnsIfPresent({});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 大纲/角色/分镜变更时刷新三列行数据
  }, [d.outlineMd, d.characterMd, d.storyboardMd, hasMediaColumns]);

  const patchSectionMd = (section: StoryLlmSection, value: string) => {
    if (section === "outline") {
      const { outlineMd, characterMd } = normalizeOutlineSection(
        value,
        d.characterMd ?? "",
      );
      const outlineHist = pushStoryRevision(d.outlineHistory, outlineMd);
      const patch: Partial<StoryScriptHubNodeData> = {
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
      updateNodeData(id, patch);
      syncColumnsIfPresent(patch);
      return;
    }
    const field =
      section === "character" ? "characterMd" : "storyboardMd";
    const historyField =
      section === "character" ? "characterHistory" : "storyboardHistory";
    const prevHist = d[historyField as keyof StoryScriptHubNodeData] as
      | import("@/lib/canvas/story-revision").StoryTextRevision[]
      | undefined;
    updateNodeData(id, {
      [field]: value,
      [historyField]: pushStoryRevision(prevHist, value),
    });
    syncColumnsIfPresent({ [field]: value });
  };

  const onOutputWorkflow = async () => {
    const starter = nodes.find((n) => n.type === "story-comic-starter");
    if (!starter) return;
    setOutputBusy(true);
    try {
      const state = useCanvasStore.getState();
      const ids = spawnStoryMediaColumns({
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
      const synced = syncColumnsFromHub(
        useCanvasStore.getState().nodes,
        id,
        ids.characterColumnId!,
        ids.frameColumnId!,
        ids.videoColumnId!,
      );
      if (synced) {
        updateNodeData(ids.characterColumnId!, synced.characterPatch);
        updateNodeData(ids.frameColumnId!, synced.framePatch);
        updateNodeData(ids.videoColumnId!, synced.videoPatch);
      }
      reflowStoryComicLayout();
      updateNodeData(starter.id, { pipelineStage: "finalized" });
    } finally {
      setOutputBusy(false);
    }
  };

  const failMsg =
    STORY_HUB_SECTION_ORDER.map(
      (s) =>
        (hubSectionRuntime(hubNode, s) as { failMessage?: string } | undefined)
          ?.failMessage,
    ).find(Boolean) ?? null;

  const canRunLlm = Boolean(d.providerId?.trim() && d.modelKey?.trim());
  const activeLlmSection = isHubLlmSection(activeSection)
    ? activeSection
    : null;
  const activeSectionRunning = activeLlmSection
    ? hubSectionIsRunning(hubNode, activeLlmSection)
    : false;
  const reviewSectionRunning =
    reviewOpen && isHubLlmSection(reviewSection)
      ? hubSectionIsRunning(hubNode, reviewSection)
      : false;

  const runHubSection = (section: StoryLlmSection) => {
    if (!canRunLlm || hubSectionIsRunning(hubNode, section)) return;
    const forceFresh = hubSectionIsReady(hubNode, section);
    runStoryHubSection(id, section, { forceFresh });
  };

  return (
    <>
      <NodeShell
        title="故事大纲"
        subtitle={
          hasMediaColumns
            ? "工作流已输出"
            : aggregateStatus === "done"
              ? "剧本就绪 · 可输出工作流"
              : anyRunning
                ? "文案生成中…"
                : "大纲 · 角色 · 分镜 · 对白"
        }
        selected={selected}
        engine
        accent={ENGINE_ACCENT}
        minWidth={400}
        minHeight={360}
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
          <StoryNodeFooterShell>
            <div className="flex flex-wrap gap-2">
              {activeLlmSection ? (
                <button
                  type="button"
                  disabled={!canRunLlm || activeSectionRunning}
                  className={STORY_NODE_ACTION_BTN_CLASS}
                  title={!canRunLlm ? "请配置 LLM 模型" : undefined}
                  onClick={() => runHubSection(activeLlmSection)}
                >
                  {activeSectionRunning ? (
                    <>
                      <RefreshCw className="size-3.5 animate-spin" /> 生成中…
                    </>
                  ) : hubSectionIsReady(hubNode, activeLlmSection) ? (
                    <>
                      <RefreshCw className="size-3.5" /> 重新生成{SECTION_LABEL[activeLlmSection]}
                    </>
                  ) : (
                    <>
                      <Play className="size-3.5" /> 生成{SECTION_LABEL[activeLlmSection]}
                    </>
                  )}
                </button>
              ) : null}
              <button
                type="button"
                disabled={
                  outputBusy ||
                  anyRunning ||
                  aggregateStatus !== "done" ||
                  hasMediaColumns
                }
                className={STORY_NODE_ACTION_BTN_CLASS}
                title={
                  aggregateStatus !== "done"
                    ? "请等待剧本生成完成"
                    : hasMediaColumns
                      ? "已输出工作流"
                      : undefined
                }
                onClick={() => void onOutputWorkflow()}
              >
                <GitBranch className="size-3.5 shrink-0" />
                {outputBusy
                  ? "输出中…"
                  : hasMediaColumns
                    ? "已输出工作流"
                    : "输出工作流"}
              </button>
            </div>
          </StoryNodeFooterShell>
        }
      >
        <div className="flex h-full min-h-0 flex-1 flex-col gap-2">
          <div className="flex shrink-0 flex-wrap gap-1">
            {sectionChips.map((c) => (
              <button
                key={c.key}
                type="button"
                className={`nodrag rounded px-1.5 py-0.5 text-[10px] transition ${
                  activeSection === c.key
                    ? "ring-1 ring-[#fb923c]/60"
                    : ""
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

          <StoryHubNodePreviewPane
            content={previewMd}
            emptyHint={previewEmptyHint}
            onOpenPreview={() => openPreview(activeSection)}
          />
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
          updateNodeData(id, {
            storyboardMd: md,
            storyboardHistory: pushStoryRevision(d.storyboardHistory, md),
          });
          syncColumnsIfPresent({ storyboardMd: md });
          reflowStoryComicLayout();
        }}
        onRunSection={runHubSection}
        sectionIsRunning={reviewSectionRunning}
        canRunLlm={canRunLlm}
      />
    </>
  );
}
