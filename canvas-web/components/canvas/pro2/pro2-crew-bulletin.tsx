"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  ChevronDown,
  Copy,
  Loader2,
  Megaphone,
  Play,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { useCanvasStore } from "@/lib/canvas/store";
import { busEnqueueStoryRun } from "@/lib/canvas/canvas-run-bus";
import { patchAnchorCrewBulletin } from "@/lib/canvas/crew-bulletin-sync";
import { resolveCrewBulletinAnchor } from "@/lib/canvas/crew-bulletin-context";
import {
  computeCrewProductionPhases,
  type CrewProductionPhase,
  type CrewProductionPhaseId,
  type CrewProductionPhaseStatus,
} from "@/lib/canvas/crew-bulletin-phases";
import {
  claimCrewBulletinTasks,
  patchCrewBulletinOnAnchor,
  crewTaskStatusColor,
  crewTaskStatusLine,
  isCrewTaskClaimable,
  revertCrewBulletinTaskDone,
  submitCrewBulletinTaskDone,
} from "@/lib/canvas/crew-bulletin-task-actions";
import type { CrewBulletinTask } from "@/lib/canvas/crew-bulletin-types";
import { ingestPro2HubScriptFile } from "@/lib/canvas/pro2-hub-script-upload";
import { refreshCrewBulletinFromHub } from "@/lib/canvas/crew-bulletin-build";
import { canvasNotify } from "@/lib/canvas/canvas-notify";
import { formatCrewTaskTableCells } from "@/lib/canvas/crew-bulletin-task-prompts";
import { resolveCrewTaskWorkPreviewUrl } from "@/lib/canvas/crew-bulletin-task-preview";
import { spawnPro2ScriptHubAt } from "@/lib/canvas/pro2-spawn-nodes";
import { selectPro2NodeAfterSpawn } from "@/lib/canvas/pro2-spawn-select";
import { flowPositionAtViewportCenter } from "@/lib/canvas/viewport-placement";
import { STORY_PRO_UPLOAD_SCRIPT_ACCEPT } from "@/lib/canvas/story-pro-upload-script";
import {
  SCRIPT_STUDIO_TOTAL_EPISODE_PRESETS,
  scriptStudioBatchCount,
  scriptStudioBatchRange,
} from "@/lib/canvas/script-studio-prompts";
import type { StoryProScriptHubNodeData } from "@/lib/canvas/story-pro-workspace-types";
import { fetchCanvasViewerUser } from "@/lib/canvas-viewer-session";
import { cn } from "@/lib/utils";
import {
  collectEpisodeNumbers,
  CrewBulletinEpisodeFilter,
  CrewBulletinVirtualTaskList,
} from "./crew-bulletin-task-list";
import {
  Pro2ScriptPackagePanel,
  useCopyScriptPackageSnapshot,
} from "./pro2-script-package-panel";
import { resolveScriptPackageSnapshots } from "@/lib/canvas/script-package-snapshots";

/** 与 Pro2 工具条 / 批次面板一致的 tab 选中高亮 */
const CREW_PHASE_TAB_ACTIVE =
  "border-cyan-400/45 bg-cyan-500/15 ring-1 ring-inset ring-cyan-400/30";

const CREW_CONTENT_SCALES = [
  { label: "小", value: 0.9 },
  { label: "标准", value: 1 },
  { label: "大", value: 1.2 },
  { label: "特大", value: 1.45 },
] as const;

function phaseStatusStyles(status: CrewProductionPhaseStatus, active: boolean) {
  if (status === "done") {
    return {
      title: "text-emerald-100",
      subtitle: "text-emerald-200/70",
      line: "bg-emerald-400/50",
      chip: active
        ? "border-emerald-400/40 bg-emerald-500/12"
        : "border-emerald-400/25 bg-emerald-500/8",
    };
  }
  if (status === "in_progress") {
    return {
      title: "text-amber-100",
      subtitle: "text-amber-200/75",
      line: "bg-amber-400/45",
      chip: active
        ? "border-amber-400/45 bg-amber-500/12"
        : "border-amber-400/30 bg-amber-500/8",
    };
  }
  return {
    title: "text-white/45",
    subtitle: "text-white/35",
    line: "bg-black/30",
    chip: "border-black/35 bg-black/10",
  };
}

function PhaseStepIcon({
  index,
  status,
}: {
  index: number;
  status: CrewProductionPhaseStatus;
}) {
  if (status === "done") {
    return (
      <div className="grid size-6 shrink-0 place-items-center rounded-full border border-emerald-300/80 bg-emerald-400 text-black">
        <Check className="size-3" strokeWidth={2.5} />
      </div>
    );
  }
  return (
    <div
      className={cn(
        "grid size-6 shrink-0 place-items-center rounded-full border text-[10px] font-semibold",
        status === "in_progress"
          ? "border-amber-300/80 bg-amber-400 text-black"
          : "border-black/40 bg-transparent text-white/40",
      )}
    >
      {index}
    </div>
  );
}

