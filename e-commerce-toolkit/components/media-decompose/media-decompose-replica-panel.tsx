"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clapperboard, Loader2 } from "lucide-react";

import { EcomVideoSlot } from "@/components/media/ecom-video-slot";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { SeedVideoRefUploader } from "@/components/seed-video/seed-video-ref-uploader";
import { SeedVideoRenderProgressPanel } from "@/components/seed-video/seed-video-render-progress-panel";
import { SeedVideoShotTable } from "@/components/seed-video/seed-video-shot-table";
import { StoryboardModelPickerDialog } from "@/components/storyboard/storyboard-model-picker-dialog";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import {
  attachSeedVideoRefsFromAssets,
  generateSeedVideoShot,
  generateSeedVideoTts,
  getSeedVideoProject,
  pollSeedVideoMediaRenderJob,
  removeSeedVideoRef,
  renderSeedVideo,
  updateSeedVideoProject,
  uploadSeedVideoRef,
} from "@/lib/ecom-seed-video-api";
import { buildSeedVideoMentionRefs } from "@/lib/seed-video-mention-refs";
import { IMAGE_UPLOAD_DROP_HINT } from "@/lib/image-upload-utils";
import {
  appendSeedVideoRenderStepLog,
  resolveSeedVideoRenderPhase,
  type SeedVideoRenderProgressState,
} from "@/lib/seed-video-render-progress";
import { isShotVideoPending, listPendingShotVideoIndices } from "@/lib/seed-video-pending-shots";
import { mergeSeedVideoShotsForPersist } from "@/lib/seed-video-shot-merge";
import {
  filterVideoModelsForMode,
  resolveSeedVideoVideoModelKey,
} from "@/lib/seed-video-workflow";
import type { SeedVideoProject, SeedVideoShot } from "@/lib/seed-video-types";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";

const RENDER_POLL_MS = 3000;
const RENDER_POLL_MAX = 120;
const SHOT_POLL_MS = 4000;

function addGeneratingShot(prev: Set<number>, index: number): Set<number> {
  if (prev.has(index)) return prev;
  const next = new Set(prev);
  next.add(index);
  return next;
}

function addGeneratingShots(prev: Set<number>, indices: Iterable<number>): Set<number> {
  let next = prev;
  for (const index of indices) {
    next = addGeneratingShot(next, index);
  }
  return next;
}

function removeGeneratingShot(prev: Set<number>, index: number): Set<number> {
  if (!prev.has(index)) return prev;
  const next = new Set(prev);
  next.delete(index);
  return next;
}

