"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Clapperboard, Download } from "lucide-react";

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
  friendlyMediaRenderError,
  isMediaRenderJobInflight,
  isMediaRenderJobPolling,
  pollMediaRenderJobUntilDone,
  renderStatusLabel,
  type JianyingMediaRenderInFlight,
  type JianyingMediaRenderTransitionKind,
} from "@/lib/canvas/media-render-in-flight";
import type { JianyingLibtvClipSlot } from "@/lib/canvas/jianying-from-workspace";
import { cn } from "@/lib/utils";
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
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const addNode = useCanvasStore((s) => s.addNode);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const setEdges = useCanvasStore((s) => s.setEdges);

  const [transitionKind, setTransitionKind] = useState<JianyingMediaRenderTransitionKind>(
    inFlight?.transitionKind ?? "xfade",
  );
  const [transitionSec, setTransitionSec] = useState(inFlight?.transitionSec ?? 0.6);
  const [scaleMode, setScaleMode] = useState<MediaRenderScaleMode>(
    inFlight?.scaleMode ?? "fit1080p",
  );
  const [burnIn, setBurnIn] = useState(inFlight?.burnIn ?? false);
  const [err, setErr] = useState<string | null>(
    inFlight?.status === "FAILED" && inFlight.errorMessage
      ? friendlyMediaRenderError(inFlight.errorMessage)
      : null,
  );
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
  const [busy, setBusy] = useState(() => isMediaRenderJobInflight(inFlight));

  const settingsRef = useRef({
    transitionKind,
    transitionSec,
    scaleMode,
    burnIn,
  });
  const downloadableRef = useRef<string | null>(doneUrl);
  settingsRef.current = { transitionKind, transitionSec, scaleMode, burnIn };

  const videoFrames = frames.filter((f) => f.videoUrl);
  const canRender = Boolean(base && projectId && videoFrames.length >= 1);
  const isDock = layout === "dock";

  useEffect(() => {
    if (isMediaRenderJobInflight(inFlight)) {
      setBusy(true);
      setProgress(inFlight?.progress ?? 0);
      setStepLabel(inFlight?.progressLabel?.trim() || "处理中…");
      setErr(null);
      if (inFlight?.transitionKind) setTransitionKind(inFlight.transitionKind);
      if (typeof inFlight?.transitionSec === "number") {
        setTransitionSec(inFlight.transitionSec);
      }
      if (inFlight?.scaleMode) setScaleMode(inFlight.scaleMode);
      if (typeof inFlight?.burnIn === "boolean") setBurnIn(inFlight.burnIn);
      return;
    }
    if (inFlight?.status === "FAILED" && inFlight.errorMessage) {
      setErr(friendlyMediaRenderError(inFlight.errorMessage));
      setBusy(false);
      setProgress(null);
      setStepLabel(null);
      return;
    }
    if (!busy) {
      setProgress(null);
      setStepLabel(null);
    }
  }, [inFlight, busy]);

  useEffect(() => {
    setDoneUrl(persisted?.downloadUrl ?? null);
    setExpiresAt(persisted?.expiresAt ?? null);
  }, [persisted?.downloadUrl, persisted?.expiresAt]);

  const patchInFlight = useCallback(
    (patch: JianyingMediaRenderInFlight | null) => {
      updateNodeData(nodeId, { mediaRenderInFlight: patch });
    },
    [nodeId, updateNodeData],
  );

  const persistResult = useCallback(
    (downloadUrl: string, expires: string, poster?: string | null) => {
      const posterUrl = poster?.trim() || undefined;
      setDoneUrl(downloadUrl);
      setExpiresAt(expires);
      updateNodeData(nodeId, {
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
      });
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
      setProgress(job.progress);
      setStepLabel(renderStatusLabel(job));
      const localUrl = base ? resolveMediaRenderDownloadUrl(base, job) : null;
      if (localUrl) {
        setDoneUrl(localUrl);
        downloadableRef.current = localUrl;
        if (job.uploadFailed) {
          setUploadFailed(true);
          setErr(
            friendlyMediaRenderError(job.errorMessage ?? "云端上传失败，可重试"),
          );
        } else if (job.status === "RUNNING" && job.localDownloadPath) {
          setUploadFailed(false);
          setErr(null);
          setStepLabel("剪辑完成，云端同步中…");
        }
      }
      if (job.status === "PENDING" || job.status === "RUNNING") {
        const settings = settingsRef.current;
        patchInFlight({
          jobId: job.id,
          status: inflightStatus(job),
          progress: job.progress,
          progressLabel: job.progressLabel ?? null,
          errorMessage: job.uploadFailed
            ? job.errorMessage ?? "云端上传失败，可重试"
            : null,
          transitionKind: settings.transitionKind,
          transitionSec: settings.transitionSec,
          scaleMode: settings.scaleMode,
          burnIn: settings.burnIn,
        });
      }
    },
    [base, patchInFlight],
  );

  const finishJob = useCallback(
    async (finalJob: MediaRenderJob) => {
      const downloadUrl = base
        ? resolveMediaRenderDownloadUrl(base, finalJob)
        : finalJob.downloadUrl;
      if (finalJob.uploadFailed && downloadUrl) {
        setDoneUrl(downloadUrl);
        setUploadFailed(true);
        setErr(
          friendlyMediaRenderError(finalJob.errorMessage ?? "云端上传失败，可重试"),
        );
        setProgress(finalJob.progress);
        setStepLabel("剪辑完成，云端同步失败");
        patchInFlight({
          jobId: finalJob.id,
          status: "RUNNING",
          progress: finalJob.progress,
          progressLabel: finalJob.progressLabel ?? null,
          errorMessage: finalJob.errorMessage ?? "云端上传失败，可重试",
          ...settingsRef.current,
        });
        return;
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
        setErr(message);
        return;
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
      setErr(null);
    },
    [base, patchInFlight, persistResult],
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
      await finishJob(finalJob);
    },
    [applyJobProgress, base, finishJob, nodeId],
  );

  useEffect(() => {
    if (!base || !isMediaRenderJobInflight(inFlight)) return;
    const jobId = inFlight!.jobId.trim();
    if (!jobId || isMediaRenderJobPolling(nodeId, jobId)) return;

    let cancelled = false;
    setBusy(true);
    void runTrackedJob(jobId)
      .catch((e) => {
        if (cancelled) return;
        const message = friendlyMediaRenderError(
          e instanceof Error ? e.message : String(e),
        );
        if (downloadableRef.current || doneUrl) {
          setErr(message);
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
        setErr(message);
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
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
  ]);

  const onRender = async () => {
    if (!canRender) {
      setErr("请至少完成 1 镜视频后再自动剪辑");
      return;
    }
    setBusy(true);
    setErr(null);
    if (!spawnPreview) {
      setProgress(0);
      setStepLabel("提交任务…");
    } else {
      setDoneUrl(null);
      setExpiresAt(null);
      setProgress(0);
      setStepLabel("提交任务…");
    }
    try {
      const transition =
        transitionKind === "xfade"
          ? ({ type: "xfade" as const, durationSec: transitionSec })
          : ({ type: "none" as const });
      const job = await submitMediaRender(base!, projectId!, {
        frames: videoFrames,
        profile: {
          transition,
          subtitle: { mode: "script", burnIn },
          video: { scaleMode },
        },
      });
      applyJobProgress(job);
      await runTrackedJob(job.id);
    } catch (e) {
      const message = friendlyMediaRenderError(
        e instanceof Error ? e.message : String(e),
      );
      patchInFlight(null);
      setErr(message);
    } finally {
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
    const jobId = inFlight?.jobId?.trim();
    if (!base || !jobId) return;
    setBusy(true);
    setUploadFailed(false);
    setErr(null);
    try {
      const job = await retryMediaRenderUpload(base, jobId);
      applyJobProgress(job);
      await runTrackedJob(jobId);
    } catch (e) {
      setErr(
        friendlyMediaRenderError(e instanceof Error ? e.message : String(e)),
      );
    } finally {
      setBusy(false);
    }
  };

  const ffmpegBusy = busy && !doneUrl;
  const syncBusy = busy && Boolean(doneUrl);

  const progressBlock = busy ? (
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
      disabled={ffmpegBusy || !canRender}
      className={cn(
        "nodrag inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-600/20 px-5 py-2 text-[13px] font-medium text-emerald-100 transition hover:bg-emerald-600/30 disabled:opacity-50",
        isDock ? "h-9 shrink-0 whitespace-nowrap" : "w-full",
      )}
      onClick={() => void onRender()}
    >
      <Clapperboard className="size-4 shrink-0" />
      {ffmpegBusy ? "剪辑中…" : "自动剪辑成片（MP4）"}
    </button>
  );

  const retryUploadBtn =
    uploadFailed && inFlight?.jobId ? (
      <button
        type="button"
        disabled={busy}
        className={cn(
          "nodrag inline-flex items-center justify-center gap-2 rounded-lg border border-amber-500/40 bg-amber-600/15 px-4 py-2 text-[13px] font-medium text-amber-100 transition hover:bg-amber-600/25 disabled:opacity-50",
          isDock ? "h-9 shrink-0 whitespace-nowrap" : "w-full",
        )}
        onClick={() => void onRetryUpload()}
      >
        重试云端同步
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
      {syncBusy ? "下载 / 打开成片" : "下载成片 MP4"}
    </a>
  ) : null;

  if (isDock) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-2 px-4 py-2.5 text-[13px] text-white/80">
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
            disabled={busy}
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
              disabled={busy || transitionKind === "none"}
              className="nodrag h-8 w-[68px] rounded-md border border-white/20 bg-black/30 px-2 text-[13px] text-white disabled:opacity-40"
              onChange={(e) => setTransitionSec(Number(e.target.value) || 0.6)}
            />
            <span className="text-[12px] text-white/45">秒</span>
          </label>
          <label className="flex items-center gap-2 text-[13px] text-white/70">
            <span className="shrink-0">转场效果</span>
            <select
              value={transitionKind}
              disabled={busy}
              className={dockFieldSelectClass}
              onChange={(e) => setTransitionKind(e.target.value as JianyingMediaRenderTransitionKind)}
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
              disabled={busy}
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
          <label className="nodrag flex items-center gap-2 text-[13px] text-white/70">
            <input
              type="checkbox"
              checked={burnIn}
              disabled={busy}
              onChange={(e) => setBurnIn(e.target.checked)}
            />
            烧录台词字幕
          </label>
        </div>

        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2.5 px-2">
          <div className="flex flex-wrap items-center justify-center gap-3">
            {renderBtn}
            {downloadBtn}
            {retryUploadBtn}
          </div>
          {!ffmpegBusy ? (
            <div className="w-full max-w-[640px] shrink-0 text-center">{expiryHint}</div>
          ) : null}
        </div>

        {busy ? (
          <div className="shrink-0 px-1 pb-1">{progressBlock}</div>
        ) : null}
        {err ? (
          <p className="shrink-0 px-2 pb-1 text-center text-[12px] text-red-300">{err}</p>
        ) : null}
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
          disabled={busy || transitionKind === "none"}
          className="nodrag w-16 rounded border border-white/20 bg-black/30 px-2 py-1 text-white disabled:opacity-40"
          onChange={(e) => setTransitionSec(Number(e.target.value) || 0.6)}
        />
      </label>
      <label className="flex items-center justify-between gap-2 text-[10px] text-white/60">
        <span>转场效果</span>
        <select
          value={transitionKind}
          disabled={busy}
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
          disabled={busy}
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
      <label className="nodrag flex items-center gap-2 text-[10px] text-white/60">
        <input
          type="checkbox"
          checked={burnIn}
          disabled={busy}
          onChange={(e) => setBurnIn(e.target.checked)}
        />
        烧录台词字幕
      </label>
      {renderBtn}
      {progressBlock}
      {expiryHint}
      {downloadBtn}
      {retryUploadBtn}
      {err ? <p className="text-[10px] text-red-300">{err}</p> : null}
    </div>
  );
}