type AuthoringPhase = {
  id: string;
  label: string;
  subtitle: string;
  status: CrewProductionPhaseStatus;
};

function isThemeOutlineRunning(d: StoryProScriptHubNodeData): boolean {
  const st = d.themeOutlineRuntime?.status as string | undefined;
  return st === "pending" || st === "running" || st === "submitted";
}

function computeAuthoringPhases(d: StoryProScriptHubNodeData): AuthoringPhase[] {
  const inputMode = d.scriptStudioInputMode ?? "generate";
  const hasInput =
    inputMode === "upload"
      ? Boolean(d.uploadedScriptMd?.trim())
      : Boolean((d.scriptStudioThemeInput ?? "").trim());
  const batchIndex = d.scriptStudioBatchIndex ?? 0;
  const running = isThemeOutlineRunning(d);

  const step2: CrewProductionPhaseStatus = hasInput
    ? "done"
    : running
      ? "in_progress"
      : "not_started";
  const step4: CrewProductionPhaseStatus = running
    ? "in_progress"
    : batchIndex > 0
      ? "done"
      : hasInput
        ? "in_progress"
        : "not_started";

  return [
    {
      id: "pick",
      label: "选择方式",
      subtitle: inputMode === "upload" ? "上传剧本" : "一句话生成",
      status: "done",
    },
    {
      id: "input",
      label: "创作输入",
      subtitle: hasInput ? "已填写" : "待输入",
      status: step2,
    },
    {
      id: "episodes",
      label: "集数设定",
      subtitle: `${d.scriptStudioTotalEpisodes ?? 30} 集`,
      status: "done",
    },
    {
      id: "batch",
      label: "生成批次",
      subtitle: running
        ? "生成中…"
        : batchIndex > 0
          ? `已完成 ${batchIndex} 批`
          : "待生成",
      status: step4,
    },
    {
      id: "publish",
      label: "待发布",
      subtitle: "节点顶栏发布",
      status: batchIndex > 0 ? "in_progress" : "not_started",
    },
  ];
}

function PhaseChip({
  index,
  label,
  tooltip,
  status,
  active,
  onClick,
}: {
  index: number;
  label: string;
  tooltip?: string;
  status: CrewProductionPhaseStatus;
  active: boolean;
  onClick: () => void;
}) {
  const styles = phaseStatusStyles(status, active);
  return (
    <button
      type="button"
      title={tooltip ?? label}
      aria-pressed={active}
      className={cn(
        "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-1 text-left transition hover:brightness-110",
        styles.chip,
        active && CREW_PHASE_TAB_ACTIVE,
      )}
      onClick={onClick}
    >
      <PhaseStepIcon index={index} status={status} />
      <span className={cn("text-[10px] font-medium", styles.title)}>{label}</span>
      <ChevronDown
        className={cn(
          "size-3 shrink-0 text-white/35 transition",
          active && "rotate-180",
        )}
      />
    </button>
  );
}

