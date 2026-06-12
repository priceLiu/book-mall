import { buildCanvasVideoVolcengineInput } from "@/lib/canvas/canvas-video-volcengine";
import {
  ecomGwCreateVolcengineVideoJob,
  ecomGwPollVolcengine,
} from "@/lib/gateway/ecom-tool-gateway-client";

/** 纯文本口播/动作类：Seedance 2.0 文生视频（1.5 Pro 仅 i2v，纯 prompt 会 500） */
const SEEDANCE_20 = "doubao-seedance-2.0";

const ECOM_VIDEO_ACTION_MODEL: Record<
  string,
  {
    modelKey: string;
    aspectRatio: string;
    generateAudio: boolean;
    provider: "volcengine" | "dashscope";
  }
> = {
  motion: {
    modelKey: SEEDANCE_20,
    aspectRatio: "16:9",
    generateAudio: false,
    provider: "volcengine",
  },
  outfit: {
    modelKey: "wan/2-7-image-to-video",
    aspectRatio: "9:16",
    generateAudio: false,
    provider: "dashscope",
  },
  "dance-swap": {
    modelKey: "happyhorse/image-to-video",
    aspectRatio: "9:16",
    generateAudio: false,
    provider: "dashscope",
  },
  camera: {
    modelKey: "kling-2.6/image-to-video",
    aspectRatio: "16:9",
    generateAudio: false,
    provider: "dashscope",
  },
  "digital-human": {
    modelKey: SEEDANCE_20,
    aspectRatio: "9:16",
    generateAudio: true,
    provider: "volcengine",
  },
  "mirror-selfie": {
    modelKey: SEEDANCE_20,
    aspectRatio: "9:16",
    generateAudio: false,
    provider: "volcengine",
  },
  "hit-product": {
    modelKey: "happyhorse-1.0-r2v",
    aspectRatio: "9:16",
    generateAudio: false,
    provider: "dashscope",
  },
  voiceover: {
    modelKey: SEEDANCE_20,
    aspectRatio: "9:16",
    generateAudio: true,
    provider: "volcengine",
  },
};

function resolveEcomVideoAction(action: string) {
  const key = action.trim().toLowerCase();
  return ECOM_VIDEO_ACTION_MODEL[key] ?? ECOM_VIDEO_ACTION_MODEL.motion!;
}

export async function ecomCreateAndPollVolcengineVideo(opts: {
  userId: string;
  modelKey: string;
  prompt: string;
  durationSec: number;
  aspectRatio: string;
  generateAudio: boolean;
  referenceImageUrl?: string;
  clientPage?: string;
}): Promise<{ taskId: string; logId: string; videoUrl: string }> {
  const { body } = buildCanvasVideoVolcengineInput({
    modelKey: opts.modelKey,
    prompt: opts.prompt,
    imageUrl: opts.referenceImageUrl?.trim() ?? "",
    options: {
      resolution: "1080p",
      duration: opts.durationSec,
      generateAudio: opts.generateAudio,
    },
    aspectRatio: opts.aspectRatio,
  });

  const { taskId, logId } = await ecomGwCreateVolcengineVideoJob(opts.userId, {
    model: opts.modelKey,
    body,
    clientPage: opts.clientPage,
  });

  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const polled = await ecomGwPollVolcengine(opts.userId, {
      taskId,
      gatewayLogId: logId,
    });
    if (polled.status === "SUCCEEDED" && polled.outputUrl) {
      return { taskId, logId, videoUrl: polled.outputUrl };
    }
    if (polled.status === "FAILED") {
      throw new Error(polled.failMessage ?? "生视频任务失败");
    }
  }

  throw new Error("生视频超时，请稍后重试");
}

export function resolveEcomVideoGenerationPlan(opts: {
  action: string;
  referenceImageUrl?: string;
}) {
  const plan = resolveEcomVideoAction(opts.action);
  if (plan.provider === "volcengine" && !plan.modelKey.includes("seedance")) {
    throw new Error(
      `「${opts.action}」暂未接入火山视频链路，请联系管理员`,
    );
  }
  if (plan.provider === "dashscope") {
    throw new Error(
      `「${opts.action}」需要参考图，当前页面仅支持纯文案生成；请使用微剧故事版或上传参考图后再试`,
    );
  }
  return plan;
}
