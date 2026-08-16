"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Images, Save, Download } from "lucide-react";

import { EcomVideoSlot } from "@/components/media/ecom-video-slot";
import { ProductDesignPromptMentionTextarea } from "@/components/product-design/product-design-prompt-mention-textarea";
import { SeedVideoRenderProgressPanel } from "@/components/seed-video/seed-video-render-progress-panel";
import { SeedVideoSaveDialog } from "@/components/seed-video/seed-video-save-dialog";
import { StoryboardModelPickerDialog } from "@/components/storyboard/storyboard-model-picker-dialog";
import { SeedVideoProductionStrategyDialog } from "@/components/seed-video/seed-video-production-strategy-dialog";
import type { SeedVideoProductionStrategy } from "@/components/seed-video/seed-video-production-strategy-dialog";
import { SeedVideoRefUploader } from "@/components/seed-video/seed-video-ref-uploader";
import { SeedVideoShotTable } from "@/components/seed-video/seed-video-shot-table";
import { SeedVideoStoryboardDraftEditor } from "@/components/seed-video/seed-video-storyboard-draft-editor";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import {
  generateSeedVideoDirect,
  generateSeedVideoShot,
  generateSeedVideoTts,
  getSeedVideoProject,
  pollSeedVideoDirect,
  pollSeedVideoMediaRenderJob,
  renderSeedVideo,
  saveSeedVideoDeliverableSnapshot,
  downloadSeedVideoExportZip,
  updateSeedVideoProject,
} from "@/lib/ecom-seed-video-api";
import { resolveSeedVideoDirectVideos } from "@/lib/seed-video-direct-videos";
import { buildSeedVideoMentionRefs, SEED_VIDEO_PROMPT_PLACEHOLDER } from "@/lib/seed-video-mention-refs";
import { pickBoundStoryboardModelKey } from "@/lib/storyboard-model-pick";
import { buildSeedVideoDirectPlanFromShots } from "@/lib/seed-video-direct-plan";
import { mergeSeedVideoShots } from "@/lib/seed-video-shot-merge";
import {
  appendSeedVideoRenderStepLog,
  resolveSeedVideoRenderPhase,
  type SeedVideoRenderProgressState,
} from "@/lib/seed-video-render-progress";
import {
  isShotVideoPending,
  listPendingShotVideoIndices,
} from "@/lib/seed-video-pending-shots";
import {
  filterVideoModelsForMode,
  hasSeedVideoDirectPlanReady,
  isDirectMode,
  resolveSeedVideoVideoModelKey,
} from "@/lib/seed-video-workflow";
import {
  hasSeedVideoProductionContent,
  resolveSeedVideoMiddleWorkspaceContent,
  resolveSeedVideoProductionShots,
  type SeedVideoStoryboardDraftRow,
} from "@/lib/seed-video-storyboard-parse";
import {
  SEED_VIDEO_DIRECT_MAX_DURATION_SEC,
  type SeedVideoPlan,
  type SeedVideoProject,
  type SeedVideoShot,
} from "@/lib/seed-video-types";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";

const DIRECT_POLL_MS = 4000;
const DIRECT_POLL_MAX = 180;
const RENDER_POLL_MS = 3000;
const RENDER_POLL_MAX = 120;
const SHOT_POLL_MS = 4000;

function addGeneratingShot(prev: Set<number>, index: number): Set<number> {
  if (prev.has(index)) return prev;
  const next = new Set(prev);
  next.add(index);
  return next;
}

function removeGeneratingShot(prev: Set<number>, index: number): Set<number> {
  if (!prev.has(index)) return prev;
  const next = new Set(prev);
  next.delete(index);
  return next;
}

type PendingDirectVideoMeta = {
  taskId?: string;
  startedAt?: string;
};

function readPendingDirectVideo(meta: SeedVideoProject["meta"]): PendingDirectVideoMeta | null {
  const raw = meta?.pendingDirectVideo as PendingDirectVideoMeta | undefined;
  if (!raw?.taskId?.trim()) return null;
  return raw;
}

type Props = {
  project: SeedVideoProject;
  videoModels: StoryboardGatewayModel[];
  videoModelKey: string;
  onVideoModelChange: (key: string) => void;
  onProjectChange: () => void | Promise<void>;
  onPreviewVideo: (src: string, title?: string) => void;
  onAlert: (opts: { title: string; message: string; variant?: "error" }) => Promise<void>;
  onUploadRef: (file: File) => Promise<void>;
  onRemoveRef?: (id: string) => void | Promise<void>;
  onAttachRefs?: (assetIds: string[]) => Promise<void>;
  refBusy?: boolean;
  planningPrompt: string;
  onPlanningPromptChange: (value: string) => void;
  onStartPlanning: () => void;
  onNewProject?: () => void | Promise<void>;
  streaming?: boolean;
  storyboardDraft?: SeedVideoStoryboardDraftRow[];
  editingStoryboard?: boolean;
  onSaveStoryboardDraft?: (rows: SeedVideoStoryboardDraftRow[]) => void | Promise<void>;
  onProceedFromStoryboardEdit?: (rows: SeedVideoStoryboardDraftRow[]) => void;
  openProductionAfterSyncToken?: number;
};

