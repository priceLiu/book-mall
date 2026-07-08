import { randomUUID } from "crypto";

import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  buildBgRemovePrompt,
  buildCameraAnglePrompt,
  buildDeblurPrompt,
  buildEnhancerPrompt,
  buildFaceSwapPrompt,
  buildAvatarPrompt,
  buildGifPrompt,
  buildImageGeneratorPrompt,
  buildMemePrompt,
  buildObjectRemovePrompt,
  buildPosterPrompt,
  buildRealisticPrompt,
  buildRestorePrompt,
} from "@/lib/ecom/ecom-image-processing-presets";
import {
  buildOutpaintApiParameters,
  DEFAULT_ENHANCE_PROMPT,
  ECOM_IMAGE_PROCESSING_TOOL_KEY,
  ECOM_OUTPAINT_MODEL_KEY,
  ECOM_SEEDREAM_EDITOR_MODEL_KEY,
  ECOM_WAN_I2I_MODEL_KEY,
  ECOM_WANX_PAINTING_MODEL_KEY,
  isKieGenerativeImageModelKey,
  isOutpaintModelKey,
  isQwenEditModelKey,
  isSeedreamEditorModelKey,
  isWanI2iModelKey,
  isWanxPaintingModelKey,
  maxQwenInputImages,
  resolveKieNanoProApiModel,
  type ImageProcessingMode,
} from "@/lib/ecom/ecom-image-processing-models";
import { ecomClientPage } from "@/lib/ecom/ecom-tool-keys";
import { buildKieImageCreateArgs } from "@/lib/canvas/providers/kie";
import {
  ecomGwCreateKieJob,
  ecomGwImage2ImageAsync,
  ecomGwImageOutPainting,
  ecomGwPollKie,
  ecomGwQwenImageEdit,
  ecomGwVolcengineImageEdit,
} from "@/lib/gateway/ecom-tool-gateway-client";
import { prisma } from "@/lib/prisma";

function parseDataUrl(dataUrl: string): { buf: Buffer; contentType: string; ext: string } {
  const m = /^data:([^;]+);base64,([\s\S]+)$/.exec(dataUrl.trim());
  if (!m) throw new Error("无效的图片 data URL");
  const contentType = m[1] || "image/png";
  const buf = Buffer.from(m[2], "base64");
  const ext = contentType.includes("jpeg")
    ? "jpg"
    : contentType.includes("webp")
      ? "webp"
      : "png";
  return { buf, contentType, ext };
}

async function ensurePublicImageUrl(
  userId: string,
  image: string,
): Promise<string> {
  const trimmed = image.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  if (trimmed.startsWith("data:")) {
    const { buf, contentType, ext } = parseDataUrl(trimmed);
    return uploadCanvasUserBuffer({ userId, ext, buf, contentType });
  }
  throw new Error("不支持的图片格式");
}

