"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import {
  fetchQrGenerateJobRecords,
  refreshQrGenerateJob,
  type QrGenerateJobRecord,
} from "@/lib/run-qr-generate-job";
import type { QrGenerateJobResult } from "@/components/quick-replica/qr-workspace-panel";

const STATUS_LABEL: Record<QrGenerateJobRecord["status"], string> = {
  PENDING: "排队中",
  RUNNING: "生成中",
  SUCCEEDED: "已完成",
  FAILED: "失败",
};

type Props = {
  onOpenResult: (args: {
    logId: string;
    phase: "generating" | "success" | "failed";
    result: QrGenerateJobResult;
    previewImageUrl?: string;
  }) => void;
};

export function QrGenerateHistoryPanel({ onOpenResult }: Props) {
  const [jobs, setJobs] = useState<QrGenerateJobRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchQrGenerateJobRecords(50);
      setJobs(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRefresh = async (job: QrGenerateJobRecord) => {
    setRefreshingId(job.logId);
    try {
      const result = await refreshQrGenerateJob(job.logId);
      await load();
      onOpenResult({
        logId: job.logId,
        phase:
          result.status === "SUCCEEDED" && result.outputUrl
            ? "success"
            : result.status === "FAILED"
              ? "failed"
              : "generating",
        result,
        previewImageUrl: job.previewImageUrl,
      });
    } finally {
      setRefreshingId(null);
    }
  };

  const openJob = (job: QrGenerateJobRecord) => {
    const phase =
      job.status === "SUCCEEDED" && job.outputUrl
        ? "success"
        : job.status === "FAILED"
          ? "failed"
          : "generating";
    onOpenResult({
      logId: job.logId,
      phase,
      result: {
        status: job.status,
        outputUrl: job.outputUrl,
        error: job.error,
      },
      previewImageUrl: job.previewImageUrl,
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="qr-panel-header shrink-0">
        <span>生成记录</span>
        <button
          type="button"
          className="text-xs text-[var(--qr-text-muted)] hover:text-[var(--qr-brand)]"
          onClick={() => void load()}
        >
          刷新
        </button>
      </div>
      <div className="qr-scroll-panel min-h-0 flex-1 p-4">
        <p className="mb-4 text-sm text-[var(--qr-text-secondary)]">
          每次点「产生」都会留下记录。若弹层显示超时，可在此刷新或打开查看是否已生成完成。
        </p>
        {error ? (
          <p className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-[var(--qr-text-muted)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            加载中…
          </div>
        ) : jobs.length === 0 ? (
          <p className="text-sm text-[var(--qr-text-muted)]">暂无生成记录</p>
        ) : (
          <div className="space-y-2">
            {jobs.map((job) => (
              <div
                key={job.logId}
                className="flex gap-3 rounded-xl border border-[var(--qr-border)] p-3"
              >
                <div className="h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-zinc-900">
                  {job.previewImageUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={job.previewImageUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full bg-zinc-800" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-medium">{job.title}</p>
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${
                        job.status === "SUCCEEDED"
                          ? "bg-emerald-500/20 text-emerald-200"
                          : job.status === "FAILED"
                            ? "bg-red-500/20 text-red-200"
                            : "bg-sky-500/20 text-sky-200"
                      }`}
                    >
                      {STATUS_LABEL[job.status]}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--qr-text-muted)]">
                    {new Date(job.submittedAt).toLocaleString("zh-CN")} · {job.kind}
                  </p>
                  {job.error ? (
                    <p className="mt-1 line-clamp-2 text-xs text-red-300">{job.error}</p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="qr-btn-secondary px-2 py-1 text-xs"
                      onClick={() => openJob(job)}
                    >
                      {job.status === "SUCCEEDED" && job.outputUrl ? "播放" : "查看"}
                    </button>
                    {job.status !== "SUCCEEDED" || !job.outputUrl ? (
                      <button
                        type="button"
                        className="qr-btn-secondary inline-flex items-center gap-1 px-2 py-1 text-xs"
                        disabled={refreshingId === job.logId}
                        onClick={() => void handleRefresh(job)}
                      >
                        {refreshingId === job.logId ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3" />
                        )}
                        刷新状态
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
