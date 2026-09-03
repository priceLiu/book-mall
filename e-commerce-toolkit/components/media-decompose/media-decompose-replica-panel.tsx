"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clapperboard, Loader2 } from "lucide-react";

import { EcomVideoSlot } from "@/components/media/ecom-video-slot";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { SeedVideoComposeDialog } from "@/components/seed-video/seed-video-compose-dialog";
import { SeedVideoRenderProgressPanel } from "@/components/seed-video/seed-video-render-progress-panel";
import { SeedVideoShotTable } from "@/components/seed-video/seed-video-shot-table";
import { StoryboardModelPickerDialog } from "@/components/storyboard/storyboard-model-picker-dialog";
import {
  type StoryboardVideoResolution,
} from "@/lib/storyboard-gen-params";
import { videoModelSupportsGenerateAudio } from "@/lib/storyboard-video-params";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import {
  generateSeedVideoShot,
  generateSeedVideoTts,
  getSeedVideoProject,
  resumeSeedVideoPendingShots,
  pollSeedVideoMediaRenderJob,
  renderSeedVideo,
  updateSeedVideoProject,
} from "@/lib/ecom-seed-video-api";
import { buildReplicaMentionRefs } from "@/lib/media-decompose-replica-refs";
import {
  readVoiceoverDraft,
  type ReplicaVoiceoverDraft,
} from "@/lib/media-decompose-replica-workflow";
import {
  buildReplicaMentionCatalogEntries,
  mentionCatalogSignature,
  syncSeedVideoShotsAfterRefChange,
} from "@/lib/ecom-mention-catalog-sync";
import {
  appendSeedVideoRenderStepLog,
  resolveSeedVideoRenderPhase,
  type SeedVideoRenderProgressState,
} from "@/lib/seed-video-render-progress";
import { isShotVideoPending } from "@/lib/seed-video-pending-shots";
import {
  mergeOptimisticGeneratingShots,
  seedVideoShotsHaveVoiceover,
  buildActiveGeneratingIndices,
  listEffectivePendingShotIndices,
  clearGeneratingShotsWithVideo,
} from "@/lib/seed-video-generating-shots";
import {
  batchComposeButtonLabel,
  batchTtsButtonLabel,
  listSelectedComposeShotIndices,
  listSelectedTtsShotIndices,
} from "@/lib/seed-video-tts-selection";
import { buildSeedVideoComposeProfile } from "@/lib/seed-video-render-profile";
import { mergeSeedVideoShotsForPersist } from "@/lib/seed-video-shot-merge";
import { DEFAULT_SUBTITLE_STYLE, type SubtitleBurnInStyle } from "@private/media-render-subtitle-style";
import {
  appendSeedVideoShot,
  canDeleteSeedVideoShot,
  removeSeedVideoShotAt,
} from "@/lib/seed-video-shot-rows";
import {
  filterVideoModelsForMode,
  resolveSeedVideoVideoModelKey,
} from "@/lib/seed-video-workflow";
import type { SeedVideoProject, SeedVideoShot } from "@/lib/seed-video-types";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";

const RENDER_POLL_MS = 3000;
const RENDER_POLL_MAX = 120;
const SHOT_POLL_MS = 4000;

function voiceoverDraftAfterApply(
  draft: ReplicaVoiceoverDraft,
  appliedIndices: number[],
): ReplicaVoiceoverDraft | null {
  const applied = new Set(appliedIndices);
  const remaining = draft.shots.filter((s) => !applied.has(s.index));
  if (remaining.length === 0) return null;
  return { ...draft, shots: remaining };
}

function buildVoiceoverDraftMap(
  draft: ReplicaVoiceoverDraft | null,
): Map<number, string> {
  const map = new Map<number, string>();
  if (!draft) return map;
  for (const row of draft.shots) {
    map.set(row.index, row.voiceover);
  }
  return map;
}

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

type Props = {
  seedVideo: SeedVideoProject;
  videoModels: StoryboardGatewayModel[];
  videoModelKey: string;
  onVideoModelChange: (key: string) => void;
  onSeedVideoChange: () => void | Promise<void>;
  onPreviewVideo: (src: string, title?: string) => void;
  onAlert: (opts: { title: string; message: string; variant?: "error" }) => Promise<void>;
};