async function downloadToOss(opts: {
  userId: string;
  url: string;
  title: string;
  prompt: string;
  model: string;
  mode: ImageProcessingMode;
  logId: string;
  meta?: Record<string, unknown>;
}) {
  const res = await fetch(opts.url);
  if (!res.ok) throw new Error(`下载生成图失败 HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") ?? "image/png";
  const ext = contentType.includes("jpeg")
    ? "jpg"
    : contentType.includes("webp")
      ? "webp"
      : "png";
  const ossUrl = await uploadCanvasUserBuffer({
    userId: opts.userId,
    ext,
    buf,
    contentType,
  });
  const asset = await prisma.ecomAsset.create({
    data: {
      userId: opts.userId,
      module: "image-processing",
      kind: "image",
      title: opts.title.slice(0, 80),
      prompt: opts.prompt,
      ossUrl,
      thumbnailUrl: ossUrl,
      meta: {
        model: opts.model,
        mode: opts.mode,
        logId: opts.logId,
        ...opts.meta,
      },
    },
  });
  return { asset, ossUrl };
}

async function persistGatewayImageUrls(opts: {
  userId: string;
  imageUrls: string[];
  prompt: string;
  model: string;
  mode: ImageProcessingMode;
  logId: string;
}) {
  const results = [];
  for (const url of opts.imageUrls) {
    const row = await downloadToOss({
      userId: opts.userId,
      url,
      title: opts.prompt,
      prompt: opts.prompt,
      model: opts.model,
      mode: opts.mode,
      logId: opts.logId,
    });
    results.push(row);
  }
  if (results.length === 0) throw new Error("未获得可保存的图像");
  return results;
}

function buildQwenContent(opts: {
  images: string[];
  prompt: string;
  maskImageDataUrl?: string;
}) {
  const content: Array<{ image?: string; text?: string }> = [];
  for (const img of opts.images) {
    content.push({ image: img });
  }
  if (opts.maskImageDataUrl?.trim()) {
    content.push({ image: opts.maskImageDataUrl.trim() });
  }
  content.push({ text: opts.prompt.trim() });
  return content;
}

async function runQwenEdit(opts: {
  userId: string;
  model: string;
  images: string[];
  prompt: string;
  maskImageDataUrl?: string;
  parameters?: Record<string, unknown>;
  mode: ImageProcessingMode;
}) {
  const workspaceId = randomUUID().slice(0, 8);
  const clientPage = ecomClientPage(
    opts.userId,
    workspaceId,
    ECOM_IMAGE_PROCESSING_TOOL_KEY,
  );
  const content = buildQwenContent({
    images: opts.images,
    prompt: opts.prompt,
    maskImageDataUrl: opts.maskImageDataUrl,
  });
  const { imageUrls, logId } = await ecomGwQwenImageEdit(opts.userId, {
    model: opts.model,
    content,
    parameters: opts.parameters,
    clientPage,
  });
  const results = await persistGatewayImageUrls({
    userId: opts.userId,
    imageUrls,
    prompt: opts.prompt,
    model: opts.model,
    mode: opts.mode,
    logId,
  });
  return { results, logId };
}

export async function ecomImageProcessingRetouch(opts: {
  userId: string;
  model: string;
  prompt: string;
  sourceImageDataUrl: string;
  maskImageDataUrl?: string;
  parameters?: Record<string, unknown>;
}) {
  await assertEcomToolkitGatewayAccess(opts.userId);

  if (isWanxPaintingModelKey(opts.model)) {
    if (!opts.maskImageDataUrl?.trim()) {
      throw new Error("万相局部重绘需要涂抹蒙版");
    }
    const workspaceId = randomUUID().slice(0, 8);
    const clientPage = ecomClientPage(
      opts.userId,
      workspaceId,
      ECOM_IMAGE_PROCESSING_TOOL_KEY,
    );
    const baseUrl = await ensurePublicImageUrl(
      opts.userId,
      opts.sourceImageDataUrl,
    );
    const maskUrl = await ensurePublicImageUrl(
      opts.userId,
      opts.maskImageDataUrl,
    );
    const params = { ...(opts.parameters ?? {}) };
    const n = params.n !== undefined ? Number(params.n) : 1;
    if (params.n !== undefined) delete params.n;
    const { imageUrls, logId } = await ecomGwImage2ImageAsync(opts.userId, {
      model: ECOM_WANX_PAINTING_MODEL_KEY,
      input: {
        prompt: opts.prompt.trim(),
        base_image_url: baseUrl,
        mask_image_url: maskUrl,
      },
      parameters: { ...params, n },
      clientPage,
    });
    const results = await persistGatewayImageUrls({
      userId: opts.userId,
      imageUrls,
      prompt: opts.prompt,
      model: opts.model,
      mode: "retouch",
      logId,
    });
    return { results, logId };
  }

  if (!isQwenEditModelKey(opts.model)) {
    throw new Error("不支持的修图模型");
  }

  return runQwenEdit({
    userId: opts.userId,
    model: opts.model,
    images: [opts.sourceImageDataUrl],
    prompt: opts.prompt,
    maskImageDataUrl: opts.maskImageDataUrl,
    parameters: opts.parameters,
    mode: "retouch",
  });
}

export async function ecomImageProcessingEnhancer(opts: {
  userId: string;
  model: string;
  prompt?: string;
  enhancerStyle?: string;
  sourceImageDataUrl: string;
  parameters?: Record<string, unknown>;
}) {
  await assertEcomToolkitGatewayAccess(opts.userId);
  if (!isQwenEditModelKey(opts.model)) {
    throw new Error("图像增强仅支持 Qwen 图像编辑模型");
  }
  const prompt =
    opts.prompt?.trim() ||
    buildEnhancerPrompt(opts.enhancerStyle ?? "standard") ||
    DEFAULT_ENHANCE_PROMPT;
  return runQwenEdit({
    userId: opts.userId,
    model: opts.model,
    images: [opts.sourceImageDataUrl],
    prompt,
    parameters: opts.parameters,
    mode: "enhancer",
  });
}

async function runSeedreamSingleImage(opts: {
  userId: string;
  model: string;
  prompt: string;
  sourceImageDataUrl: string;
  parameters?: Record<string, unknown>;
  mode: ImageProcessingMode;
}) {
  const workspaceId = randomUUID().slice(0, 8);
  const clientPage = ecomClientPage(
    opts.userId,
    workspaceId,
    ECOM_IMAGE_PROCESSING_TOOL_KEY,
  );
  const { images: volcImages, logId } = await ecomGwVolcengineImageEdit(
    opts.userId,
    {
      model: opts.model,
      prompt: opts.prompt,
      image: opts.sourceImageDataUrl,
      parameters: opts.parameters,
      clientPage,
    },
  );
  const results = [];
  for (const img of volcImages) {
    let url = img.url;
    if (!url && img.b64) {
      const buf = Buffer.from(img.b64, "base64");
      const ossUrl = await uploadCanvasUserBuffer({
        userId: opts.userId,
        ext: "png",
        buf,
        contentType: "image/png",
      });
      const asset = await prisma.ecomAsset.create({
        data: {
          userId: opts.userId,
          module: "image-processing",
          kind: "image",
          title: opts.prompt.slice(0, 80),
          prompt: opts.prompt,
          ossUrl,
          thumbnailUrl: ossUrl,
          meta: { model: opts.model, mode: opts.mode, logId },
        },
      });
      results.push({ asset, ossUrl });
      continue;
    }
    if (!url) continue;
    const row = await downloadToOss({
      userId: opts.userId,
      url,
      title: opts.prompt,
      prompt: opts.prompt,
      model: opts.model,
      mode: opts.mode,
      logId,
    });
    results.push(row);
  }
  if (results.length === 0) throw new Error("未获得可保存的图像");
  return { results, logId };
}

export async function ecomImageProcessingRestore(opts: {
  userId: string;
  model: string;
  sourceImageDataUrl: string;
  repairType?: string;
  upscaleFactor?: string;
  parameters?: Record<string, unknown>;
}) {
  await assertEcomToolkitGatewayAccess(opts.userId);
  const prompt = buildRestorePrompt(
    opts.repairType ?? "auto",
    opts.upscaleFactor ?? "1",
  );
  if (isQwenEditModelKey(opts.model)) {
    return runQwenEdit({
      userId: opts.userId,
      model: opts.model,
      images: [opts.sourceImageDataUrl],
      prompt,
      parameters: opts.parameters,
      mode: "restore",
    });
  }
  if (!isSeedreamEditorModelKey(opts.model)) {
    throw new Error("不支持的修复模型");
  }
  return runSeedreamSingleImage({
    userId: opts.userId,
    model: opts.model,
    prompt,
    sourceImageDataUrl: opts.sourceImageDataUrl,
    parameters: opts.parameters,
    mode: "restore",
  });
}

export async function ecomImageProcessingFaceSwap(opts: {
  userId: string;
  model: string;
  sourceFaceDataUrl: string;
  targetImageDataUrl: string;
  blendMode?: string;
  postProcess?: string;
  algorithm?: string;
  parameters?: Record<string, unknown>;
}) {
  await assertEcomToolkitGatewayAccess(opts.userId);
  const prompt = buildFaceSwapPrompt({
    blendMode: opts.blendMode ?? "natural",
    postProcess: opts.postProcess ?? "auto-beauty",
    algorithm: opts.algorithm ?? "standard",
  });
  if (isQwenEditModelKey(opts.model)) {
    return runQwenEdit({
      userId: opts.userId,
      model: opts.model,
      images: [opts.sourceFaceDataUrl, opts.targetImageDataUrl],
      prompt,
      parameters: opts.parameters,
      mode: "face-swap",
    });
  }
  if (!isSeedreamEditorModelKey(opts.model)) {
    throw new Error("不支持的换脸模型");
  }
  return runSeedreamSingleImage({
    userId: opts.userId,
    model: opts.model,
    prompt: `${prompt} Reference face is provided separately; apply to the target portrait.`,
    sourceImageDataUrl: opts.targetImageDataUrl,
    parameters: opts.parameters,
    mode: "face-swap",
  });
}

export async function ecomImageProcessingOutpaint(opts: {
  userId: string;
  model: string;
  prompt?: string;
  sourceImageDataUrl: string;
  parameters?: Record<string, unknown>;
}) {
  await assertEcomToolkitGatewayAccess(opts.userId);

  if (isQwenEditModelKey(opts.model)) {
    const prompt =
      opts.prompt?.trim() ||
      "Extend the image canvas naturally while keeping the main subject unchanged.";
    return runQwenEdit({
      userId: opts.userId,
      model: opts.model,
      images: [opts.sourceImageDataUrl],
      prompt,
      parameters: opts.parameters,
      mode: "outpaint",
    });
  }

  if (!isOutpaintModelKey(opts.model)) {
    throw new Error("不支持的扩图模型");
  }

  const workspaceId = randomUUID().slice(0, 8);
  const clientPage = ecomClientPage(
    opts.userId,
    workspaceId,
    ECOM_IMAGE_PROCESSING_TOOL_KEY,
  );
  const imageUrl = await ensurePublicImageUrl(opts.userId, opts.sourceImageDataUrl);
  const apiParams = buildOutpaintApiParameters(opts.parameters ?? {});
  const { imageUrls, logId } = await ecomGwImageOutPainting(opts.userId, {
    imageUrl,
    parameters: apiParams,
    clientPage,
  });
  const results = await persistGatewayImageUrls({
    userId: opts.userId,
    imageUrls,
    prompt: opts.prompt?.trim() || "AI 扩图",
    model: ECOM_OUTPAINT_MODEL_KEY,
    mode: "outpaint",
    logId,
  });
  return { results, logId };
}

export async function ecomImageProcessingEditor(opts: {
  userId: string;
  prompt: string;
  sourceImageDataUrls?: string[];
  sourceImageDataUrl?: string;
  parameters?: Record<string, unknown>;
  model?: string;
}) {
  await assertEcomToolkitGatewayAccess(opts.userId);
  const model = opts.model?.trim() || ECOM_SEEDREAM_EDITOR_MODEL_KEY;
  const images =
    opts.sourceImageDataUrls?.filter((u) => u.trim()) ??
    (opts.sourceImageDataUrl?.trim() ? [opts.sourceImageDataUrl.trim()] : []);

  if (isWanI2iModelKey(model)) {
    if (images.length === 0) throw new Error("请上传至少一张图片");
    if (images.length > 3) throw new Error("最多上传 3 张图片");
    const workspaceId = randomUUID().slice(0, 8);
    const clientPage = ecomClientPage(
      opts.userId,
      workspaceId,
      ECOM_IMAGE_PROCESSING_TOOL_KEY,
    );
    const resolved = await Promise.all(
      images.map((img) => ensurePublicImageUrl(opts.userId, img)),
    );
    const params = { ...(opts.parameters ?? {}) };
    const n = params.n !== undefined ? Number(params.n) : 1;
    if (params.n !== undefined) delete params.n;
    if (params.seed === "" || params.seed === undefined) delete params.seed;
    if (params.size === "") delete params.size;
    const negative =
      typeof params.negative_prompt === "string"
        ? params.negative_prompt
        : undefined;
    if (negative !== undefined) delete params.negative_prompt;

    const { imageUrls, logId } = await ecomGwImage2ImageAsync(opts.userId, {
      model: ECOM_WAN_I2I_MODEL_KEY,
      input: {
        prompt: opts.prompt.trim(),
        images: resolved,
        ...(negative ? { negative_prompt: negative } : {}),
      },
      parameters: { ...params, n },
      clientPage,
    });
    const results = await persistGatewayImageUrls({
      userId: opts.userId,
      imageUrls,
      prompt: opts.prompt,
      model,
      mode: "editor",
      logId,
    });
    return { results, logId };
  }

  if (isQwenEditModelKey(model)) {
    if (images.length === 0) throw new Error("请上传至少一张图片");
    const maxIn = maxQwenInputImages(model);
    if (images.length > maxIn) {
      throw new Error(`最多上传 ${maxIn} 张图片`);
    }
    return runQwenEdit({
      userId: opts.userId,
      model,
      images,
      prompt: opts.prompt,
      parameters: opts.parameters,
      mode: "editor",
    });
  }

  if (!isSeedreamEditorModelKey(model)) {
    throw new Error("不支持的编辑器模型");
  }

  const workspaceId = randomUUID().slice(0, 8);
  const clientPage = ecomClientPage(
    opts.userId,
    workspaceId,
    ECOM_IMAGE_PROCESSING_TOOL_KEY,
  );

  const { images: volcImages, logId } = await ecomGwVolcengineImageEdit(opts.userId, {
    model,
    prompt: opts.prompt,
    image: images[0],
    parameters: opts.parameters,
    clientPage,
  });

  const results = [];
  for (const img of volcImages) {
    let url = img.url;
    if (!url && img.b64) {
      const buf = Buffer.from(img.b64, "base64");
      const ossUrl = await uploadCanvasUserBuffer({
        userId: opts.userId,
        ext: "png",
        buf,
        contentType: "image/png",
      });
      const asset = await prisma.ecomAsset.create({
        data: {
          userId: opts.userId,
          module: "image-processing",
          kind: "image",
          title: opts.prompt.slice(0, 80),
          prompt: opts.prompt,
          ossUrl,
          thumbnailUrl: ossUrl,
          meta: { model, mode: "editor", logId },
        },
      });
      results.push({ asset, ossUrl });
      continue;
    }
    if (!url) continue;
    const row = await downloadToOss({
      userId: opts.userId,
      url,
      title: opts.prompt,
      prompt: opts.prompt,
      model,
      mode: "editor",
      logId,
    });
    results.push(row);
  }
  if (results.length === 0) throw new Error("未获得可保存的图像");
  return { results, logId };
}

const ECOM_SEEDREAM_LITE_MODEL_KEY = "doubao-seedream-5-0-lite";

function buildGenerativeParameters(
  raw: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(raw ?? {}) };
  if (out.seed === "" || out.seed === undefined) delete out.seed;
  if (out.strength !== undefined) delete out.strength;
  if (out.styleImageDataUrl) delete out.styleImageDataUrl;
  return out;
}

export async function ecomImageProcessingBgRemove(opts: {
  userId: string;
  sourceImageDataUrl: string;
  model?: string;
  generativeModel?: string;
  bgMode?: string;
  edgeQuality?: string;
  outputFormat?: string;
  customColor?: string;
  styleImageDataUrl?: string;
  parameters?: Record<string, unknown>;
}) {
  await assertEcomToolkitGatewayAccess(opts.userId);
  const prompt = buildBgRemovePrompt({
    bgMode: opts.bgMode ?? "transparent",
    edgeQuality: opts.edgeQuality ?? "auto",
    customColor: opts.customColor,
  });
  const model =
    opts.generativeModel?.trim() || opts.model?.trim() || "qwen-image-edit-max";
  const params = buildGenerativeParameters(opts.parameters);
  const images = [opts.sourceImageDataUrl];
  if (opts.styleImageDataUrl?.trim()) {
    images.push(opts.styleImageDataUrl.trim());
  }

  if (isQwenEditModelKey(model)) {
    return runQwenEdit({
      userId: opts.userId,
      model,
      images,
      prompt,
      parameters: params,
      mode: "bg-remove",
    });
  }

  if (!isSeedreamEditorModelKey(model)) {
    throw new Error("不支持的抠图模型");
  }

  return runSeedreamSingleImage({
    userId: opts.userId,
    model,
    prompt,
    sourceImageDataUrl: opts.sourceImageDataUrl,
    parameters: params,
    mode: "bg-remove",
  });
}

export async function ecomImageProcessingObjectRemove(opts: {
  userId: string;
  sourceImageDataUrl: string;
  prompt: string;
  model?: string;
  generativeModel?: string;
  removalMode?: string;
  outputFormat?: string;
  styleImageDataUrl?: string;
  parameters?: Record<string, unknown>;
}) {
  await assertEcomToolkitGatewayAccess(opts.userId);
  if (!opts.prompt.trim()) {
    throw new Error("请描述要移除的内容");
  }
  const builtPrompt = buildObjectRemovePrompt({
    removalMode: opts.removalMode ?? "auto",
    userPrompt: opts.prompt,
  });
  const model =
    opts.generativeModel?.trim() || opts.model?.trim() || ECOM_SEEDREAM_LITE_MODEL_KEY;
  const params = buildGenerativeParameters(opts.parameters);
  const images = [opts.sourceImageDataUrl];
  if (opts.styleImageDataUrl?.trim()) {
    images.push(opts.styleImageDataUrl.trim());
  }

  if (isQwenEditModelKey(model)) {
    return runQwenEdit({
      userId: opts.userId,
      model,
      images,
      prompt: builtPrompt,
      parameters: params,
      mode: "object-remove",
    });
  }

  if (!isSeedreamEditorModelKey(model)) {
    throw new Error("不支持的移除模型");
  }

  return runSeedreamSingleImage({
    userId: opts.userId,
    model,
    prompt: builtPrompt,
    sourceImageDataUrl: opts.sourceImageDataUrl,
    parameters: params,
    mode: "object-remove",
  });
}

export async function ecomImageProcessingDeblur(opts: {
  userId: string;
  sourceImageDataUrl: string;
  model?: string;
  generativeModel?: string;
  blurType?: string;
  sharpenStrength?: string;
  styleImageDataUrl?: string;
  parameters?: Record<string, unknown>;
}) {
  await assertEcomToolkitGatewayAccess(opts.userId);
  const builtPrompt = buildDeblurPrompt(
    opts.blurType ?? "auto",
    opts.sharpenStrength ?? "medium",
  );
  const model =
    opts.generativeModel?.trim() || opts.model?.trim() || "qwen-image-edit";
  const params = buildGenerativeParameters(opts.parameters);
  const images = [opts.sourceImageDataUrl];
  if (opts.styleImageDataUrl?.trim()) {
    images.push(opts.styleImageDataUrl.trim());
  }

  if (isQwenEditModelKey(model)) {
    return runQwenEdit({
      userId: opts.userId,
      model,
      images,
      prompt: builtPrompt,
      parameters: params,
      mode: "deblur",
    });
  }

  if (!isSeedreamEditorModelKey(model)) {
    throw new Error("不支持的去模糊模型");
  }

  return runSeedreamSingleImage({
    userId: opts.userId,
    model,
    prompt: builtPrompt,
    sourceImageDataUrl: opts.sourceImageDataUrl,
    parameters: params,
    mode: "deblur",
  });
}

async function pollKieImageJob(
  userId: string,
  taskId: string,
  logId: string,
): Promise<string> {
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const polled = await ecomGwPollKie(userId, { taskId, gatewayLogId: logId });
    if (polled.status === "SUCCEEDED" && polled.outputUrl) {
      return polled.outputUrl;
    }
    if (polled.status === "FAILED") {
      throw new Error(polled.failMessage ?? "生图任务失败");
    }
  }
  throw new Error("生图超时，请稍后重试");
}

async function runVolcengineGenerate(opts: {
  userId: string;
  model: string;
  prompt: string;
  sourceImageDataUrl?: string;
  parameters?: Record<string, unknown>;
  mode: ImageProcessingMode;
}) {
  const workspaceId = randomUUID().slice(0, 8);
  const clientPage = ecomClientPage(
    opts.userId,
    workspaceId,
    ECOM_IMAGE_PROCESSING_TOOL_KEY,
  );
  const { images: volcImages, logId } = await ecomGwVolcengineImageEdit(
    opts.userId,
    {
      model: opts.model,
      prompt: opts.prompt,
      image: opts.sourceImageDataUrl,
      parameters: opts.parameters,
      clientPage,
    },
  );
  const results = [];
  for (const img of volcImages) {
    let url = img.url;
    if (!url && img.b64) {
      const buf = Buffer.from(img.b64, "base64");
      const ossUrl = await uploadCanvasUserBuffer({
        userId: opts.userId,
        ext: "png",
        buf,
        contentType: "image/png",
      });
      const asset = await prisma.ecomAsset.create({
        data: {
          userId: opts.userId,
          module: "image-processing",
          kind: "image",
          title: opts.prompt.slice(0, 80),
          prompt: opts.prompt,
          ossUrl,
          thumbnailUrl: ossUrl,
          meta: { model: opts.model, mode: opts.mode, logId },
        },
      });
      results.push({ asset, ossUrl });
      continue;
    }
    if (!url) continue;
    const row = await downloadToOss({
      userId: opts.userId,
      url,
      title: opts.prompt,
      prompt: opts.prompt,
      model: opts.model,
      mode: opts.mode,
      logId,
    });
    results.push(row);
  }
  if (results.length === 0) throw new Error("未获得可保存的图像");
  return { results, logId };
}

async function runKieTextToImage(opts: {
  userId: string;
  model: string;
  prompt: string;
  styleImageDataUrl?: string;
  parameters?: Record<string, unknown>;
  mode: ImageProcessingMode;
}) {
  const apiModel = resolveKieNanoProApiModel(opts.model);
  const refUrls: string[] = [];
  if (opts.styleImageDataUrl?.trim()) {
    refUrls.push(
      await ensurePublicImageUrl(opts.userId, opts.styleImageDataUrl.trim()),
    );
  }
  const params = { ...(opts.parameters ?? {}) };
  const aspect = typeof params.aspect_ratio === "string" ? params.aspect_ratio : "1:1";
  if (params.size) {
    const sizeMap: Record<string, string> = {
      "2048x2048": "1:1",
      "2048x1152": "16:9",
      "1152x2048": "9:16",
      "1638x2048": "4:5",
      "1536x2048": "3:4",
      "2048x1536": "4:3",
    };
    const mapped = sizeMap[String(params.size)];
    if (mapped) params.aspect_ratio = mapped;
  }
  const { model, input } = buildKieImageCreateArgs({
    modelKey: apiModel,
    prompt: opts.prompt,
    imageUrls: refUrls,
    params: {
      aspect_ratio: aspect,
      resolution: params.resolution ?? "2K",
      output_format: params.output_format ?? "png",
      n: params.n,
    },
  });
  const workspaceId = randomUUID().slice(0, 8);
  const clientPage = ecomClientPage(
    opts.userId,
    workspaceId,
    ECOM_IMAGE_PROCESSING_TOOL_KEY,
  );
  const { taskId, logId } = await ecomGwCreateKieJob(opts.userId, {
    model,
    input,
    clientPage,
  });
  const vendorUrl = await pollKieImageJob(opts.userId, taskId, logId);
  const results = await persistGatewayImageUrls({
    userId: opts.userId,
    imageUrls: [vendorUrl],
    prompt: opts.prompt,
    model: opts.model,
    mode: opts.mode,
    logId,
  });
  return { results, logId };
}

export async function ecomImageProcessingCameraAngle(opts: {
  userId: string;
  sourceImageDataUrl: string;
  model?: string;
  generativeModel?: string;
  cameraAngle?: string;
  extraGuidance?: string;
  styleImageDataUrl?: string;
  parameters?: Record<string, unknown>;
}) {
  await assertEcomToolkitGatewayAccess(opts.userId);
  const builtPrompt = buildCameraAnglePrompt(
    opts.cameraAngle ?? "three-quarter",
    opts.extraGuidance,
  );
  const model =
    opts.generativeModel?.trim() || opts.model?.trim() || "qwen-image-edit";
  const params = buildGenerativeParameters(opts.parameters);
  const images = [opts.sourceImageDataUrl];
  if (opts.styleImageDataUrl?.trim()) {
    images.push(opts.styleImageDataUrl.trim());
  }

  if (isQwenEditModelKey(model)) {
    return runQwenEdit({
      userId: opts.userId,
      model,
      images,
      prompt: builtPrompt,
      parameters: params,
      mode: "camera-angle",
    });
  }

  if (isSeedreamEditorModelKey(model)) {
    return runVolcengineGenerate({
      userId: opts.userId,
      model,
      prompt: builtPrompt,
      sourceImageDataUrl: opts.sourceImageDataUrl,
      parameters: params,
      mode: "camera-angle",
    });
  }

  throw new Error("不支持的相机角度模型");
}

export async function ecomImageProcessingPoster(opts: {
  userId: string;
  title: string;
  subtitle?: string;
  sceneDescription: string;
  model?: string;
  generativeModel?: string;
  posterStyle?: string;
  printFormat?: string;
  styleImageDataUrl?: string;
  parameters?: Record<string, unknown>;
}) {
  await assertEcomToolkitGatewayAccess(opts.userId);
  if (!opts.sceneDescription.trim()) {
    throw new Error("请填写场景描述");
  }
  const builtPrompt = buildPosterPrompt({
    title: opts.title,
    subtitle: opts.subtitle,
    sceneDescription: opts.sceneDescription,
    styleId: opts.posterStyle ?? "concert",
    printFormat: opts.printFormat,
  });
  const model =
    opts.generativeModel?.trim() ||
    opts.model?.trim() ||
    "doubao-seedream-5-0-lite";
  const params = buildGenerativeParameters(opts.parameters);

  if (isKieGenerativeImageModelKey(model)) {
    return runKieTextToImage({
      userId: opts.userId,
      model,
      prompt: builtPrompt,
      styleImageDataUrl: opts.styleImageDataUrl,
      parameters: params,
      mode: "poster",
    });
  }

  if (isSeedreamEditorModelKey(model)) {
    return runVolcengineGenerate({
      userId: opts.userId,
      model,
      prompt: builtPrompt,
      parameters: params,
      mode: "poster",
    });
  }

  throw new Error("不支持的海报生成模型");
}

async function ecomImageProcessingTextToImage(opts: {
  userId: string;
  prompt: string;
  model?: string;
  generativeModel?: string;
  styleImageDataUrl?: string;
  parameters?: Record<string, unknown>;
  mode: ImageProcessingMode;
}) {
  await assertEcomToolkitGatewayAccess(opts.userId);
  const model =
    opts.generativeModel?.trim() ||
    opts.model?.trim() ||
    "doubao-seedream-5-0-lite";
  const params = buildGenerativeParameters(opts.parameters);

  if (isKieGenerativeImageModelKey(model)) {
    return runKieTextToImage({
      userId: opts.userId,
      model,
      prompt: opts.prompt,
      styleImageDataUrl: opts.styleImageDataUrl,
      parameters: params,
      mode: opts.mode,
    });
  }

  if (isSeedreamEditorModelKey(model)) {
    return runVolcengineGenerate({
      userId: opts.userId,
      model,
      prompt: opts.prompt,
      parameters: params,
      mode: opts.mode,
    });
  }

  throw new Error("不支持的生成模型");
}

export async function ecomImageProcessingMeme(opts: {
  userId: string;
  sceneDescription: string;
  generativeModel?: string;
  memeFormat?: string;
  topText?: string;
  bottomText?: string;
  textStyle?: string;
  styleImageDataUrl?: string;
  parameters?: Record<string, unknown>;
}) {
  if (!opts.sceneDescription.trim()) {
    throw new Error("请描述场景");
  }
  const prompt = buildMemePrompt({
    memeFormat: opts.memeFormat ?? "classic",
    sceneDescription: opts.sceneDescription,
    topText: opts.topText,
    bottomText: opts.bottomText,
    textStyle: opts.textStyle,
  });
  return ecomImageProcessingTextToImage({
    userId: opts.userId,
    prompt,
    generativeModel: opts.generativeModel,
    styleImageDataUrl: opts.styleImageDataUrl,
    parameters: opts.parameters,
    mode: "meme",
  });
}

export async function ecomImageProcessingAvatar(opts: {
  userId: string;
  characterDescription: string;
  generativeModel?: string;
  avatarStyle?: string;
  cropShape?: string;
  styleImageDataUrl?: string;
  parameters?: Record<string, unknown>;
}) {
  if (!opts.characterDescription.trim()) {
    throw new Error("请描述角色");
  }
  const prompt = buildAvatarPrompt({
    avatarStyle: opts.avatarStyle ?? "pixar-3d",
    characterDescription: opts.characterDescription,
    cropShape: opts.cropShape,
  });
  return ecomImageProcessingTextToImage({
    userId: opts.userId,
    prompt,
    generativeModel: opts.generativeModel,
    styleImageDataUrl: opts.styleImageDataUrl,
    parameters: opts.parameters,
    mode: "avatar",
  });
}

export async function ecomImageProcessingGif(opts: {
  userId: string;
  animationDescription: string;
  generativeModel?: string;
  animationType?: string;
  durationSec?: string;
  gifSize?: string;
  frameRate?: string;
  styleImageDataUrl?: string;
  parameters?: Record<string, unknown>;
}) {
  if (!opts.animationDescription.trim()) {
    throw new Error("请描述动画");
  }
  const prompt = buildGifPrompt({
    animationType: opts.animationType ?? "seamless-loop",
    animationDescription: opts.animationDescription,
    durationSec: opts.durationSec,
    gifSize: opts.gifSize,
    frameRate: opts.frameRate,
  });
  return ecomImageProcessingTextToImage({
    userId: opts.userId,
    prompt,
    generativeModel: opts.generativeModel,
    styleImageDataUrl: opts.styleImageDataUrl,
    parameters: opts.parameters,
    mode: "gif",
  });
}

export async function ecomImageProcessingRealistic(opts: {
  userId: string;
  sceneDescription: string;
  generativeModel?: string;
  cameraLens?: string;
  lighting?: string;
  styleImageDataUrl?: string;
  parameters?: Record<string, unknown>;
}) {
  if (!opts.sceneDescription.trim()) {
    throw new Error("请描述场景或主题");
  }
  const prompt = buildRealisticPrompt({
    sceneDescription: opts.sceneDescription,
    cameraLens: opts.cameraLens,
    lighting: opts.lighting,
  });
  return ecomImageProcessingTextToImage({
    userId: opts.userId,
    prompt,
    generativeModel: opts.generativeModel,
    styleImageDataUrl: opts.styleImageDataUrl,
    parameters: opts.parameters,
    mode: "realistic",
  });
}

export async function ecomImageProcessingImageGenerator(opts: {
  userId: string;
  prompt: string;
  generativeModel?: string;
  styleId?: string;
  negativePrompt?: string;
  styleImageDataUrl?: string;
  parameters?: Record<string, unknown>;
}) {
  if (!opts.prompt.trim()) {
    throw new Error("请描述你的图片");
  }
  const builtPrompt = buildImageGeneratorPrompt({
    prompt: opts.prompt,
    styleId: opts.styleId,
    negativePrompt: opts.negativePrompt,
  });
  return ecomImageProcessingTextToImage({
    userId: opts.userId,
    prompt: builtPrompt,
    generativeModel: opts.generativeModel,
    styleImageDataUrl: opts.styleImageDataUrl,
    parameters: opts.parameters,
    mode: "image-generator",
  });
}
