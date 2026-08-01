"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Clapperboard, Download } from "lucide-react";

import { useDialogs } from "@/components/dialogs/dialog-provider";
import { useCanvasStore } from "@/lib/canvas/store";
import type { JianyingMediaRenderResult } from "@/lib/canvas/types";
import { spawnJianyingRenderPreviewNode } from "@/lib/canvas/spawn-jianying-render-preview";
import {
  type JianyingExportFrame,
  type MediaRenderJob,
  type MediaRenderScaleMode,
  resolveMediaRenderDownloadUrl,
  retryMediaRenderUpload,
  submitMediaRender,
} from "@/lib/canvas-api";
import {
  clearMediaRenderPollDismiss,
  dismissMediaRenderPoll,
  friendlyMediaRenderError,
  isMediaRenderJobInflight,
  isMediaRenderJobPolling,
  isMediaRenderPollDismissed,
  pollMediaRenderJobUntilDone,
  renderStatusLabel,
  type JianyingMediaRenderInFlight,
  type JianyingMediaRenderTransitionKind,
} from "@/lib/canvas/media-render-in-flight";
import type { JianyingLibtvClipSlot } from "@/lib/canvas/jianying-from-workspace";
import {
  preserveAutoRenderNodeMediaFitPatch,
  scheduleAutoRenderParentGroupRelayout,
} from "@/lib/canvas/jianying-auto-render-layout";
import { cn } from "@/lib/utils";
import { useGatewayLinkStatus } from "@/lib/canvas/use-gateway-link-status";
import { JianyingClipOrderStrip } from "./jianying-clip-order-strip";