export function MediaDecomposeReplicaPanel({
  seedVideo,
  videoModels,
  videoModelKey,
  onVideoModelChange,
  onSeedVideoChange,
  onPreviewVideo,
  onAlert,
}: Props) {
  const { toast } = useDialogs();
  const shots = seedVideo.plan?.shots ?? [];
  const [localShots, setLocalShots] = useState<SeedVideoShot[]>(shots);
  const [selectedShotIndices, setSelectedShotIndices] = useState<Set<number>>(() => new Set());
  const [generatingShots, setGeneratingShots] = useState<Set<number>>(
    () =>
      new Set(listEffectivePendingShotIndices(seedVideo.meta, seedVideo.plan?.shots)),
  );
  const generatingShotsRef = useRef(generatingShots);
  generatingShotsRef.current = generatingShots;
  /** 各镜号乐观 generating 的起始时间，用于过期清理从未到达服务端的标记 */
  const generatingSinceRef = useRef<Map<number, number> | null>(null);
  if (generatingSinceRef.current === null) {
    generatingSinceRef.current = new Map([...generatingShots].map((i) => [i, Date.now()]));
  }
  const [ttsBusy, setTtsBusy] = useState(false);
  const [renderBusy, setRenderBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSelected, setPickerSelected] = useState<number[]>([]);
  const [pickerPanelDurationSec, setPickerPanelDurationSec] = useState(() => {
    const saved = seedVideo.settings.videoPanelDurationSec;
    return typeof saved === "number" && saved > 0 ? saved : 8;
  });
  const [pickerVideoResolution, setPickerVideoResolution] =
    useState<StoryboardVideoResolution>(() => {
      const saved = seedVideo.settings.videoResolution?.trim().toLowerCase();
      return saved === "720p" ? "720p" : "1080p";
    });
  const [pickerVideoR2vRatio, setPickerVideoR2vRatio] = useState<string>(
    () =>
      seedVideo.settings.videoR2vRatio?.trim() ||
      seedVideo.settings.aspectRatio ||
      "9:16",
  );
  const [pickerVideoSeed, setPickerVideoSeed] = useState("");
  const [pickerVideoPromptExtend, setPickerVideoPromptExtend] = useState(true);
  const [pickerVideoGenerateAudio, setPickerVideoGenerateAudio] = useState(
    () => seedVideo.settings.videoGenerateAudio ?? true,
  );
  const [pickerConfirming, setPickerConfirming] = useState(false);
  const [renderProgress, setRenderProgress] = useState<SeedVideoRenderProgressState | null>(null);
  const [composeDialogOpen, setComposeDialogOpen] = useState(false);
  const [pendingComposeIndices, setPendingComposeIndices] = useState<number[] | null>(null);
  const [composeSubtitleStyle, setComposeSubtitleStyle] =
    useState<SubtitleBurnInStyle>(DEFAULT_SUBTITLE_STYLE);
  const [localFinalUrl, setLocalFinalUrl] = useState<string | null>(
    seedVideo.plan?.render?.finalVideoUrl?.trim() || seedVideo.videoOssUrl?.trim() || null,
  );
  /** 轮询拉取的最新 meta（pending 等），与父级 seedVideo 同步 */
  const [syncedProjectMeta, setSyncedProjectMeta] = useState<SeedVideoProject["meta"]>(
    seedVideo.meta,
  );
  const [syncedReferences, setSyncedReferences] = useState(seedVideo.references);

  const syncLockRef = useRef(false);
  const submitInFlightRef = useRef(false);
  const prevRefCatalogRef = useRef<ReturnType<typeof buildReplicaMentionCatalogEntries> | null>(
    null,
  );
  const refSyncBusyRef = useRef(false);
  const onSeedVideoChangeRef = useRef(onSeedVideoChange);
  onSeedVideoChangeRef.current = onSeedVideoChange;
  const pickerSelectedRef = useRef<number[]>([]);
  const pickerPanelDurationRef = useRef(
    typeof seedVideo.settings.videoPanelDurationSec === "number" &&
      seedVideo.settings.videoPanelDurationSec > 0
      ? seedVideo.settings.videoPanelDurationSec
      : 8,
  );

  const persistVideoGenSettings = useCallback(
    (patch: Partial<SeedVideoProject["settings"]>) => {
      void updateSeedVideoProject(seedVideo.id, {
        settings: { ...seedVideo.settings, ...patch },
      }).catch(() => {
        /* 本地仍用于本次生成 */
      });
    },
    [seedVideo.id, seedVideo.settings],
  );

  useEffect(() => {
    setLocalShots((prev) => mergeSeedVideoShotsForPersist(prev, shots));
  }, [shots, seedVideo.id]);

  useEffect(() => {
    setLocalFinalUrl(
      seedVideo.plan?.render?.finalVideoUrl?.trim() || seedVideo.videoOssUrl?.trim() || null,
    );
  }, [seedVideo.id, seedVideo.plan?.render?.finalVideoUrl, seedVideo.videoOssUrl]);

  useEffect(() => {
    setSelectedShotIndices(new Set());
  }, [seedVideo.id]);

  useEffect(() => {
    setSyncedProjectMeta(seedVideo.meta);
    setSyncedReferences(seedVideo.references);
  }, [seedVideo.id]);

  useEffect(() => {
    const initial = new Set(listEffectivePendingShotIndices(seedVideo.meta, seedVideo.plan?.shots));
    generatingSinceRef.current = new Map([...initial].map((i) => [i, Date.now()]));
    setGeneratingShots(initial);
  }, [seedVideo.id]);

  useEffect(() => {
    const shots = seedVideo.plan?.shots;
    if (!shots?.length) return;
    setLocalShots((prev) => mergeSeedVideoShotsForPersist(prev, shots));
    setGeneratingShots((prev) => clearGeneratingShotsWithVideo(prev, shots));
  }, [seedVideo.plan?.shots, seedVideo.updatedAt, seedVideo.id]);

  const filteredModels = useMemo(() => {
    const keys = filterVideoModelsForMode(
      videoModels.map((m) => m.modelKey),
      false,
    );
    return videoModels.filter((m) => keys.includes(m.modelKey));
  }, [videoModels]);

  useEffect(() => {
    const s = seedVideo.settings;
    if (typeof s.videoPanelDurationSec === "number" && s.videoPanelDurationSec > 0) {
      pickerPanelDurationRef.current = s.videoPanelDurationSec;
      setPickerPanelDurationSec(s.videoPanelDurationSec);
    }
    if (s.videoResolution?.trim()) {
      const v = s.videoResolution.trim().toLowerCase();
      if (v === "720p" || v === "1080p") {
        setPickerVideoResolution(v);
      }
    }
    if (typeof s.videoGenerateAudio === "boolean") {
      setPickerVideoGenerateAudio(s.videoGenerateAudio);
    }
    if (s.videoR2vRatio?.trim()) {
      setPickerVideoR2vRatio(s.videoR2vRatio.trim());
    }
    const savedModel = s.videoModelKey?.trim();
    if (savedModel) {
      const next = resolveSeedVideoVideoModelKey(filteredModels, savedModel, false);
      if (next !== videoModelKey) onVideoModelChange(next);
    }
  }, [seedVideo.id, seedVideo.settings, filteredModels, videoModelKey, onVideoModelChange]);

  const mentionRefs = useMemo(
    () => buildReplicaMentionRefs(syncedReferences),
    [syncedReferences],
  );

  const voiceoverDraft = useMemo(
    () => readVoiceoverDraft(seedVideo),
    [seedVideo.meta?.replicaVoiceoverDraft, seedVideo.id],
  );

  const voiceoverDraftByIndex = useMemo(
    () => buildVoiceoverDraftMap(voiceoverDraft),
    [voiceoverDraft],
  );

  const pendingShotIndices = useMemo(
    () => listEffectivePendingShotIndices(syncedProjectMeta, localShots),
    [syncedProjectMeta, localShots],
  );

  const activeGeneratingIndices = useMemo(
    () =>
      buildActiveGeneratingIndices({
        generatingShots,
        pendingIndices: pendingShotIndices,
        shots: localShots,
      }),
    [generatingShots, pendingShotIndices, localShots],
  );

  const generatingSelectionKey = useMemo(
    () => [...activeGeneratingIndices].sort((a, b) => a - b).join(","),
    [activeGeneratingIndices],
  );


  const batchProductionBusy = ttsBusy || renderBusy;
  const singleShotBusy = activeGeneratingIndices.size > 0;
  const pipelineBusy = batchProductionBusy || singleShotBusy;
  const planSynced = localShots.length >= 1;
  const scriptReady = planSynced;
  const anyGenerating = activeGeneratingIndices.size > 0;
  const generatingStatusLabel = useMemo(() => {
    const nums = [...activeGeneratingIndices].sort((a, b) => a - b);
    if (nums.length === 0) return "";
    if (nums.length === 1) return `镜头 ${nums[0]} 视频生成中（约 1～3 分钟，Gateway 处理中）…`;
    return `镜头 ${nums.join("、")} 生成中（约 1～3 分钟，Gateway 处理中）…`;
  }, [activeGeneratingIndices]);
  const idleGeneratableIndices = localShots
    .filter((s) => !activeGeneratingIndices.has(s.index))
    .map((s) => s.index);
  const selectedGeneratableIndices = [...selectedShotIndices].filter(
    (index) => !activeGeneratingIndices.has(index),
  );
  const selectedGeneratableCount = selectedGeneratableIndices.length;

  const selectedTtsIndices = useMemo(
    () => listSelectedTtsShotIndices(localShots, selectedGeneratableIndices),
    [localShots, selectedGeneratableIndices],
  );
  const selectedTtsCount = selectedTtsIndices.length;
  const batchTtsLabel = batchTtsButtonLabel({ busy: ttsBusy, selectedCount: selectedTtsCount });

  const selectedComposeIndices = useMemo(
    () => listSelectedComposeShotIndices(localShots, selectedGeneratableIndices),
    [localShots, selectedGeneratableIndices],
  );
  const selectedComposeCount = selectedComposeIndices.length;
  const batchComposeLabel = batchComposeButtonLabel({
    busy: renderBusy,
    selectedCount: selectedComposeCount,
  });

  const pickerPanelHasVoiceover = useMemo(() => {
    if (!pickerOpen) return false;
    const indices =
      pickerSelected.length > 0
        ? pickerSelected
        : pickerSelectedRef.current.length > 0
          ? pickerSelectedRef.current
          : selectedGeneratableCount > 0
            ? selectedGeneratableIndices
            : idleGeneratableIndices;
    return seedVideoShotsHaveVoiceover(localShots, indices);
  }, [
    pickerOpen,
    pickerSelected,
    localShots,
    selectedGeneratableCount,
    selectedGeneratableIndices,
    idleGeneratableIndices,
  ]);

  useEffect(() => {
    setSelectedShotIndices((prev) => {
      let changed = false;
      const next = new Set<number>();
      for (const i of prev) {
        if (activeGeneratingIndices.has(i)) changed = true;
        else next.add(i);
      }
      return changed ? next : prev;
    });
  }, [generatingSelectionKey, activeGeneratingIndices]);

  const composedUrl =
    localFinalUrl?.trim() || seedVideo.plan?.render?.finalVideoUrl?.trim() || seedVideo.videoOssUrl?.trim() || null;
  const finalUrl = composedUrl;

  async function handleSaveShots() {
    await persistShots(localShots);
    await onSeedVideoChange();
  }

  const persistShots = useCallback(
    async (next: SeedVideoShot[]) => {
      const merged = mergeSeedVideoShotsForPersist(next, seedVideo.plan?.shots ?? []);
      await updateSeedVideoProject(seedVideo.id, {
        plan: { ...(seedVideo.plan ?? {}), shots: merged },
      });
      return merged;
    },
    [seedVideo.id, seedVideo.plan],
  );

  useEffect(() => {
    prevRefCatalogRef.current = buildReplicaMentionCatalogEntries(seedVideo.references);
  }, [seedVideo.id]);

  useEffect(() => {
    const newCatalog = buildReplicaMentionCatalogEntries(syncedReferences);
    const oldCatalog = prevRefCatalogRef.current;
    prevRefCatalogRef.current = newCatalog;
    if (!oldCatalog || refSyncBusyRef.current) return;
    if (mentionCatalogSignature(oldCatalog) === mentionCatalogSignature(newCatalog)) return;

    setLocalShots((prev) => {
      if (prev.length === 0) return prev;
      const synced = syncSeedVideoShotsAfterRefChange(prev, oldCatalog, newCatalog);
      if (JSON.stringify(synced) === JSON.stringify(prev)) return prev;
      refSyncBusyRef.current = true;
      void persistShots(synced)
        .then(() => onSeedVideoChangeRef.current())
        .finally(() => {
          refSyncBusyRef.current = false;
        });
      return synced;
    });
  }, [persistShots, syncedReferences]);

  const shotsAutosaveSkipRef = useRef(true);
  useEffect(() => {
    shotsAutosaveSkipRef.current = true;
  }, [seedVideo.id]);

  useEffect(() => {
    if (shotsAutosaveSkipRef.current) {
      shotsAutosaveSkipRef.current = false;
      return;
    }
    if (localShots.length === 0) return;
    const timer = window.setTimeout(() => {
      void persistShots(localShots).catch(() => {
        /* 生成前会再保存 */
      });
    }, 900);
    return () => window.clearTimeout(timer);
  }, [localShots, persistShots]);

  async function handleAddRow() {
    const next = appendSeedVideoShot(localShots);
    setLocalShots(next);
    await persistShots(next);
  }

  async function handleDeleteRow(index: number) {
    const shot = localShots.find((s) => s.index === index);
    if (!shot || !canDeleteSeedVideoShot(shot, activeGeneratingIndices)) return;
    const next = removeSeedVideoShotAt(localShots, index);
    setLocalShots(next);
    setSelectedShotIndices((prev) => {
      const nextSel = new Set<number>();
      for (const i of prev) {
        if (i < index) nextSel.add(i);
        else if (i > index) nextSel.add(i - 1);
      }
      return nextSel;
    });
    await persistShots(next);
  }

  const applyVoiceoverDraftIndices = useCallback(
    async (indices: number[]) => {
      const draft = readVoiceoverDraft(seedVideo);
      if (!draft || indices.length === 0) return;
      const byIndex = buildVoiceoverDraftMap(draft);
      const applicable = indices.filter((index) => byIndex.has(index));
      if (applicable.length === 0) return;

      const nextShots = localShots.map((s) => {
        if (!applicable.includes(s.index)) return s;
        return { ...s, voiceover: byIndex.get(s.index) ?? "" };
      });
      setLocalShots(nextShots);

      const merged = mergeSeedVideoShotsForPersist(nextShots, seedVideo.plan?.shots ?? []);
      const nextDraft = voiceoverDraftAfterApply(draft, applicable);
      await updateSeedVideoProject(seedVideo.id, {
        plan: { ...(seedVideo.plan ?? {}), shots: merged },
        meta: {
          ...(seedVideo.meta ?? {}),
          replicaVoiceoverDraft: nextDraft,
        },
      });
      await onSeedVideoChange();
      toast({
        title: applicable.length > 1 ? "已应用全部新口播" : "已应用新口播",
        description: "可在口播列继续编辑或清空；若已有 TTS 请重新批量 TTS。",
      });
    },
    [localShots, onSeedVideoChange, seedVideo, toast],
  );

  const applyRemoteShotVideo = useCallback((panelIndex: number, remote: SeedVideoShot | undefined) => {
    if (!remote?.videoUrl?.trim()) return false;
    let changed = false;
    setLocalShots((prev) => {
      const cur = prev.find((s) => s.index === panelIndex);
      if (cur?.videoUrl?.trim() === remote.videoUrl?.trim()) return prev;
      changed = true;
      return prev.map((s) =>
        s.index === panelIndex ? { ...s, videoUrl: remote.videoUrl, videoTaskId: remote.videoTaskId } : s,
      );
    });
    return changed;
  }, []);

  const applyFreshShotProject = useCallback(
    (fresh: SeedVideoProject) => {
      setSyncedProjectMeta(fresh.meta);
      setSyncedReferences(fresh.references);

      const serverPending = listEffectivePendingShotIndices(fresh.meta, fresh.plan?.shots);
      const watch = new Set<number>(generatingShotsRef.current);
      for (const idx of serverPending) watch.add(idx);

      if (fresh.plan?.shots?.length) {
        setLocalShots((prev) =>
          mergeSeedVideoShotsForPersist(prev, fresh.plan?.shots ?? prev),
        );
      }

      setGeneratingShots((prev) => {
        const merged = clearGeneratingShotsWithVideo(
          mergeOptimisticGeneratingShots({
            previous: prev,
            serverPending,
            shots: fresh.plan?.shots,
            previousStartedAt: generatingSinceRef.current ?? undefined,
          }),
          fresh.plan?.shots,
        );
        const since = generatingSinceRef.current;
        if (since) for (const key of [...since.keys()]) if (!merged.has(key)) since.delete(key);
        return merged;
      });

      for (const idx of watch) {
        const remote = fresh.plan?.shots?.find((s) => s.index === idx);
        if (!remote?.videoUrl?.trim()) continue;
        applyRemoteShotVideo(idx, remote);
      }
    },
    [applyRemoteShotVideo],
  );

  const syncRemoteShotVideos = useCallback(async () => {
    if (syncLockRef.current || submitInFlightRef.current) return;
    syncLockRef.current = true;
    try {
      let fresh = await getSeedVideoProject(seedVideo.id, { resumePending: false });
      applyFreshShotProject(fresh);

      const serverPending = listEffectivePendingShotIndices(fresh.meta, fresh.plan?.shots);
      if (serverPending.length > 0 && !submitInFlightRef.current) {
        fresh = await resumeSeedVideoPendingShots(seedVideo.id);
        applyFreshShotProject(fresh);
      }

      await onSeedVideoChangeRef.current();
    } catch {
      /* ignore */
    } finally {
      syncLockRef.current = false;
    }
  }, [applyFreshShotProject, seedVideo.id]);

  useEffect(() => {
    void syncRemoteShotVideos();
  }, [seedVideo.id, syncRemoteShotVideos]);

  useEffect(() => {
    if (generatingShots.size === 0 && pendingShotIndices.length === 0) return;
    void syncRemoteShotVideos();
    const timer = window.setInterval(() => void syncRemoteShotVideos(), SHOT_POLL_MS);
    return () => window.clearInterval(timer);
  }, [
    generatingShots.size,
    pendingShotIndices.length,
    pendingShotIndices.join(","),
    syncRemoteShotVideos,
  ]);

  async function runPanelGenerate(
    modelKey: string,
    panelIndex: number,
    durationSec?: number,
    opts?: { skipPersist?: boolean },
  ) {
    submitInFlightRef.current = true;
    try {
      if (!opts?.skipPersist) {
        await persistShots(localShots);
      }
      setGeneratingShots((prev) => addGeneratingShot(prev, panelIndex));
      generatingSinceRef.current?.set(panelIndex, Date.now());
      const result = await generateSeedVideoShot({
        projectId: seedVideo.id,
        shotIndex: panelIndex,
        modelKey,
        durationSec: durationSec ?? pickerPanelDurationRef.current,
        aspectRatio: seedVideo.settings.aspectRatio ?? "9:16",
        resolution: pickerVideoResolution,
        generateAudio: pickerVideoGenerateAudio,
      });
      if ("status" in result) {
        void syncRemoteShotVideos();
        await onSeedVideoChange();
        return;
      }
      setLocalShots((prev) =>
        prev.map((s) => (s.index === panelIndex ? { ...s, videoUrl: result.videoUrl } : s)),
      );
      setGeneratingShots((prev) => removeGeneratingShot(prev, panelIndex));
      await onSeedVideoChange();
    } catch (e) {
      const fresh = await getSeedVideoProject(seedVideo.id, { resumePending: false }).catch(
        () => null,
      );
      const remote = fresh?.plan?.shots?.find((s) => s.index === panelIndex);
      if (remote?.videoUrl?.trim()) {
        applyRemoteShotVideo(panelIndex, remote);
        setGeneratingShots((prev) => removeGeneratingShot(prev, panelIndex));
        await onSeedVideoChange();
        return;
      }
      if (fresh && isShotVideoPending(fresh.meta, panelIndex)) {
        void syncRemoteShotVideos();
        void onSeedVideoChange();
        return;
      }
      setGeneratingShots((prev) => removeGeneratingShot(prev, panelIndex));
      await onAlert({
        title: "镜头生成失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      submitInFlightRef.current = false;
    }
  }

  function openGeneratePicker(indices: number[]) {
    if (filteredModels.length > 0) {
      const validKeys = new Set(filteredModels.map((m) => m.modelKey));
      if (!validKeys.has(videoModelKey)) {
        const next = resolveSeedVideoVideoModelKey(filteredModels, videoModelKey, false);
        if (next !== videoModelKey) onVideoModelChange(next);
      }
    }
    const firstIndex = indices[0];
    const firstShot =
      firstIndex != null ? localShots.find((s) => s.index === firstIndex) : undefined;
    const durationSec = firstShot?.durationSec ?? 8;
    pickerSelectedRef.current = [...indices];
    pickerPanelDurationRef.current = durationSec;
    setPickerPanelDurationSec(durationSec);
    setPickerSelected(indices);
    setPickerOpen(true);
  }

  async function runSelectedShotsParallel(modelKey: string, shotIndices: number[], durationSec: number) {
    const unique = [...new Set(shotIndices)].sort((a, b) => a - b);
    if (unique.length === 0) return;
    pickerPanelDurationRef.current = durationSec;
    const saved = await persistShots(localShots);
    setLocalShots(saved);
    const pending = unique.filter((index) => !generatingShotsRef.current.has(index));
    if (pending.length === 0) return;
    await Promise.all(
      pending.map((index) =>
        runPanelGenerate(modelKey, index, durationSec, { skipPersist: true }),
      ),
    );
  }

  async function onPickerConfirm(modelKey: string) {
    const durationSec = pickerPanelDurationSec;
    pickerPanelDurationRef.current = durationSec;
    const indicesFromRef = [...pickerSelectedRef.current];
    const indicesFromState = pickerSelected.length > 0 ? [...pickerSelected] : [];
    const indices =
      indicesFromRef.length > 0
        ? indicesFromRef
        : indicesFromState.length > 0
          ? indicesFromState
          : localShots
              .filter((s) => !activeGeneratingIndices.has(s.index))
              .map((s) => s.index);
    pickerSelectedRef.current = [];
    setPickerSelected([]);

    if (indices.length === 0) {
      await onAlert({
        title: "无法生成",
        message: activeGeneratingIndices.size > 0 ? "所选镜头正在生成中，请稍候。" : "暂无可用镜头。",
      });
      return;
    }

    setSelectedShotIndices((prev) => {
      const submitting = new Set(indices);
      const next = new Set<number>();
      for (const i of prev) {
        if (!submitting.has(i)) next.add(i);
      }
      return next;
    });

    setPickerConfirming(true);
    setPickerOpen(false);
    onVideoModelChange(modelKey);
    persistVideoGenSettings({
      videoModelKey: modelKey,
      videoPanelDurationSec: durationSec,
      videoResolution: pickerVideoResolution,
      videoGenerateAudio: pickerVideoGenerateAudio,
      videoR2vRatio: pickerVideoR2vRatio,
    });

    try {
      await runSelectedShotsParallel(modelKey, indices, durationSec);
    } catch (e) {
      setGeneratingShots((prev) => {
        let next = prev;
        for (const index of indices) next = removeGeneratingShot(next, index);
        return next;
      });
      await onAlert({
        title: "提交生成失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setPickerConfirming(false);
    }
  }

  async function runTts(shotIndices: number[]) {
    if (shotIndices.length === 0) {
      await onAlert({
        title: "请先勾选镜头",
        message: "勾选含口播文案的镜头后再点「批量 TTS」；口播列为空的不计入。",
        variant: "error",
      });
      return;
    }
    setTtsBusy(true);
    try {
      await persistShots(localShots);
      await generateSeedVideoTts({ projectId: seedVideo.id, shotIndices });
      await onSeedVideoChange();
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

  async function waitForRenderJob(jobId: string): Promise<string> {
    for (let i = 0; i < RENDER_POLL_MAX; i++) {
      await new Promise((r) => setTimeout(r, RENDER_POLL_MS));
      const job = await pollSeedVideoMediaRenderJob(jobId);
      const label = job.progressLabel?.trim() || "处理中…";
      setRenderProgress((prev) =>
        prev
          ? {
              ...prev,
              jobId: job.id,
              progress: job.progress,
              progressLabel: label,
              phase: resolveSeedVideoRenderPhase(job.status, job.progress),
              stepLog: appendSeedVideoRenderStepLog(prev.stepLog, label),
            }
          : prev,
      );
      if (job.status === "SUCCEEDED" && job.downloadUrl) return job.downloadUrl;
      if (job.status === "FAILED" || job.status === "EXPIRED") {
        throw new Error(job.errorMessage ?? "合成失败");
      }
    }
    throw new Error("合成超时");
  }

  function requestCompose(shotIndices: number[]) {
    if (shotIndices.length === 0) {
      void onAlert({
        title: "请先勾选镜头",
        message:
          "勾选状态为「就绪」或「视频 OK」（无口播）的镜头后再合成；缺视频或未 TTS 的不计入。",
        variant: "error",
      });
      return;
    }
    const merged = mergeSeedVideoShotsForPersist(localShots, seedVideo.plan?.shots ?? []);
    const selectedSet = new Set(shotIndices);
    const targets = merged.filter((s) => selectedSet.has(s.index));
    if (targets.some((s) => !s.videoUrl?.trim())) {
      void onAlert({
        title: "暂不能合成",
        message: "所选镜头须已有镜头视频（状态「视频 OK」或「就绪」）。",
        variant: "error",
      });
      return;
    }
    if (
      targets.some(
        (s) => s.videoUrl?.trim() && s.voiceover?.trim() && !s.ttsUrl?.trim(),
      )
    ) {
      void onAlert({
        title: "暂不能合成",
        message: "所选镜头中有口播尚未 TTS，请先对勾选镜头批量 TTS。",
        variant: "error",
      });
      return;
    }
    setPendingComposeIndices(shotIndices);
    setComposeDialogOpen(true);
  }

  async function runRender(shotIndices: number[], subtitleStyle: SubtitleBurnInStyle) {
    if (shotIndices.length === 0) return;
    setComposeSubtitleStyle(subtitleStyle);
    setComposeDialogOpen(false);
    setPendingComposeIndices(null);
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
      const merged = mergeSeedVideoShotsForPersist(localShots, seedVideo.plan?.shots ?? []);
      const selectedSet = new Set(shotIndices);
      const targets = merged.filter((s) => selectedSet.has(s.index));
      if (targets.some((s) => !s.videoUrl?.trim())) {
        setRenderProgress(null);
        await onAlert({
          title: "暂不能合成",
          message: "所选镜头须已有镜头视频（状态「视频 OK」或「就绪」）。",
          variant: "error",
        });
        return;
      }
      if (
        targets.some(
          (s) => s.videoUrl?.trim() && s.voiceover?.trim() && !s.ttsUrl?.trim(),
        )
      ) {
        setRenderProgress(null);
        await onAlert({
          title: "暂不能合成",
          message: "所选镜头中有口播尚未 TTS，请先对勾选镜头批量 TTS。",
          variant: "error",
        });
        return;
      }
      await persistShots(merged);
      const { jobId } = await renderSeedVideo(seedVideo.id, {
        shotIndices,
        profile: buildSeedVideoComposeProfile(subtitleStyle),
      });
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
      const videoUrl = await waitForRenderJob(jobId);
      setLocalFinalUrl(videoUrl);
      await updateSeedVideoProject(seedVideo.id, {
        plan: {
          ...(seedVideo.plan ?? {}),
          render: { ...(seedVideo.plan?.render ?? {}), jobId, finalVideoUrl: videoUrl },
        },
        status: "done",
      });
      await onSeedVideoChange();
      toast({
        title: "合成完成",
        message: "成片已就绪，可在下方预览。",
        variant: "success",
      });
    } catch (e) {
      setRenderProgress((prev) =>
        prev ? { ...prev, phase: "failed", progressLabel: e instanceof Error ? e.message : "合成失败" } : prev,
      );
      await onAlert({
        title: "合成失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setRenderBusy(false);
    }
  }

  return (
    <>
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[#1d1d1f]">方案② · 精细成片</h2>
          <div className="flex flex-wrap gap-2">
            <EcomButtonSecondary
              type="button"
              size="sm"
              disabled={
                batchProductionBusy ||
                singleShotBusy ||
                !scriptReady ||
                (selectedGeneratableCount === 0 && idleGeneratableIndices.length === 0)
              }
              onClick={() =>
                openGeneratePicker(
                  selectedGeneratableCount > 0
                    ? selectedGeneratableIndices
                    : idleGeneratableIndices,
                )
              }
            >
              {selectedGeneratableCount > 0
                ? `生成 (${selectedGeneratableCount})`
                : "生成"}
            </EcomButtonSecondary>
            <EcomButtonSecondary
              type="button"
              size="sm"
              disabled={batchProductionBusy || !scriptReady}
              onClick={() => void handleSaveShots()}
            >
              保存编辑
            </EcomButtonSecondary>
            <EcomButtonSecondary
              type="button"
              size="sm"
              disabled={batchProductionBusy || singleShotBusy || !scriptReady}
              onClick={() => openGeneratePicker(idleGeneratableIndices)}
            >
              逐镜生成视频
            </EcomButtonSecondary>
            <EcomButtonSecondary
              type="button"
              size="sm"
              disabled={
                batchProductionBusy ||
                singleShotBusy ||
                !scriptReady ||
                ttsBusy ||
                selectedTtsCount === 0
              }
              onClick={() => void runTts(selectedTtsIndices)}
            >
              {batchTtsLabel}
            </EcomButtonSecondary>
            <EcomButtonPrimary
              type="button"
              size="sm"
              disabled={
                batchProductionBusy ||
                singleShotBusy ||
                !scriptReady ||
                renderBusy ||
                selectedComposeCount === 0
              }
              onClick={() => requestCompose(selectedComposeIndices)}
            >
              {batchComposeLabel}
            </EcomButtonPrimary>
          </div>
        </div>
        <p className="text-[11px] leading-relaxed text-[#6e6e73]">
          推荐顺序：① 勾选后「生成 (N)」→ ② 含口播「批量 TTS (N)」→ ③ 就绪镜头「合成成片 (N)」。
        </p>

        {anyGenerating ? (
          <div
            className="flex flex-wrap items-center gap-3 rounded-xl border border-[#0071e3]/25 bg-[#f0f6ff] px-3 py-2.5"
            role="status"
            aria-live="polite"
          >
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#0071e3]" />
            <span className="min-w-0 flex-1 text-xs leading-relaxed text-[#0058c7]">
              {generatingStatusLabel}
            </span>
            <div className="ecom-upload-progress ecom-upload-progress-indeterminate w-full min-w-[8rem] sm:w-32">
              <span />
            </div>
          </div>
        ) : null}

        <SeedVideoShotTable
          shots={localShots}
          references={syncedReferences}
          onChange={setLocalShots}
          disabled={batchProductionBusy || !planSynced}
          generatingIndices={activeGeneratingIndices}
          onPreviewVideo={onPreviewVideo}
          showGenerateActions
          selectDisabled={!planSynced}
          hideRefColumn
          videoPromptMentionRefs={mentionRefs}
          selectedShotIndices={selectedShotIndices}
          selectedCount={selectedGeneratableCount}
          onToggleShotSelected={(index, checked) => {
            if (activeGeneratingIndices.has(index)) return;
            setSelectedShotIndices((prev) => {
              const next = new Set(prev);
              if (checked) next.add(index);
              else next.delete(index);
              return next;
            });
          }}
          onGenerateSelected={() => {
            if (selectedGeneratableCount === 0) return;
            openGeneratePicker([...selectedGeneratableIndices].sort((a, b) => a - b));
          }}
          generateSelectedDisabled={
            selectedGeneratableCount === 0 ||
            !planSynced ||
            ttsBusy ||
            renderBusy
          }
          onBatchTtsSelected={() => void runTts(selectedTtsIndices)}
          batchTtsDisabled={
            selectedTtsCount === 0 ||
            !planSynced ||
            batchProductionBusy ||
            singleShotBusy
          }
          batchTtsLabel={batchTtsLabel}
          onBatchComposeSelected={() => requestCompose(selectedComposeIndices)}
          batchComposeDisabled={
            selectedComposeCount === 0 ||
            !planSynced ||
            batchProductionBusy ||
            singleShotBusy
          }
          batchComposeLabel={batchComposeLabel}
          showRowActions
          onAddRow={() => void handleAddRow()}
          onDeleteRow={(index) => void handleDeleteRow(index)}
          canDeleteShot={(shot) => canDeleteSeedVideoShot(shot, activeGeneratingIndices)}
          voiceoverDraftByIndex={voiceoverDraftByIndex}
          onApplyVoiceoverDraft={(index) => void applyVoiceoverDraftIndices([index])}
          onApplyAllVoiceoverDrafts={() =>
            void applyVoiceoverDraftIndices([...voiceoverDraftByIndex.keys()])
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
              onPreview={() => onPreviewVideo(finalUrl, "精细成片")}
              playSize="lg"
            />
          </div>
        ) : null}
      </section>

      <StoryboardModelPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        mode="video"
        videoTarget="panel"
        models={filteredModels.length ? filteredModels : videoModels}
        value={videoModelKey}
        onChange={(key) => {
          onVideoModelChange(key);
          persistVideoGenSettings({ videoModelKey: key });
          if (videoModelSupportsGenerateAudio(key)) {
            setPickerVideoGenerateAudio(true);
          }
        }}
        onConfirm={(key) => void onPickerConfirm(key)}
        confirming={pickerConfirming}
        aspectRatio={seedVideo.settings.aspectRatio ?? "9:16"}
        panelDurationSec={pickerPanelDurationSec}
        onPanelDurationChange={(value) => {
          pickerPanelDurationRef.current = value;
          setPickerPanelDurationSec(value);
          persistVideoGenSettings({ videoPanelDurationSec: value });
        }}
        videoResolution={pickerVideoResolution}
        onVideoResolutionChange={(value) => {
          setPickerVideoResolution(value);
          persistVideoGenSettings({ videoResolution: value });
        }}
        videoR2vRatio={pickerVideoR2vRatio}
        onVideoR2vRatioChange={(value) => {
          setPickerVideoR2vRatio(value);
          persistVideoGenSettings({ videoR2vRatio: value });
        }}
        videoSeed={pickerVideoSeed}
        onVideoSeedChange={setPickerVideoSeed}
        videoPromptExtend={pickerVideoPromptExtend}
        onVideoPromptExtendChange={setPickerVideoPromptExtend}
        videoGenerateAudio={pickerVideoGenerateAudio}
        onVideoGenerateAudioChange={(value) => {
          setPickerVideoGenerateAudio(value);
          persistVideoGenSettings({ videoGenerateAudio: value });
        }}
        panelHasVoiceover={pickerPanelHasVoiceover}
      />

      <SeedVideoComposeDialog
        open={composeDialogOpen}
        shotCount={pendingComposeIndices?.length ?? 0}
        busy={renderBusy}
        initialStyle={composeSubtitleStyle}
        onOpenChange={(open) => {
          if (!open && !renderBusy) {
            setComposeDialogOpen(false);
            setPendingComposeIndices(null);
          }
        }}
        onConfirm={(style) => {
          if (!pendingComposeIndices?.length) return;
          void runRender(pendingComposeIndices, style);
        }}
      />

      <SeedVideoRenderProgressPanel
        state={renderProgress}
        onPanelOpenChange={(open) =>
          setRenderProgress((prev) => (prev ? { ...prev, panelOpen: open } : prev))
        }
        onCollapsedChange={(collapsed) =>
          setRenderProgress((prev) => (prev ? { ...prev, collapsed } : prev))
        }
        onDismiss={() => setRenderProgress(null)}
      />
    </>
  );
}

export function MediaDecomposeReplicaLaunch({
  busy,
  onStart,
}: {
  busy?: boolean;
  onStart: () => void;
}) {
  return (
    <section className="rounded-xl border border-[#e8e8ed] bg-white p-4 shadow-[0_8px_30px_rgba(0,0,0,0.08)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[#1d1d1f]">一键复刻</h2>
          <p className="mt-0.5 text-[11px] leading-relaxed text-[#6e6e73]">
            把拆出的生图 Prompt 或分镜脚本，按种草视频精细成片流程生成视频。
          </p>
        </div>
        <EcomButtonPrimary type="button" size="sm" disabled={busy} onClick={onStart}>
          {busy ? (
            <>
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              准备中…
            </>
          ) : (
            <>
              <Clapperboard className="mr-1 h-3.5 w-3.5" />
              一键复刻
            </>
          )}
        </EcomButtonPrimary>
      </div>
    </section>
  );
}
