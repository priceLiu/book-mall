"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_SUBTITLE_STYLE,
  type SubtitleBurnInStyle,
} from "@private/media-render-subtitle-style";
import { Clapperboard, Download } from "lucide-react";

import { useDialogs } from "@/components/dialogs/dialog-provider";
import { useCanvasStore } from "@/lib/canvas/store";
import type { JianyingMediaRenderResult } from "@/lib/canvas/types";
import { spawnJianyingRenderPreviewNode } from "@/lib/canvas/spawn-jianying-render-preview";
import {
  type JianyingExportFrame,
  type MediaRenderJob,
  type MediaRenderScaleMode,
  cancelMediaRenderJob,
  resolveMediaRenderDownloadUrl,
  retryMediaRenderUpload,
  submitMediaRender,
} from "@/lib/canvas-api";
import {
  MEDIA_RENDER_CANCEL_CONFIRM_MESSAGE,
  MEDIA_RENDER_CANCEL_CONFIRM_TITLE,
} from "@/lib/canvas/canvas-generation-cancel-messages";
import {
  clearMediaRenderPollDismiss,
  dismissMediaRenderPoll,
  friendlyMediaRenderError,
  isMediaRenderJobInflight,
  isMediaRenderJobPolling,
  isMediaRenderPollDismissed,
  isStaleMediaRenderInFlight,
  isTransientMediaRenderPollError,
  pollMediaRenderJobUntilDone,
  renderStatusLabel,
  type JianyingMediaRenderInFlight,
  type JianyingMediaRenderTransitionKind,
} from "@/lib/canvas/media-render-in-flight";
import { syncMediaRenderFrameAudios } from "@/lib/canvas/media-render-sync-audio";
import type { JianyingLibtvAudioClipSlot, JianyingLibtvClipSlot } from "@/lib/canvas/jianying-from-workspace";
import { pairAudioSlotsToVideoOrder } from "@/lib/canvas/jianying-from-workspace";
import {
  preserveAutoRenderNodeMediaFitPatch,
  scheduleAutoRenderParentGroupRelayout,
} from "@/lib/canvas/jianying-auto-render-layout";
import {
  isMediaRenderSessionLocalUrl,
  resolveMediaRenderLocalDownloadUrl,
} from "@/lib/canvas/media-render-session-url";
import { cn } from "@/lib/utils";
import { useGatewayLinkStatus } from "@/lib/canvas/use-gateway-link-status";
import { computeMediaRenderCreditsPreview } from "@/lib/canvas/media-render-credits";
import { dispatchPlatformCreditsBalanceRefresh } from "@/lib/canvas/canvas-credits-balance-events";
import { LibtvDockCreditsLabel } from "./libtv-dock-credits-label";
import { JianyingClipOrderStrip } from "./jianying-clip-order-strip";
import { JianyingAudioClipOrderStrip } from "./jianying-audio-clip-order-strip";
import {
  JianyingAutoRenderOutputFields,
  type JianyingAutoRenderSubtitleMode,
} from "./jianying-auto-render-output-fields";

type Props = {
  nodeId: string;
  base: string | null;
  projectId: string | null;
  frames: JianyingExportFrame[];
  clipSlots?: JianyingLibtvClipSlot[];
  clipOrderNodeIds?: string[];
  onClipOrderChange?: (orderNodeIds: string[]) => void;
  audioClipSlots?: JianyingLibtvAudioClipSlot[];
  audioOrderNodeIds?: string[];
  onAudioOrderChange?: (orderNodeIds: string[]) => void;
  persisted?: JianyingMediaRenderResult | null;
  inFlight?: JianyingMediaRenderInFlight | null;
  /** false = 成片留在当前节点，不另 spawn video-preview */
  spawnPreview?: boolean;
  layout?: "default" | "dock";
  connectedCount?: number;
  renderedCount?: number;
  audioConnectedCount?: number;
};

const SCALE_OPTIONS: { value: MediaRenderScaleMode; label: string }[] = [
  { value: "source", label: "原片（首镜分辨率）" },
  { value: "fit720p", label: "720P（按源片比例）" },
  { value: "fit1080p", label: "1080P（按源片比例）" },
];

const TRANSITION_OPTIONS: { value: JianyingMediaRenderTransitionKind; label: string }[] = [
  { value: "xfade", label: "交叉淡化" },
  { value: "none", label: "无转场" },
];

const fieldSelectClass =
  "nodrag h-8 min-w-0 flex-1 rounded-md border border-white/20 bg-black/30 px-2.5 text-[13px] text-white";

const dockFieldSelectClass =
  "nodrag h-8 w-[132px] shrink-0 rounded-md border border-white/20 bg-black/30 px-2.5 text-[13px] text-white";

function inflightStatus(
  job: MediaRenderJob,
): JianyingMediaRenderInFlight["status"] {
  return job.status === "PENDING" ? "PENDING" : "RUNNING";
}

