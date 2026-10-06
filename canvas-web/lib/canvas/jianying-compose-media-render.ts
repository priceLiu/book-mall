"use client";

import { useCallback, useMemo, useState } from "react";
import { DEFAULT_COMPOSE_PROFILE } from "@private/platform-compose-ui/default-compose-profile";
import { workbenchToJianyingExportFrames } from "@private/platform-compose-ui/jianying-adapter";
import type { ComposeWorkbenchState } from "@private/platform-compose-ui/types";

import type { JianyingMediaRenderResult } from "@/lib/canvas/types";
import {
  type MediaRenderProfile,
  resolveMediaRenderDownloadUrl,
  submitMediaRender,
} from "@/lib/canvas-api";
import {
  preserveAutoRenderNodeMediaFitPatch,
  scheduleAutoRenderParentGroupRelayout,
} from "@/lib/canvas/jianying-auto-render-layout";
import {
  friendlyMediaRenderError,
  pollMediaRenderJobUntilDone,
  renderStatusLabel,
} from "@/lib/canvas/media-render-in-flight";
import { syncMediaRenderFrameAudios } from "@/lib/canvas/media-render-sync-audio";
import { useCanvasStore } from "@/lib/canvas/store";
import { dispatchPlatformCreditsBalanceRefresh } from "@/lib/canvas/canvas-credits-balance-events";

function workbenchToMediaRenderProfile(
  workbench: ComposeWorkbenchState,
): MediaRenderProfile {
  const p = workbench.profile ?? DEFAULT_COMPOSE_PROFILE;
  const transition =
    p.transition?.type === "none"
      ? ({ type: "none" as const })
      : ({
          type: "xfade" as const,
          durationSec: p.transition?.durationSec ?? 0.6,
        });
  const mode = p.subtitle?.mode ?? "script";
  const subtitleMode =
    mode === "asr" ? "asr" : mode === "none" ? "none" : "script";
  return {
    transition,
    audio: {
      mixTts: p.audio?.mixTts ?? true,
    },
    subtitle: {
      mode: subtitleMode,
      burnIn: p.subtitle?.burnIn ?? false,
      ...(p.subtitle?.style ? { style: p.subtitle.style } : {}),
    },
    video: { scaleMode: p.video?.scaleMode ?? "fit1080p" },
  };
}

