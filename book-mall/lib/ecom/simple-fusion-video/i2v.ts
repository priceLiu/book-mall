import { buildCanvasVideoKieInput } from "@/lib/canvas/canvas-video-kie";
import {
  buildDashscopeSbv1T2vVideoBody,
  buildDashscopeWan30Media,
} from "@/lib/canvas/dashscope-sbv1-t2v";
import { buildEcomStoryboardKling30DashscopeVideoJob } from "@/lib/canvas/dashscope-kling-v3-video";
import {
  ensureStoryboardBailianR2vRefImage,
  ensureStoryboardVideoRefImage,
} from "@/lib/ecom/ecom-storyboard-ref-image";
import {
  bailianResolutionFromEcom,
  resolveEcomVideoGenerateAudio,
  resolveVideoResolution,
} from "@/lib/ecom/ecom-storyboard-gen-params";
import { resolveStoryboardPanelVideoRefPlan } from "@/lib/ecom/ecom-storyboard-video-ref-rules";
import {
  isStoryboardKling30VideoModel,
  isStoryboardWan30VideoModel,
  resolveStoryboardKieVideoUpstreamModel,
  resolveStoryboardVideoModel,
  resolveStoryboardVideoProvider,
} from "@/lib/ecom/ecom-storyboard-video-models";
import {
  ecomCreateAndPollVolcengineVideo,
} from "@/lib/ecom/ecom-video-generate-routing";
import {
  ecomGwCreateBailianR2vJob,
  ecomGwCreateDashscopeJob,
  ecomGwCreateKieJob,
  ecomGwPollBailianR2v,
  ecomGwPollDashscope,
  ecomGwPollKie,
} from "@/lib/gateway/ecom-tool-gateway-client";
import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";

import {
  SIMPLE_FUSION_ASPECT_RATIO,
  SIMPLE_FUSION_VIDEO_DURATION_SEC,
} from "./constants";