export function SeedVideoContentPanel({
  project,
  videoModels,
  videoModelKey,
  onVideoModelChange,
  onProjectChange,
  onPreviewVideo,
  onAlert,
  onUploadRef,
  onRemoveRef,
  onAttachRefs,
  refBusy,
  planningPrompt,
  onPlanningPromptChange,
  onStartPlanning,
  onNewProject,
  streaming,
  storyboardDraft = [],
  editingStoryboard = false,
  onSaveStoryboardDraft,
  onProceedFromStoryboardEdit,
  openProductionAfterSyncToken = 0,
}: Props) {
  const router = useRouter();
  const workspace = useMemo(
    () => resolveSeedVideoMiddleWorkspaceContent(project),
    [project],
  );
  const directMode = isDirectMode(project);
  const direct = directMode;
  const resolvedShots = useMemo(
    () => resolveSeedVideoProductionShots(project),
    [project],
  );
  const directPlan = project.plan?.directVideo;
  const needsConfirmPreview = workspace.needsConfirm && Boolean(workspace.mode);
  const [localRenderedFinalUrl, setLocalRenderedFinalUrl] = useState<string | null>(null);
  const finalUrl =
    localRenderedFinalUrl?.trim() ||
    project.plan?.render?.finalVideoUrl?.trim() ||
    project.videoOssUrl?.trim() ||
    directPlan?.videoUrl?.trim() ||
    null;

  useEffect(() => {
    setLocalRenderedFinalUrl(null);
  }, [project.id]);

  useEffect(() => {
    const fromPlan = project.plan?.render?.finalVideoUrl?.trim();
    if (fromPlan) setLocalRenderedFinalUrl(fromPlan);
  }, [project.plan?.render?.finalVideoUrl]);

  const filteredModels = useMemo(() => {
    const keys = filterVideoModelsForMode(
      videoModels.map((m) => m.modelKey),
      direct,
    );
    return videoModels.filter((m) => keys.includes(m.modelKey));
  }, [videoModels, direct]);

  const videoModelKeyRef = useRef(videoModelKey);
  videoModelKeyRef.current = videoModelKey;
  const prevDirectRef = useRef(direct);

  useEffect(() => {
    if (filteredModels.length === 0) return;
    if (prevDirectRef.current === direct) return;
    prevDirectRef.current = direct;
    const next = resolveSeedVideoVideoModelKey(
      filteredModels,
      videoModelKeyRef.current,
      direct,
    );
    if (next !== videoModelKeyRef.current) onVideoModelChange(next);
  }, [direct, filteredModels, onVideoModelChange]);

  const [localShots, setLocalShots] = useState<SeedVideoShot[]>(() =>
    resolvedShots.length > 0
      ? resolvedShots
      : workspace.mode === "fine"
        ? workspace.shots
        : [],
  );

  useEffect(() => {
    if (resolvedShots.length >= 2) {
      setLocalShots((prev) => mergeSeedVideoShots(prev, resolvedShots));
      return;
    }
    if (resolvedShots.length > 0) {
      setLocalShots(resolvedShots);
      return;
    }
    if (workspace.mode === "fine" && workspace.shots.length > 0) {
      setLocalShots((prev) => mergeSeedVideoShots(prev, workspace.shots));
      return;
    }
    if (resolvedShots.length === 0 && workspace.mode !== "fine") {
      setLocalShots([]);
    }
  }, [project.id, resolvedShots, workspace.mode, workspace.shots]);

  const effectiveDirectPlan = useMemo(() => {
    if (directPlan?.globalPrompt?.trim()) return directPlan;
    if (workspace.mode === "direct" && workspace.directPlan) return workspace.directPlan;
    const shots =
      localShots.length >= 1
        ? localShots
        : resolvedShots.length >= 1
          ? resolvedShots
          : workspace.shots;
    return buildSeedVideoDirectPlanFromShots(shots, {
      settings: project.settings,
      stylePack: project.plan?.stylePack,
      existing: directPlan ?? undefined,
    });
  }, [
    directPlan,
    workspace.mode,
    workspace.directPlan,
    workspace.shots,
    localShots,
    resolvedShots,
    project.settings,
    project.plan?.stylePack,
  ]);

  const [localStoryboardDraft, setLocalStoryboardDraft] =
    useState<SeedVideoStoryboardDraftRow[]>(storyboardDraft);
  const [storyboardDraftBusy, setStoryboardDraftBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [strategyDialogOpen, setStrategyDialogOpen] = useState(false);
  const [productionStrategy, setProductionStrategy] = useState<SeedVideoProductionStrategy | null>(
    null,
  );
  const [pickerPanelIndex, setPickerPanelIndex] = useState<number | null>(null);
  const [pickerTarget, setPickerTarget] = useState<"panel" | "fullSheet">("fullSheet");
  const [pickerGenerateAllParallel, setPickerGenerateAllParallel] = useState(false);
  const [pickerSelectedShotIndices, setPickerSelectedShotIndices] = useState<number[]>([]);
  const [selectedShotIndices, setSelectedShotIndices] = useState<Set<number>>(() => new Set());
  const [generatingShots, setGeneratingShots] = useState<Set<number>>(() => new Set());
  const [batchShotBusy, setBatchShotBusy] = useState(false);
  const [ttsBusy, setTtsBusy] = useState(false);
  const [renderBusy, setRenderBusy] = useState(false);
  const [renderProgress, setRenderProgress] = useState<SeedVideoRenderProgressState | null>(
    null,
  );
  const renderResumeLockRef = useRef(false);
  const [directBusy, setDirectBusy] = useState(false);
  const [pickerDurationSec, setPickerDurationSec] = useState(
    () =>
      directPlan?.durationSec ??
      project.settings.targetDurationSec ??
      SEED_VIDEO_DIRECT_MAX_DURATION_SEC,
  );
  const [pickerPanelDurationSec, setPickerPanelDurationSec] = useState(8);
  const directPollLock = useRef(false);
  const generatingShotsRef = useRef(generatingShots);
  generatingShotsRef.current = generatingShots;
  const syncShotVideosLockRef = useRef(false);
  const projectChangeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setPickerDurationSec(
      directPlan?.durationSec ??
        project.settings.targetDurationSec ??
        SEED_VIDEO_DIRECT_MAX_DURATION_SEC,
    );
  }, [directPlan?.durationSec, project.settings.targetDurationSec, project.id]);

  useEffect(() => {
    setSelectedShotIndices(new Set());
  }, [project.id]);

  const pendingShotIndices = useMemo(
    () =>
      listPendingShotVideoIndices(project.meta).filter((idx) => {
        const local = localShots.find((s) => s.index === idx);
        return !local?.videoUrl?.trim();
      }),
    [project.meta, localShots],
  );

  const activeGeneratingIndices = useMemo(() => {
    const set = new Set(generatingShots);
    for (const idx of pendingShotIndices) set.add(idx);
    return set;
  }, [generatingShots, pendingShotIndices]);

  const pendingDirectVideo = readPendingDirectVideo(project.meta);
  const isDirectGenerating = directBusy || Boolean(pendingDirectVideo?.taskId);

  const batchProductionBusy =
    isDirectGenerating || batchShotBusy || ttsBusy || renderBusy;
  const singleShotBusy = activeGeneratingIndices.size > 0;
  const productionBusy = batchProductionBusy || singleShotBusy;

  const mentionRefs = useMemo(
    () => buildSeedVideoMentionRefs(project.references),
    [project.references],
  );
  const directPreviewBgUrl = useMemo(
    () =>
      project.references.find((r) => r.role === "seed-material" && r.ossUrl?.trim())?.ossUrl?.trim(),
    [project.references],
  );
  const directVideos = useMemo(
    () => resolveSeedVideoDirectVideos(effectiveDirectPlan ?? directPlan),
    [directPlan, effectiveDirectPlan],
  );
  const hasDirectVideos = directVideos.length > 0;
  const materialCount = project.references.filter((r) => r.role === "seed-material").length;
  const canStartPlanning =
    materialCount > 0 && planningPrompt.trim().length > 0 && !streaming;
  const canSave =
    materialCount > 0 &&
    planningPrompt.trim().length > 0 &&
    (hasSeedVideoProductionContent(project) ||
      Boolean(effectiveDirectPlan?.globalPrompt?.trim()) ||
      localShots.length >= 1) &&
    !streaming &&
    !productionBusy;

  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);

  const shotsAutosaveRef = useRef<number | null>(null);
  const shotsAutosaveSkipRef = useRef(true);

  useEffect(() => {
    shotsAutosaveSkipRef.current = true;
  }, [project.id]);

  useEffect(() => {
    setLocalStoryboardDraft(storyboardDraft);
  }, [storyboardDraft]);

  const showStoryboardEdit =
    editingStoryboard && localStoryboardDraft.length > 0;

  const savePlan = useCallback(
    async (patch: Partial<SeedVideoPlan>) => {
      await updateSeedVideoProject(project.id, {
        plan: { ...(project.plan ?? {}), ...patch },
      });
      await onProjectChange();
    },
    [onProjectChange, project.id, project.plan],
  );

  const persistPlanShotsQuiet = useCallback(
    async (shots: SeedVideoShot[]) => {
      await updateSeedVideoProject(project.id, {
        plan: {
          ...(project.plan ?? {}),
          shots: mergeSeedVideoShots(shots, project.plan?.shots ?? []),
        },
      });
    },
    [project.id, project.plan],
  );

  const scheduleProjectChange = useCallback(() => {
    if (projectChangeTimerRef.current) {
      window.clearTimeout(projectChangeTimerRef.current);
    }
    projectChangeTimerRef.current = window.setTimeout(() => {
      projectChangeTimerRef.current = null;
      void onProjectChange();
    }, 500);
  }, [onProjectChange]);

  useEffect(() => {
    if (shotsAutosaveSkipRef.current) {
      shotsAutosaveSkipRef.current = false;
      return;
    }
    if (localShots.length < 2) return;
    if (shotsAutosaveRef.current) window.clearTimeout(shotsAutosaveRef.current);
    const serverShots = project.plan?.shots ?? [];
    shotsAutosaveRef.current = window.setTimeout(() => {
      void savePlan({
        shots: mergeSeedVideoShots(localShots, serverShots),
      }).catch(() => {
        /* 静默失败，用户仍可点保存编辑 */
      });
    }, 800);
    return () => {
      if (shotsAutosaveRef.current) window.clearTimeout(shotsAutosaveRef.current);
    };
  }, [localShots, project.plan?.shots, savePlan]);

  const applyRemoteShotVideo = useCallback(
    (panelIndex: number, remote: SeedVideoShot | undefined) => {
      if (!remote?.videoUrl?.trim()) return false;
      setLocalShots((prev) =>
        prev.map((s) =>
          s.index === panelIndex
            ? { ...s, videoUrl: remote.videoUrl, videoTaskId: remote.videoTaskId }
            : s,
        ),
      );
      return true;
    },
    [],
  );

  const syncGeneratingShotVideos = useCallback(async () => {
    if (syncShotVideosLockRef.current) return;
    syncShotVideosLockRef.current = true;
    try {
      const fresh = await getSeedVideoProject(project.id);
      const watch = new Set<number>(generatingShotsRef.current);
      for (const idx of listPendingShotVideoIndices(fresh.meta)) {
        watch.add(idx);
      }
      if (watch.size === 0) return;

      let videoChanged = false;
      const completed: number[] = [];
      for (const idx of watch) {
        const remote = fresh.plan?.shots?.find((s) => s.index === idx);
        if (!remote?.videoUrl?.trim()) continue;
        if (applyRemoteShotVideo(idx, remote)) videoChanged = true;
        completed.push(idx);
      }

      if (completed.length > 0) {
        setGeneratingShots((prev) => {
          let next = prev;
          for (const idx of completed) {
            next = removeGeneratingShot(next, idx);
          }
          return next;
        });
      }
      if (videoChanged) scheduleProjectChange();
    } catch {
      /* ignore */
    } finally {
      syncShotVideosLockRef.current = false;
    }
  }, [applyRemoteShotVideo, project.id, scheduleProjectChange]);

  useEffect(() => {
    if (generatingShots.size === 0 && pendingShotIndices.length === 0) return;
    void syncGeneratingShotVideos();
    const timer = window.setInterval(() => {
      void syncGeneratingShotVideos();
    }, SHOT_POLL_MS);
    return () => window.clearInterval(timer);
  }, [
    generatingShots.size,
    pendingShotIndices.length,
    syncGeneratingShotVideos,
  ]);

  useEffect(
    () => () => {
      if (projectChangeTimerRef.current) {
        window.clearTimeout(projectChangeTimerRef.current);
      }
    },
    [],
  );

  async function handleSaveShots() {
    await savePlan({
      shots: mergeSeedVideoShots(localShots, project.plan?.shots ?? []),
    });
  }

  function beginFineProduction(opts: {
    panelIndex?: number;
    fullSheet?: boolean;
    strategy?: SeedVideoProductionStrategy;
    generateAllParallel?: boolean;
    generateSelected?: boolean;
    selectedShotIndices?: number[];
  }) {
    setPickerGenerateAllParallel(Boolean(opts.generateAllParallel));
    setPickerSelectedShotIndices(
      opts.generateSelected ? (opts.selectedShotIndices ?? []) : [],
    );
    if (opts.strategy) setProductionStrategy(opts.strategy);
    setPickerTarget(opts.fullSheet ? "fullSheet" : "panel");
    setPickerPanelIndex(opts.panelIndex ?? null);
    if (opts.panelIndex != null) {
      const shot = localShots.find((s) => s.index === opts.panelIndex);
      setPickerPanelDurationSec(shot?.durationSec ?? 8);
    }
    if (opts.fullSheet) {
      setPickerDurationSec(
        directPlan?.durationSec ??
          project.settings.targetDurationSec ??
          SEED_VIDEO_DIRECT_MAX_DURATION_SEC,
      );
    }
    if (!direct && opts.panelIndex == null && !opts.strategy && productionStrategy == null) {
      setPickerTarget("fullSheet");
      setPickerPanelIndex(null);
    }
    setPickerOpen(true);
  }

  function openVideoPicker(opts: {
    panelIndex?: number;
    fullSheet?: boolean;
    strategy?: SeedVideoProductionStrategy;
    generateAllParallel?: boolean;
    generateSelected?: boolean;
    selectedShotIndices?: number[];
  }) {
    if (filteredModels.length > 0) {
      const validKeys = new Set(filteredModels.map((m) => m.modelKey));
      if (!validKeys.has(videoModelKey)) {
        const next = resolveSeedVideoVideoModelKey(filteredModels, videoModelKey, direct);
        if (next !== videoModelKey) onVideoModelChange(next);
      }
    }
    if (
      !direct &&
      opts.panelIndex == null &&
      !opts.fullSheet &&
      !opts.strategy &&
      !opts.generateAllParallel &&
      !opts.generateSelected &&
      productionStrategy == null
    ) {
      setStrategyDialogOpen(true);
      return;
    }
    beginFineProduction(opts);
  }

  const openProductionAfterSyncRef = useRef(0);
  useEffect(() => {
    if (openProductionAfterSyncToken <= openProductionAfterSyncRef.current) return;
    openProductionAfterSyncRef.current = openProductionAfterSyncToken;
    if (direct && hasSeedVideoDirectPlanReady(directPlan ?? workspace.directPlan)) {
      if (filteredModels.length > 0) {
        const next = resolveSeedVideoVideoModelKey(filteredModels, videoModelKey, true);
        if (next !== videoModelKey) onVideoModelChange(next);
      }
      setPickerTarget("fullSheet");
      setPickerPanelIndex(null);
      setPickerOpen(true);
    }
  }, [direct, directPlan, workspace, openProductionAfterSyncToken, filteredModels, videoModelKey, onVideoModelChange]);

  async function recoverShotFromServer(panelIndex: number): Promise<boolean> {
    try {
      const fresh = await getSeedVideoProject(project.id);
      const remote = fresh.plan?.shots?.find((s) => s.index === panelIndex);
      if (remote?.videoUrl) {
        setLocalShots((prev) =>
          prev.map((s) =>
            s.index === panelIndex ? { ...s, videoUrl: remote.videoUrl, videoTaskId: remote.videoTaskId } : s,
          ),
        );
        await onProjectChange();
        return true;
      }
    } catch {
      /* ignore */
    }
    return false;
  }

  async function runPanelGenerate(modelKey: string, panelIndex: number) {
    setGeneratingShots((prev) => addGeneratingShot(prev, panelIndex));
    void syncGeneratingShotVideos();
    try {
      await persistPlanShotsQuiet(
        mergeSeedVideoShots(localShots, project.plan?.shots ?? []),
      );
      const result = await generateSeedVideoShot({
        projectId: project.id,
        shotIndex: panelIndex,
        modelKey,
        durationSec: pickerPanelDurationSec,
        aspectRatio: project.settings.aspectRatio ?? "9:16",
      });
      setLocalShots((prev) =>
        prev.map((s) =>
          s.index === panelIndex ? { ...s, videoUrl: result.videoUrl } : s,
        ),
      );
      setGeneratingShots((prev) => removeGeneratingShot(prev, panelIndex));
      scheduleProjectChange();
    } catch (e) {
      const recovered = await recoverShotFromServer(panelIndex);
      if (recovered) {
        setGeneratingShots((prev) => removeGeneratingShot(prev, panelIndex));
        scheduleProjectChange();
        return;
      }
      const fresh = await getSeedVideoProject(project.id);
      const remote = fresh.plan?.shots?.find((s) => s.index === panelIndex);
      if (remote?.videoUrl?.trim()) {
        applyRemoteShotVideo(panelIndex, remote);
        setGeneratingShots((prev) => removeGeneratingShot(prev, panelIndex));
        scheduleProjectChange();
        return;
      }
      if (isShotVideoPending(fresh.meta, panelIndex)) {
        void syncGeneratingShotVideos();
        return;
      }
      const msg = e instanceof Error ? e.message : "请稍后重试";
      if (/upstream_fetch_failed/i.test(msg)) {
        void syncGeneratingShotVideos();
        return;
      }
      setGeneratingShots((prev) => removeGeneratingShot(prev, panelIndex));
      await onAlert({
        title: "镜头生成失败",
        message: msg,
        variant: "error",
      });
    }
  }

  async function runAllShotsInternal(modelKey: string) {
    let current = localShots;
    for (const shot of [...current].sort((a, b) => a.index - b.index)) {
      const fresh = await getSeedVideoProject(project.id);
      current = mergeSeedVideoShots(current, fresh.plan?.shots ?? current);
      setLocalShots(current);
      const target = current.find((s) => s.index === shot.index);
      if (target?.videoUrl) continue;
      await runPanelGenerate(modelKey, shot.index);
      const after = await getSeedVideoProject(project.id);
      current = mergeSeedVideoShots(current, after.plan?.shots ?? current);
      setLocalShots(current);
    }
  }

  async function runSelectedShotsParallel(modelKey: string, shotIndices: number[]) {
    const unique = [...new Set(shotIndices)].sort((a, b) => a - b);
    if (unique.length === 0) return;
    await persistPlanShotsQuiet(
      mergeSeedVideoShots(localShots, project.plan?.shots ?? []),
    );
    const fresh = await getSeedVideoProject(project.id);
    const current = mergeSeedVideoShots(localShots, fresh.plan?.shots ?? localShots);
    setLocalShots(current);
    const pending = unique.filter((index) => !generatingShotsRef.current.has(index));
    if (pending.length === 0) return;
    void Promise.all(pending.map((index) => runPanelGenerate(modelKey, index)));
  }

  async function runAllShotsParallel(modelKey: string) {
    setBatchShotBusy(true);
    try {
      await persistPlanShotsQuiet(
        mergeSeedVideoShots(localShots, project.plan?.shots ?? []),
      );
      const fresh = await getSeedVideoProject(project.id);
      let current = mergeSeedVideoShots(localShots, fresh.plan?.shots ?? localShots);
      setLocalShots(current);
      const pending = [...current]
        .sort((a, b) => a.index - b.index)
        .filter((s) => !s.videoUrl?.trim());
      if (pending.length === 0) return;
      await Promise.all(pending.map((shot) => runPanelGenerate(modelKey, shot.index)));
      const after = await getSeedVideoProject(project.id);
      current = mergeSeedVideoShots(current, after.plan?.shots ?? current);
      setLocalShots(current);
      await onProjectChange();
    } finally {
      setBatchShotBusy(false);
    }
  }

  async function runAllShots(modelKey: string) {
    setBatchShotBusy(true);
    try {
      await runAllShotsInternal(modelKey);
    } finally {
      setBatchShotBusy(false);
    }
  }

  async function runAutoPipeline(modelKey: string) {
    setBatchShotBusy(true);
    try {
      await runAllShotsInternal(modelKey);
      await onProjectChange();
      const fresh = await getSeedVideoProject(project.id);
      const shotsForTts = fresh.plan?.shots ?? localShots;
      setLocalShots(shotsForTts);
      setTtsBusy(true);
      try {
        await savePlan({ shots: shotsForTts });
        await generateSeedVideoTts({ projectId: project.id });
        await onProjectChange();
      } finally {
        setTtsBusy(false);
      }
      setRenderBusy(true);
      const startedAt = Date.now();
      setRenderProgress({
        panelOpen: true,
        collapsed: false,
        jobId: "",
        progress: 0,
        progressLabel: "提交合成任务…",
        stepLog: ["自动流程：提交合成任务"],
        startedAt,
        phase: "queued",
      });
      try {
        const { jobId } = await renderSeedVideo(project.id);
        const videoUrl = await waitForRenderJob(jobId, startedAt);
        await persistRenderFinalVideo(jobId, videoUrl);
        await onProjectChange();
      } finally {
        setRenderBusy(false);
      }
    } catch (e) {
      await onAlert({
        title: "自动出片失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setBatchShotBusy(false);
    }
  }

  const applyRenderJobUpdate = useCallback(
    (
      job: {
        id: string;
        status: string;
        progress: number;
        progressLabel: string | null;
      },
      startedAt: number,
    ) => {
      const label = job.progressLabel?.trim() || "处理中…";
      setRenderProgress((prev) => {
        const base: SeedVideoRenderProgressState = prev ?? {
          panelOpen: true,
          collapsed: false,
          jobId: job.id,
          progress: 0,
          progressLabel: label,
          stepLog: [],
          startedAt,
          phase: "queued",
        };
        return {
          ...base,
          jobId: job.id,
          progress: job.progress,
          progressLabel: label,
          stepLog: appendSeedVideoRenderStepLog(base.stepLog, label),
          phase: resolveSeedVideoRenderPhase(job.status, job.progress),
        };
      });
    },
    [],
  );

  const persistRenderFinalVideo = useCallback(
    async (jobId: string, videoUrl: string) => {
      const url = videoUrl.trim();
      if (!url) return;
      setLocalRenderedFinalUrl(url);
      const prevWorkflow =
        (project.meta?.workflow as Record<string, unknown> | undefined) ?? {};
      await updateSeedVideoProject(project.id, {
        plan: {
          ...(project.plan ?? {}),
          render: {
            ...(project.plan?.render ?? {}),
            jobId,
            finalVideoUrl: url,
          },
        },
        status: "done",
        meta: {
          ...(project.meta ?? {}),
          workflow: { ...prevWorkflow, phase: "done" },
        },
      });
    },
    [project.id, project.meta, project.plan],
  );

  const waitForRenderJob = useCallback(
    async (jobId: string, startedAt: number): Promise<string> => {
      for (let i = 0; i < RENDER_POLL_MAX; i++) {
        await new Promise((r) => setTimeout(r, RENDER_POLL_MS));
        const job = await pollSeedVideoMediaRenderJob(jobId);
        applyRenderJobUpdate(job, startedAt);
        if (job.status === "SUCCEEDED" && job.downloadUrl) {
          setRenderProgress((prev) =>
            prev
              ? {
                  ...prev,
                  phase: "done",
                  progress: 100,
                  progressLabel: "合成完成",
                  stepLog: appendSeedVideoRenderStepLog(prev.stepLog, "合成完成"),
                }
              : prev,
          );
          return job.downloadUrl;
        }
        if (job.status === "FAILED" || job.status === "EXPIRED") {
          setRenderProgress((prev) =>
            prev
              ? {
                  ...prev,
                  phase: "failed",
                  progressLabel: job.errorMessage ?? "合成失败",
                }
              : prev,
          );
          throw new Error(job.errorMessage ?? "合成失败");
        }
      }
      const last = await pollSeedVideoMediaRenderJob(jobId);
      applyRenderJobUpdate(last, startedAt);
      if (last.status === "SUCCEEDED" && last.downloadUrl) {
        setRenderProgress((prev) =>
          prev
            ? {
                ...prev,
                phase: "done",
                progress: 100,
                progressLabel: "合成完成",
                stepLog: appendSeedVideoRenderStepLog(prev.stepLog, "合成完成"),
              }
            : prev,
        );
        return last.downloadUrl;
      }
      throw new Error("合成超时，请稍后刷新页面查看是否已完成");
    },
    [applyRenderJobUpdate],
  );

  useEffect(() => {
    renderResumeLockRef.current = false;
  }, [project.id]);

  useEffect(() => {
    const jobId = project.plan?.render?.jobId?.trim();
    if (!jobId || finalUrl || renderBusy || renderResumeLockRef.current) return;

    let cancelled = false;
    void (async () => {
      try {
        const job = await pollSeedVideoMediaRenderJob(jobId);
        if (cancelled) return;
        if (job.status === "SUCCEEDED" && job.downloadUrl) {
          await persistRenderFinalVideo(jobId, job.downloadUrl);
          await onProjectChange();
          return;
        }
        if (job.status === "FAILED" || job.status === "EXPIRED") return;

        renderResumeLockRef.current = true;
        setRenderBusy(true);
        const startedAt = Date.now();
        setRenderProgress({
          panelOpen: true,
          collapsed: false,
          jobId,
          progress: job.progress,
          progressLabel: job.progressLabel?.trim() || "恢复合成进度…",
          stepLog: [job.progressLabel?.trim() || "恢复合成进度…"],
          startedAt,
          phase: resolveSeedVideoRenderPhase(job.status, job.progress),
        });
        const videoUrl = await waitForRenderJob(jobId, startedAt);
        await persistRenderFinalVideo(jobId, videoUrl);
        await onProjectChange();
      } catch {
        /* 用户刷新后可再次查看成片区 */
      } finally {
        if (!cancelled) setRenderBusy(false);
        renderResumeLockRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    finalUrl,
    onProjectChange,
    persistRenderFinalVideo,
    project.plan?.render?.jobId,
    project.id,
    renderBusy,
    waitForRenderJob,
  ]);

  async function runTts() {
    setTtsBusy(true);
    try {
      await savePlan({
        shots: mergeSeedVideoShots(localShots, project.plan?.shots ?? []),
      });
      await generateSeedVideoTts({ projectId: project.id });
      await onProjectChange();
    } catch (e) {
      await onAlert({
        title: "TTS 失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setTtsBusy(false);
    }
  }

  async function runRender() {
    setRenderBusy(true);
    const startedAt = Date.now();
    setRenderProgress({
      panelOpen: true,
      collapsed: false,
      jobId: "",
      progress: 0,
      progressLabel: "校验镜头与口播…",
      stepLog: ["校验镜头与口播素材"],
      startedAt,
      phase: "queued",
    });
    try {
      const merged = mergeSeedVideoShots(localShots, project.plan?.shots ?? []);
      const missingVideo = merged.some((s) => !s.videoUrl?.trim());
      if (missingVideo) {
        setRenderProgress(null);
        await onAlert({
          title: "暂不能合成",
          message: "请先为各镜生成镜头视频（状态「视频 OK」或「就绪」）。",
          variant: "error",
        });
        return;
      }
      const missingTts = merged.some((s) => s.videoUrl?.trim() && !s.ttsUrl?.trim());
      if (missingTts) {
        setRenderProgress(null);
        await onAlert({
          title: "暂不能合成",
          message: "请先点击「批量 TTS」，待各镜状态为「就绪」后再点「合成成片」。",
          variant: "error",
        });
        return;
      }
      setRenderProgress((prev) =>
        prev
          ? {
              ...prev,
              progressLabel: "保存镜头参数…",
              stepLog: appendSeedVideoRenderStepLog(prev.stepLog, "保存镜头参数"),
            }
          : prev,
      );
      await savePlan({ shots: merged });
      setRenderProgress((prev) =>
        prev
          ? {
              ...prev,
              progressLabel: "提交合成任务…",
              stepLog: appendSeedVideoRenderStepLog(prev.stepLog, "提交合成任务"),
            }
          : prev,
      );
      const { jobId } = await renderSeedVideo(project.id);
      setRenderProgress((prev) =>
        prev
          ? {
              ...prev,
              jobId,
              progressLabel: "排队中…",
              stepLog: appendSeedVideoRenderStepLog(prev.stepLog, "任务已提交，排队中"),
            }
          : prev,
      );
      const videoUrl = await waitForRenderJob(jobId, startedAt);
      await persistRenderFinalVideo(jobId, videoUrl);
      await onProjectChange();
      await onAlert({
        title: "合成完成",
        message: "最终成片已就绪，可在下方「成片视频」区域预览。",
      });
    } catch (e) {
      await onAlert({
        title: "合成失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setRenderBusy(false);
    }
  }

  const pollDirect = useCallback(async () => {
    if (directPollLock.current) return;
    directPollLock.current = true;
    setDirectBusy(true);
    try {
      for (let i = 0; i < DIRECT_POLL_MAX; i++) {
        const status = await pollSeedVideoDirect(project.id);
        if (status.status === "done" && status.videoUrl) {
          await onProjectChange();
          return;
        }
        if (status.status === "failed") {
          throw new Error("直接生成失败");
        }
        await new Promise((r) => setTimeout(r, DIRECT_POLL_MS));
      }
      throw new Error("直接生成超时");
    } catch (e) {
      const fresh = await getSeedVideoProject(project.id).catch(() => null);
      const stillPending = readPendingDirectVideo(fresh?.meta ?? null);
      if (!stillPending?.taskId) {
        await onAlert({
          title: "生成失败",
          message: e instanceof Error ? e.message : "请稍后重试",
          variant: "error",
        });
      }
    } finally {
      const fresh = await getSeedVideoProject(project.id).catch(() => null);
      const stillPending = readPendingDirectVideo(fresh?.meta ?? project.meta);
      if (!stillPending?.taskId) {
        setDirectBusy(false);
      }
      directPollLock.current = false;
    }
  }, [onAlert, onProjectChange, project.id, project.meta]);

  useEffect(() => {
    const pending = readPendingDirectVideo(project.meta);
    if (!pending?.taskId) return;
    if (directPollLock.current) return;
    void pollDirect();
  }, [pollDirect, project.meta?.pendingDirectVideo]);

  async function runDirectGenerate(modelKey: string) {
    setDirectBusy(true);
    try {
      const built = effectiveDirectPlan;
      if (!built?.globalPrompt?.trim()) {
        throw new Error("请先完成脚本与视频 Prompt");
      }
      await savePlan({
        shots: mergeSeedVideoShots(localShots, project.plan?.shots ?? []),
        directVideo: built,
      });
      await generateSeedVideoDirect({
        projectId: project.id,
        modelKey,
        durationSec: pickerDurationSec,
        aspectRatio: project.settings.aspectRatio ?? "9:16",
      });
      await onProjectChange();
      await pollDirect();
    } catch (e) {
      setDirectBusy(false);
      await onAlert({
        title: "提交失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    }
  }

  async function onPickerConfirm(modelKey: string) {
    setPickerOpen(false);
    onVideoModelChange(modelKey);
    if (direct && pickerTarget === "fullSheet") {
      await runDirectGenerate(modelKey);
      return;
    }
    if (pickerPanelIndex != null) {
      void runPanelGenerate(modelKey, pickerPanelIndex);
      return;
    }
    if (pickerGenerateAllParallel) {
      setPickerGenerateAllParallel(false);
      await runAllShotsParallel(modelKey);
      return;
    }
    if (pickerSelectedShotIndices.length > 0) {
      const indices = pickerSelectedShotIndices;
      setPickerSelectedShotIndices([]);
      void runSelectedShotsParallel(modelKey, indices);
      return;
    }
    if (productionStrategy === "auto") {
      await runAutoPipeline(modelKey);
      return;
    }
    await runAllShots(modelKey);
  }

  async function handleSaveDeliverable(workName: string) {
    setSaveBusy(true);
    try {
      await saveSeedVideoDeliverableSnapshot(project.id, workName);
      setSaveDialogOpen(false);
      await onProjectChange();
      await onAlert({
        title: "已保存到资产库",
        message: "可在「我的资产 → 种草视频」一键复用：换参考图后直接生成。",
      });
    } catch (e) {
      await onAlert({
        title: "保存失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setSaveBusy(false);
    }
  }

  async function handleExportZip() {
    setExportBusy(true);
    try {
      await downloadSeedVideoExportZip(project.id);
    } catch (e) {
      await onAlert({
        title: "导出失败",
        message: e instanceof Error ? e.message : "未知错误",
        variant: "error",
      });
    } finally {
      setExportBusy(false);
    }
  }

  const hasShots = localShots.length > 0;
  const finePlanSynced = (project.plan?.shots?.length ?? 0) >= 1 && !needsConfirmPreview;
  const directPlanSynced = Boolean(directPlan?.globalPrompt?.trim());
  const showDirectProduction =
    direct && Boolean(effectiveDirectPlan?.globalPrompt?.trim() || directPlan || needsConfirmPreview);
  const showFineProduction = !direct && hasShots;
  const showProduction =
    hasSeedVideoProductionContent(project) || showStoryboardEdit;

  return (
    <>
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-white">
      <div className="ecom-scrollbar-overlay h-full min-h-0 w-full overflow-x-hidden overflow-y-auto overscroll-y-contain [overflow-anchor:none]">
        <header className="sticky top-0 z-20 border-b border-[#e8e8ed] bg-white px-5 py-3 shadow-[0_1px_0_0_rgba(0,0,0,0.04)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-[#1d1d1f]">
                {project.title ?? "图片生种草视频"}
              </h2>
              <p className="text-[11px] text-[#6e6e73]">种草短视频 · 素材策划与成片</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {onNewProject ? (
                <EcomButtonSecondary
                  size="sm"
                  type="button"
                  dark
                  disabled={Boolean(refBusy) || streaming}
                  onClick={() => void onNewProject()}
                >
                  新建
                </EcomButtonSecondary>
              ) : null}
              <EcomButtonSecondary
                size="sm"
                type="button"
                dark
                onClick={() => router.push("/library")}
              >
                <Images className="h-3.5 w-3.5 shrink-0" />
                我的资产
              </EcomButtonSecondary>
              <EcomButtonSecondary
                size="sm"
                type="button"
                dark
                disabled={!canSave || saveBusy}
                onClick={() => setSaveDialogOpen(true)}
              >
                <Save className="h-3.5 w-3.5 shrink-0" />
                保存
              </EcomButtonSecondary>
              <EcomButtonSecondary
                size="sm"
                type="button"
                dark
                disabled={!canSave || exportBusy || streaming || productionBusy}
                onClick={() => void handleExportZip()}
              >
                <Download className="h-3.5 w-3.5 shrink-0" />
                {exportBusy ? "打包中…" : "导出交付包"}
              </EcomButtonSecondary>
            </div>
          </div>
        </header>

        <section className="border-b border-[#e8e8ed] px-5 py-4">
          <SeedVideoRefUploader
            references={project.references}
            onUpload={onUploadRef}
            onRemove={onRemoveRef}
            onAttachAssets={onAttachRefs}
            busy={refBusy}
          />
        </section>

        <section className="border-b border-[#e8e8ed] px-5 py-4">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[#6e6e73]">
            素材 + Prompt
          </p>
          <p className="mb-4 text-[11px] leading-relaxed text-[#6e6e73]">
            上传素材后填写 Prompt（可 @ 图片），点击「开始策划」进入 Skill 流程；脚本、模式与风格点选请在右侧助手完成。
          </p>
          <p className="mb-2 text-[11px] font-semibold text-[#1d1d1f]">Prompt（可 @ 图片）</p>
          <ProductDesignPromptMentionTextarea
            value={planningPrompt}
            referenceImages={mentionRefs}
            disabled={Boolean(refBusy) || streaming}
            onChange={onPlanningPromptChange}
            onBlur={() => {
              const prompt = planningPrompt.trim();
              if (!prompt) return;
              void updateSeedVideoProject(project.id, {
                meta: { ...(project.meta ?? {}), planningPrompt: prompt },
              }).catch(() => {});
            }}
          />
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <EcomButtonPrimary
              size="sm"
              type="button"
              disabled={!canStartPlanning || Boolean(refBusy)}
              onClick={onStartPlanning}
            >
              开始策划
            </EcomButtonPrimary>
            {!planningPrompt.trim() ? (
              <button
                type="button"
                className="text-[11px] text-[#0071e3] hover:underline disabled:opacity-50"
                disabled={Boolean(refBusy) || streaming}
                onClick={() => onPlanningPromptChange(SEED_VIDEO_PROMPT_PLACEHOLDER)}
              >
                填入示例 Prompt
              </button>
            ) : null}
          </div>
        </section>

        {!showProduction && !streaming ? (
          <div className="flex min-h-[24vh] flex-col items-center justify-center px-6 py-10 text-center">
            <p className="max-w-md text-sm text-[#6e6e73]">
              完成素材上传与 Prompt 并点击「开始策划」后，定稿脚本、镜头表与视频 Prompt 将显示在此。
            </p>
          </div>
        ) : (
          <div className="px-4 py-4 sm:px-6">
      {showStoryboardEdit ? (
        <section className="mb-6 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-[#1d1d1f]">正式脚本 · 手动编辑</h2>
              <p className="text-[11px] text-[#6e6e73]">
                表头与中间工作区一致；完成后将直接同步，无需再确认一轮。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <EcomButtonSecondary
                type="button"
                disabled={storyboardDraftBusy || streaming}
                onClick={() => {
                  setStoryboardDraftBusy(true);
                  void Promise.resolve(onSaveStoryboardDraft?.(localStoryboardDraft)).finally(
                    () => setStoryboardDraftBusy(false),
                  );
                }}
              >
                保存修改
              </EcomButtonSecondary>
              <EcomButtonPrimary
                type="button"
                disabled={storyboardDraftBusy || streaming}
                onClick={() => {
                  setStoryboardDraftBusy(true);
                  void Promise.resolve(onProceedFromStoryboardEdit?.(localStoryboardDraft)).finally(
                    () => setStoryboardDraftBusy(false),
                  );
                }}
              >
                完成修改，提交正式脚本
              </EcomButtonPrimary>
            </div>
          </div>
          <SeedVideoStoryboardDraftEditor
            rows={localStoryboardDraft}
            onChange={setLocalStoryboardDraft}
            disabled={storyboardDraftBusy || streaming}
          />
        </section>
      ) : null}

      {finalUrl && !showDirectProduction && !showFineProduction ? (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-[#1d1d1f]">成片预览</h2>
          <EcomVideoSlot
            src={finalUrl}
            layout="gallery"
            onPreview={() => onPreviewVideo(finalUrl, project.title ?? "种草视频")}
            playSize="lg"
          />
        </section>
      ) : null}

      {showDirectProduction ? (
        <section className="mb-6 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[#1d1d1f]">方案① · 直接连贯生成</h2>
            {localShots.length >= 2 ? (
              <EcomButtonSecondary
                type="button"
                disabled={productionBusy}
                onClick={() => void handleSaveShots()}
              >
                保存编辑
              </EcomButtonSecondary>
            ) : null}
          </div>
          <p className="text-[11px] leading-relaxed text-[#6e6e73]">
            将脚本与参考图一次性交给视频模型，生成一条不超过 30 秒的成片（非逐镜单独生成）。
          </p>
          {!directPlanSynced && needsConfirmPreview ? (
            <p className="rounded-lg bg-[#f5f5f7] px-3 py-2 text-xs leading-relaxed text-[#6e6e73]">
              以下为参数预览。请在右侧点「确认成片参数」同步到此工作区后再生成视频。
            </p>
          ) : null}
          {localShots.length >= 2 ? (
            <SeedVideoShotTable
              shots={localShots}
              references={project.references}
              onChange={setLocalShots}
              disabled={productionBusy}
              hideVideoColumn
              hideStatusColumn
            />
          ) : effectiveDirectPlan?.shotSequence && effectiveDirectPlan.shotSequence.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-[#e8e8ed]">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-[#f5f5f7] text-[#6e6e73]">
                  <tr>
                    <th className="px-3 py-2">镜号</th>
                    <th className="px-3 py-2">时间</th>
                    <th className="px-3 py-2">参考素材</th>
                    <th className="px-3 py-2">画面设计</th>
                    <th className="px-3 py-2">口播</th>
                  </tr>
                </thead>
                <tbody>
                  {effectiveDirectPlan.shotSequence.map((s) => (
                    <tr key={s.index} className="border-t border-[#e8e8ed]">
                      <td className="px-3 py-2">{s.index}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{s.timeSlice}</td>
                      <td className="px-3 py-2">{s.refImageLabel}</td>
                      <td className="px-3 py-2">{s.sceneDescription}</td>
                      <td className="px-3 py-2">{s.voiceover}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {effectiveDirectPlan ? (
            <>
              <label className="block text-xs text-[#6e6e73]">全局视频 Prompt</label>
              <textarea
                className="ecom-scrollbar-thin w-full min-h-[6rem] rounded-xl border border-[#e8e8ed] px-3 py-2 text-sm"
                value={effectiveDirectPlan.globalPrompt}
                readOnly={!directPlanSynced && needsConfirmPreview}
                onChange={(e) => {
                  if (!directPlan) return;
                  void savePlan({
                    directVideo: { ...directPlan, globalPrompt: e.target.value },
                  });
                }}
              />
              <label className="block text-xs text-[#6e6e73]">完整口播</label>
              <textarea
                className="ecom-scrollbar-thin w-full min-h-[4rem] rounded-xl border border-[#e8e8ed] px-3 py-2 text-sm"
                value={effectiveDirectPlan.fullVoiceover}
                readOnly={!directPlanSynced && needsConfirmPreview}
                onChange={(e) => {
                  if (!directPlan) return;
                  void savePlan({
                    directVideo: { ...directPlan, fullVoiceover: e.target.value },
                  });
                }}
              />
            </>
          ) : null}
          <div className="pt-1">
            <p className="mb-2 text-xs font-medium text-[#6e6e73]">成片视频</p>
            <div className="flex flex-wrap gap-3">
              {directVideos.map((item, index) => (
                <EcomVideoSlot
                  key={item.id}
                  src={item.videoUrl}
                  layout="gallery-workspace"
                  onPreview={() =>
                    onPreviewVideo(
                      item.videoUrl,
                      `${project.title ?? "种草视频"} · 第 ${index + 1} 条`,
                    )
                  }
                  playSize="lg"
                />
              ))}
              {isDirectGenerating ? (
                <EcomVideoSlot
                  layout="gallery-workspace"
                  generating
                  generatingPosterUrl={directPreviewBgUrl}
                  playSize="lg"
                />
              ) : null}
              {!isDirectGenerating && !hasDirectVideos ? (
                <EcomVideoSlot
                  layout="gallery-workspace"
                  emptyLabel="点击「视频生成」开始"
                  playSize="lg"
                />
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <EcomButtonPrimary
              type="button"
              disabled={isDirectGenerating || !directPlanSynced}
              onClick={() => openVideoPicker({ fullSheet: true })}
            >
              {hasDirectVideos ? "重新生成" : "视频生成"}
            </EcomButtonPrimary>
          </div>
        </section>
      ) : null}

      {showFineProduction ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[#1d1d1f]">方案② · 精细成片</h2>
            <div className="flex flex-wrap gap-2">
              <EcomButtonSecondary
                type="button"
                disabled={batchProductionBusy}
                onClick={() => void handleSaveShots()}
              >
                保存编辑
              </EcomButtonSecondary>
              <EcomButtonSecondary
                type="button"
                disabled={batchProductionBusy || singleShotBusy || !finePlanSynced}
                onClick={() => openVideoPicker({})}
              >
                逐镜生成视频
              </EcomButtonSecondary>
              <EcomButtonSecondary
                type="button"
                disabled={batchProductionBusy || singleShotBusy || !finePlanSynced || ttsBusy}
                onClick={() => void runTts()}
              >
                {ttsBusy ? "TTS…" : "批量 TTS"}
              </EcomButtonSecondary>
              <EcomButtonPrimary
                type="button"
                disabled={batchProductionBusy || singleShotBusy || !finePlanSynced || renderBusy}
                onClick={() => void runRender()}
              >
                {renderBusy ? "合成中…" : "合成成片"}
              </EcomButtonPrimary>
            </div>
          </div>
          {!finePlanSynced && needsConfirmPreview ? (
            <p className="rounded-lg bg-[#f5f5f7] px-3 py-2 text-xs leading-relaxed text-[#6e6e73]">
              以下为脚本预览。请在右侧点「确认逐镜参数表」同步后再逐镜生成。
            </p>
          ) : (
            <p className="text-[11px] leading-relaxed text-[#6e6e73]">
              推荐顺序：① 勾选镜头后点表底「生成」→ ②「批量 TTS」→ ③ 状态均为「就绪」后点「合成成片」。可多次勾选、多次生成。
            </p>
          )}
          <SeedVideoShotTable
            shots={localShots}
            references={project.references}
            onChange={setLocalShots}
            disabled={batchProductionBusy || !finePlanSynced}
            generatingIndices={activeGeneratingIndices}
            onPreviewVideo={onPreviewVideo}
            showGenerateActions
            selectDisabled={!finePlanSynced}
            selectedShotIndices={selectedShotIndices}
            selectedCount={selectedShotIndices.size}
            onToggleShotSelected={(index, checked) => {
              setSelectedShotIndices((prev) => {
                const next = new Set(prev);
                if (checked) next.add(index);
                else next.delete(index);
                return next;
              });
            }}
            onGenerateSelected={() => {
              if (selectedShotIndices.size === 0) return;
              openVideoPicker({
                generateSelected: true,
                selectedShotIndices: [...selectedShotIndices].sort((a, b) => a - b),
              });
            }}
            generateSelectedDisabled={
              selectedShotIndices.size === 0 ||
              !finePlanSynced ||
              ttsBusy ||
              renderBusy
            }
          />
          {finalUrl ? (
            <div className="space-y-2 border-t border-[#e8e8ed] pt-4">
              <h3 className="text-sm font-semibold text-[#1d1d1f]">成片视频</h3>
              <p className="text-[11px] text-[#6e6e73]">
                逐镜合成已完成，可预览或保存到「我的资产」。
              </p>
              <EcomVideoSlot
                src={finalUrl}
                layout="gallery-workspace"
                onPreview={() => onPreviewVideo(finalUrl, project.title ?? "种草视频")}
                playSize="lg"
              />
            </div>
          ) : null}
        </section>
      ) : null}

      <SeedVideoProductionStrategyDialog
        open={strategyDialogOpen}
        onOpenChange={setStrategyDialogOpen}
        onSelect={(strategy) => {
          setProductionStrategy(strategy);
          beginFineProduction({ strategy });
        }}
      />

      <StoryboardModelPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        mode="video"
        videoTarget={pickerTarget}
        panelIndex={pickerPanelIndex}
        models={filteredModels.length ? filteredModels : videoModels}
        value={videoModelKey}
        onChange={onVideoModelChange}
        onConfirm={(modelKey) => void onPickerConfirm(modelKey)}
        durationSec={pickerDurationSec}
        onDurationChange={setPickerDurationSec}
        panelDurationSec={pickerPanelDurationSec}
        onPanelDurationChange={setPickerPanelDurationSec}
        aspectRatio={project.settings.aspectRatio ?? "9:16"}
      />

      <SeedVideoSaveDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        defaultWorkName={project.title ?? "种草视频"}
        busy={saveBusy}
        onConfirm={handleSaveDeliverable}
      />
          </div>
        )}
      </div>
    </div>
    <SeedVideoRenderProgressPanel
      state={renderProgress}
      onPanelOpenChange={(open) =>
        setRenderProgress((prev) => (prev ? { ...prev, panelOpen: open } : prev))
      }
      onCollapsedChange={(collapsed) =>
        setRenderProgress((prev) => (prev ? { ...prev, collapsed } : prev))
      }
    />
    </>
  );
}
