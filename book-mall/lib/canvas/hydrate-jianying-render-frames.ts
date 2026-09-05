import type { JianyingFrameInput } from "@/lib/canvas/canvas-jianying-export";
import { ensureCanvasAudioNodeHttpsUrl } from "@/lib/canvas/ensure-canvas-audio-oss-url";

type CanvasNodeRow = {
  id: string;
  type?: string;
  data?: Record<string, unknown>;
};

/** 提交自动成片前：为缺 audioUrl 的帧按 audioSourceNodeId 同步落 OSS 并填入 HTTPS */
export async function hydrateJianyingRenderFrameAudioUrls(args: {
  userId: string;
  projectId: string;
  frames: JianyingFrameInput[];
  canvasNodes: CanvasNodeRow[];
}): Promise<JianyingFrameInput[]> {
  const out: JianyingFrameInput[] = [];
  for (const frame of args.frames) {
    const existing = frame.audioUrl?.trim();
    if (existing && /^https:\/\//i.test(existing)) {
      out.push(frame);
      continue;
    }
    const nodeId = frame.audioSourceNodeId?.trim();
    if (!nodeId) {
      out.push(frame);
      continue;
    }
    const audioUrl = await ensureCanvasAudioNodeHttpsUrl({
      userId: args.userId,
      projectId: args.projectId,
      nodeId,
      canvasNodes: args.canvasNodes,
    });
    out.push(audioUrl ? { ...frame, audioUrl } : frame);
  }
  return out;
}
