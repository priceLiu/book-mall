"use client";

import { useState } from "react";
import { Clapperboard, Download } from "lucide-react";

import { useCanvasStore } from "@/lib/canvas/store";
import type { JianyingMediaRenderResult } from "@/lib/canvas/types";
import {
  type JianyingExportFrame,
  type MediaRenderJob,
  type MediaRenderScaleMode,
  submitMediaRender,
  waitMediaRenderJob,
} from "@/lib/canvas-api";

type Props = {
  nodeId: string;
  base: string | null;
  projectId: string | null;
  frames: JianyingExportFrame[];
  persisted?: JianyingMediaRenderResult | null;
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
  "nodrag w-[118px] rounded border border-white/20 bg-black/30 px-2 py-1 text-[10px] text-white";

export function JianyingMediaRenderActions({
  nodeId,
  base,
  projectId,
  frames,
  persisted,
}: Props) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
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

  const persistResult = (downloadUrl: string, expires: string) => {
    setDoneUrl(downloadUrl);
    setExpiresAt(expires);
    updateNodeData(nodeId, {
      mediaRenderResult: {
        downloadUrl,
        expiresAt: expires,
        completedAt: new Date().toISOString(),
      },
    });
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
    setDoneUrl(null);
    setExpiresAt(null);
    setProgress(0);
    setStepLabel("提交任务…");
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

  return (
    <div className="flex flex-col gap-2 border-t border-white/10 pt-2">
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
      <button
        type="button"
        disabled={busy || !canRender}
        className="nodrag flex items-center justify-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-600/20 px-3 py-2 text-[12px] text-emerald-100 hover:bg-emerald-600/30 disabled:opacity-50"
        onClick={() => void onRender()}
      >
        <Clapperboard className="size-4" />
        {busy ? "剪辑中…" : "自动剪辑成片（MP4）"}
      </button>
      {busy ? (
        <div className="nodrag flex flex-col gap-1.5 rounded-md border border-white/10 bg-black/20 px-2.5 py-2">
          <div className="flex items-center justify-between gap-2 text-[10px] text-white/75">
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
      ) : null}
      {expiresAt ? (
        <p className="text-[10px] text-amber-200/90">
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
        <p className="text-[10px] text-[var(--canvas-muted)]">
          默认保留 7 天限时下载，不入长期视频库。
        </p>
      )}
      {doneUrl ? (
        <a
          href={doneUrl}
          download
          target="_blank"
          rel="noreferrer"
          className="nodrag flex items-center justify-center gap-2 rounded-md bg-[var(--canvas-accent)] px-3 py-2 text-[12px] text-white hover:opacity-90"
        >
          <Download className="size-4" />
          下载成片 MP4
        </a>
      ) : null}
      {err ? <p className="text-[10px] text-red-300">{err}</p> : null}
    </div>
  );
}
