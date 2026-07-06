"use client";

import { useState } from "react";
import { Clapperboard, Download } from "lucide-react";

import { useCanvasStore } from "@/lib/canvas/store";
import type { JianyingMediaRenderResult } from "@/lib/canvas/types";
import { spawnJianyingRenderPreviewNode } from "@/lib/canvas/spawn-jianying-render-preview";
import {
  type JianyingExportFrame,
  type MediaRenderJob,
  type MediaRenderScaleMode,
  submitMediaRender,
  waitMediaRenderJob,
} from "@/lib/canvas-api";
import { cn } from "@/lib/utils";

type Props = {
  nodeId: string;
  base: string | null;
  projectId: string | null;
  frames: JianyingExportFrame[];
  persisted?: JianyingMediaRenderResult | null;
  /** false = 成片留在当前节点，不另 spawn video-preview */
  spawnPreview?: boolean;
  layout?: "default" | "dock";
  connectedCount?: number;
  renderedCount?: number;
};

type TransitionKind = "xfade" | "none";

const SCALE_OPTIONS: { value: MediaRenderScaleMode; label: string }[] = [
  { value: "source", label: "原片（不缩放）" },
  { value: "fit720p", label: "720P" },
  { value: "fit1080p", label: "1080P" },
];

const TRANSITION_OPTIONS: { value: TransitionKind; label: string }[] = [
  { value: "xfade", label: "交叉淡化" },
  { value: "none", label: "无转场" },
];

function renderStatusLabel(job: MediaRenderJob | null): string {
  if (!job) return "提交任务…";
  if (job.status === "PENDING") {
    return job.progressLabel?.trim() || "排队中…";
  }
  if (job.progressLabel?.trim()) return job.progressLabel.trim();
  if (job.progress > 0) return `处理中… ${job.progress}%`;
  return "处理中…";
}

const fieldSelectClass =
  "nodrag h-8 min-w-0 flex-1 rounded-md border border-white/20 bg-black/30 px-2.5 text-[13px] text-white";

const dockFieldSelectClass =
  "nodrag h-8 w-[132px] shrink-0 rounded-md border border-white/20 bg-black/30 px-2.5 text-[13px] text-white";

export function JianyingMediaRenderActions({
  nodeId,
  base,
  projectId,
  frames,
  persisted,
  spawnPreview = true,
  layout = "default",
  connectedCount = 0,
  renderedCount = 0,
}: Props) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const addNode = useCanvasStore((s) => s.addNode);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const [busy, setBusy] = useState(false);
  const [transitionKind, setTransitionKind] = useState<TransitionKind>("xfade");
  const [transitionSec, setTransitionSec] = useState(0.6);
  const [scaleMode, setScaleMode] = useState<MediaRenderScaleMode>("fit1080p");
  const [burnIn, setBurnIn] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [doneUrl, setDoneUrl] = useState<string | null>(
    persisted?.downloadUrl ?? null,
  );
  const [expiresAt, setExpiresAt] = useState<string | null>(
    persisted?.expiresAt ?? null,
  );
  const [progress, setProgress] = useState<number | null>(null);
  const [stepLabel, setStepLabel] = useState<string | null>(null);

  const videoFrames = frames.filter((f) => f.videoUrl);
  const canRender = Boolean(base && projectId && videoFrames.length >= 1);
  const isDock = layout === "dock";

  const persistResult = (downloadUrl: string, expires: string) => {
    setDoneUrl(downloadUrl);
    setExpiresAt(expires);
    updateNodeData(nodeId, {
      videoUrl: downloadUrl,
      mediaRenderResult: {
        downloadUrl,
        expiresAt: expires,
        completedAt: new Date().toISOString(),
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
  };

  const applyJobProgress = (job: MediaRenderJob) => {
    setProgress(job.progress);
    setStepLabel(renderStatusLabel(job));
  };

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
      const finalJob = await waitMediaRenderJob(base!, job.id, {
        onPoll: applyJobProgress,
      });
      if (finalJob.status !== "SUCCEEDED" || !finalJob.downloadUrl) {
        throw new Error(finalJob.errorMessage ?? "云端剪辑失败");
      }
      persistResult(finalJob.downloadUrl, finalJob.expiresAt);
      setProgress(100);
      setStepLabel("剪辑完成");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
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
      disabled={busy || !canRender}
      className={cn(
        "nodrag inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-600/20 px-5 py-2 text-[13px] font-medium text-emerald-100 transition hover:bg-emerald-600/30 disabled:opacity-50",
        isDock ? "h-9 shrink-0 whitespace-nowrap" : "w-full",
      )}
      onClick={() => void onRender()}
    >
      <Clapperboard className="size-4 shrink-0" />
      {busy ? "剪辑中…" : "自动剪辑成片（MP4）"}
    </button>
  );

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
      下载成片 MP4
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
              onChange={(e) => setTransitionKind(e.target.value as TransitionKind)}
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
          </div>
          <div className="w-full max-w-[640px] text-center">
            {progressBlock ?? expiryHint}
          </div>
          {err ? <p className="text-center text-[12px] text-red-300">{err}</p> : null}
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
          onChange={(e) => setTransitionKind(e.target.value as TransitionKind)}
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
      {err ? <p className="text-[10px] text-red-300">{err}</p> : null}
    </div>
  );
}
