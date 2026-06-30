/**
 * 分镜视频 1.0 · sbv1-video-engine runner
 */
import { CanvasProjectError } from "./canvas-project-service";
import { resolveVolcengineVideoRatio } from "./canvas-video-volcengine";
import {
  runVideoEngineNode,
  type RunEngineNodeArgs,
  type RunEngineNodeResult,
} from "./canvas-engine-runner";
import {
  clampSbv1ReferenceMode,
  getSbv1VideoModelRefCaps,
} from "./sbv1-video-model-reference";

type Sbv1ReferenceMode = "omni" | "first_last" | "smart_multi";

function httpsImageUrls(urls: string[]): string[] {
  return urls.filter((u) => typeof u === "string" && /^https?:\/\//.test(u.trim()));
}

export async function runSbv1VideoEngineNode(
  args: RunEngineNodeArgs,
): Promise<RunEngineNodeResult> {
  const data = args.node.data ?? {};
  const engine = (data.engine as Record<string, unknown> | undefined) ?? {};
  const providerId = String(engine.providerId ?? data.providerId ?? "");
  const modelKey = String(engine.modelKey ?? data.modelKey ?? "");
  const params = {
    ...((engine.params as Record<string, unknown> | undefined) ?? {}),
    ...((data.params as Record<string, unknown> | undefined) ?? {}),
  };
  const referenceMode = clampSbv1ReferenceMode(
    String(data.referenceMode ?? "omni") as Sbv1ReferenceMode,
    getSbv1VideoModelRefCaps(modelKey, {
      multiShots: params.multi_shots === true,
      providerId,
    }),
  );

  const aspectRatio = resolveVolcengineVideoRatio(
    String(data.aspectRatio ?? params.aspect_ratio ?? "16:9"),
  );
  const durationSec = Number(data.durationSec ?? params.duration ?? 15);
  const resolution = String(
    data.resolution ?? params.resolution ?? "1080p",
  ).toLowerCase();

  const promptRaw = String(data.prompt ?? "").trim();
  const portraitRefs = args.node.portraitAssetRefs ?? [];
  const hasPortraitRefs = portraitRefs.length > 0;
  /** 已入库走 asset://；未入库仍走 HTTPS OSS（可与 asset 混用） */
  const imageInputs = httpsImageUrls(args.node.imageInputs ?? []);

  if (!providerId || !modelKey) {
    throw new CanvasProjectError(
      "INVALID_INPUT",
      "sbv1-video-engine 缺少模型配置",
    );
  }

  const isMotionControl =
    modelKey === "kling-2.6/motion-control" ||
    modelKey === "kling-3.0/motion-control";

  const dockInputMode = data.dockInputMode as
    | import("./sbv1-workspace-types").Sbv1DockInputMode
    | undefined;
  const isKlingTextToVideo =
    modelKey === "kling-3.0/video" && dockInputMode === "t2v";

  if (
    !promptRaw &&
    imageInputs.length === 0 &&
    !hasPortraitRefs &&
    !isMotionControl &&
    !isKlingTextToVideo
  ) {
    throw new CanvasProjectError(
      "INVALID_INPUT",
      "请填写 prompt 或连接至少一张参考图",
    );
  }

  const prompt = promptRaw || "根据参考图生成视频";
  let mainFrameImageUrl = "";
  let referenceImageUrls: string[] = [];
  let lastFrameImageUrl = "";
  let forceReferenceMode = false;

  if (isKlingTextToVideo) {
    mainFrameImageUrl = "";
    referenceImageUrls = [];
    lastFrameImageUrl = "";
    forceReferenceMode = false;
  } else if (referenceMode === "first_last") {
    const firstAsset = portraitRefs.find((r) => r.role === "first_frame");
    const lastAsset = portraitRefs.find((r) => r.role === "last_frame");
    if (firstAsset && lastAsset) {
      mainFrameImageUrl = "";
      lastFrameImageUrl = "";
    } else if (firstAsset && !lastAsset) {
      mainFrameImageUrl = "";
      lastFrameImageUrl = imageInputs[0] ?? "";
    } else if (!firstAsset && lastAsset) {
      mainFrameImageUrl = imageInputs[0] ?? "";
      lastFrameImageUrl = "";
    } else {
      mainFrameImageUrl = imageInputs[0] ?? "";
      lastFrameImageUrl = imageInputs[1] ?? "";
    }
    if (!firstAsset && !mainFrameImageUrl) {
      throw new CanvasProjectError(
        "INVALID_INPUT",
        "首尾帧模式需要至少一张首帧参考图",
      );
    }
  } else if (referenceMode === "smart_multi") {
    if (imageInputs.length === 0 && !hasPortraitRefs) {
      throw new CanvasProjectError(
        "INVALID_INPUT",
        "智能多帧模式需要至少一张参考图",
      );
    }
    if (imageInputs.length > 0) {
      mainFrameImageUrl = imageInputs[0]!;
      referenceImageUrls = imageInputs.slice(1);
    }
    forceReferenceMode =
      hasPortraitRefs || referenceImageUrls.length > 0;
    params.resolution = resolution;
    params.duration = durationSec > 0 ? durationSec : 4;
  } else {
    // omni
    if (imageInputs.length === 0 && !hasPortraitRefs) {
      throw new CanvasProjectError(
        "INVALID_INPUT",
        "全能参考模式需要至少一张参考图",
      );
    }
    if (imageInputs.length > 0) {
      mainFrameImageUrl = imageInputs[0]!;
      referenceImageUrls = imageInputs.slice(1);
    }
    forceReferenceMode =
      hasPortraitRefs || referenceImageUrls.length > 0;
  }

  params.aspect_ratio = aspectRatio;
  if (referenceMode !== "smart_multi") {
    params.duration = durationSec;
  }
  if (modelKey === "kling-3.0/video" && referenceMode === "first_last") {
    params.multi_shots = false;
  }
  params.generate_audio =
    params.generate_audio !== false && params.generateAudio !== false;

  if (isMotionControl) {
    const videoUrls = Array.isArray(params.reference_video_urls)
      ? (params.reference_video_urls as unknown[]).filter(
          (u): u is string =>
            typeof u === "string" && /^https?:\/\//.test(u.trim()),
        )
      : [];
    params.reference_video_urls = videoUrls;
  }

  const variantId = String(
    data.volcengineVariantId ?? data.jimengModelId ?? "",
  ).trim();
  const effectiveDuration =
    referenceMode === "smart_multi"
      ? durationSec > 0
        ? durationSec
        : 4
      : durationSec;

  const sbv1Billing = {
    edition: "sbv1",
    referenceMode,
    aspectRatio,
    durationSec: effectiveDuration,
    resolution,
    volcengineVariantId: variantId || undefined,
    modelKey,
    providerId,
    promptLength: prompt.length,
    imageInputCount: imageInputs.length,
    referenceImageCount: referenceImageUrls.length,
    hasLastFrame: Boolean(lastFrameImageUrl),
    forceReferenceMode,
    paramsSnapshot: {
      resolution: params.resolution,
      duration: params.duration,
      aspect_ratio: params.aspect_ratio,
      generate_audio: params.generate_audio === true,
      tier: params.tier,
    },
    pricingReference: {
      tokenPureVideoYuanPerMillion: 46,
      tokenWithVideoInputYuanPerMillion: 28,
      reference15SecTokens: 308880,
      approxYuanPerSec720p: 0.99,
      billingDoc: "https://www.volcengine.com/docs/82379/1544106",
    },
    realPersonReview:
      "真人人像作为主体参考须经本人验证或合法授权；先录入真人人像库并通过审核，生成时使用 asset://",
    portraitApiDoc: "https://www.volcengine.com/docs/82379/2333589",
  };

  return runVideoEngineNode({
    ...args,
    clientPage: args.clientPage ?? `canvas/${args.projectId}/sbv1`,
    node: {
      ...args.node,
      type: "video-engine",
      modelKey,
      portraitAssetRefs: args.node.portraitAssetRefs,
      data: {
        providerId,
        modelKey,
        prompt,
        params,
        mainFrameImageUrl,
        referenceImageUrls,
        lastFrameImageUrl,
        forceReferenceMode:
          referenceMode === "first_last" &&
          portraitRefs.some((r) => r.role === "first_frame")
            ? false
            : forceReferenceMode || portraitRefs.length > 0,
        sbv1Billing,
      },
      imageInputs,
      textInputs: [],
    },
  });
}