export function JianyingMediaRenderActions({
  nodeId,
  base,
  projectId,
  frames,
  clipSlots = [],
  clipOrderNodeIds = [],
  onClipOrderChange,
  audioClipSlots = [],
  audioOrderNodeIds = [],
  onAudioOrderChange,
  persisted,
  inFlight,
  spawnPreview = true,
  layout = "default",
  connectedCount = 0,
  renderedCount = 0,
  audioConnectedCount = 0,
}: Props) {
  const dialogs = useDialogs();
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const addNode = useCanvasStore((s) => s.addNode);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const setEdges = useCanvasStore((s) => s.setEdges);

  const showRenderError = useCallback(
    async (message: string) => {
      await dialogs.alert({
        title: "云端剪辑失败",
        message,
        variant: "error",
      });
    },
    [dialogs],
  );

  const [transitionKind, setTransitionKind] = useState<JianyingMediaRenderTransitionKind>(
    inFlight?.transitionKind ?? "xfade",
  );
  const [transitionSec, setTransitionSec] = useState(inFlight?.transitionSec ?? 0.6);
  const [scaleMode, setScaleMode] = useState<MediaRenderScaleMode>(
    inFlight?.scaleMode ?? "fit1080p",
  );
  const [mixDialogue, setMixDialogue] = useState(
    () =>
      inFlight?.mixDialogue ??
      (audioConnectedCount > 0),
  );
  const [burnInSubtitles, setBurnInSubtitles] = useState(
    () => inFlight?.burnInSubtitles ?? inFlight?.burnIn ?? false,
  );
  const [subtitleMode, setSubtitleMode] = useState<JianyingAutoRenderSubtitleMode>(
    () =>
      inFlight?.subtitleMode ??
      (audioConnectedCount > 0 ? "tts" : "script"),
  );
  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleBurnInStyle>(
    inFlight?.subtitleStyle ?? DEFAULT_SUBTITLE_STYLE,
  );
  const { confirmedUnlinked: gatewayBlocked, accountUrl: gatewayAccountUrl } =
    useGatewayLinkStatus();
  const [doneUrl, setDoneUrl] = useState<string | null>(
    persisted?.downloadUrl ?? null,
  );
  const [expiresAt, setExpiresAt] = useState<string | null>(
    persisted?.expiresAt ?? null,
  );
  const [progress, setProgress] = useState<number | null>(
    isMediaRenderJobInflight(inFlight) ? inFlight?.progress ?? 0 : null,
  );
  const [stepLabel, setStepLabel] = useState<string | null>(
    isMediaRenderJobInflight(inFlight)
      ? inFlight?.progressLabel?.trim() || "处理中…"
      : null,
  );
  const [uploadFailed, setUploadFailed] = useState(false);
  const [syncDismissed, setSyncDismissed] = useState(false);
  const [retrySyncPending, setRetrySyncPending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [busy, setBusy] = useState(() => isMediaRenderJobInflight(inFlight));

  const settingsRef = useRef({
    transitionKind,
    transitionSec,
    scaleMode,
    mixDialogue,
    burnInSubtitles,
    subtitleMode,
    subtitleStyle,
  });
  const downloadableRef = useRef<string | null>(doneUrl);
  const doneUrlRef = useRef<string | null>(doneUrl);
  const progressRef = useRef<number | null>(
    isMediaRenderJobInflight(inFlight) ? inFlight?.progress ?? 0 : null,
  );
  const submittingRef = useRef(false);
  const syncDismissedRef = useRef(false);
  /** 停止等待后仍保留 jobId，供「重试云端同步」；不写回 inFlight 以免恢复轮询 */
  const stoppedJobIdRef = useRef<string | null>(null);
  settingsRef.current = {
    transitionKind,
    transitionSec,
    scaleMode,
    mixDialogue,
    burnInSubtitles,
    subtitleMode,
    subtitleStyle,
  };
  doneUrlRef.current = doneUrl;
  progressRef.current = progress;

  const videoFrames = frames.filter((f) => f.videoUrl);
  const canRender = Boolean(base && projectId && videoFrames.length >= 1);
  const isDock = layout === "dock";
  const pairedAudioForVideos = useMemo(
    () =>
      pairAudioSlotsToVideoOrder(
        clipOrderNodeIds,
        audioOrderNodeIds,
        audioClipSlots,
      ),
    [clipOrderNodeIds, audioOrderNodeIds, audioClipSlots],
  );

  const renderCreditsEstimate = useMemo(
    () =>
      computeMediaRenderCreditsPreview({
        burnInSubtitles,
        subtitleMode,
      }),
    [burnInSubtitles, subtitleMode],
  );

  const renderCreditsTitle = useMemo(() => {
    if (burnInSubtitles && subtitleMode === "asr") {
      return "自动成片 20 积分 + ASR 识别 10 积分";
    }
    if (burnInSubtitles) {
      return "自动成片 20 积分（字幕不另收费）";
    }
    return "自动成片 20 积分";
  }, [burnInSubtitles, subtitleMode]);

  const patchInFlight = useCallback(
    (patch: JianyingMediaRenderInFlight | null) => {
      updateNodeData(
        nodeId,
        { mediaRenderInFlight: patch },
        { sessionOnly: true },
      );
    },
    [nodeId, updateNodeData],
  );

  useEffect(() => {
    syncDismissedRef.current = syncDismissed;
  }, [syncDismissed]);

  useEffect(() => {
    const onExternalCancel = (ev: Event) => {
      const e = ev as CustomEvent<{ nodeId?: string }>;
      if (e.detail?.nodeId !== nodeId) return;
      setBusy(false);
      setProgress(null);
      setStepLabel(null);
      setSyncDismissed(false);
      syncDismissedRef.current = false;
    };
    window.addEventListener("canvas:media-render-cancelled", onExternalCancel);
    return () =>
      window.removeEventListener("canvas:media-render-cancelled", onExternalCancel);
  }, [nodeId]);

  useEffect(() => {
    if (isMediaRenderJobInflight(inFlight)) {
      if (!syncDismissedRef.current) {
        setBusy(true);
        setProgress((prev) =>
          Math.max(prev ?? 0, inFlight?.progress ?? 0),
        );
        setStepLabel(inFlight?.progressLabel?.trim() || "处理中…");
      }
      if (inFlight?.transitionKind) setTransitionKind(inFlight.transitionKind);
      if (typeof inFlight?.transitionSec === "number") {
        setTransitionSec(inFlight.transitionSec);
      }
      if (inFlight?.scaleMode) setScaleMode(inFlight.scaleMode);
      if (typeof inFlight?.mixDialogue === "boolean") {
        setMixDialogue(inFlight.mixDialogue);
      }
      if (typeof inFlight?.burnInSubtitles === "boolean") {
        setBurnInSubtitles(inFlight.burnInSubtitles);
      } else if (typeof inFlight?.burnIn === "boolean") {
        setBurnInSubtitles(inFlight.burnIn);
      }
      if (inFlight?.subtitleMode) setSubtitleMode(inFlight.subtitleMode);
      if (inFlight?.subtitleStyle) setSubtitleStyle(inFlight.subtitleStyle);
      return;
    }
    if (inFlight?.status === "FAILED") {
      setBusy(false);
      setProgress(null);
      setStepLabel(null);
      patchInFlight(null);
      return;
    }
    if (!busy) {
      setProgress(null);
      setStepLabel(null);
    }
  }, [inFlight, busy, patchInFlight]);

  useEffect(() => {
    setDoneUrl(persisted?.downloadUrl ?? null);
    setExpiresAt(persisted?.expiresAt ?? null);
  }, [persisted?.downloadUrl, persisted?.expiresAt]);

  const persistResult = useCallback(
    (
      ossDownloadUrl: string,
      expires: string,
      poster?: string | null,
      jobId?: string,
    ) => {
      const posterUrl = poster?.trim() || undefined;
      const currentVideoUrl = (
        useCanvasStore.getState().nodes.find((n) => n.id === nodeId)?.data as
          | { videoUrl?: string }
          | undefined
      )?.videoUrl?.trim();
      const keepSessionPreview =
        !spawnPreview &&
        isMediaRenderSessionLocalUrl(currentVideoUrl, jobId);

      setExpiresAt(expires);
      setDoneUrl(ossDownloadUrl);
      downloadableRef.current = ossDownloadUrl;

      const mediaRenderResult: JianyingMediaRenderResult = {
        downloadUrl: ossDownloadUrl,
        expiresAt: expires,
        completedAt: new Date().toISOString(),
        ...(posterUrl ? { posterUrl } : {}),
      };

      updateNodeData(nodeId, {
        ...preserveAutoRenderNodeMediaFitPatch(nodeId, {
          videoUrl: ossDownloadUrl,
          ...(posterUrl ? { posterUrl } : {}),
          mediaRenderInFlight: null,
          mediaFit: false,
          mediaFitKey: undefined,
          mediaRenderResult,
        }),
      });
      if (
        keepSessionPreview &&
        currentVideoUrl &&
        isMediaRenderSessionLocalUrl(currentVideoUrl, jobId)
      ) {
        updateNodeData(
          nodeId,
          preserveAutoRenderNodeMediaFitPatch(nodeId, {
            videoUrl: currentVideoUrl,
            mediaRenderInFlight: null,
          }),
          { sessionOnly: true },
        );
      }
      scheduleAutoRenderParentGroupRelayout(nodeId);
      if (spawnPreview) {
        const state = useCanvasStore.getState();
        spawnJianyingRenderPreviewNode(nodeId, ossDownloadUrl, {
          nodes: state.nodes,
          edges: state.edges,
          addNode,
          setNodes,
          setEdges,
          updateNodeData,
        });
      }
    },
    [nodeId, spawnPreview, updateNodeData, addNode, setNodes, setEdges],
  );

  const applyJobProgress = useCallback(
    (job: MediaRenderJob) => {
      if (isMediaRenderPollDismissed(nodeId, job.id)) return;
      const dismissed = syncDismissedRef.current;
      if (!dismissed) {
        setProgress((prev) => {
          const next = Math.max(prev ?? 0, job.progress);
          progressRef.current = next;
          return next;
        });
      }
      const ossUrl = job.downloadUrl?.trim() || null;
      const sessionPreviewUrl =
        base && job.localDownloadPath?.trim()
          ? resolveMediaRenderLocalDownloadUrl(base, job)
          : null;
      const localReady = Boolean(sessionPreviewUrl);
      const currentVideoUrl = (
        useCanvasStore.getState().nodes.find((n) => n.id === nodeId)?.data as
          | { videoUrl?: string }
          | undefined
      )?.videoUrl?.trim();
      const keepSessionPreview =
        !spawnPreview &&
        isMediaRenderSessionLocalUrl(currentVideoUrl, job.id);

      const dockUrl =
        sessionPreviewUrl ??
        ossUrl ??
        (base ? resolveMediaRenderDownloadUrl(base, job) : null);
      if (dockUrl) {
        if (job.status === "SUCCEEDED" && ossUrl) {
          setDoneUrl(ossUrl);
          downloadableRef.current = ossUrl;
        } else {
          setDoneUrl(dockUrl);
          downloadableRef.current = dockUrl;
        }
      }

      if (!spawnPreview && (sessionPreviewUrl || ossUrl)) {
        if (sessionPreviewUrl && !keepSessionPreview) {
          updateNodeData(
            nodeId,
            preserveAutoRenderNodeMediaFitPatch(nodeId, {
              videoUrl: sessionPreviewUrl,
              mediaRenderResult: null,
              mediaFit: false,
              mediaFitKey: undefined,
            }),
            { sessionOnly: true },
          );
          scheduleAutoRenderParentGroupRelayout(nodeId);
        } else if (ossUrl && !sessionPreviewUrl && !keepSessionPreview) {
          updateNodeData(
            nodeId,
            preserveAutoRenderNodeMediaFitPatch(nodeId, {
              videoUrl: ossUrl,
              mediaFit: false,
              mediaFitKey: undefined,
              ...(job.posterUrl?.trim()
                ? { posterUrl: job.posterUrl.trim() }
                : {}),
            }),
          );
          scheduleAutoRenderParentGroupRelayout(nodeId);
        }
      }

      if (sessionPreviewUrl || ossUrl) {
        if (job.uploadFailed) {
          setUploadFailed(true);
          if (!dismissed) setStepLabel("剪辑完成，云端同步失败");
        } else if (job.status === "RUNNING" && job.localDownloadPath) {
          if (!dismissed) {
            setUploadFailed(false);
            setStepLabel("剪辑完成，云端同步中…");
            setBusy(false);
          }
        } else if (!dismissed) {
          setStepLabel(renderStatusLabel(job));
        }
      } else if (!dismissed) {
        const nextLabel = renderStatusLabel(job);
        const cur = progressRef.current ?? 0;
        if (cur > 5 && /排队/.test(nextLabel) && job.status === "PENDING") {
          setStepLabel((prev) => prev ?? nextLabel);
        } else {
          setStepLabel(nextLabel);
        }
      }
      if (job.status === "PENDING" || job.status === "RUNNING") {
        const settings = settingsRef.current;
        const monotonicProgress = Math.max(
          progressRef.current ?? 0,
          job.progress,
        );
        progressRef.current = monotonicProgress;
        patchInFlight({
          jobId: job.id,
          status: inflightStatus(job),
          progress: monotonicProgress,
          // 本地成片已就绪：进度只在 Dock 展示，节点不写上传文案
          progressLabel: localReady ? null : (job.progressLabel ?? null),
          errorMessage: job.uploadFailed
            ? job.errorMessage ?? "云端上传失败，可重试"
            : null,
          transitionKind: settings.transitionKind,
          transitionSec: settings.transitionSec,
          scaleMode: settings.scaleMode,
          mixDialogue: settings.mixDialogue,
          burnInSubtitles: settings.burnInSubtitles,
          subtitleMode: settings.subtitleMode,
          subtitleStyle: settings.subtitleStyle,
        });
      }
    },
    [base, nodeId, patchInFlight, spawnPreview, updateNodeData],
  );

  const finishJob = useCallback(
    async (
      finalJob: MediaRenderJob,
    ): Promise<
      | { outcome: "succeeded" }
      | { outcome: "upload_failed" }
      | { outcome: "failed"; errorMessage: string }
    > => {
      if (isMediaRenderPollDismissed(nodeId, finalJob.id)) {
        return { outcome: "upload_failed" };
      }
      const downloadUrl = base
        ? resolveMediaRenderDownloadUrl(base, finalJob)
        : finalJob.downloadUrl;
      if (finalJob.uploadFailed && downloadUrl) {
        setDoneUrl(downloadUrl);
        setUploadFailed(true);
        setProgress(finalJob.progress);
        setStepLabel("剪辑完成，云端同步失败");
        if (!spawnPreview) {
          const cur = (
            useCanvasStore.getState().nodes.find((n) => n.id === nodeId)
              ?.data as { videoUrl?: string } | undefined
          )?.videoUrl?.trim();
          if (!isMediaRenderSessionLocalUrl(cur, finalJob.id)) {
            updateNodeData(nodeId, {
              videoUrl: downloadUrl,
              ...(finalJob.posterUrl?.trim()
                ? { posterUrl: finalJob.posterUrl.trim() }
                : {}),
            });
          }
        }
        patchInFlight({
          jobId: finalJob.id,
          status: "RUNNING",
          progress: finalJob.progress,
          progressLabel: finalJob.progressLabel ?? null,
          errorMessage: finalJob.errorMessage ?? "云端上传失败，可重试",
          ...settingsRef.current,
        });
        return { outcome: "upload_failed" };
      }
      if (finalJob.status !== "SUCCEEDED" || !downloadUrl) {
        const message = friendlyMediaRenderError(
          finalJob.errorMessage ?? "云端剪辑失败",
        );
        patchInFlight({
          jobId: finalJob.id,
          status: "FAILED",
          progress: finalJob.progress,
          progressLabel: finalJob.progressLabel ?? null,
          errorMessage: message,
          ...settingsRef.current,
        });
        return { outcome: "failed", errorMessage: message };
      }
      persistResult(
        downloadUrl,
        finalJob.expiresAt,
        finalJob.posterUrl,
        finalJob.id,
      );
      setProgress(100);
      setStepLabel("剪辑完成");
      setUploadFailed(false);
      return { outcome: "succeeded" };
    },
    [base, nodeId, patchInFlight, persistResult, spawnPreview, updateNodeData],
  );

  const runTrackedJob = useCallback(
    async (jobId: string) => {
      if (!base) throw new Error("画布未就绪，请刷新页面后重试");
      const finalJob = await pollMediaRenderJobUntilDone({
        nodeId,
        jobId,
        base,
        onPoll: applyJobProgress,
      });
      return finishJob(finalJob);
    },
    [applyJobProgress, base, finishJob, nodeId],
  );

  // 历史落盘 bug：jobId=pending 会永远卡在「提交任务」且无法轮询（只清一次，勿清掉本次提交占位）
  const clearedStalePendingRef = useRef(false);
  useEffect(() => {
    if (clearedStalePendingRef.current) return;
    if (!isStaleMediaRenderInFlight(inFlight)) return;
    clearedStalePendingRef.current = true;
    patchInFlight(null);
    setBusy(false);
    setProgress(null);
    setStepLabel(null);
  }, [inFlight, patchInFlight]);

  useEffect(() => {
    if (!base || !isMediaRenderJobInflight(inFlight)) return;
    const jobId = inFlight!.jobId.trim();
    // 提交前占位 jobId，尚无真实任务可轮询
    if (!jobId || jobId === "pending" || isMediaRenderJobPolling(nodeId, jobId)) {
      return;
    }
    if (isMediaRenderPollDismissed(nodeId, jobId) || syncDismissedRef.current) {
      return;
    }

    let cancelled = false;
    setBusy(true);
    void runTrackedJob(jobId)
      .then((outcome) => {
        if (cancelled || isMediaRenderPollDismissed(nodeId, jobId)) return;
        if (outcome.outcome === "failed" && !downloadableRef.current) {
          void showRenderError(outcome.errorMessage);
        }
      })
      .catch((e) => {
        if (cancelled || isMediaRenderPollDismissed(nodeId, jobId)) return;
        const raw = e instanceof Error ? e.message : String(e);
        const message = friendlyMediaRenderError(raw);
        if (isTransientMediaRenderPollError(message)) {
          setStepLabel("连接中断，正在重试…");
          window.setTimeout(() => {
            if (cancelled || isMediaRenderPollDismissed(nodeId, jobId)) return;
            void runTrackedJob(jobId).catch(() => undefined);
          }, 5000);
          return;
        }
        if (downloadableRef.current || doneUrlRef.current) {
          setUploadFailed(true);
          setStepLabel("云端同步中断，可重试");
          patchInFlight({
            jobId,
            status: "RUNNING",
            progress: progressRef.current ?? 90,
            progressLabel: null,
            errorMessage: message,
            ...settingsRef.current,
          });
          return;
        }
        patchInFlight({
          jobId,
          status: "FAILED",
          progress: progressRef.current ?? 0,
          progressLabel: null,
          errorMessage: message,
          ...settingsRef.current,
        });
        void showRenderError(message);
      })
      .finally(() => {
        if (!cancelled && !isMediaRenderPollDismissed(nodeId, jobId)) {
          setBusy(false);
        }
      });

    return () => {
      cancelled = true;
    };
    // 仅在 job 身份变化时重启轮询；勿把 progress 放进 deps（会每秒 cancel 风暴）
  }, [
    base,
    inFlight?.jobId,
    inFlight?.status,
    nodeId,
    patchInFlight,
    runTrackedJob,
    showRenderError,
  ]);

  // 剪辑轮询被 tasks 风暴挤占连接池时会假死：watchdog 检测并重启
  useEffect(() => {
    if (!base || !busy) return;
    const jobId = inFlight?.jobId?.trim();
    if (!jobId || jobId === "pending") return;
    if (isMediaRenderPollDismissed(nodeId, jobId)) return;

    const watchdog = window.setInterval(() => {
      if (submittingRef.current) return;
      if (isMediaRenderPollDismissed(nodeId, jobId)) return;
      if (isMediaRenderJobPolling(nodeId, jobId)) return;
      void runTrackedJob(jobId).catch(() => undefined);
    }, 10_000);

    return () => window.clearInterval(watchdog);
  }, [base, busy, inFlight?.jobId, nodeId, runTrackedJob]);

  const onRender = async () => {
    if (submittingRef.current) return;
    if (busy && !syncDismissed) {
      await dialogs.alert({
        title: "请稍候",
        message: "云端剪辑任务进行中，请等待完成后再提交。",
        variant: "info",
      });
      return;
    }
    if (!base?.trim()) {
      await dialogs.alert({
        title: "无法提交",
        message: "主站地址未配置，无法提交剪辑。请刷新页面后重试。",
        variant: "error",
      });
      return;
    }
    if (!projectId?.trim()) {
      await dialogs.alert({
        title: "无法提交",
        message: "画布项目尚未加载完成，请稍候再试。",
        variant: "error",
      });
      return;
    }
    if (videoFrames.length < 1) {
      await dialogs.alert({
        title: "无法提交",
        message: "请至少完成 1 镜视频后再自动剪辑。",
        variant: "warning",
      });
      return;
    }
    if (mixDialogue && audioConnectedCount < 1) {
      await dialogs.alert({
        title: "无法烧录对白",
        message:
          "已勾选「烧录对白」，但未连接配音节点。请将音效设计节点连到自动成片下方配音入点，或取消勾选。",
        variant: "warning",
      });
      return;
    }
    if (burnInSubtitles && subtitleMode === "asr" && gatewayBlocked) {
      await dialogs.alert({
        title: "无法提交",
        message: gatewayAccountUrl
          ? `语音识别烧字幕须先关联 Gateway API Key。请前往主站账号页关联后再试。\n${gatewayAccountUrl}`
          : "语音识别烧字幕须先关联 Gateway API Key，请刷新页面后重试。",
        variant: "warning",
      });
      return;
    }
    if (burnInSubtitles && (subtitleMode === "script" || subtitleMode === "tts")) {
      const hasDialogue = videoFrames.some((f) => f.dialogue?.trim());
      if (!hasDialogue) {
        await dialogs.alert({
          title: "无法烧录字幕",
          message:
            subtitleMode === "tts"
              ? "当前各镜未解析到 TTS 台词。请确认音频节点已填写台词并连线到自动成片。"
              : "当前各镜未解析到分镜对白。请确认脚本表「对白」列已填写，或视频已连线文本/脚本节点，或改用「已连接 TTS 配音」。",
          variant: "warning",
        });
        return;
      }
    }

    const framesPayload = mixDialogue
      ? videoFrames
      : videoFrames.map((f) => ({
          ...f,
          audioUrl: null,
          audioSourceNodeId: null,
        }));

    submittingRef.current = true;
    setSubmitting(true);
    clearMediaRenderPollDismiss(nodeId);
    stoppedJobIdRef.current = null;
    setUploadFailed(false);
    setSyncDismissed(false);
    syncDismissedRef.current = false;
    setBusy(true);
    setDoneUrl(null);
    setExpiresAt(null);
    setProgress(0);
    setStepLabel(mixDialogue ? "准备同步配音…" : "准备提交…");
    // 新任务开始前清掉复制画布带来的旧成片 URL，避免播放仍指向源项目 OSS
    updateNodeData(nodeId, {
      videoUrl: undefined,
      posterUrl: undefined,
      mediaRenderResult: null,
    });
    // 不在此处 refresh：BFF 代理会静默续签；introspect 在 DB 拥堵时可达 5～13s，会假死在「提交任务」
    // 会话态占位（已从落盘剥离）；仅用于节点扫光与 Dock 进度
    updateNodeData(
      nodeId,
      {
        mediaRenderInFlight: {
          jobId: "pending",
          status: "PENDING",
          progress: 0,
          progressLabel: mixDialogue ? "准备同步配音…" : "提交任务…",
          transitionKind,
          transitionSec,
          scaleMode,
          mixDialogue,
          burnInSubtitles,
          subtitleMode,
          subtitleStyle,
        },
      },
      { sessionOnly: true },
    );
    // 让「提交中…」先绘制，再发 POST（避免 3s 内按钮无反馈）
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
    try {
      const transition =
        transitionKind === "xfade"
          ? ({ type: "xfade" as const, durationSec: transitionSec })
          : ({ type: "none" as const });
      const subtitleApiMode =
        !burnInSubtitles ? "none" : subtitleMode === "asr" ? "asr" : "script";

      let framesToSubmit = framesPayload;
      if (mixDialogue) {
        framesToSubmit = await syncMediaRenderFrameAudios({
          base,
          projectId,
          frames: framesPayload,
          onProgress: ({ label, progressPct }) => {
            setStepLabel(label);
            setProgress(progressPct);
            patchInFlight({
              jobId: "pending",
              status: "PENDING",
              progress: progressPct,
              progressLabel: label,
              transitionKind,
              transitionSec,
              scaleMode,
              mixDialogue,
              burnInSubtitles,
              subtitleMode,
              subtitleStyle,
            });
          },
        });
      }

      setStepLabel("提交剪辑任务…");
      setProgress((prev) => Math.max(prev ?? 0, 12));
      patchInFlight({
        jobId: "pending",
        status: "PENDING",
        progress: 12,
        progressLabel: "提交剪辑任务…",
        transitionKind,
        transitionSec,
        scaleMode,
        mixDialogue,
        burnInSubtitles,
        subtitleMode,
        subtitleStyle,
      });

      const job = await submitMediaRender(base, projectId, {
        frames: framesToSubmit,
        profile: {
          transition,
          audio: { mixTts: mixDialogue },
          subtitle: {
            mode: subtitleApiMode,
            burnIn: burnInSubtitles,
            ...(burnInSubtitles ? { style: subtitleStyle } : {}),
          },
          video: { scaleMode },
        },
      });
      dispatchPlatformCreditsBalanceRefresh();
      submittingRef.current = false;
      setSubmitting(false);
      if (isMediaRenderPollDismissed(nodeId, job.id)) return;
      // 立刻换成真实 jobId，避免一直停在 pending
      applyJobProgress(job);
      setStepLabel(renderStatusLabel(job));
      setProgress((prev) => Math.max(prev ?? 0, job.progress));
      const outcome = await runTrackedJob(job.id);
      if (isMediaRenderPollDismissed(nodeId, job.id)) return;
      if (outcome.outcome === "failed") {
        await showRenderError(outcome.errorMessage);
      }
    } catch (e) {
      if (syncDismissedRef.current) {
        patchInFlight(null);
        return;
      }
      const message = friendlyMediaRenderError(
        e instanceof Error ? e.message : String(e),
      );
      patchInFlight(null);
      await showRenderError(message);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
      setBusy(false);
    }
  };

  const expiryHint = expiresAt ? (
    <p
      className={cn(
        isDock ? "text-[12px] text-white/55" : "text-[10px] text-amber-200/90",
      )}
    >
      请在{" "}
      {new Date(expiresAt).toLocaleString("zh-CN", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })}{" "}
      前下载；到期将自动清理。
    </p>
  ) : (
    <p
      className={cn(
        isDock ? "text-[12px]" : "text-[10px]",
        "text-[var(--canvas-muted)]",
      )}
    >
      默认保留 7 天限时下载，不入长期视频库。
    </p>
  );

  const onRetryUpload = async () => {
    const jobId =
      inFlight?.jobId?.trim() || stoppedJobIdRef.current?.trim() || "";
    if (!base || !jobId || retrySyncPending) return;
    clearMediaRenderPollDismiss(nodeId);
    stoppedJobIdRef.current = null;
    setRetrySyncPending(true);
    setSyncDismissed(false);
    syncDismissedRef.current = false;
    setUploadFailed(false);
    setBusy(true);
    setStepLabel("正在重新同步云端…");
    try {
      const job = await retryMediaRenderUpload(base, jobId);
      applyJobProgress(job);
      const outcome = await runTrackedJob(jobId);
      if (isMediaRenderPollDismissed(nodeId, jobId)) return;
      if (outcome.outcome === "upload_failed") {
        setUploadFailed(true);
        setStepLabel("云端同步失败，可重试");
      } else if (outcome.outcome === "failed") {
        await showRenderError(outcome.errorMessage);
      }
    } catch (e) {
      if (isMediaRenderPollDismissed(nodeId, jobId)) return;
      setUploadFailed(true);
      setStepLabel("云端同步失败，可重试");
      await showRenderError(
        friendlyMediaRenderError(e instanceof Error ? e.message : String(e)),
      );
    } finally {
      setRetrySyncPending(false);
      if (!isMediaRenderPollDismissed(nodeId, jobId)) setBusy(false);
    }
  };

  const ffmpegBusy = (busy && !doneUrl) || submitting;
  const backgroundSync =
    Boolean(doneUrl) &&
    isMediaRenderJobInflight(inFlight) &&
    !uploadFailed &&
    !syncDismissed;
  const settingsLocked = ffmpegBusy || submitting;
  const retryJobId =
    inFlight?.jobId?.trim() || stoppedJobIdRef.current?.trim() || "";
  const showRetryUpload =
    Boolean(retryJobId) &&
    Boolean(doneUrl) &&
    (uploadFailed || backgroundSync || syncDismissed);
  const showProgress =
    (ffmpegBusy || backgroundSync || submitting) && !syncDismissed;

  const onStopBackgroundSync = async () => {
    if (
      !(await dialogs.confirm({
        title: MEDIA_RENDER_CANCEL_CONFIRM_TITLE,
        message: MEDIA_RENDER_CANCEL_CONFIRM_MESSAGE,
      }))
    ) {
      return;
    }
    const jobId = inFlight?.jobId?.trim() || null;
    if (jobId && jobId !== "pending" && base?.trim()) {
      try {
        await cancelMediaRenderJob(base, jobId);
      } catch {
        /* 本地仍停止等待 */
      }
    }
    if (jobId) {
      dismissMediaRenderPoll(nodeId, jobId);
      stoppedJobIdRef.current = jobId;
    }
    setBusy(false);
    setUploadFailed(Boolean(doneUrl));
    setSyncDismissed(true);
    syncDismissedRef.current = true;
    setProgress(null);
    setStepLabel(null);
    patchInFlight(null);
  };

  const onStopFfmpeg = async () => {
    if (
      !(await dialogs.confirm({
        title: MEDIA_RENDER_CANCEL_CONFIRM_TITLE,
        message: MEDIA_RENDER_CANCEL_CONFIRM_MESSAGE,
      }))
    ) {
      return;
    }
    const jobId = inFlight?.jobId?.trim() || null;
    if (jobId && jobId !== "pending" && base?.trim()) {
      try {
        await cancelMediaRenderJob(base, jobId);
      } catch {
        /* 本地仍停止等待 */
      }
    }
    if (jobId) dismissMediaRenderPoll(nodeId, jobId);
    setBusy(false);
    setProgress(null);
    setStepLabel(null);
    setSyncDismissed(true);
    syncDismissedRef.current = true;
    patchInFlight(null);
  };

  const progressBlock = showProgress ? (
    <div
      className={cn(
        "nodrag flex flex-col gap-1.5 px-1 py-1",
        isDock ? "w-full" : "rounded-md border border-white/10 bg-black/20 px-3 py-2",
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between gap-2 text-white/75",
          isDock ? "text-[12px]" : "text-[10px]",
        )}
      >
        <span className="min-w-0 truncate">{stepLabel ?? "处理中…"}</span>
        <span className="shrink-0 tabular-nums">{progress ?? 0}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-emerald-500/80 transition-[width] duration-300"
          style={{ width: `${Math.max(2, progress ?? 0)}%` }}
        />
      </div>
      {ffmpegBusy ? (
        <button
          type="button"
          className="nodrag self-end rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-white/75 transition hover:bg-white/10"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            void onStopFfmpeg();
          }}
        >
          中止剪辑
        </button>
      ) : null}
    </div>
  ) : null;

  const renderBtn = (
    <button
      type="button"
      disabled={settingsLocked}
      className={cn(
        "nodrag inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-600/20 px-5 py-2 text-[13px] font-medium text-emerald-100 transition hover:bg-emerald-600/30 disabled:opacity-50",
        isDock ? "h-9 shrink-0 whitespace-nowrap" : "w-full",
        !canRender && !settingsLocked ? "opacity-80" : undefined,
      )}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        void onRender();
      }}
    >
      <Clapperboard className="size-4 shrink-0" />
      {submitting
        ? "提交中…"
        : ffmpegBusy
          ? "剪辑中…"
          : "自动剪辑成片（MP4）"}
    </button>
  );

  const renderCreditsLabel = (
    <LibtvDockCreditsLabel
      credits={renderCreditsEstimate}
      fontPx={isDock ? 13 : 12}
      title={renderCreditsTitle}
    />
  );

  const renderBtnRow = (
    <div
      className={cn(
        "flex items-center gap-2",
        isDock ? "shrink-0" : "w-full",
      )}
    >
      {renderCreditsLabel}
      {renderBtn}
    </div>
  );

  const retryUploadBtn = showRetryUpload ? (
    <button
      type="button"
      disabled={retrySyncPending || ffmpegBusy}
      className={cn(
        "nodrag inline-flex items-center justify-center gap-2 rounded-lg border border-amber-500/40 bg-amber-600/15 px-4 py-2 text-[13px] font-medium text-amber-100 transition hover:bg-amber-600/25 disabled:opacity-50",
        isDock ? "h-9 shrink-0 whitespace-nowrap" : "w-full",
      )}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        void onRetryUpload();
      }}
    >
      {retrySyncPending ? "同步中…" : uploadFailed || syncDismissed ? "重试云端同步" : "重新同步云端"}
    </button>
  ) : null;

  const stopSyncBtn =
    backgroundSync && isDock ? (
      <button
        type="button"
        className="nodrag inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-[13px] font-medium text-white/75 transition hover:bg-white/10"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          void onStopBackgroundSync();
        }}
      >
        停止等待
      </button>
    ) : null;

  const downloadBtn = doneUrl ? (
    <a
      href={doneUrl}
      download
      target="_blank"
      rel="noreferrer"
      className={cn(
        "nodrag inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-[#2A2A2A] px-5 py-2 text-[13px] font-medium text-white transition hover:bg-[#333]",
        isDock ? "h-9 shrink-0 whitespace-nowrap" : "w-full",
      )}
    >
      <Download className="size-4 shrink-0" />
      {backgroundSync ? "下载 / 打开成片" : "下载成片 MP4"}
    </a>
  ) : null;

  const outputControls = (
    <JianyingAutoRenderOutputFields
      mixDialogue={mixDialogue}
      onMixDialogueChange={setMixDialogue}
      burnSubtitles={burnInSubtitles}
      onBurnSubtitlesChange={setBurnInSubtitles}
      subtitleMode={subtitleMode}
      onSubtitleModeChange={setSubtitleMode}
      style={subtitleStyle}
      onStyleChange={setSubtitleStyle}
      disabled={settingsLocked}
      showMixDialogue={audioConnectedCount > 0}
      className={isDock ? undefined : "border-white/10"}
    />
  );

  if (isDock) {
    return (
      <div className="flex h-full min-h-0 flex-col text-[13px] text-white/80">
        <div className="nodrag min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-2 [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/20"
          data-canvas-wheel-scroll
        >
          <div className="flex shrink-0 flex-col gap-1 border-b border-white/[0.06] pb-1.5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] text-white/70">
                视频 <strong className="text-white">{connectedCount}</strong>
                {" · "}
                可剪辑 <strong className="text-white">{renderedCount}</strong>
                {audioConnectedCount > 0 ? (
                  <>
                    {" · "}
                    音频 <strong className="text-white">{audioConnectedCount}</strong>
                  </>
                ) : null}
              </p>
              <p className="text-[13px] font-medium text-white/90">云端自动剪辑成片</p>
            </div>
            {audioConnectedCount > 0 ? (
              <p className="text-[11px] leading-snug text-white/40">
                第 N 段音频对应第 N 镜视频；在下方两行分别用 ↑↓ 对齐。提交时自动上传并混入 TTS。
              </p>
            ) : connectedCount > 0 ? (
              <p className="text-[11px] leading-snug text-white/40">
                将音效设计节点从右侧 <strong className="text-white/55">audio</strong> 口连到自动成片左侧
                <strong className="text-white/55"> 下方配音入点</strong>，即可混入 TTS 对白。
              </p>
            ) : null}
          </div>

          {clipSlots.length > 0 && onClipOrderChange ? (
            <JianyingClipOrderStrip
              slots={clipSlots}
              orderNodeIds={clipOrderNodeIds}
              pairedAudioByVideoIndex={pairedAudioForVideos}
              disabled={settingsLocked}
              onOrderChange={onClipOrderChange}
              className="mt-1.5 shrink-0 border-b border-white/[0.06] pb-1.5"
            />
          ) : null}

          {audioClipSlots.length > 0 && onAudioOrderChange ? (
            <JianyingAudioClipOrderStrip
              slots={audioClipSlots}
              orderNodeIds={audioOrderNodeIds}
              disabled={settingsLocked}
              onOrderChange={onAudioOrderChange}
              className="mt-1.5 shrink-0 border-b border-white/[0.06] pb-1.5"
            />
          ) : null}
        </div>

        <div className="nodrag shrink-0 border-t border-white/[0.06] bg-[#16161a] px-4 py-2">
          <div className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-2">
            <label className="flex items-center gap-2 text-[13px] text-white/70">
              <span className="shrink-0">转场时长</span>
              <input
                type="number"
                min={0.2}
                max={2}
                step={0.1}
                value={transitionSec}
                disabled={settingsLocked || transitionKind === "none"}
                className="nodrag h-8 w-[68px] rounded-md border border-white/20 bg-black/30 px-2 text-[13px] text-white disabled:opacity-40"
                onChange={(e) => setTransitionSec(Number(e.target.value) || 0.6)}
              />
              <span className="text-[12px] text-white/45">秒</span>
            </label>
            <label className="flex items-center gap-2 text-[13px] text-white/70">
              <span className="shrink-0">转场效果</span>
              <select
                value={transitionKind}
                disabled={settingsLocked}
                className={dockFieldSelectClass}
                onChange={(e) =>
                  setTransitionKind(e.target.value as JianyingMediaRenderTransitionKind)
                }
              >
                {TRANSITION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-[13px] text-white/70">
              <span className="shrink-0">输出画质</span>
              <select
                value={scaleMode}
                disabled={settingsLocked}
                className={dockFieldSelectClass}
                onChange={(e) => setScaleMode(e.target.value as MediaRenderScaleMode)}
              >
                {SCALE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {outputControls}
        </div>

        <div className="nodrag flex shrink-0 flex-col gap-2 border-t border-white/[0.06] bg-[#1a1a1f] px-4 py-2.5">
          {showProgress ? (
            <div className="shrink-0">{progressBlock}</div>
          ) : syncDismissed && doneUrl ? (
            <p className="shrink-0 text-center text-[12px] text-white/50">
              已停止等待云端；可下载本地成片，或点「重试云端同步」。
            </p>
          ) : null}
          {!ffmpegBusy ? (
            <div className="w-full shrink-0 text-center">{expiryHint}</div>
          ) : null}
          <div className="flex flex-wrap items-center justify-center gap-3">
            {renderBtnRow}
            {downloadBtn}
            {retryUploadBtn}
            {stopSyncBtn}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 pt-2">
      <p className="text-[10px] font-medium text-white/80">云端自动剪辑成片</p>
      <label className="flex items-center justify-between gap-2 text-[10px] text-white/60">
        <span>转场时长（秒）</span>
        <input
          type="number"
          min={0.2}
          max={2}
          step={0.1}
          value={transitionSec}
          disabled={settingsLocked || transitionKind === "none"}
          className="nodrag w-16 rounded border border-white/20 bg-black/30 px-2 py-1 text-white disabled:opacity-40"
          onChange={(e) => setTransitionSec(Number(e.target.value) || 0.6)}
        />
      </label>
      <label className="flex items-center justify-between gap-2 text-[10px] text-white/60">
        <span>转场效果</span>
        <select
          value={transitionKind}
          disabled={settingsLocked}
          className={fieldSelectClass}
          onChange={(e) => setTransitionKind(e.target.value as JianyingMediaRenderTransitionKind)}
        >
          {TRANSITION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center justify-between gap-2 text-[10px] text-white/60">
        <span>输出画质</span>
        <select
          value={scaleMode}
          disabled={settingsLocked}
          className={fieldSelectClass}
          onChange={(e) => setScaleMode(e.target.value as MediaRenderScaleMode)}
        >
          {SCALE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
      {outputControls}
      {renderBtnRow}
      {progressBlock}
      {expiryHint}
      {downloadBtn}
      {retryUploadBtn}
    </div>
  );
}