function removeGeneratingShots(prev: Set<number>, indices: Iterable<number>): Set<number> {
  let next = prev;
  for (const index of indices) {
    next = removeGeneratingShot(next, index);
  }
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
  const { doubleConfirm, toast } = useDialogs();
  const shots = seedVideo.plan?.shots ?? [];
  const [localShots, setLocalShots] = useState<SeedVideoShot[]>(shots);
  const [selectedShotIndices, setSelectedShotIndices] = useState<Set<number>>(() => new Set());
  const [generatingShots, setGeneratingShots] = useState<Set<number>>(
    () => new Set(listPendingShotVideoIndices(seedVideo.meta)),
  );
  const generatingShotsRef = useRef(generatingShots);
  generatingShotsRef.current = generatingShots;
  const [projectRefBusy, setProjectRefBusy] = useState(false);
  const [ttsBusy, setTtsBusy] = useState(false);
  const [renderBusy, setRenderBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSelected, setPickerSelected] = useState<number[]>([]);
  const [pickerPanelDurationSec, setPickerPanelDurationSec] = useState(8);
  const [pickerConfirming, setPickerConfirming] = useState(false);
  const [renderProgress, setRenderProgress] = useState<SeedVideoRenderProgressState | null>(null);
  const [localFinalUrl, setLocalFinalUrl] = useState<string | null>(
    seedVideo.plan?.render?.finalVideoUrl?.trim() || seedVideo.videoOssUrl?.trim() || null,
  );
  /** 轮询拉取的最新 meta（pending 等），与父级 seedVideo 同步 */
  const [syncedProjectMeta, setSyncedProjectMeta] = useState<SeedVideoProject["meta"]>(
    seedVideo.meta,
  );
  const [syncedReferences, setSyncedReferences] = useState(seedVideo.references);

  const syncLockRef = useRef(false);
  const onSeedVideoChangeRef = useRef(onSeedVideoChange);
  onSeedVideoChangeRef.current = onSeedVideoChange;
  const pickerSelectedRef = useRef<number[]>([]);
  const pickerPanelDurationRef = useRef(8);

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
  }, [seedVideo.id, seedVideo.meta, seedVideo.references]);

  useEffect(() => {
    setGeneratingShots(new Set(listPendingShotVideoIndices(seedVideo.meta)));
  }, [seedVideo.id]);

  useEffect(() => {
    const pending = listPendingShotVideoIndices(seedVideo.meta);
    if (pending.length === 0) return;
    setGeneratingShots((prev) => addGeneratingShots(prev, pending));
  }, [seedVideo.meta]);

  const filteredModels = useMemo(() => {
    const keys = filterVideoModelsForMode(
      videoModels.map((m) => m.modelKey),
      false,
    );
    return videoModels.filter((m) => keys.includes(m.modelKey));
  }, [videoModels]);

  const mentionRefs = useMemo(
    () => buildSeedVideoMentionRefs(syncedReferences),
    [syncedReferences],
  );

  const pendingShotIndices = useMemo(
    () => listPendingShotVideoIndices(syncedProjectMeta),
    [syncedProjectMeta],
  );

  const activeGeneratingIndices = useMemo(() => {
    const set = new Set(generatingShots);
    for (const idx of pendingShotIndices) set.add(idx);
    return set;
  }, [generatingShots, pendingShotIndices]);

  const hasVoiceover = localShots.some((s) => s.voiceover.trim());
  const isMultiShot = localShots.length > 1;
  const showCompose = isMultiShot || hasVoiceover;
  const pipelineBusy = ttsBusy || renderBusy;
  const refLocked = pipelineBusy || projectRefBusy;
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

  const composedUrl =
    localFinalUrl?.trim() || seedVideo.plan?.render?.finalVideoUrl?.trim() || seedVideo.videoOssUrl?.trim() || null;
  const finalUrl = composedUrl || (!showCompose
    ? localShots.find((s) => s.videoUrl?.trim())?.videoUrl?.trim() || null
    : null);

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

  const syncRemoteShotVideos = useCallback(async () => {
    if (syncLockRef.current) return;
    syncLockRef.current = true;
    try {
      const fresh = await getSeedVideoProject(seedVideo.id);
      setSyncedProjectMeta(fresh.meta);
      setSyncedReferences(fresh.references);

      const serverPending = listPendingShotVideoIndices(fresh.meta);
      const watch = new Set<number>(generatingShotsRef.current);
      for (const idx of serverPending) watch.add(idx);

      if (fresh.plan?.shots?.length) {
        setLocalShots((prev) =>
          mergeSeedVideoShotsForPersist(prev, fresh.plan?.shots ?? prev),
        );
      }

      if (watch.size === 0) {
        await onSeedVideoChangeRef.current();
        return;
      }

      const completed: number[] = [];
      for (const idx of watch) {
        const remote = fresh.plan?.shots?.find((s) => s.index === idx);
        if (!remote?.videoUrl?.trim()) continue;
        if (applyRemoteShotVideo(idx, remote)) completed.push(idx);
      }

      if (completed.length > 0) {
        setGeneratingShots((prev) => {
          let next = prev;
          for (const idx of completed) next = removeGeneratingShot(next, idx);
          return next;
        });
      }

      if (serverPending.length > 0) {
        setGeneratingShots((prev) => addGeneratingShots(prev, serverPending));
      }

      await onSeedVideoChangeRef.current();
    } catch {
      /* ignore */
    } finally {
      syncLockRef.current = false;
    }
  }, [applyRemoteShotVideo, seedVideo.id]);

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

  async function handleUploadRef(file: File) {
    setProjectRefBusy(true);
    try {
      await uploadSeedVideoRef(seedVideo.id, file);
      await onSeedVideoChange();
    } catch (e) {
      await onAlert({
        title: "上传失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setProjectRefBusy(false);
    }
  }

  async function handleAttachRefs(assetIds: string[]) {
    if (assetIds.length === 0) return;
    setProjectRefBusy(true);
    try {
      await attachSeedVideoRefsFromAssets(seedVideo.id, assetIds);
      await onSeedVideoChange();
    } catch (e) {
      await onAlert({
        title: "添加失败",
        message: e instanceof Error ? e.message : "无法从资产添加参考图",
        variant: "error",
      });
    } finally {
      setProjectRefBusy(false);
    }
  }

  async function handleRemoveRef(refId: string) {
    const ok = await doubleConfirm({
      title: "删除参考图",
      message: "确定从本项目移除这张参考图？",
      secondTitle: "不可恢复",
      secondMessage: "已引用该图的镜头将失去参考，是否继续？",
      confirmLabel: "删除",
    });
    if (!ok) return;
    setProjectRefBusy(true);
    try {
      await removeSeedVideoRef(seedVideo.id, refId);
      await onSeedVideoChange();
    } catch (e) {
      await onAlert({
        title: "删除失败",
        message: e instanceof Error ? e.message : "无法删除参考图",
        variant: "error",
      });
    } finally {
      setProjectRefBusy(false);
    }
  }

  async function runPanelGenerate(
    modelKey: string,
    panelIndex: number,
    durationSec?: number,
    opts?: { skipPersist?: boolean },
  ) {
    setGeneratingShots((prev) => addGeneratingShot(prev, panelIndex));
    try {
      if (!opts?.skipPersist) {
        await persistShots(localShots);
      }
      const result = await generateSeedVideoShot({
        projectId: seedVideo.id,
        shotIndex: panelIndex,
        modelKey,
        durationSec: durationSec ?? pickerPanelDurationRef.current,
        aspectRatio: seedVideo.settings.aspectRatio ?? "9:16",
      });
      setLocalShots((prev) =>
        prev.map((s) => (s.index === panelIndex ? { ...s, videoUrl: result.videoUrl } : s)),
      );
      setGeneratingShots((prev) => removeGeneratingShot(prev, panelIndex));
      await onSeedVideoChange();
    } catch (e) {
      const fresh = await getSeedVideoProject(seedVideo.id).catch(() => null);
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
    const fresh = await getSeedVideoProject(seedVideo.id);
    setLocalShots((prev) => mergeSeedVideoShotsForPersist(prev, fresh.plan?.shots ?? prev));
    setGeneratingShots((prev) => addGeneratingShots(prev, unique));
    await Promise.all(
      unique.map((index) =>
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

    setGeneratingShots((prev) => addGeneratingShots(prev, indices));
    setPickerConfirming(true);
    setPickerOpen(false);
    onVideoModelChange(modelKey);
    void updateSeedVideoProject(seedVideo.id, {
      settings: { ...seedVideo.settings, videoModelKey: modelKey },
    }).catch(() => {
      /* 模型选择仍用于本次生成 */
    });

    try {
      await runSelectedShotsParallel(modelKey, indices, durationSec);
    } catch (e) {
      await onAlert({
        title: "提交生成失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setPickerConfirming(false);
    }
  }

  async function runTts() {
    setTtsBusy(true);
    try {
      await persistShots(localShots);
      await generateSeedVideoTts({ projectId: seedVideo.id });
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
      const merged = mergeSeedVideoShotsForPersist(localShots, seedVideo.plan?.shots ?? []);
      if (merged.some((s) => !s.videoUrl?.trim())) {
        setRenderProgress(null);
        await onAlert({
          title: "暂不能合成",
          message: "请先为各镜生成镜头视频。",
          variant: "error",
        });
        return;
      }
      if (hasVoiceover && merged.some((s) => s.voiceover.trim() && !s.ttsUrl?.trim())) {
        setRenderProgress(null);
        await onAlert({
          title: "暂不能合成",
          message: "请先点击「批量 TTS」，待口播就绪后再合成。",
          variant: "error",
        });
        return;
      }
      await persistShots(merged);
      const { jobId } = await renderSeedVideo(seedVideo.id);
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
      <section className="space-y-3 rounded-xl border border-[#e8e8ed] bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-[#1d1d1f]">一键复刻</h2>
            <p className="mt-0.5 text-[11px] leading-relaxed text-[#6e6e73]">
              {showCompose
                ? "上传参考图后勾选镜号逐镜生成；各镜在视频 Prompt 用 @图片1 … 指定参考图。支持 TTS 与合成成片。"
                : "上传参考图并在各镜视频 Prompt 中用 @图片1 … 引用，生成后可在表格内预览。"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <EcomButtonSecondary
              type="button"
              size="sm"
              disabled={pipelineBusy || idleGeneratableIndices.length === 0}
              onClick={() => openGeneratePicker(idleGeneratableIndices)}
            >
              逐镜生成视频
            </EcomButtonSecondary>
            {showCompose ? (
              <>
                <EcomButtonSecondary
                  type="button"
                  size="sm"
                  disabled={pipelineBusy || anyGenerating || !hasVoiceover}
                  onClick={() => void runTts()}
                >
                  {ttsBusy ? "TTS…" : "批量 TTS"}
                </EcomButtonSecondary>
                <EcomButtonPrimary
                  type="button"
                  size="sm"
                  disabled={pipelineBusy || anyGenerating}
                  onClick={() => void runRender()}
                >
                  {renderBusy ? "合成中…" : "合成成片"}
                </EcomButtonPrimary>
              </>
            ) : null}
          </div>
        </div>

        <SeedVideoRefUploader
          references={syncedReferences}
          onUpload={handleUploadRef}
          onRemove={(id) => void handleRemoveRef(id)}
          onAttachAssets={handleAttachRefs}
          busy={refLocked}
          sectionLabel="参考图"
          requiredMark={false}
          emptyHint={`上传 1～9 张参考图；下方表格会展示全部 @图片N，在各镜视频 Prompt 中引用即可。${IMAGE_UPLOAD_DROP_HINT}`}
          className="rounded-xl border border-[#e8e8ed] bg-[#fafafa] p-3"
        />

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
          disabled={pipelineBusy}
          generatingIndices={activeGeneratingIndices}
          onPreviewVideo={onPreviewVideo}
          showGenerateActions
          selectDisabled={pipelineBusy}
          hideRefColumn
          showRefsGallery
          videoPromptMentionRefs={mentionRefs}
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
            if (selectedGeneratableIndices.length === 0) return;
            openGeneratePicker([...selectedGeneratableIndices].sort((a, b) => a - b));
          }}
          generateSelectedDisabled={selectedGeneratableIndices.length === 0 || pipelineBusy}
        />

        {finalUrl ? (
          <div className="space-y-2 border-t border-[#e8e8ed] pt-4">
            <h3 className="text-sm font-semibold text-[#1d1d1f]">成片视频</h3>
            <EcomVideoSlot
              src={finalUrl}
              layout="gallery-workspace"
              onPreview={() => onPreviewVideo(finalUrl, "一键复刻")}
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
        onChange={onVideoModelChange}
        onConfirm={(key) => void onPickerConfirm(key)}
        confirming={pickerConfirming}
        aspectRatio={seedVideo.settings.aspectRatio ?? "9:16"}
        panelDurationSec={pickerPanelDurationSec}
        onPanelDurationChange={(value) => {
          pickerPanelDurationRef.current = value;
          setPickerPanelDurationSec(value);
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