export function useJianyingComposeMediaRender(args: {
  nodeId: string;
  base: string | null;
  projectId: string | null;
  mediaRenderResult?: JianyingMediaRenderResult | null;
  videoUrl?: string | null;
}) {
  const { nodeId, base, projectId, mediaRenderResult, videoUrl } = args;
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const [composeBusy, setComposeBusy] = useState(false);

  const downloadUrl = useMemo(() => {
    const fromResult = mediaRenderResult?.downloadUrl?.trim();
    if (fromResult) return fromResult;
    const fromNode = videoUrl?.trim();
    if (fromNode && /^https?:\/\//.test(fromNode)) return fromNode;
    return null;
  }, [mediaRenderResult?.downloadUrl, videoUrl]);

  const persistSucceededRender = useCallback(
    (ossDownloadUrl: string, expires: string, poster?: string | null) => {
      const posterUrl = poster?.trim() || undefined;
      const mediaRenderResultNext: JianyingMediaRenderResult = {
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
          mediaRenderResult: mediaRenderResultNext,
        }),
      );
      scheduleAutoRenderParentGroupRelayout(nodeId);
    },
    [nodeId, updateNodeData],
  );

  const runCompose = useCallback(
    async (
      workbench: ComposeWorkbenchState,
      fullDurationByUrl: Record<string, number>,
    ) => {
      if (!base?.trim() || !projectId?.trim()) {
        throw new Error("画布项目尚未就绪，请稍候再试。");
      }
      const ordered = workbench.orderedClipIds.length;
      if (ordered < 1) {
        throw new Error("请至少保留 1 段视频。");
      }

      setComposeBusy(true);
      updateNodeData(nodeId, {
        videoUrl: undefined,
        posterUrl: undefined,
        mediaRenderResult: null,
        mediaRenderResumeJobId: null,
      });
      updateNodeData(
        nodeId,
        {
          mediaRenderInFlight: {
            jobId: "pending",
            status: "PENDING",
            progress: 0,
            progressLabel: "提交合成…",
            transitionKind: "xfade",
            transitionSec: workbench.profile?.transition?.durationSec ?? 0.6,
            scaleMode: workbench.profile?.video?.scaleMode ?? "fit1080p",
            mixDialogue: workbench.profile?.audio?.mixTts ?? true,
            burnInSubtitles: workbench.profile?.subtitle?.burnIn ?? false,
            subtitleMode:
              workbench.profile?.subtitle?.mode === "asr" ? "asr" : "script",
          },
        },
        { sessionOnly: true },
      );

      try {
        const profile = workbenchToMediaRenderProfile(workbench);
        let frames = workbenchToJianyingExportFrames(workbench, fullDurationByUrl);
        const mixTts = profile.audio?.mixTts ?? true;
        if (!mixTts) {
          frames = frames.map((f) => ({
            ...f,
            audioUrl: null,
            audioSourceNodeId: null,
          }));
        } else if (
          frames.some((f) => f.audioSourceNodeId?.trim() && !f.audioUrl?.trim())
        ) {
          frames = await syncMediaRenderFrameAudios({
            base,
            projectId,
            frames,
          });
        }

        const job = await submitMediaRender(base, projectId, {
          frames,
          profile,
        });
        dispatchPlatformCreditsBalanceRefresh();

        updateNodeData(
          nodeId,
          {
            mediaRenderInFlight: {
              jobId: job.id,
              status: "PENDING",
              progress: job.progress,
              progressLabel: renderStatusLabel(job),
              transitionKind: "xfade",
              transitionSec: workbench.profile?.transition?.durationSec ?? 0.6,
              scaleMode: workbench.profile?.video?.scaleMode ?? "fit1080p",
              mixDialogue: mixTts,
              burnInSubtitles: profile.subtitle?.burnIn ?? false,
              subtitleMode:
                profile.subtitle?.mode === "asr" ? "asr" : "script",
            },
          },
          { sessionOnly: true },
        );
        updateNodeData(nodeId, { mediaRenderResumeJobId: job.id });

        const finalJob = await pollMediaRenderJobUntilDone({
          nodeId,
          jobId: job.id,
          base,
          onPoll: (j) => {
            updateNodeData(
              nodeId,
              {
                mediaRenderInFlight: {
                  jobId: j.id,
                  status: j.status === "PENDING" ? "PENDING" : "RUNNING",
                  progress: j.progress,
                  progressLabel: renderStatusLabel(j),
                  transitionKind: "xfade",
                  transitionSec: workbench.profile?.transition?.durationSec ?? 0.6,
                  scaleMode: workbench.profile?.video?.scaleMode ?? "fit1080p",
                  mixDialogue: mixTts,
                  burnInSubtitles: profile.subtitle?.burnIn ?? false,
                  subtitleMode:
                profile.subtitle?.mode === "asr" ? "asr" : "script",
                },
              },
              { sessionOnly: true },
            );
          },
        });

        if (finalJob.status === "SUCCEEDED") {
          const ossUrl = resolveMediaRenderDownloadUrl(base, finalJob);
          if (ossUrl && finalJob.downloadUrl?.trim()) {
            persistSucceededRender(
              finalJob.downloadUrl.trim(),
              finalJob.expiresAt,
              finalJob.posterUrl,
            );
          } else if (ossUrl) {
            updateNodeData(
              nodeId,
              preserveAutoRenderNodeMediaFitPatch(nodeId, {
                videoUrl: ossUrl,
                mediaRenderInFlight: null,
              }),
              { sessionOnly: true },
            );
          }
          updateNodeData(nodeId, {
            mediaRenderInFlight: null,
            mediaRenderResumeJobId: null,
          });
          return;
        }

        const msg =
          finalJob.errorMessage?.trim() ||
          (finalJob.status === "EXPIRED" ? "合成结果已过期" : "云端合成失败");
        updateNodeData(nodeId, {
          mediaRenderInFlight: null,
          mediaRenderResumeJobId: null,
        });
        throw new Error(msg);
      } catch (e) {
        updateNodeData(nodeId, {
          mediaRenderInFlight: null,
          mediaRenderResumeJobId: null,
        });
        throw new Error(
          friendlyMediaRenderError(
            e instanceof Error ? e.message : String(e),
          ),
        );
      } finally {
        setComposeBusy(false);
      }
    },
    [base, nodeId, persistSucceededRender, projectId, updateNodeData],
  );

  const runDownload = useCallback(async () => {
    if (!downloadUrl) {
      throw new Error("请先完成云端合成，再下载成片。");
    }
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = "";
    a.target = "_blank";
    a.rel = "noreferrer";
    a.click();
  }, [downloadUrl]);

  return {
    composeBusy,
    canDownload: Boolean(downloadUrl),
    runCompose,
    runDownload,
  };
}
