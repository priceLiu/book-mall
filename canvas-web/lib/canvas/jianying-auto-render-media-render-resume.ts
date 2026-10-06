"use client";

import { useCallback, useEffect, useRef } from "react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import {
  pollMediaRender,
  resolveMediaRenderDownloadUrl,
  type MediaRenderJob,
} from "@/lib/canvas-api";
import {
  preserveAutoRenderNodeMediaFitPatch,
  scheduleAutoRenderParentGroupRelayout,
} from "@/lib/canvas/jianying-auto-render-layout";
import {
  isMediaRenderJobInflight,
  isMediaRenderPollDismissed,
  pollMediaRenderJobUntilDone,
  renderStatusLabel,
  type JianyingMediaRenderInFlight,
} from "@/lib/canvas/media-render-in-flight";
import { useCanvasStore } from "@/lib/canvas/store";
import type {
  JianyingAutoRenderNodeData,
  JianyingMediaRenderResult,
} from "@/lib/canvas/types";

function inFlightFromJob(job: MediaRenderJob): JianyingMediaRenderInFlight {
  return {
    jobId: job.id,
    status: job.status === "PENDING" ? "PENDING" : "RUNNING",
    progress: job.progress,
    progressLabel: renderStatusLabel(job),
    transitionKind: "xfade",
  };
}

/** 刷新后 · 用落盘 jobId 恢复自动成片合成扫光与轮询 */
export function useJianyingAutoRenderMediaRenderResume(nodeId: string) {
  const base = useBookMallBaseUrl();
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);

  const resumeJobId = useCanvasStore(
    useCallback(
      (s) =>
        (
          s.nodes.find((n) => n.id === nodeId)?.data as
            | JianyingAutoRenderNodeData
            | undefined
        )?.mediaRenderResumeJobId?.trim() || null,
      [nodeId],
    ),
  );

  const inFlight = useCanvasStore(
    useCallback(
      (s) =>
        (
          s.nodes.find((n) => n.id === nodeId)?.data as
            | JianyingAutoRenderNodeData
            | undefined
        )?.mediaRenderInFlight ?? null,
      [nodeId],
    ),
  );

  const persistedDownloadUrl = useCanvasStore(
    useCallback(
      (s) =>
        (
          s.nodes.find((n) => n.id === nodeId)?.data as
            | JianyingAutoRenderNodeData
            | undefined
        )?.mediaRenderResult?.downloadUrl?.trim() || null,
      [nodeId],
    ),
  );

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

  const persistSucceeded = useCallback(
    (ossDownloadUrl: string, expires: string, poster?: string | null) => {
      const posterUrl = poster?.trim() || undefined;
      const mediaRenderResult: JianyingMediaRenderResult = {
        downloadUrl: ossDownloadUrl,
        expiresAt: expires,
        completedAt: new Date().toISOString(),
        ...(posterUrl ? { posterUrl } : {}),
      };
      updateNodeData(
        nodeId,
        preserveAutoRenderNodeMediaFitPatch(nodeId, {
          videoUrl: ossDownloadUrl,
          ...(posterUrl ? { posterUrl } : {}),
          mediaRenderInFlight: null,
          mediaRenderResumeJobId: null,
          mediaFit: false,
          mediaFitKey: undefined,
          mediaRenderResult,
        }),
      );
      scheduleAutoRenderParentGroupRelayout(nodeId);
    },
    [nodeId, updateNodeData],
  );

  const clearResume = useCallback(() => {
    updateNodeData(nodeId, {
      mediaRenderInFlight: null,
      mediaRenderResumeJobId: null,
    });
  }, [nodeId, updateNodeData]);

  const resumedJobRef = useRef<string | null>(null);

  useEffect(() => {
    const onCancel = (ev: Event) => {
      const e = ev as CustomEvent<{ nodeId?: string }>;
      if (e.detail?.nodeId !== nodeId) return;
      resumedJobRef.current = null;
    };
    window.addEventListener("canvas:media-render-cancelled", onCancel);
    return () =>
      window.removeEventListener("canvas:media-render-cancelled", onCancel);
  }, [nodeId]);

  useEffect(() => {
    if (!base?.trim() || !resumeJobId) return;
    if (persistedDownloadUrl) {
      updateNodeData(nodeId, { mediaRenderResumeJobId: null });
      return;
    }
    if (isMediaRenderJobInflight(inFlight)) return;
    if (resumedJobRef.current === resumeJobId) return;
    if (isMediaRenderPollDismissed(nodeId, resumeJobId)) return;

    resumedJobRef.current = resumeJobId;
    let cancelled = false;

    void (async () => {
      try {
        let job = await pollMediaRender(base, resumeJobId);
        if (cancelled || isMediaRenderPollDismissed(nodeId, job.id)) return;

        if (job.status === "SUCCEEDED") {
          const ossUrl = resolveMediaRenderDownloadUrl(base, job);
          const download = job.downloadUrl?.trim() || ossUrl;
          if (download && job.expiresAt) {
            persistSucceeded(download, job.expiresAt, job.posterUrl);
          } else if (ossUrl) {
            patchInFlight(null);
            updateNodeData(
              nodeId,
              preserveAutoRenderNodeMediaFitPatch(nodeId, {
                videoUrl: ossUrl,
                mediaRenderInFlight: null,
                mediaRenderResumeJobId: null,
              }),
              { sessionOnly: true },
            );
          } else {
            clearResume();
          }
          return;
        }

        if (job.status === "FAILED" || job.status === "EXPIRED") {
          clearResume();
          return;
        }

        patchInFlight(inFlightFromJob(job));

        job = await pollMediaRenderJobUntilDone({
          nodeId,
          jobId: resumeJobId,
          base,
          onPoll: (j) => {
            if (cancelled) return;
            patchInFlight(inFlightFromJob(j));
          },
        });

        if (cancelled || isMediaRenderPollDismissed(nodeId, job.id)) return;

        if (job.status === "SUCCEEDED") {
          const ossUrl = resolveMediaRenderDownloadUrl(base, job);
          const download = job.downloadUrl?.trim() || ossUrl;
          if (download && job.expiresAt) {
            persistSucceeded(download, job.expiresAt, job.posterUrl);
          } else if (ossUrl) {
            updateNodeData(
              nodeId,
              preserveAutoRenderNodeMediaFitPatch(nodeId, {
                videoUrl: ossUrl,
                mediaRenderInFlight: null,
                mediaRenderResumeJobId: null,
              }),
            );
          } else {
            clearResume();
          }
          return;
        }

        clearResume();
      } catch {
        if (cancelled) return;
        resumedJobRef.current = null;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    base,
    clearResume,
    inFlight,
    nodeId,
    patchInFlight,
    persistSucceeded,
    persistedDownloadUrl,
    resumeJobId,
    updateNodeData,
  ]);
}