type Props = {
  nodeId: string;
  base: string | null;
  projectId: string | null;
  frames: JianyingExportFrame[];
  clipSlots?: JianyingLibtvClipSlot[];
  clipOrderNodeIds?: string[];
  onClipOrderChange?: (orderNodeIds: string[]) => void;
  persisted?: JianyingMediaRenderResult | null;
  inFlight?: JianyingMediaRenderInFlight | null;
  /** false = 成片留在当前节点，不另 spawn video-preview */
  spawnPreview?: boolean;
  layout?: "default" | "dock";
  connectedCount?: number;
  renderedCount?: number;
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
  persisted,
  inFlight,
  spawnPreview = true,
  layout = "default",
  connectedCount = 0,
  renderedCount = 0,
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
  const [burnIn, setBurnIn] = useState(inFlight?.burnIn ?? false);
  const [subtitleMode, setSubtitleMode] = useState<"script" | "asr">(
    inFlight?.subtitleMode ?? "script",
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
  const [busy, setBusy] = useState(() => isMediaRenderJobInflight(inFlight));

  const settingsRef = useRef({
    transitionKind,
    transitionSec,
    scaleMode,
    burnIn,
    subtitleMode,
  });
  const downloadableRef = useRef<string | null>(doneUrl);
  const syncDismissedRef = useRef(false);
  /** 停止等待后仍保留 jobId，供「重试云端同步」；不写回 inFlight 以免恢复轮询 */
  const stoppedJobIdRef = useRef<string | null>(null);
  settingsRef.current = {
    transitionKind,
    transitionSec,
    scaleMode,
    burnIn,
    subtitleMode,
  };

  const videoFrames = frames.filter((f) => f.videoUrl);
  const canRender = Boolean(base && projectId && videoFrames.length >= 1);
  const isDock = layout === "dock";

  const patchInFlight = useCallback(
    (patch: JianyingMediaRenderInFlight | null) => {
      updateNodeData(nodeId, { mediaRenderInFlight: patch });
    },
    [nodeId, updateNodeData],
  );

  useEffect(() => {
    syncDismissedRef.current = syncDismissed;
  }, [syncDismissed]);

  useEffect(() => {
    if (isMediaRenderJobInflight(inFlight)) {
      if (!syncDismissedRef.current) {
        setBusy(true);
        setProgress(inFlight?.progress ?? 0);
        setStepLabel(inFlight?.progressLabel?.trim() || "处理中…");
      }
      if (inFlight?.transitionKind) setTransitionKind(inFlight.transitionKind);
      if (typeof inFlight?.transitionSec === "number") {
        setTransitionSec(inFlight.transitionSec);
      }
      if (inFlight?.scaleMode) setScaleMode(inFlight.scaleMode);
      if (typeof inFlight?.burnIn === "boolean") setBurnIn(inFlight.burnIn);
      if (inFlight?.subtitleMode) setSubtitleMode(inFlight.subtitleMode);
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
    (downloadUrl: string, expires: string, poster?: string | null) => {
      const posterUrl = poster?.trim() || undefined;
      setDoneUrl(downloadUrl);
      setExpiresAt(expires);
      updateNodeData(nodeId, {
        ...preserveAutoRenderNodeMediaFitPatch(nodeId, {
          videoUrl: downloadUrl,
          posterUrl,
          mediaRenderInFlight: null,
          mediaFit: false,
          mediaFitKey: undefined,
          mediaRenderResult: {
            downloadUrl,
            expiresAt: expires,
            completedAt: new Date().toISOString(),
            ...(posterUrl ? { posterUrl } : {}),
          },
        }),
      });
      scheduleAutoRenderParentGroupRelayout(nodeId);
      if (spawnPreview) {
        const state = useCanvasStore.getState();
        spawnJianyingRenderPreviewNode(nodeId, downloadUrl, {
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
        setProgress(job.progress);
      }
      const localUrl = base ? resolveMediaRenderDownloadUrl(base, job) : null;
      const localReady = Boolean(localUrl && job.localDownloadPath?.trim());
      if (localUrl) {
        setDoneUrl(localUrl);
        downloadableRef.current = localUrl;
        if (!spawnPreview) {
          // 剪辑完成立刻刷新节点预览；OSS 上传在后台继续，勿等 SUCCEEDED
          updateNodeData(nodeId, {
            ...preserveAutoRenderNodeMediaFitPatch(nodeId, {
              videoUrl: localUrl,
              mediaRenderResult: null,
              mediaFit: false,
              mediaFitKey: undefined,
              ...(job.posterUrl?.trim()
                ? { posterUrl: job.posterUrl.trim() }
                : { posterUrl: undefined }),
            }),
          });
          scheduleAutoRenderParentGroupRelayout(nodeId);
        }
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
        setStepLabel(renderStatusLabel(job));
      }
      if (job.status === "PENDING" || job.status === "RUNNING") {
        const settings = settingsRef.current;
        patchInFlight({
          jobId: job.id,
          status: inflightStatus(job),
          progress: job.progress,
          // 本地成片已就绪：进度只在 Dock 展示，节点不写上传文案
          progressLabel: localReady ? null : (job.progressLabel ?? null),
          errorMessage: job.uploadFailed
            ? job.errorMessage ?? "云端上传失败，可重试"
            : null,
          transitionKind: settings.transitionKind,
          transitionSec: settings.transitionSec,
          scaleMode: settings.scaleMode,
          burnIn: settings.burnIn,
          subtitleMode: settings.subtitleMode,
        });
      }
    },
    [base, nodeId, patchInFlight, spawnPreview, updateNodeData],
  );

  const finishJob = useCallback(
    async (finalJob: MediaRenderJob): Promise<"succeeded" | "upload_failed" | "failed"> => {
      if (isMediaRenderPollDismissed(nodeId, finalJob.id)) {
        return "upload_failed";
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
          updateNodeData(nodeId, {
            videoUrl: downloadUrl,
            ...(finalJob.posterUrl?.trim()
              ? { posterUrl: finalJob.posterUrl.trim() }
              : {}),
          });
        }
        patchInFlight({
          jobId: finalJob.id,
          status: "RUNNING",
          progress: finalJob.progress,
          progressLabel: finalJob.progressLabel ?? null,
          errorMessage: finalJob.errorMessage ?? "云端上传失败，可重试",
          ...settingsRef.current,
        });
        return "upload_failed";
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
        return "failed";
      }
      persistResult(
        downloadUrl,
        finalJob.expiresAt,
        finalJob.posterUrl,
      );
      downloadableRef.current = downloadUrl;
      setProgress(100);
      setStepLabel("剪辑完成");
      setUploadFailed(false);
      return "succeeded";
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
        if (outcome === "failed" && !downloadableRef.current) {
          void showRenderError(
            "云端剪辑失败，请稍后重试；若多次失败请刷新页面后再试。",
          );
        }
      })
      .catch((e) => {
        if (cancelled || isMediaRenderPollDismissed(nodeId, jobId)) return;
        const message = friendlyMediaRenderError(
          e instanceof Error ? e.message : String(e),
        );
        if (downloadableRef.current || doneUrl) {
          setUploadFailed(true);
          setStepLabel("云端同步中断，可重试");
          patchInFlight({
            jobId,
            status: "RUNNING",
            progress: inFlight?.progress ?? progress ?? 90,
            progressLabel: null,
            errorMessage: message,
            ...settingsRef.current,
          });
          return;
        }
        patchInFlight({
          jobId,
          status: "FAILED",
          progress: inFlight?.progress ?? 0,
          progressLabel: inFlight?.progressLabel ?? null,
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
  }, [
    base,
    inFlight?.jobId,
    inFlight?.status,
    nodeId,
    patchInFlight,
    runTrackedJob,
    inFlight?.progress,
    inFlight?.progressLabel,
    doneUrl,
    progress,
    showRenderError,
  ]);

  const onRender = async () => {
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
    if (burnIn && subtitleMode === "asr" && gatewayBlocked) {
      await dialogs.alert({
        title: "无法提交",
        message: gatewayAccountUrl
          ? `语音识别烧字幕须先关联 Gateway API Key。请前往主站账号页关联后再试。\n${gatewayAccountUrl}`
          : "语音识别烧字幕须先关联 Gateway API Key，请刷新页面后重试。",
        variant: "warning",
      });
      return;
    }

    clearMediaRenderPollDismiss(nodeId);
    stoppedJobIdRef.current = null;
    setUploadFailed(false);
    setSyncDismissed(false);
    syncDismissedRef.current = false;
    setBusy(true);
    setDoneUrl(null);
    setExpiresAt(null);
    setProgress(0);
    setStepLabel("提交任务…");
    // 立刻写入 inFlight（progressLabel 非空 → 节点扫光）；旧成片保留作底，本地成片就绪后再替换
    updateNodeData(nodeId, {
      mediaRenderInFlight: {
        jobId: "pending",
        status: "PENDING",
        progress: 0,
        progressLabel: "提交任务…",
        transitionKind,
        transitionSec,
        scaleMode,
        burnIn,
        subtitleMode,
      },
    });
    try {
      const transition =
        transitionKind === "xfade"
          ? ({ type: "xfade" as const, durationSec: transitionSec })
          : ({ type: "none" as const });
      const job = await submitMediaRender(base, projectId, {
        frames: videoFrames,
        profile: {
          transition,
          subtitle: {
            mode: burnIn ? subtitleMode : "none",
            burnIn,
          },
          video: { scaleMode },
        },
      });
      if (isMediaRenderPollDismissed(nodeId, job.id)) return;
      applyJobProgress(job);
      const outcome = await runTrackedJob(job.id);
      if (isMediaRenderPollDismissed(nodeId, job.id)) return;
      if (outcome === "failed") {
        await showRenderError("云端剪辑失败，请稍后重试；若多次失败请刷新页面后再试。");
      }
    } catch (e) {
      if (syncDismissedRef.current) return;
      const message = friendlyMediaRenderError(
        e instanceof Error ? e.message : String(e),
      );
      patchInFlight(null);
      await showRenderError(message);
    } finally {
      if (!syncDismissedRef.current) setBusy(false);
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
      if (outcome === "upload_failed") {
        setUploadFailed(true);
        setStepLabel("云端同步失败，可重试");
      } else if (outcome === "failed") {
        await showRenderError("云端同步失败，请稍后重试。");
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

  const ffmpegBusy = busy && !doneUrl;
  const backgroundSync =
    Boolean(doneUrl) &&
    isMediaRenderJobInflight(inFlight) &&
    !uploadFailed &&
    !syncDismissed;
  const settingsLocked = ffmpegBusy;
  const retryJobId =
    inFlight?.jobId?.trim() || stoppedJobIdRef.current?.trim() || "";
  const showRetryUpload =
    Boolean(retryJobId) &&
    Boolean(doneUrl) &&
    (uploadFailed || backgroundSync || syncDismissed);
  const showProgress = (ffmpegBusy || backgroundSync) && !syncDismissed;

  const onStopBackgroundSync = () => {
    const jobId = inFlight?.jobId?.trim() || null;
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
    // 清空进行中标记，避免恢复轮询把 Dock 锁死 / 弹失败框
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
      {ffmpegBusy ? "剪辑中…" : "自动剪辑成片（MP4）"}
    </button>
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
          onStopBackgroundSync();
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

  const burnInControls = (
    <div
      className={cn(
        "nodrag shrink-0",
        isDock
          ? "border-t border-white/[0.06] pt-2"
          : "border-t border-white/10 pt-2",
      )}
    >
      <label
        className={cn(
          "flex items-center gap-2 text-white/70",
          isDock ? "text-[13px]" : "text-[10px]",
        )}
      >
        <input
          type="checkbox"
          checked={burnIn}
          disabled={settingsLocked}
          onChange={(e) => setBurnIn(e.target.checked)}
        />
        烧录台词字幕
      </label>
      {burnIn ? (
        <fieldset
          className={cn(
            "mt-1.5 space-y-1 border-0 p-0",
            isDock ? "pl-6 text-[13px] text-white/75" : "pl-5 text-[10px] text-white/60",
          )}
        >
          <legend className="sr-only">字幕来源</legend>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              checked={subtitleMode === "script"}
              disabled={settingsLocked}
              onChange={() => setSubtitleMode("script")}
            />
            分镜对白（脚本表）
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              checked={subtitleMode === "asr"}
              disabled={settingsLocked}
              onChange={() => setSubtitleMode("asr")}
            />
            从视频音频识别（ASR）
          </label>
        </fieldset>
      ) : null}
    </div>
  );

  if (isDock) {
    return (
      <div className="flex h-full min-h-0 flex-col text-[13px] text-white/80">
        <div className="nodrag flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-4 py-2.5">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.06] pb-1.5">
            <p className="text-[13px] text-white/70">
              已连接 <strong className="text-white">{connectedCount}</strong>
              {" · "}
              可剪辑 <strong className="text-white">{renderedCount}</strong>
            </p>
            <p className="text-[13px] font-medium text-white/90">云端自动剪辑成片</p>
          </div>

          {clipSlots.length > 0 && onClipOrderChange ? (
            <JianyingClipOrderStrip
              slots={clipSlots}
              orderNodeIds={clipOrderNodeIds}
              disabled={settingsLocked}
              onOrderChange={onClipOrderChange}
              className="shrink-0 border-b border-white/[0.06] pb-2"
            />
          ) : null}

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

          {burnInControls}
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
            {renderBtn}
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
      {burnInControls}
      {renderBtn}
      {progressBlock}
      {expiryHint}
      {downloadBtn}
      {retryUploadBtn}
    </div>
  );
}
