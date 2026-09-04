import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { bailianResolutionFromEcom } from "@/lib/ecom/ecom-storyboard-gen-params";
import {
  isOutfitVideoKieModel,
  isOutfitVideoKlingMotionControlModel,
  resolveOutfitVideoGenerateModelKey,
  resolveOutfitVideoGenerateProvider,
} from "@/lib/ecom/ecom-outfit-video-models";
import {
  resolveStoryboardVideoModel,
  resolveStoryboardVideoProvider,
} from "@/lib/ecom/ecom-storyboard-video-models";
import { ensureStoryboardBailianR2vRefImage } from "@/lib/ecom/ecom-storyboard-ref-image";
import { ecomClientPage } from "@/lib/ecom/ecom-tool-keys";
import { ECOM_OUTFIT_VIDEO_TOOL_KEY } from "@/lib/ecom/ecom-outfit-video-types";
import {
  enrichOutfitKlingMotionControlPrompt,
  resolveOutfitKlingMotionControlInputImage,
  resolveOutfitShotGenerateRoute,
} from "@/lib/ecom/ecom-outfit-video-kling-input";
import { buildOutfitShotGenerateBody } from "@/lib/ecom/video-workflow/templates/outfit-v1/generation";
import type { SceneShot, WorkflowRefs } from "@/lib/ecom/video-workflow/shot-spine";
import { buildKieKlingMotionControlCreateArgs } from "@/lib/canvas/kie-video-tool-builders";
import {
  ecomGwCreateBailianR2vJob,
  ecomGwCreateKieJob,
  ecomGwPollBailianR2v,
  ecomGwPollKie,
} from "@/lib/gateway/ecom-tool-gateway-client";
import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import { extractVideoFirstFrameJpeg } from "@/lib/canvas/video-poster-ffmpeg";

