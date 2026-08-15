"use client";

import { createPortal } from "react-dom";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { useEffect, useState } from "react";

import { useEcomTemplateImport } from "@/components/template-gallery/ecom-template-import-provider";
import {
  jobStats,
  isImportItemErrorMessage,
  listImportPanelItems,
  computeImportItemDisplayProgress,
  UPLOAD_DISPLAY_PROGRESS_CAP,
} from "@/lib/ecom-template-gallery/import-storage";
import { cn } from "@/lib/utils";

function formatElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m} 分 ${s} 秒` : `${s} 秒`;
}

function statusLabel(
  status: string,
  retryCount?: number,
  progress?: number,
  uploadStartedAt?: number,
): string {
  switch (status) {
    case "queued":
      return retryCount && retryCount > 0
        ? `排队重试 ${retryCount}`
        : "排队";
    case "uploading":
      if (progress != null && progress <= 8) return "等待重试";
      if (uploadStartedAt) {
        const elapsed = formatElapsed(Date.now() - uploadStartedAt);
        return progress != null && progress >= UPLOAD_DISPLAY_PROGRESS_CAP
          ? `等待服务端确认 · ${elapsed}`
          : `上传中 · ${elapsed}`;
      }
      return "上传中";
    case "success":
      return "成功";
    case "skipped":
      return "已存在";
    case "failed":
      return "失败";
    case "cancelled":
      return "已停止";
    default:
      return status;
  }
}

export function EcomTemplateImportPanel() {
  const {
    activeJob,
    panelOpen,
    setPanelOpen,
    resumeJob,
    stopJob,
    clearFinishedJobs,
  } = useEcomTemplateImport();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [, tick] = useState(0);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!activeJob) return;
    const hasUploading = activeJob.items.some((i) => i.status === "uploading");
    if (!hasUploading) return;
    const timer = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(timer);
  }, [activeJob]);

  if (!mounted || !activeJob) return null;

  const stats = jobStats(activeJob.items);
  const visibleItems = listImportPanelItems(activeJob.items);
  const completedShown = visibleItems.filter(
    (i) => i.status === "success" || i.status === "skipped",
  ).length;
  const completedTotal = stats.success + stats.skipped;
  const resumable =
    !activeJob.cancelled &&
    activeJob.items.some(
      (i) =>
        i.status === "queued" ||
        i.status === "uploading" ||
        i.status === "failed",
    );
  const stoppable = stats.pending > 0 && !activeJob.cancelled;
  const uploadingCount = activeJob.items.filter(
    (i) => i.status === "uploading",
  ).length;

  if (!panelOpen) {
    if (stats.pending === 0 && activeJob.done) return null;
    return createPortal(
      <button
        type="button"
        className="fixed bottom-4 right-4 z-[90] rounded-full border border-[#e8e8ed] bg-white px-4 py-2 text-xs font-medium text-[#1d1d1f] shadow-lg"
        onClick={() => setPanelOpen(true)}
      >
        模板导入 {stats.success + stats.skipped}/{stats.total}
        {stats.pending > 0 ? " · 进行中" : ""}
      </button>,
      document.body,
    );
  }

  return createPortal(
    <div
      className="fixed bottom-4 right-4 z-[90] w-[min(100vw-2rem,380px)] overflow-hidden rounded-xl border border-[#e8e8ed] bg-white shadow-lg"
    >
      <div className="flex items-center justify-between border-b border-[#e8e8ed] bg-[#f5f5f7] px-3 py-2">
        <div>
          <p className="text-xs font-semibold text-[#1d1d1f]">模板导入</p>
          <p className="text-[10px] text-[#6e6e73]">
            成功 {stats.success} · 已存在 {stats.skipped} · 失败 {stats.failed}
            {stats.cancelled > 0 ? ` · 已停止 ${stats.cancelled}` : ""} /{" "}
            {stats.total}
            {stats.pending > 0
              ? uploadingCount > 0
                ? ` · ${Math.min(uploadingCount, 3)} 路上传中 · 排队 ${Math.max(0, stats.pending - uploadingCount)}`
                : ` · 排队 ${stats.pending}`
              : null}
            {stats.pending > 0 ? " · 单条约 3～5 分钟" : null}
            {completedTotal > completedShown
              ? ` · 已完成 ${completedTotal}（列表展示最近 ${completedShown} 条）`
              : null}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded p-1 text-[#6e6e73] hover:bg-white"
            aria-label={collapsed ? "展开" : "折叠"}
            onClick={() => setCollapsed((v) => !v)}
          >
            {collapsed ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            className="rounded p-1 text-[#6e6e73] hover:bg-white"
            aria-label="关闭面板"
            onClick={() => setPanelOpen(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!collapsed ? (
        <ul className="max-h-64 overflow-y-auto p-2">
          {visibleItems.length === 0 ? (
            <li className="rounded-lg border border-dashed border-[#e8e8ed] px-3 py-6 text-center text-xs text-[#6e6e73]">
              暂无条目
            </li>
          ) : (
            visibleItems.map((item) => {
              const displayProgress = computeImportItemDisplayProgress(item);
              return (
            <li
              key={item.id}
              className="mb-2 rounded-lg border border-[#e8e8ed] p-2 last:mb-0"
            >
              <div className="flex gap-2">
                <div className="h-10 w-8 shrink-0 overflow-hidden rounded bg-[#f5f5f7]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.thumbPreview}
                    alt=""
                    className="size-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-medium text-[#1d1d1f]">
                    {item.title}
                  </p>
                  <p className="truncate text-[10px] text-[#6e6e73]">{item.id}</p>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "text-[10px]",
                        item.status === "failed"
                          ? "text-[#ff3b30]"
                          : item.status === "success"
                            ? "text-[#0071e3]"
                            : item.status === "skipped"
                              ? "text-[#86868b]"
                              : "text-[#6e6e73]",
                      )}
                    >
                      {statusLabel(
                        item.status,
                        item.retryCount,
                        displayProgress,
                        item.uploadStartedAt,
                      )}
                    </span>
                    <span className="text-[10px] text-[#86868b]">
                      {displayProgress}%
                    </span>
                  </div>
                  <div className="ecom-upload-progress mt-1 h-1">
                    <div
                      className="ecom-upload-progress-bar h-full bg-[#0071e3]"
                      style={{ width: `${displayProgress}%` }}
                    />
                  </div>
                  {item.error && isImportItemErrorMessage(item) ? (
                    <p className="mt-1 line-clamp-2 text-[10px] text-[#ff3b30]">
                      {item.error}
                    </p>
                  ) : null}
                </div>
              </div>
            </li>
            );
            })
          )}
        </ul>
      ) : null}

      <div className="flex gap-2 border-t border-[#e8e8ed] px-2 py-2">
        {stoppable ? (
          <button
            type="button"
            className="flex-1 rounded-lg border border-[#ff3b30] px-2 py-1.5 text-xs font-medium text-[#ff3b30]"
            onClick={() => stopJob(activeJob.id)}
          >
            停止上传
          </button>
        ) : null}
        {resumable ? (
          <button
            type="button"
            className="flex-1 rounded-lg border border-[#0071e3] px-2 py-1.5 text-xs text-[#0071e3]"
            onClick={() => resumeJob(activeJob.id)}
          >
            {activeJob.done ? "继续未完成" : "恢复上传"}
          </button>
        ) : null}
        {activeJob.done && !resumable ? (
          <button
            type="button"
            className="flex-1 rounded-lg border border-[#e8e8ed] px-2 py-1.5 text-xs text-[#6e6e73]"
            onClick={clearFinishedJobs}
          >
            清除记录
          </button>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