async function persistVideoUrl(userId: string, vendorUrl: string): Promise<string> {
  const res = await fetch(vendorUrl, { signal: AbortSignal.timeout(180_000) });
  if (!res.ok) throw new Error(`下载视频失败 HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type")?.split(";")[0]?.trim() || "video/mp4";
  const ext = contentType.includes("webm") ? "webm" : "mp4";
  return uploadCanvasUserBuffer({ userId, buf, ext, contentType });
}

async function pollKieJob(userId: string, taskId: string, logId: string): Promise<string> {
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const polled = await ecomGwPollKie(userId, { taskId, gatewayLogId: logId });
    if (polled.status === "SUCCEEDED" && polled.outputUrl) {
      return polled.outputUrl;
    }
    if (polled.status === "FAILED") {
      throw new Error(polled.failMessage ?? "图生视频失败");
    }
  }
  throw new Error("图生视频超时，请稍后重试");
}

async function pollBailianJob(userId: string, taskId: string, logId: string): Promise<string> {
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const polled = await ecomGwPollBailianR2v(userId, { taskId, gatewayLogId: logId });
    if (polled.status === "SUCCEEDED" && polled.outputUrl) {
      return polled.outputUrl;
    }
    if (polled.status === "FAILED") {
      throw new Error(polled.failMessage ?? "图生视频失败");
    }
  }
  throw new Error("图生视频超时，请稍后重试");
}

async function pollDashscopeVideoJob(
  userId: string,
  taskId: string,
  logId: string,
): Promise<string> {
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const polled = await ecomGwPollDashscope(userId, { taskId, gatewayLogId: logId });
    if (polled.status === "SUCCEEDED" && polled.outputUrl) {
      return polled.outputUrl;
    }
    if (polled.status === "FAILED") {
      throw new Error(polled.failMessage ?? "图生视频失败");
    }
  }
  throw new Error("图生视频超时，请稍后重试");
}

export async function runSimpleFusionI2v(opts: {
  userId: string;
  clientPage: string;
  fusedImageUrl: string;
  prompt: string;
  modelKey?: string;
  durationSec?: number;
}): Promise<{ videoUrl: string; modelKey: string }> {
  const modelKey = resolveStoryboardVideoModel(opts.modelKey ?? "doubao-seedance-2.0");
  const provider = resolveStoryboardVideoProvider(modelKey);
  const durationSec = opts.durationSec ?? SIMPLE_FUSION_VIDEO_DURATION_SEC;
  const aspectRatio = SIMPLE_FUSION_ASPECT_RATIO;
  const resolution = resolveVideoResolution("1080p");
  const generateAudio = resolveEcomVideoGenerateAudio(modelKey, false);
  const prompt = opts.prompt.trim();
  if (!prompt) throw new Error("图生视频 Prompt 不能为空");

  const panelRefPlan = resolveStoryboardPanelVideoRefPlan({
    modelKey,
    references: [],
    panelImageUrl: opts.fusedImageUrl.trim(),
  });

  const uniqueUrls = [...new Set(panelRefPlan.slots.map((s) => s.url))];
  const normalizedMap = new Map<string, string>();
  await Promise.all(
    uniqueUrls.map(async (raw) => {
      const { url: sizedUrl } =
        provider === "bailian" || provider === "dashscope"
          ? await ensureStoryboardBailianR2vRefImage({
              userId: opts.userId,
              imageUrl: raw,
              modelKey,
            })
          : await ensureStoryboardVideoRefImage({
              userId: opts.userId,
              imageUrl: raw,
            });
      normalizedMap.set(raw, sizedUrl);
    }),
  );
  const norm = (u: string) => normalizedMap.get(u) ?? u;
  const panelFirstFrame = norm(panelRefPlan.firstFrameUrl);
  const refUrls = panelRefPlan.referenceImageUrls.map(norm);
  const bailianUrls = panelRefPlan.bailianAllUrls.map(norm);

  if (provider === "bailian") {
    const { taskId, logId } = await ecomGwCreateBailianR2vJob(opts.userId, {
      model: modelKey,
      prompt,
      referenceImageUrls: bailianUrls.length > 0 ? bailianUrls : [panelFirstFrame],
      resolution: bailianResolutionFromEcom(resolution),
      ratio: aspectRatio,
      duration: durationSec,
      clientPage: opts.clientPage,
    });
    const vendorUrl = await pollBailianJob(opts.userId, taskId, logId);
    const oss = await persistVideoUrl(opts.userId, vendorUrl);
    return { videoUrl: oss, modelKey };
  }

  if (provider === "dashscope" && isStoryboardWan30VideoModel(modelKey)) {
    const media = buildDashscopeWan30Media({
      firstFrameUrl: panelFirstFrame,
      referenceImageUrls: refUrls,
    });
    const { input, parameters } = buildDashscopeSbv1T2vVideoBody({
      prompt,
      aspectRatio,
      resolution,
      durationSec,
      modelKey,
      media,
    });
    const { taskId, logId } = await ecomGwCreateDashscopeJob(opts.userId, {
      kind: "video",
      model: modelKey,
      body: { input, parameters },
      clientPage: opts.clientPage,
    });
    const vendorUrl = await pollDashscopeVideoJob(opts.userId, taskId, logId);
    const oss = await persistVideoUrl(opts.userId, vendorUrl);
    return { videoUrl: oss, modelKey };
  }

  if (provider === "dashscope" && isStoryboardKling30VideoModel(modelKey)) {
    const klingAspect: "16:9" | "9:16" | "1:1" = aspectRatio;
    const { model, videoBody } = buildEcomStoryboardKling30DashscopeVideoJob({
      prompt,
      firstFrameUrl: panelFirstFrame,
      references: [],
      aspectRatio: klingAspect,
      durationSec,
      sound: generateAudio,
    });
    const { taskId, logId } = await ecomGwCreateDashscopeJob(opts.userId, {
      kind: "video",
      model,
      body: videoBody,
      clientPage: opts.clientPage,
    });
    const vendorUrl = await pollDashscopeVideoJob(opts.userId, taskId, logId);
    const oss = await persistVideoUrl(opts.userId, vendorUrl);
    return { videoUrl: oss, modelKey };
  }

  if (provider === "volcengine") {
    const { videoUrl } = await ecomCreateAndPollVolcengineVideo({
      userId: opts.userId,
      modelKey,
      prompt,
      durationSec,
      aspectRatio,
      generateAudio,
      referenceImageUrl: panelFirstFrame,
      clientPage: opts.clientPage,
    });
    const oss = await persistVideoUrl(opts.userId, videoUrl);
    return { videoUrl: oss, modelKey };
  }

  if (provider === "kie") {
    const { model, input } = buildCanvasVideoKieInput({
      modelKey: resolveStoryboardKieVideoUpstreamModel(modelKey),
      prompt,
      imageUrl: panelFirstFrame,
      options: {
        resolution: "1080p",
        duration: durationSec,
        generateAudio: false,
      },
      aspectRatio,
    });
    const { taskId, logId } = await ecomGwCreateKieJob(opts.userId, {
      model,
      input,
      clientPage: opts.clientPage,
    });
    const vendorUrl = await pollKieJob(opts.userId, taskId, logId);
    const oss = await persistVideoUrl(opts.userId, vendorUrl);
    return { videoUrl: oss, modelKey };
  }

  throw new Error(
    `视频模型「${modelKey}」暂未接入简易融合短视频；请选用 Seedance、HappyHorse R2V 或万相 3.0 等已绑定模型。`,
  );
}