async function fetchVideoBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`下载参考片段失败 HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** 从参考片段抽取首/中/尾帧，供百炼 R2V 迁移运镜与动作 */
async function extractClipKeyframeUrls(opts: {
  userId: string;
  clipUrl: string;
  durationSec: number;
}): Promise<string[]> {
  const buf = await fetchVideoBuffer(opts.clipUrl);
  const urls: string[] = [];
  const first = await extractVideoFirstFrameJpeg(buf);
  if (first) {
    urls.push(
      await uploadCanvasUserBuffer({
        userId: opts.userId,
        ext: "jpg",
        buf: first,
        contentType: "image/jpeg",
      }),
    );
  }
  return urls;
}

async function pollKieJob(
  userId: string,
  taskId: string,
  logId: string,
): Promise<string> {
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const polled = await ecomGwPollKie(userId, { taskId, gatewayLogId: logId });
    if (polled.status === "SUCCEEDED" && polled.outputUrl) {
      return polled.outputUrl;
    }
    if (polled.status === "FAILED") {
      throw new Error(polled.failMessage ?? "单镜视频生成失败");
    }
  }
  throw new Error("单镜视频生成超时，请稍后重试");
}

async function pollBailianJob(
  userId: string,
  taskId: string,
  logId: string,
): Promise<string> {
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const polled = await ecomGwPollBailianR2v(userId, { taskId, gatewayLogId: logId });
    if (polled.status === "SUCCEEDED" && polled.outputUrl) {
      return polled.outputUrl;
    }
    if (polled.status === "FAILED") {
      throw new Error(polled.failMessage ?? "单镜视频生成失败");
    }
  }
  throw new Error("单镜视频生成超时，请稍后重试");
}

async function runKlingMotionControlGenerate(opts: {
  userId: string;
  projectId: string;
  modelKey: string;
  prompt: string;
  modelImageUrl: string;
  clothingImageUrl: string;
  referenceClipUrl: string;
  durationSec: number;
}): Promise<string> {
  const modelUrl = opts.modelImageUrl.trim();
  const clothingUrl = opts.clothingImageUrl.trim();
  const inputImageUrl = resolveOutfitKlingMotionControlInputImage(modelUrl);
  const hasSeparateClothingRef = Boolean(
    clothingUrl && clothingUrl !== modelUrl,
  );

  const prompt = enrichOutfitKlingMotionControlPrompt(opts.prompt, {
    hasSeparateClothingRef,
  });

  const { model, input } = buildKieKlingMotionControlCreateArgs({
    model: opts.modelKey as "kling-3.0/motion-control" | "kling-2.6/motion-control",
    prompt,
    imageUrls: [inputImageUrl],
    videoUrls: [opts.referenceClipUrl],
    mode: "1080p",
    characterOrientation: "video",
    backgroundSource: "input_video",
  });

  const clientPage = ecomClientPage(opts.userId, opts.projectId, ECOM_OUTFIT_VIDEO_TOOL_KEY);
  const { taskId, logId } = await ecomGwCreateKieJob(opts.userId, {
    model,
    input,
    clientPage: `${clientPage}/shot-generate-motion`,
  });
  return pollKieJob(opts.userId, taskId, logId);
}

async function runWan26VideoToVideoGenerate(opts: {
  userId: string;
  projectId: string;
  prompt: string;
  referenceClipUrl: string;
  durationSec: number;
}): Promise<string> {
  const duration = opts.durationSec >= 10 ? 10 : 5;
  const clientPage = ecomClientPage(opts.userId, opts.projectId, ECOM_OUTFIT_VIDEO_TOOL_KEY);
  const { taskId, logId } = await ecomGwCreateKieJob(opts.userId, {
    model: "wan/2-6-video-to-video",
    input: {
      prompt: opts.prompt,
      video_urls: [opts.referenceClipUrl],
      duration: String(duration),
      resolution: "1080p",
    },
    clientPage: `${clientPage}/shot-generate-v2v`,
  });
  return pollKieJob(opts.userId, taskId, logId);
}

async function runBailianR2vGenerate(opts: {
  userId: string;
  projectId: string;
  modelKey: string;
  body: ReturnType<typeof buildOutfitShotGenerateBody>;
}): Promise<string> {
  const modelKey = resolveStoryboardVideoModel(opts.modelKey);
  const provider = resolveStoryboardVideoProvider(modelKey);
  if (provider !== "bailian") {
    throw new Error(`穿搭视频暂不支持模型 ${modelKey}，请选用动作迁移类模型`);
  }

  const { body } = opts;
  const refUrls: string[] = [];
  const pushRef = async (url: string | undefined) => {
    if (!url?.trim()) return;
    refUrls.push(
      (
        await ensureStoryboardBailianR2vRefImage({
          userId: opts.userId,
          imageUrl: url.trim(),
          modelKey,
        })
      ).url,
    );
  };

  await pushRef(body.previewImageUrl);
  await pushRef(body.modelImageUrl);
  if (body.clothingImageUrl.trim() && body.clothingImageUrl !== body.modelImageUrl) {
    await pushRef(body.clothingImageUrl);
  }
  if (body.referenceClipUrl?.trim()) {
    const clipFrames = await extractClipKeyframeUrls({
      userId: opts.userId,
      clipUrl: body.referenceClipUrl.trim(),
      durationSec: body.durationSec,
    });
    for (const frameUrl of clipFrames) {
      await pushRef(frameUrl);
    }
  }

  if (refUrls.length === 0) {
    throw new Error("缺少参考图，无法生成视频");
  }

  const clientPage = ecomClientPage(opts.userId, opts.projectId, ECOM_OUTFIT_VIDEO_TOOL_KEY);
  const { taskId, logId } = await ecomGwCreateBailianR2vJob(opts.userId, {
    model: modelKey,
    prompt: body.prompt,
    referenceImageUrls: refUrls,
    resolution: bailianResolutionFromEcom("1080p"),
    ratio: body.aspectRatio,
    duration: body.durationSec,
    parameterExtras: body.negativePrompt.trim()
      ? { negative_prompt: body.negativePrompt.trim() }
      : undefined,
    clientPage: `${clientPage}/shot-generate-r2v`,
  });

  return pollBailianJob(opts.userId, taskId, logId);
}

export async function ecomGenerateOutfitVideoShot(opts: {
  userId: string;
  projectId: string;
  scene: SceneShot;
  refs: WorkflowRefs;
  videoModelKey?: string;
}): Promise<string> {
  await assertEcomToolkitGatewayAccess(opts.userId);

  const body = buildOutfitShotGenerateBody({
    scene: opts.scene,
    refs: opts.refs,
    videoModelKey: opts.videoModelKey ?? "kling-3.0/motion-control",
    durationSec: opts.scene.durationSec,
  });

  const modelKey = resolveOutfitVideoGenerateModelKey(
    opts.videoModelKey ?? "kling-3.0/motion-control",
  );
  const provider = resolveOutfitVideoGenerateProvider(modelKey);

  if (!body.referenceClipUrl?.trim()) {
    throw new Error("分镜缺少参考片段，请先完成真实拆镜后再生成");
  }

  const route = resolveOutfitShotGenerateRoute(modelKey, {
    modelImageUrl: body.modelImageUrl,
    clothingImageUrl: body.clothingImageUrl,
  });

  if (route.kind === "bailian-r2v") {
    return runBailianR2vGenerate({
      userId: opts.userId,
      projectId: opts.projectId,
      modelKey: route.modelKey,
      body,
    });
  }

  if (route.kind === "kling") {
    return runKlingMotionControlGenerate({
      userId: opts.userId,
      projectId: opts.projectId,
      modelKey: route.modelKey,
      prompt: body.prompt,
      modelImageUrl: body.modelImageUrl,
      clothingImageUrl: body.clothingImageUrl,
      referenceClipUrl: body.referenceClipUrl.trim(),
      durationSec: body.durationSec,
    });
  }

  if (route.kind === "wan-v2v") {
    return runWan26VideoToVideoGenerate({
      userId: opts.userId,
      projectId: opts.projectId,
      prompt: body.prompt,
      referenceClipUrl: body.referenceClipUrl.trim(),
      durationSec: body.durationSec,
    });
  }

  if (provider === "kie" && isOutfitVideoKieModel(modelKey)) {
    throw new Error(`模型 ${modelKey} 尚未接入穿搭逐镜生成，请选用 Kling 动作控制或百炼 R2V`);
  }

  return runBailianR2vGenerate({
    userId: opts.userId,
    projectId: opts.projectId,
    modelKey,
    body,
  });
}
