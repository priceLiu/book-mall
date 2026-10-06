"use client";

import { DEFAULT_COMPOSE_PROFILE } from "@private/platform-compose-ui/default-compose-profile";
import {
  composeClipSourceEnd,
  composeClipSourceStart,
  orderedComposeClips,
} from "@private/platform-compose-ui/editor";
import { workbenchToJianyingExportFrames } from "@private/platform-compose-ui/jianying-adapter";
import type { ComposeWorkbenchState } from "@private/platform-compose-ui/types";

import {
  resolveMediaRenderDownloadUrl,
  submitMediaRender,
  waitMediaRenderJob,
  type MediaRenderProfile,
} from "@/lib/canvas-api";
import { requestCanvasGraphPersistFlush } from "@/lib/canvas/canvas-persist-request";
import { isClipRangeStillFullLength } from "@/lib/canvas/libtv-video-clip-editor-format";
import {
  runLibtvVideoTrim,
  spawnLibtvVideoEditResultNode,
  type RunLibtvVideoTrimOpts,
} from "@/lib/canvas/libtv-video-trim-run";
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
    audio: { mixTts: p.audio?.mixTts ?? true },
    subtitle: {
      mode: subtitleMode,
      burnIn: p.subtitle?.burnIn ?? false,
      ...(p.subtitle?.style ? { style: p.subtitle.style } : {}),
    },
    video: { scaleMode: p.video?.scaleMode ?? "fit1080p" },
  };
}

function pickExportClip(
  workbench: ComposeWorkbenchState,
  selectedClipId: string | null,
) {
  const ordered = orderedComposeClips(workbench);
  const targetId =
    selectedClipId ?? workbench.orderedClipIds[0] ?? ordered[0]?.id ?? null;
  const clip = targetId
    ? (ordered.find((c) => c.id === targetId) ?? ordered[0])
    : ordered[0];
  return { ordered, clip };
}

export type ExportLibtvComposeTrimOpts = Omit<
  RunLibtvVideoTrimOpts,
  "sourceVideoUrl" | "startSec" | "endSec"
> & {
  workbench: ComposeWorkbenchState;
  fullDurationByUrl: Record<string, number>;
  selectedClipId: string | null;
  base: string;
  onComposeProgress?: (line: string | null) => void;
};

/** 单段 FFmpeg 裁段；多段或时间线合成走云端 FFmpeg 拼接（与自动成片一致） */
export async function exportLibtvComposeTrim(
  opts: ExportLibtvComposeTrimOpts,
): Promise<string> {
  const { ordered, clip } = pickExportClip(opts.workbench, opts.selectedClipId);
  if (!clip?.videoUrl?.trim()) {
    throw new Error("没有可剪辑的视频片段");
  }

  const useProgramCompose = ordered.length > 1;

  if (!useProgramCompose) {
    const full =
      opts.fullDurationByUrl[clip.videoUrl.trim()] ??
      clip.durationSec ??
      15;
    const startSec = composeClipSourceStart(clip);
    const endSec = composeClipSourceEnd(clip, full);
    if (endSec - startSec < 0.2) {
      throw new Error("片段过短，请拖白边保留足够长度后再生成。");
    }
    if (isClipRangeStillFullLength(startSec, endSec, full)) {
      throw new Error(
        "入出点仍覆盖整段原片。请拖选中段左右白边，或分割后只保留需要的段落再生成。",
      );
    }
    return runLibtvVideoTrim({
      ...opts,
      sourceVideoUrl: clip.videoUrl.trim(),
      startSec,
      endSec,
    });
  }

  if (!opts.base?.trim() || !opts.projectId?.trim()) {
    throw new Error("画布项目尚未就绪，请稍候再试。");
  }

  const targetId = spawnLibtvVideoEditResultNode(
    opts.sourceNodeId,
    opts.store,
  );
  opts.onComposeProgress?.("提交合成…");

  try {
    const profile = workbenchToMediaRenderProfile(opts.workbench);
    const frames = workbenchToJianyingExportFrames(
      opts.workbench,
      opts.fullDurationByUrl,
    ).map((f) => ({
      ...f,
      audioUrl: null,
      audioSourceNodeId: null,
    }));

    const job = await submitMediaRender(opts.base, opts.projectId, {
      frames,
      profile,
    });

    const finalJob = await waitMediaRenderJob(opts.base, job.id, {
      onPoll: (j) => {
        const pct =
          typeof j.progress === "number" && j.progress > 0
            ? `${Math.round(j.progress)}% · `
            : "";
        opts.onComposeProgress?.(
          `${pct}${j.progressLabel?.trim() || "合成中…"}`,
        );
      },
    });

    if (finalJob.status !== "SUCCEEDED") {
      const msg =
        finalJob.errorMessage?.trim() ||
        (finalJob.status === "EXPIRED" ? "合成结果已过期" : "云端合成失败");
      throw new Error(msg);
    }

    const ossUrl =
      finalJob.downloadUrl?.trim() ||
      resolveMediaRenderDownloadUrl(opts.base, finalJob);
    if (!ossUrl) throw new Error("未获得合成成片地址");

    const durationSec =
      frames.reduce((sum, f) => sum + (f.durationSec ?? 0), 0) || undefined;
    const label =
      durationSec && durationSec > 0
        ? `剪辑片段 · ${durationSec.toFixed(1)}s`
        : "剪辑片段";

    opts.updateNodeData(targetId, {
      label,
      ossUrl,
      trimClipMeta: undefined,
      runtime: {
        status: "done",
        ossUrl,
        ephemeralUrl: ossUrl,
        posterUrl: finalJob.posterUrl?.trim() || undefined,
        failCode: undefined,
        failMessage: undefined,
        localJobKind: undefined,
      },
    });

    requestCanvasGraphPersistFlush({ immediate: true });
    opts.onComposeProgress?.(null);
    return targetId;
  } catch (e) {
    const message = e instanceof Error ? e.message : "剪辑失败";
    opts.updateNodeData(targetId, {
      runtime: {
        status: "error",
        failCode: "VIDEO_TRIM",
        failMessage: message,
        localJobKind: undefined,
      },
    });
    opts.onComposeProgress?.(null);
    throw e;
  }
}
