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
  sbv1VideoModelUsesPortraitLibrary,
} from "./sbv1-video-model-reference";
import {
  isDashscopeHappyhorseImageToVideoModel,
  isDashscopeSbv1TextToVideoModel,
} from "./dashscope-sbv1-t2v";
import { isTopazCanvasVideoModelKey } from "./providers/topaz";

type Sbv1ReferenceMode = "omni" | "first_last" | "smart_multi";
type Sbv1DockInputMode = "t2v" | "i2v" | "first_last" | "omni" | "multi_ref";

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
  const usesPortraitLibrary = sbv1VideoModelUsesPortraitLibrary(
    modelKey,
    providerId,
  );
  const portraitRefs = usesPortraitLibrary
    ? (args.node.portraitAssetRefs ?? [])
    : [];
  const hasPortraitRefs = portraitRefs.length > 0;
  /** Seedance：已入库 asset://；其它模型：仅 OSS HTTPS */
  const imageInputs = httpsImageUrls(args.node.imageInputs ?? []);

  if (!providerId || !modelKey) {
    throw new CanvasProjectError(
      "INVALID_INPUT",
      "sbv1-video-engine 缺少模型配置",
    );
  }

  const isTopazHd =
    data.creationType === "hd-video" || isTopazCanvasVideoModelKey(modelKey);

  if (isTopazHd) {
    const videoUrls = Array.isArray(params.reference_video_urls)
      ? (params.reference_video_urls as unknown[]).filter(
          (u): u is string =>
            typeof u === "string" && /^https?:\/\//.test(u.trim()),
        )
      : [];
    if (!videoUrls.length) {
      throw new CanvasProjectError(
        "INVALID_INPUT",
        "请连接上游视频后再生成高清视频",
      );
    }
    params.reference_video_urls = videoUrls;
    params.resolution = resolution;
    return runVideoEngineNode({
      ...args,
      clientPage: args.clientPage ?? `canvas/${args.projectId}/sbv1`,
      node: {
        ...args.node,
        type: "video-engine",
        modelKey,
        data: {
          providerId,
          modelKey,
          prompt: promptRaw || "Topaz video enhance",
          params,
          resolution,
        },
        imageInputs: [],
        textInputs: [],
      },
    });
  }

  const isMotionControl =
    modelKey === "kling-2.6/motion-control" ||
    modelKey === "kling-3.0/motion-control";

  const dockInputModeRaw = data.dockInputMode as Sbv1DockInputMode | undefined;
  const dockInputMode: Sbv1DockInputMode =
    dockInputModeRaw ??
    (modelKey === "kling-3.0/video"
      ? "t2v"
      : isDashscopeSbv1TextToVideoModel(modelKey)
        ? "t2v"
        : isDashscopeHappyhorseImageToVideoModel(modelKey)
          ? "i2v"
          : "omni");
  const isDashscopeT2v = isDashscopeSbv1TextToVideoModel(modelKey);
  const isKlingTextToVideo =
    modelKey === "kling-3.0/video" && dockInputMode === "t2v";
  const isTextToVideoOnly = isDashscopeT2v || isKlingTextToVideo;

  if (
    !promptRaw &&
    imageInputs.length === 0 &&
    !hasPortraitRefs &&
    !isMotionControl &&
    !isTextToVideoOnly
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

  if (isTextToVideoOnly) {
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
  const refApi = getSbv1VideoModelRefCaps(modelKey, {
    multiShots: params.multi_shots === true,
    providerId,
  }).refApi;
  if (refApi === "bailian_r2v_media") {
    params.ratio = aspectRatio;
    params.resolution = /^720p$/i.test(resolution) ? "720P" : "1080P";
    params.duration = durationSec;
  }
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
      portraitAssetRefs: usesPortraitLibrary ? args.node.portraitAssetRefs : [],
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
        dockInputMode,
      },
      imageInputs,
      textInputs: [],
    },
  });
}