function PhaseActionPanel({
  phase,
  published,
          hubId,
          hubData,
  nodes,
  onViewScript,
  onCopyScriptNode,
  onClaim,
  onSubmitDone,
  onRevertDone,
  onRefreshTasks,
  claiming,
  refreshing,
  selectedTaskIds,
  onToggleSelect,
  onSelectAll,
  episodeFilter,
  onEpisodeFilterChange,
  contentScale = 1,
  fullscreen = false,
  scriptPackageSnapshots,
  scriptTitle,
  onCopySnapshot,
}: {
  phase: CrewProductionPhase;
  published: boolean;
  hubId: string;
  hubData: StoryProScriptHubNodeData;
  nodes: ReturnType<typeof useCanvasStore.getState>["nodes"];
  onViewScript: () => void;
  onCopyScriptNode?: () => void;
  onClaim: () => void;
  onSubmitDone: (taskId: string) => void;
  onRevertDone: (taskId: string) => void;
  onRefreshTasks: () => void;
  claiming: boolean;
  refreshing: boolean;
  selectedTaskIds: Set<string>;
  onToggleSelect: (taskId: string) => void;
  onSelectAll: (taskIds: string[], select: boolean) => void;
  episodeFilter: number | "all";
  onEpisodeFilterChange: (v: number | "all") => void;
  contentScale?: number;
  fullscreen?: boolean;
  scriptPackageSnapshots?: import("@/lib/canvas/script-package-snapshots").ScriptPackageSnapshotsByKind;
  scriptTitle?: string;
  onCopySnapshot?: (snapshot: import("@/lib/canvas/script-package-snapshots").ScriptPackageSnapshot) => void;
}) {
  if (phase.id === "scriptPackage") {
    return (
      <Pro2ScriptPackagePanel
        snapshots={scriptPackageSnapshots ?? {}}
        scriptTitle={scriptTitle}
        contentScale={contentScale}
        fullscreen={fullscreen}
        hubNodeId={hubId}
        onCopySnapshot={onCopySnapshot ?? (() => {})}
      />
    );
  }

  if (phase.id === "script") {
    const outlineMd = hubData.outlineMd?.trim() ?? "";
    const onCopyMarkdown = async () => {
      if (!outlineMd) return;
      try {
        await navigator.clipboard.writeText(outlineMd);
        await canvasNotify({
          title: "已复制",
          message: "剧本正文已复制到剪贴板",
          variant: "info",
        });
      } catch {
        await canvasNotify({
          title: "复制失败",
          message: "请手动选择正文复制",
          variant: "error",
        });
      }
    };
    return (
      <div
        className={cn(
          "overflow-y-auto overflow-x-auto bg-black/15 px-3 py-2",
          fullscreen ? "min-h-0 flex-1" : "max-h-[min(70vh,520px)]",
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-lg border border-black/40 bg-black/20 px-3 py-1.5 text-[11px] text-white/85 transition hover:bg-black/30"
            onClick={onViewScript}
          >
            查看已定稿剧本
          </button>
          {outlineMd ? (
            <>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-lg border border-black/40 bg-black/20 px-3 py-1.5 text-[11px] text-white/85 transition hover:bg-black/30"
                onClick={() => void onCopyMarkdown()}
              >
                <Copy className="size-3" />
                复制剧本正文
              </button>
              {onCopyScriptNode ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-lg border border-black/40 bg-black/20 px-3 py-1.5 text-[11px] text-white/85 transition hover:bg-black/30"
                  onClick={onCopyScriptNode}
                >
                  <Copy className="size-3" />
                  复制剧本节点
                </button>
              ) : null}
            </>
          ) : null}
        </div>
        {outlineMd ? (
          <pre
            className="mt-2 min-w-0 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-black/35 bg-black/20 p-3 leading-relaxed text-white/70"
            style={{
              fontSize: `${Math.round(11 * contentScale)}px`,
              maxHeight: fullscreen ? undefined : "min(52vh, 420px)",
            }}
          >
            {outlineMd}
          </pre>
        ) : (
          <p className="mt-2 text-[10px] text-white/40">
            暂无剧本快照；请从脚本生成器发布后再关联。
          </p>
        )}
        {published ? (
          <p className="mt-2 text-[10px] text-white/40">
            其他环节请点击对应步骤 · 勾选任务后点「参与制作」
          </p>
        ) : null}
      </div>
    );
  }

  const episodes = collectEpisodeNumbers(phase.phaseTasks);
  const listTasks = [
    ...phase.pendingTasks,
    ...phase.activeTasks,
    ...phase.completedTasks,
  ];
  const claimableTaskIds = new Set(
    listTasks.filter((t) => isCrewTaskClaimable(t, nodes)).map((t) => t.id),
  );

  const emptyPhase = listTasks.length === 0;

  return (
    <div
      className={cn(
        "overflow-hidden bg-[#0D1117]",
        fullscreen ? "flex min-h-0 flex-1 flex-col" : "max-h-[min(72vh,580px)]",
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-3 py-2">
        <p className="text-[10px] text-white/45">
          {phase.label}
          {phase.totalCount > 0
            ? ` · ${phase.doneCount}/${phase.totalCount}`
            : ""}
        </p>
        <div className="flex shrink-0 items-center gap-1.5">
          {emptyPhase ? (
                  <button
                    type="button"
              disabled={refreshing}
              className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/70 transition hover:bg-[#262626] disabled:opacity-40"
              onClick={onRefreshTasks}
                  >
              {refreshing ? "刷新中…" : "刷新任务"}
                  </button>
              ) : null}
          {claimableTaskIds.size > 0 ? (
                <button
                  type="button"
              disabled={claiming || selectedTaskIds.size === 0}
              className="shrink-0 rounded-md border border-cyan-400/35 bg-cyan-500/15 px-2 py-0.5 text-[10px] text-cyan-50 transition hover:bg-cyan-500/25 disabled:opacity-40"
              onClick={onClaim}
            >
              {claiming ? "参与制作中…" : `参与制作 (${selectedTaskIds.size})`}
                </button>
          ) : null}
        </div>
      </div>
      {emptyPhase ? (
        <p className="px-3 py-3 text-[10px] text-white/40">
          暂无任务。若已生成分镜/角色表，请点「刷新任务」；或重新发布剧本以同步最新清单。
        </p>
      ) : (
        <div
                  className={cn(
            fullscreen && "flex min-h-0 flex-1 flex-col",
          )}
        >
          <CrewBulletinEpisodeFilter
            episodes={episodes}
            value={episodeFilter}
            onChange={onEpisodeFilterChange}
          />
          <CrewBulletinVirtualTaskList
            tasks={listTasks}
            taskKind={phase.id}
            episodeFilter={episodeFilter}
            selectedTaskIds={selectedTaskIds}
            claimableTaskIds={claimableTaskIds}
            taskCells={(task) => formatCrewTaskTableCells(task, hubId, hubData)}
            taskPreviewUrl={(task) => resolveCrewTaskWorkPreviewUrl(task, nodes)}
            onToggleSelect={onToggleSelect}
            onSelectAll={onSelectAll}
            onSubmitDone={onSubmitDone}
            onRevertDone={onRevertDone}
            statusLine={crewTaskStatusLine}
            statusColor={crewTaskStatusColor}
            contentScale={contentScale}
            fullscreen={fullscreen}
          />
              </div>
      )}
    </div>
  );
}

function AuthoringPanel({
  hubId,
  d,
  onUpload,
  uploadBusy,
}: {
  hubId: string;
  d: StoryProScriptHubNodeData;
  onUpload: () => void;
  uploadBusy: boolean;
}) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const total = d.scriptStudioTotalEpisodes ?? 30;
  const batchIndex = d.scriptStudioBatchIndex ?? 0;
  const batchTotal = scriptStudioBatchCount(total);
  const generatedEpisodes = Math.min(batchIndex * 10, total);
  const running = isThemeOutlineRunning(d);
  const hasMore = batchIndex < batchTotal;
  const range =
    batchIndex < batchTotal
      ? scriptStudioBatchRange(batchIndex, total)
      : scriptStudioBatchRange(Math.max(0, batchTotal - 1), total);

  const onNextBatch = useCallback(() => {
    if (running || !hasMore) return;
    busEnqueueStoryRun({ nodeId: hubId, mediaKind: "themeOutline" });
  }, [hubId, running, hasMore]);

  return (
    <div className="bg-black/15 px-3 py-2.5">
      <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-cyan-200/70">
        创作
      </p>
      <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
          className="inline-flex items-center gap-1 rounded-lg border border-black/40 bg-black/20 px-2.5 py-1 text-[11px] text-white/75 transition hover:bg-black/30"
          onClick={() =>
            updateNodeData(hubId, { scriptStudioInputMode: "generate" })
          }
        >
          一句话生成
                  </button>
                <button
                  type="button"
          disabled={uploadBusy}
          className="inline-flex items-center gap-1 rounded-lg border border-black/40 bg-black/20 px-2.5 py-1 text-[11px] text-white/75 transition hover:bg-black/30 disabled:opacity-50"
          onClick={onUpload}
        >
          {uploadBusy ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Upload className="size-3" />
          )}
          上传剧本
                </button>
        <span className="text-[10px] text-white/35">|</span>
        {SCRIPT_STUDIO_TOTAL_EPISODE_PRESETS.map((n) => (
                <button
            key={n}
                  type="button"
                  className={cn(
              "rounded-md px-2 py-0.5 text-[10px] transition",
              total === n
                ? "bg-cyan-500/25 text-cyan-50"
                : "text-white/45 hover:bg-black/20",
            )}
            onClick={() => updateNodeData(hubId, { scriptStudioTotalEpisodes: n })}
          >
            {n}集
                </button>
        ))}
              </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-[10px] text-white/50">
          进度 {generatedEpisodes}/{total} 集 · 第 {batchIndex}/{batchTotal} 批
        </span>
              {hasMore ? (
                <button
                  type="button"
                  disabled={running}
            className="inline-flex items-center gap-1 rounded-lg bg-cyan-600/90 px-2.5 py-1 text-[11px] font-medium text-white transition hover:bg-cyan-500 disabled:opacity-50"
                  onClick={onNextBatch}
                >
                  {running ? (
              <Loader2 className="size-3 animate-spin" />
                  ) : (
              <Play className="size-3" />
                  )}
                  {batchIndex === 0
                    ? `生成第 ${range.start}–${range.end} 集`
                    : `下一批 ${range.start}–${range.end} 集`}
                </button>
              ) : (
          <span className="text-[10px] text-emerald-300/80">全部批次已生成</span>
        )}
            </div>
      <p className="mt-2 text-[10px] text-white/35">
        发布：请在脚本生成器节点顶栏点击「发布剧本」；发布后可在此参与制作任务。
      </p>
              </div>
  );
}

function CrewBulletinPhaseFullscreen({
  open,
  phaseLabel,
  contentScale,
  onContentScaleChange,
  onClose,
  children,
}: {
  open: boolean;
  phaseLabel: string;
  contentScale: number;
  onContentScaleChange: (scale: number) => void;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) {
      document.body.style.overflow = "";
      return;
    }
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const scaleIdx = CREW_CONTENT_SCALES.findIndex((s) => s.value === contentScale);
  const canZoomOut = scaleIdx > 0;
  const canZoomIn = scaleIdx >= 0 && scaleIdx < CREW_CONTENT_SCALES.length - 1;

  return createPortal(
    <div
      className="fixed inset-0 z-[1090] flex h-[100dvh] w-screen flex-col bg-[#0c0a14]/94 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`公告栏 · ${phaseLabel}`}
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-cyan-400/15 bg-[#14101c]/95 px-5 py-3">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold text-white">
            公告栏 · {phaseLabel}
          </p>
          <p className="text-[11px] text-white/40">
            全屏查看 · 可调字号 · Esc 关闭
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-lg border border-white/10 bg-black/25 p-0.5">
                    <button
                      type="button"
              disabled={!canZoomOut}
              className="rounded-md p-1.5 text-white/55 hover:bg-white/8 disabled:opacity-30"
              title="缩小字号"
              onClick={() => {
                const i = Math.max(0, scaleIdx < 0 ? 1 : scaleIdx - 1);
                onContentScaleChange(CREW_CONTENT_SCALES[i]!.value);
              }}
            >
              <ZoomOut className="size-4" />
                    </button>
            {CREW_CONTENT_SCALES.map((s) => (
                          <button
                key={s.label}
                            type="button"
                className={cn(
                  "rounded-md px-2 py-1 text-[10px] transition",
                  contentScale === s.value
                    ? "bg-cyan-500/20 text-cyan-100"
                    : "text-white/45 hover:bg-white/8",
                )}
                onClick={() => onContentScaleChange(s.value)}
              >
                {s.label}
                          </button>
            ))}
                              <button
                                type="button"
              disabled={!canZoomIn}
              className="rounded-md p-1.5 text-white/55 hover:bg-white/8 disabled:opacity-30"
              title="放大字号"
              onClick={() => {
                const i = Math.min(
                  CREW_CONTENT_SCALES.length - 1,
                  (scaleIdx < 0 ? 1 : scaleIdx) + 1,
                );
                onContentScaleChange(CREW_CONTENT_SCALES[i]!.value);
              }}
            >
              <ZoomIn className="size-4" />
                              </button>
                      </div>
                <button
                  type="button"
            className="rounded-lg p-2 text-white/50 hover:bg-white/8"
            onClick={onClose}
                >
            <X className="size-5" />
                </button>
            </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>,
    document.body,
  );
}

/** 顶部剧组公告条 · 创作 / 领取 / 制作进度 */
export function Pro2CrewBulletin() {
  const base = useBookMallBaseUrl();
  const { alert } = useDialogs();
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const graphMeta = useCanvasStore((s) => s.graphMeta);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const addNode = useCanvasStore((s) => s.addNode);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const patchGraphMeta = useCanvasStore((s) => s.patchGraphMeta);
  const duplicateNode = useCanvasStore((s) => s.duplicateNode);
  const openTableEditor = useCanvasStore((s) => s.openPro2ScriptTableEditor);

  const anchor = useMemo(
    () => resolveCrewBulletinAnchor(nodes, graphMeta ?? undefined),
    [nodes, graphMeta],
  );
  const hubId = anchor?.nodeId;
  const published = anchor?.published === true;
  const bulletin = anchor?.bulletin;
  const d = anchor?.hubFields ?? ({} as StoryProScriptHubNodeData);
  const isAuthoring = anchor?.mode === "script-studio" && !published;

  const scriptPackageSnapshots = useMemo(
    () =>
      anchor
        ? resolveScriptPackageSnapshots(anchor, graphMeta, nodes)
        : {},
    [anchor, graphMeta, nodes],
  );

  const linkedScriptHeadline = useMemo(() => {
    if (anchor?.mode !== "linked-package" || !published) return null;
    const title =
      bulletin?.scriptTitle?.trim() ||
      graphMeta?.crewBulletinAnchor?.linkedScriptPackageTitle?.replace(
        /^剧本包 · /,
        "",
      ) ||
      graphMeta?.crewBulletinAnchor?.crewBulletin?.scriptTitle?.trim();
    if (!title) return null;
    const eps =
      bulletin?.totalEpisodes ??
      graphMeta?.crewBulletinAnchor?.crewBulletin?.totalEpisodes;
    return {
      title,
      episodes: eps && eps > 0 ? eps : null,
    };
  }, [anchor?.mode, published, bulletin, graphMeta]);

  const scriptPackageTitle = useMemo(() => {
    return (
      bulletin?.scriptTitle?.trim() ||
      linkedScriptHeadline?.title ||
      graphMeta?.crewBulletinAnchor?.linkedScriptPackageTitle?.replace(
        /^剧本包 · /,
        "",
      ) ||
      d.outlineMd?.split("\n")[0]?.replace(/^#\s*/, "").trim() ||
      undefined
    );
  }, [
    bulletin?.scriptTitle,
    linkedScriptHeadline?.title,
    graphMeta,
    d.outlineMd,
  ]);

  const onCopySnapshot = useCopyScriptPackageSnapshot({
    hubNodeId: hubId,
    duplicateNode,
    addNode: addNode as never,
    setNodes,
    nodes,
  });

  const [collapsed, setCollapsed] = useState(false);
  const [expandedPhaseId, setExpandedPhaseId] =
    useState<CrewProductionPhaseId | "authoring" | null>(null);
  const linkedPackageBootRef = useRef<string | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [episodeFilter, setEpisodeFilter] = useState<number | "all">("all");
  const [claiming, setClaiming] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [contentScale, setContentScale] = useState(1.2);
  const fileRef = useRef<HTMLInputElement>(null);

  const bulletinPatch = useMemo(
    () => ({ updateNodeData, patchGraphMeta }),
    [updateNodeData, patchGraphMeta],
  );

  useEffect(() => {
    if (!anchor || !published) return;
    patchAnchorCrewBulletin(anchor, nodes, bulletinPatch);
  }, [anchor, published, nodes, bulletinPatch]);

  useEffect(() => {
    if (
      anchor?.mode !== "linked-package" ||
      !published ||
      linkedPackageBootRef.current === anchor.nodeId
    ) {
      return;
    }
    linkedPackageBootRef.current = anchor.nodeId;
    setCollapsed(false);
  }, [anchor?.mode, anchor?.nodeId, published]);

  useEffect(() => {
    if (!anchor || !published || !hubId) return;
    const fresh = refreshCrewBulletinFromHub(hubId, d);
    const freshAsset = fresh.tasks.filter((t) => t.kind !== "script").length;
    const curAsset =
      bulletin?.tasks.filter((t) => t.kind !== "script").length ?? 0;
    const freshFrames = fresh.tasks.filter((t) => t.kind === "frame").length;
    const curFrames = bulletin?.tasks.filter((t) => t.kind === "frame").length ?? 0;
    const rowFrames = d.scriptStudioFrameRows?.length ?? 0;
    if (
      freshAsset > curAsset ||
      (rowFrames > 0 && freshFrames !== curFrames)
    ) {
      patchCrewBulletinOnAnchor(anchor, fresh, bulletinPatch);
    }
  }, [
    anchor,
    published,
    hubId,
    d,
    bulletin?.tasks.length,
    bulletinPatch,
  ]);

  useEffect(() => {
    setSelectedTaskIds(new Set());
    setEpisodeFilter("all");
  }, [expandedPhaseId]);

  const productionPhases = useMemo(
    () =>
      bulletin
        ? computeCrewProductionPhases(bulletin, scriptPackageSnapshots)
        : [],
    [bulletin, scriptPackageSnapshots],
  );
  const workflowPhases = useMemo(
    () => productionPhases.filter((p) => p.id !== "scriptPackage"),
    [productionPhases],
  );
  const scriptPackagePhase = useMemo(
    () => productionPhases.find((p) => p.id === "scriptPackage"),
    [productionPhases],
  );
  const authoringPhases = useMemo(
    () => (isAuthoring ? computeAuthoringPhases(d) : []),
    [isAuthoring, d],
  );

  const viewScript = useCallback(() => {
    if (!hubId) return;
    openTableEditor(hubId);
  }, [hubId, openTableEditor]);

  const onCopyScriptNode = useCallback(() => {
    const position = flowPositionAtViewportCenter("story-pro2-script-hub");
    const { crewBulletin: _drop, ...hubPatch } = d;
    const id = spawnPro2ScriptHubAt(addNode, position, {
      ...hubPatch,
      scriptPublished: true,
      scriptFinalized: true,
    });
    if (id) {
      selectPro2NodeAfterSpawn(setNodes, id);
      void canvasNotify({
        title: "已复制",
        message: "剧本节点已添加到画布，可查看完整角色/分镜表",
        variant: "info",
      });
    }
  }, [d, addNode, setNodes]);


  const onPhaseClick = useCallback(
    (phaseId: CrewProductionPhaseId | "authoring") => {
      setExpandedPhaseId((cur) => (cur === phaseId ? null : phaseId));
    },
    [],
  );

  const toggleSelect = useCallback((taskId: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  const onSelectAll = useCallback((taskIds: string[], select: boolean) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      for (const id of taskIds) {
        if (select) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const onPaneClick = () => {
      setExpandedPhaseId(null);
    };
    window.addEventListener("canvas:pro2-pane-click", onPaneClick);
    return () => window.removeEventListener("canvas:pro2-pane-click", onPaneClick);
  }, []);

  const onRefreshTasks = useCallback(() => {
    if (!anchor || !hubId) return;
    setRefreshing(true);
    try {
      const live = useCanvasStore.getState().nodes.find((n) => n.id === hubId);
      const liveData = (live?.data ?? d) as StoryProScriptHubNodeData;
      const fresh = refreshCrewBulletinFromHub(hubId, liveData);
      patchCrewBulletinOnAnchor(anchor, fresh, bulletinPatch);
    } finally {
      setRefreshing(false);
    }
  }, [anchor, hubId, d, bulletinPatch]);

  const onClaim = useCallback(async () => {
    if (
      !anchor ||
      !expandedPhaseId ||
      expandedPhaseId === "authoring" ||
      expandedPhaseId === "scriptPackage"
    ) {
      return;
    }
    const liveAnchor = resolveCrewBulletinAnchor(
      useCanvasStore.getState().nodes,
      useCanvasStore.getState().graphMeta ?? undefined,
    );
    const liveBulletin = liveAnchor?.bulletin;
    if (!liveAnchor || !liveBulletin) return;
    const phase = computeCrewProductionPhases(liveBulletin).find(
      (p) => p.id === expandedPhaseId,
    );
    if (!phase || selectedTaskIds.size === 0) return;

    setClaiming(true);
    try {
      const user = await fetchCanvasViewerUser(base);
      const result = claimCrewBulletinTasks(
        liveAnchor,
        liveBulletin,
        liveAnchor.hubFields,
        Array.from(selectedTaskIds),
        {
          userId: user?.id,
          displayName: user?.name ?? user?.email ?? "我",
        },
        { nodes, edges, addNode: addNode as never, setNodes, setEdges, updateNodeData, patchGraphMeta, graphMeta, bookMallBase: base },
      );
      setSelectedTaskIds(new Set());
      if (result.claimed === 0) {
        await alert({
          title: "未能参与制作",
          message:
            result.skipped > 0
              ? "所选任务暂无法生成工作节点（如后期合成等请手动添加节点）。"
              : "请勾选待参与制作的任务后再试。",
          variant: "warning",
        });
      }
    } finally {
      setClaiming(false);
    }
  }, [
    anchor,
    expandedPhaseId,
    selectedTaskIds,
    base,
    nodes,
    edges,
    addNode,
    setNodes,
    setEdges,
    patchGraphMeta,
    alert,
    graphMeta,
  ]);

  const onRevertDone = useCallback(
    (taskId: string) => {
      if (!anchor || !bulletin) return;
      revertCrewBulletinTaskDone(anchor, bulletin, taskId, {
        nodes,
        edges,
        addNode: addNode as never,
        setNodes,
        setEdges,
        updateNodeData,
        patchGraphMeta,
        graphMeta,
        bookMallBase: base,
      });
    },
    [anchor, bulletin, nodes, edges, addNode, setNodes, setEdges, updateNodeData, patchGraphMeta, graphMeta, base],
  );

  const onSubmitDone = useCallback(
    (taskId: string) => {
      if (!anchor || !bulletin) return;
      submitCrewBulletinTaskDone(anchor, bulletin, taskId, {
        nodes,
        edges,
        addNode: addNode as never,
        setNodes,
        setEdges,
        updateNodeData,
        patchGraphMeta,
        graphMeta,
        bookMallBase: base,
      });
    },
    [anchor, bulletin, nodes, edges, addNode, setNodes, setEdges, updateNodeData, patchGraphMeta, graphMeta, base],
  );

  const onUploadClick = useCallback(() => {
    fileRef.current?.click();
  }, []);

  const onFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file || !hubId) return;
      setUploadBusy(true);
      try {
        await ingestPro2HubScriptFile(
          hubId,
          file,
          base,
          { nodes, edges, updateNodeData },
          { alert },
          { triggerGeneration: true },
        );
        updateNodeData(hubId, { scriptStudioInputMode: "upload" });
      } finally {
        setUploadBusy(false);
      }
    },
    [hubId, base, nodes, edges, updateNodeData, alert],
  );

  if (!anchor || !hubId) return null;

  const activeProductionPhase =
    expandedPhaseId && expandedPhaseId !== "authoring"
      ? productionPhases.find((p) => p.id === expandedPhaseId)
      : undefined;

  return (
    <div
      className="pointer-events-none absolute left-0 top-0 z-[56] flex max-w-[calc(100vw-12px)] items-start"
      role="region"
      aria-label="剧组公告条"
    >
      <input
        ref={fileRef}
        type="file"
        accept={STORY_PRO_UPLOAD_SCRIPT_ACCEPT}
        className="hidden"
        onChange={(e) => void onFileChange(e)}
      />

      {/* 收起后保留 · 公告 logo */}
                    <button
                      type="button"
        className={cn(
          "pointer-events-auto relative z-[2] flex size-9 shrink-0 items-center justify-center rounded-r-lg border border-black/40 bg-[var(--canvas-surface)]/98 text-cyan-300/90 shadow-md backdrop-blur-sm transition hover:bg-black/25",
          !collapsed && "rounded-r-none border-r-0",
        )}
        title={collapsed ? "展开公告栏" : "向左收起"}
        aria-expanded={!collapsed}
        onClick={() => {
          setCollapsed((v) => {
            if (!v) setExpandedPhaseId(null);
            return !v;
          });
        }}
      >
        <Megaphone className="size-4" />
                    </button>

      {/* 向右滑开 · 环节 tab + 任务面板 */}
      <div
        className={cn(
          "pointer-events-auto overflow-hidden transition-[max-width,opacity] duration-300 ease-out",
          collapsed ? "max-w-0 opacity-0" : "max-w-[min(calc(100vw-52px),1080px)] opacity-100",
        )}
      >
        <div className="min-w-[min(calc(100vw-52px),780px)] max-w-[min(calc(100vw-52px),1080px)] rounded-r-xl border border-black/40 border-l-0 bg-[var(--canvas-surface)]/98 shadow-lg backdrop-blur-sm">
          {linkedScriptHeadline ? (
            <div className="border-b border-black/35 px-3 py-1.5">
              <p className="truncate text-[11px] font-medium text-white/90">
                {linkedScriptHeadline.title}
              </p>
              <p className="text-[10px] text-white/45">
                协作制作
                {linkedScriptHeadline.episodes
                  ? ` · 共 ${linkedScriptHeadline.episodes} 集`
                  : ""}
                {bulletin?.tasks?.length
                  ? ` · ${bulletin.tasks.filter((t) => t.status === "done" && t.kind !== "script").length}/${bulletin.tasks.filter((t) => t.kind !== "script").length} 项已完成`
                  : ""}
              </p>
            </div>
          ) : null}
          <div className="flex items-stretch">
            <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-1 overflow-x-auto px-2 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {isAuthoring
                ? authoringPhases.map((phase, idx) => (
                    <PhaseChip
                      key={phase.id}
                      index={idx + 1}
                      label={phase.label}
                      tooltip={phase.subtitle}
                      status={phase.status}
                      active={expandedPhaseId === "authoring"}
                      onClick={() => onPhaseClick("authoring")}
                    />
                  ))
                : workflowPhases.map((phase, idx) => (
                    <PhaseChip
                      key={phase.id}
                      index={idx + 1}
                      label={phase.label}
                      tooltip={
                        phase.totalCount > 0
                          ? `${phase.label} · ${phase.doneCount}/${phase.totalCount}`
                          : phase.label
                      }
                      status={phase.status}
                      active={expandedPhaseId === phase.id}
                      onClick={() => onPhaseClick(phase.id)}
                    />
                  ))}
          </div>
            {published && scriptPackagePhase ? (
              <div className="flex shrink-0 items-center border-l border-black/35 px-2 py-1.5">
                <PhaseChip
                  index={workflowPhases.length + 1}
                  label={scriptPackagePhase.label}
                  tooltip={scriptPackagePhase.subtitle}
                  status={scriptPackagePhase.status}
                  active={expandedPhaseId === "scriptPackage"}
                  onClick={() => onPhaseClick("scriptPackage")}
                />
        </div>
      ) : null}
          </div>

          {isAuthoring && expandedPhaseId === "authoring" ? (
            <AuthoringPanel
              hubId={hubId}
              d={d}
              onUpload={onUploadClick}
              uploadBusy={uploadBusy}
            />
          ) : null}
        </div>
      </div>

      {published && activeProductionPhase && expandedPhaseId ? (
        <CrewBulletinPhaseFullscreen
          open
          phaseLabel={activeProductionPhase.label}
          contentScale={contentScale}
          onContentScaleChange={setContentScale}
          onClose={() => setExpandedPhaseId(null)}
        >
          <PhaseActionPanel
            phase={activeProductionPhase}
            published={published}
            hubId={hubId}
            hubData={d}
            nodes={nodes}
            onViewScript={viewScript}
            onCopyScriptNode={onCopyScriptNode}
            onClaim={() => void onClaim()}
            onSubmitDone={onSubmitDone}
            onRevertDone={onRevertDone}
            onRefreshTasks={onRefreshTasks}
            claiming={claiming}
            refreshing={refreshing}
            selectedTaskIds={selectedTaskIds}
            onToggleSelect={toggleSelect}
            onSelectAll={onSelectAll}
            episodeFilter={episodeFilter}
            onEpisodeFilterChange={setEpisodeFilter}
            contentScale={contentScale}
            fullscreen
            scriptPackageSnapshots={scriptPackageSnapshots}
            scriptTitle={scriptPackageTitle}
            onCopySnapshot={onCopySnapshot}
          />
        </CrewBulletinPhaseFullscreen>
      ) : null}
    </div>
  );
}
