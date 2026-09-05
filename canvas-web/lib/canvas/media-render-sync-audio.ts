import {
  type JianyingExportFrame,
  syncMediaRenderAudio,
} from "@/lib/canvas-api";

const HTTPS_AUDIO = /^https:\/\//i;

export function frameNeedsAudioOssSync(frame: JianyingExportFrame): boolean {
  const nodeId = frame.audioSourceNodeId?.trim();
  if (!nodeId) return false;
  const url = frame.audioUrl?.trim();
  return !url || !HTTPS_AUDIO.test(url);
}

export function countFramesNeedingAudioOssSync(
  frames: JianyingExportFrame[],
): number {
  return frames.filter(frameNeedsAudioOssSync).length;
}

/** 提交自动成片前：逐镜同步 TTS 到 OSS，供 Dock 展示「同步配音 N/M」进度 */
export async function syncMediaRenderFrameAudios(args: {
  base: string;
  projectId: string;
  frames: JianyingExportFrame[];
  onProgress?: (args: {
    done: number;
    total: number;
    label: string;
    progressPct: number;
  }) => void;
}): Promise<JianyingExportFrame[]> {
  const out = args.frames.map((f) => ({ ...f }));
  const pending = out
    .map((frame, index) => ({ frame, index }))
    .filter(({ frame }) => frameNeedsAudioOssSync(frame));

  const total = pending.length;
  if (total === 0) {
    args.onProgress?.({
      done: 0,
      total: 0,
      label: "配音已就绪，提交剪辑…",
      progressPct: 12,
    });
    return out;
  }

  for (let i = 0; i < pending.length; i++) {
    const { frame, index } = pending[i]!;
    const step = i + 1;
    const label = `同步配音 ${step}/${total}…`;
    args.onProgress?.({
      done: i,
      total,
      label,
      progressPct: Math.round((i / total) * 12),
    });

    const nodeId = frame.audioSourceNodeId!.trim();
    const audioUrl = await syncMediaRenderAudio(
      args.base,
      args.projectId,
      nodeId,
    );
    out[index] = { ...frame, audioUrl };
    args.onProgress?.({
      done: step,
      total,
      label: `同步配音 ${step}/${total} 完成`,
      progressPct: Math.round((step / total) * 12),
    });
  }

  return out;
}
