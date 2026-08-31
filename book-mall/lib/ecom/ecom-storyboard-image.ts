import { randomUUID } from "crypto";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { ecomClientPage } from "@/lib/ecom/ecom-tool-keys";
import {
  ECOM_STORYBOARD_DEFAULT_IMAGE_MODEL,
} from "@/lib/gateway/ecom-storyboard-chat-models";
import { buildKieImageCreateArgs } from "@/lib/canvas/providers/kie";
import {
  ecomGwCreateDashscopeJob,
  ecomGwCreateKieJob,
  ecomGwPollDashscope,
  ecomGwPollKie,
} from "@/lib/gateway/ecom-tool-gateway-client";
import {
  ECOM_STORYBOARD_MODULE,
  ECOM_STORYBOARD_TOOL_KEY,
  type StoryboardReference,
  type StoryboardSheet,
  storyboardSheetSchema,
} from "@/lib/ecom/ecom-storyboard-types";
import {
  resolveKlingV3Resolution,
  resolveStoryboardWan27JobSize,
  resolveWan27ImageSize,
  resolveWanxImageSize,
  type EcomStoryboardWanxSize,
} from "@/lib/ecom/ecom-storyboard-gen-params";
import {
  buildCharacterRefPrompt,
  buildStoryboardImagePromptContext,
  resolveCharacterAppearance,
  resolveStoryboardPanelImagePrompt,
  buildStoryboardPanelInvokePrompt,
  buildStoryboardPanelRefGuideForUrls,
} from "@/lib/ecom/ecom-storyboard-image-prompt";
import {
  isStoryboardDashscopeImageModel,
  isStoryboardKieImageModel,
  isStoryboardKlingImageModel,
  isStoryboardRefCapableImageModel,
  isWan26ImageModel,
  resolveStoryboardDashscopeModel,
  resolveStoryboardKieModel,
  resolveStoryboardKlingModel,
} from "@/lib/ecom/ecom-storyboard-image-models";
import {
  clearStoryboardPanelImagesPending,
  markStoryboardPanelImagesPending,
} from "@/lib/ecom/ecom-storyboard-pending-images";
import { ensureStoryboardRefImagesForWan27 } from "@/lib/ecom/ecom-storyboard-ref-image";
import {
  isDashscopeMultimodalImageGenModel,
  isQwenImageEditModel,
  isZImageTurboModel,
} from "@/lib/gateway/qwen-image-edit-proxy";
import {
  assertEcomStoryboardImageEditRefs,
  ecomStoryboardImageEditMaxRefs,
} from "@/lib/ecom/ecom-storyboard-image-edit";
import {
  requireStoryboardProductRef,
  resolveStoryboardImageGenRefs,
} from "@/lib/ecom/ecom-storyboard-refs";
import {
  addStoryboardReferenceUpload,
  getEcomStoryboardProject,
  updateEcomStoryboardProject,
} from "@/lib/ecom/ecom-storyboard-service";
import { resolveEcomImageGenConcurrency } from "@/lib/ecom/ecom-image-gen-concurrency";
import type { ProductDesignSettings } from "@/lib/ecom/ecom-product-design-types";
import { mapWithConcurrency } from "@/lib/generation/poll-parallel";
import { persistStoryboardPanelImageUrl } from "@/lib/ecom/ecom-storyboard-sheet-reconcile";

function isTransientPollError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg === "fetch failed" ||
    msg.includes("网络异常") ||
    msg.includes("ECONNRESET") ||
    msg.includes("ETIMEDOUT")
  );
}

async function pollWanxImage(
  userId: string,
  taskId: string,
  logId: string,
): Promise<string> {
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    let polled: Awaited<ReturnType<typeof ecomGwPollDashscope>>;
    try {
      polled = await ecomGwPollDashscope(userId, { taskId, gatewayLogId: logId });
    } catch (e) {
      if (isTransientPollError(e) && i < 59) continue;
      throw e instanceof Error ? e : new Error(String(e));
    }
    if (polled.status === "SUCCEEDED" && polled.outputUrl) {
      return polled.outputUrl;
    }
    if (polled.status === "FAILED") {
      throw new Error(polled.failMessage ?? "生图任务失败");
    }
  }
  throw new Error("生图超时，请稍后重试");
}

async function pollKieImage(
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

async function downloadAndUpload(
  userId: string,
  imageUrl: string,
  ext = "png",
): Promise<string> {
  let res: Response;
  try {
    res = await fetch(imageUrl);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      msg === "fetch failed"
        ? "下载生成图失败：网络中断，请重试"
        : `下载生成图失败：${msg}`,
    );
  }
  if (!res.ok) throw new Error(`下载生成图失败 HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return uploadCanvasUserBuffer({
    userId,
    ext,
    buf,
    contentType: "image/png",
  });
}

async function generateOneImage(opts: {
  userId: string;
  projectId: string;
  modelKey: string;
  prompt: string;
  action: string;
  meta: Prisma.InputJsonValue;
  imageSize: EcomStoryboardWanxSize;
  aspectRatio: "16:9" | "9:16";
  refImg?: string;
  refMode?: "repaint" | "refonly";
  refStrength?: number;
}): Promise<{ ossUrl: string; chargePoints: number | null; taskId: string }> {
  if (isStoryboardKieImageModel(opts.modelKey)) {
    return generateOneKieImage(opts);
  }
  if (isStoryboardKlingImageModel(opts.modelKey)) {
    return generateOneKlingImage(opts);
  }
  if (isDashscopeMultimodalImageGenModel(opts.modelKey)) {
    return generateOneMultimodalSyncImage(opts);
  }
  if (isStoryboardDashscopeImageModel(opts.modelKey)) {
    return generateOneWan27Image(opts);
  }
  return generateOneWanxImage(opts);
}

async function generateOneMultimodalSyncImage(opts: {
  userId: string;
  projectId: string;
  modelKey: string;
  prompt: string;
  imageSize: EcomStoryboardWanxSize;
  refImg?: string;
}): Promise<{ ossUrl: string; chargePoints: number | null; taskId: string }> {
  const workspaceId = randomUUID().slice(0, 8);
  const clientPage = ecomClientPage(opts.userId, workspaceId, ECOM_STORYBOARD_TOOL_KEY);
  const refs =
    !isZImageTurboModel(opts.modelKey) && opts.refImg
      ? await ensureStoryboardRefImagesForWan27({
          userId: opts.userId,
          urls: [opts.refImg],
        })
      : [];
  assertEcomStoryboardImageEditRefs(opts.modelKey, refs.length);
  const content: Array<{ text: string } | { image: string }> =
    refs.length > 0
      ? [...refs.map((url) => ({ image: url })), { text: opts.prompt }]
      : [{ text: opts.prompt }];
  const { taskId, logId } = await ecomGwCreateDashscopeJob(opts.userId, {
    kind: "multimodal-image-sync",
    model: opts.modelKey,
    content,
    parameters: {
      size: opts.imageSize,
      n: 1,
      prompt_extend: isQwenImageEditModel(opts.modelKey)
        ? true
        : !isZImageTurboModel(opts.modelKey),
      watermark: false,
    },
    clientPage,
  });
  const vendorUrl = await pollWanxImage(opts.userId, taskId, logId);
  const ossUrl = await downloadAndUpload(opts.userId, vendorUrl);
  return { ossUrl, chargePoints: null, taskId };
}

async function generateOneWan27Image(opts: {
  userId: string;
  projectId: string;
  modelKey: string;
  prompt: string;
  imageSize: EcomStoryboardWanxSize;
  refImg?: string;
}): Promise<{ ossUrl: string; chargePoints: number | null; taskId: string }> {
  const apiModel = resolveStoryboardDashscopeModel(opts.modelKey);
  const wan26 = isWan26ImageModel(apiModel) || isWan26ImageModel(opts.modelKey);
  const workspaceId = randomUUID().slice(0, 8);
  const clientPage = ecomClientPage(opts.userId, workspaceId, ECOM_STORYBOARD_TOOL_KEY);
  const refs = opts.refImg
    ? await ensureStoryboardRefImagesForWan27({
        userId: opts.userId,
        urls: [opts.refImg],
      })
    : [];
  const content: Array<{ text: string } | { image: string }> =
    refs.length > 0
      ? wan26
        ? [{ text: opts.prompt }, ...refs.map((url) => ({ image: url }))]
        : [...refs.map((url) => ({ image: url })), { text: opts.prompt }]
      : [{ text: opts.prompt }];
  const { taskId, logId } = await ecomGwCreateDashscopeJob(opts.userId, {
    kind: "wan27-image",
    model: apiModel,
    content,
    size: resolveStoryboardWan27JobSize({
      wan26,
      refCount: refs.length,
      wan27Size: opts.imageSize,
    }),
    n: 1,
    contentOrder: wan26 ? "text-first" : "images-first",
    clientPage,
  });
  const vendorUrl = await pollWanxImage(opts.userId, taskId, logId);
  const ossUrl = await downloadAndUpload(opts.userId, vendorUrl);
  return { ossUrl, chargePoints: null, taskId };
}

async function generateOneKlingImage(opts: {
  userId: string;
  projectId: string;
  modelKey: string;
  prompt: string;
  action: string;
  meta: Prisma.InputJsonValue;
  aspectRatio: "16:9" | "9:16";
}): Promise<{ ossUrl: string; chargePoints: number | null; taskId: string }> {
  const apiModel = resolveStoryboardKlingModel(opts.modelKey);
  const resolution = resolveKlingV3Resolution();
  const workspaceId = randomUUID().slice(0, 8);
  const clientPage = ecomClientPage(opts.userId, workspaceId, ECOM_STORYBOARD_TOOL_KEY);

  const { taskId, logId } = await ecomGwCreateDashscopeJob(opts.userId, {
    kind: "kling-v3-image",
    model: apiModel,
    content: [{ text: opts.prompt }],
    aspectRatio: opts.aspectRatio,
    resolution,
    n: 1,
    clientPage,
  });

  const vendorUrl = await pollWanxImage(opts.userId, taskId, logId);
  const ossUrl = await downloadAndUpload(opts.userId, vendorUrl);

  return { ossUrl, chargePoints: null, taskId };
}

async function generateOneKieImage(opts: {
  userId: string;
  projectId: string;
  modelKey: string;
  prompt: string;
  action: string;
  meta: Prisma.InputJsonValue;
  aspectRatio: "16:9" | "9:16";
}): Promise<{ ossUrl: string; chargePoints: number | null; taskId: string }> {
  const apiModel = resolveStoryboardKieModel(opts.modelKey);
  const workspaceId = randomUUID().slice(0, 8);
  const taskKey = `ecom-sb-img:${opts.projectId}:${workspaceId}`;
  const clientPage = ecomClientPage(opts.userId, workspaceId, ECOM_STORYBOARD_TOOL_KEY);


  const { model, input } = buildKieImageCreateArgs({
    modelKey: apiModel,
    prompt: opts.prompt,
    params: {
      aspect_ratio: opts.aspectRatio,
      resolution: "2K",
      output_format: "png",
    },
  });

  const { taskId, logId } = await ecomGwCreateKieJob(opts.userId, {
    model,
    input,
    clientPage,
  });

  const vendorUrl = await pollKieImage(opts.userId, taskId, logId);
  const ossUrl = await downloadAndUpload(opts.userId, vendorUrl);


  return { ossUrl, chargePoints: null, taskId };
}

async function generateOneWanxImage(opts: {
  userId: string;
  projectId: string;
  modelKey: string;
  prompt: string;
  action: string;
  meta: Prisma.InputJsonValue;
  imageSize: EcomStoryboardWanxSize;
  refImg?: string;
  refMode?: "repaint" | "refonly";
  refStrength?: number;
}): Promise<{ ossUrl: string; chargePoints: number | null; taskId: string }> {
  const workspaceId = randomUUID().slice(0, 8);
  const taskKey = `ecom-sb-img:${opts.projectId}:${workspaceId}`;
  const clientPage = ecomClientPage(opts.userId, workspaceId, ECOM_STORYBOARD_TOOL_KEY);


  const { taskId, logId } = await ecomGwCreateDashscopeJob(opts.userId, {
    kind: "wanx",
    model: opts.modelKey,
    prompt: opts.prompt,
    n: 1,
    size: opts.imageSize,
    refImg: opts.refImg,
    refMode: opts.refMode,
    refStrength: opts.refStrength,
    clientPage,
  });

  const vendorUrl = await pollWanxImage(opts.userId, taskId, logId);
  const ossUrl = await downloadAndUpload(opts.userId, vendorUrl);


  return { ossUrl, chargePoints: null, taskId };
}

/** 单镜头分镜图：千问/Z-Image 同步 multimodal-generation */
async function generatePanelImageWithMultimodalSync(opts: {
  userId: string;
  projectId: string;
  modelKey: string;
  prompt: string;
  refGuide: string;
  wan27Size: string;
  panelIndex: number;
  refImageUrls: string[];
}): Promise<{ ossUrl: string; chargePoints: number | null }> {
  const refImageUrls =
    !isZImageTurboModel(opts.modelKey) && opts.refImageUrls.length > 0
      ? await ensureStoryboardRefImagesForWan27({
          userId: opts.userId,
          urls: opts.refImageUrls.slice(0, ecomStoryboardImageEditMaxRefs(opts.modelKey)),
        })
      : [];
  assertEcomStoryboardImageEditRefs(opts.modelKey, refImageUrls.length);
  const promptText = buildStoryboardPanelInvokePrompt({
    refGuide: opts.refGuide,
    panelPrompt: opts.prompt,
    refCount: refImageUrls.length,
  });
  const content: Array<{ text: string } | { image: string }> =
    refImageUrls.length > 0
      ? [...refImageUrls.map((url) => ({ image: url })), { text: promptText }]
      : [{ text: promptText }];
  const workspaceId = randomUUID().slice(0, 8);
  const clientPage = ecomClientPage(opts.userId, workspaceId, ECOM_STORYBOARD_TOOL_KEY);
  const { taskId, logId } = await ecomGwCreateDashscopeJob(opts.userId, {
    kind: "multimodal-image-sync",
    model: opts.modelKey,
    content,
    parameters: {
      size: opts.wan27Size,
      n: 1,
      prompt_extend: isQwenImageEditModel(opts.modelKey)
        ? true
        : !isZImageTurboModel(opts.modelKey),
      watermark: false,
    },
    clientPage,
  });
  const vendorUrl = await pollWanxImage(opts.userId, taskId, logId);
  const ossUrl = await downloadAndUpload(opts.userId, vendorUrl);
  return { ossUrl, chargePoints: null };
}

/** 单镜头分镜图：wan2.7 多图参考（产品 + 角色 + 场景一次传入） */
async function generatePanelImageWithRefs(opts: {
  userId: string;
  projectId: string;
  modelKey: string;
  prompt: string;
  refGuide: string;
  wan27Size: string;
  panelIndex: number;
  refImageUrls: string[];
}): Promise<{ ossUrl: string; chargePoints: number | null }> {
  const apiModel = resolveStoryboardDashscopeModel(opts.modelKey);
  const wan26 = isWan26ImageModel(apiModel) || isWan26ImageModel(opts.modelKey);
  const refImageUrls = await ensureStoryboardRefImagesForWan27({
    userId: opts.userId,
    urls: opts.refImageUrls,
  });
  const imageSize = resolveStoryboardWan27JobSize({
    wan26,
    refCount: refImageUrls.length,
    wan27Size: opts.wan27Size,
  });

  const baseMeta: Record<string, unknown> = {
    projectId: opts.projectId,
    kind: "storyboard_panel",
    panelIndex: opts.panelIndex,
    imageSize: imageSize ?? opts.wan27Size,
    refModel: apiModel,
    refCount: refImageUrls.length,
  };

  const promptText = buildStoryboardPanelInvokePrompt({
    refGuide: opts.refGuide,
    panelPrompt: opts.prompt,
    refCount: refImageUrls.length,
  });
  const content: Array<{ text: string } | { image: string }> = wan26
    ? [{ text: promptText }, ...refImageUrls.map((url) => ({ image: url }))]
    : [...refImageUrls.map((url) => ({ image: url })), { text: promptText }];

  const workspaceId = randomUUID().slice(0, 8);
  const taskKey = `ecom-sb-img:${opts.projectId}:${workspaceId}`;
  const clientPage = ecomClientPage(opts.userId, workspaceId, ECOM_STORYBOARD_TOOL_KEY);

  const { taskId, logId } = await ecomGwCreateDashscopeJob(opts.userId, {
    kind: "wan27-image",
    model: apiModel,
    content,
    size: imageSize,
    n: 1,
    contentOrder: wan26 ? "text-first" : "images-first",
    clientPage,
  });

  const vendorUrl = await pollWanxImage(opts.userId, taskId, logId);
  const ossUrl = await downloadAndUpload(opts.userId, vendorUrl);


  return { ossUrl, chargePoints: null };
}

/** 单镜头分镜图：可灵 3.0 Omni 多图参考（百炼 messages） */
async function generatePanelImageWithKling(opts: {
  userId: string;
  projectId: string;
  modelKey: string;
  prompt: string;
  refGuide: string;
  aspectRatio: "16:9" | "9:16";
  panelIndex: number;
  refImageUrls: string[];
}): Promise<{ ossUrl: string; chargePoints: number | null }> {
  const apiModel = resolveStoryboardKlingModel(opts.modelKey);
  const resolution = resolveKlingV3Resolution();
  const refImageUrls = await ensureStoryboardRefImagesForWan27({
    userId: opts.userId,
    urls: opts.refImageUrls.slice(0, 10),
  });

  const baseMeta: Record<string, unknown> = {
    projectId: opts.projectId,
    kind: "storyboard_panel",
    panelIndex: opts.panelIndex,
    aspectRatio: opts.aspectRatio,
    refModel: apiModel,
    refCount: refImageUrls.length,
  };

  const promptText = buildStoryboardPanelInvokePrompt({
    refGuide: opts.refGuide,
    panelPrompt: opts.prompt,
    refCount: refImageUrls.length,
  });
  const content: Array<{ text: string } | { image: string }> = [
    ...refImageUrls.map((url) => ({ image: url })),
    { text: promptText },
  ];

  const workspaceId = randomUUID().slice(0, 8);
  const taskKey = `ecom-sb-img:${opts.projectId}:${workspaceId}`;
  const clientPage = ecomClientPage(opts.userId, workspaceId, ECOM_STORYBOARD_TOOL_KEY);


  const { taskId, logId } = await ecomGwCreateDashscopeJob(opts.userId, {
    kind: "kling-v3-image",
    model: apiModel,
    content,
    aspectRatio: opts.aspectRatio,
    resolution,
    n: 1,
    clientPage,
  });

  const vendorUrl = await pollWanxImage(opts.userId, taskId, logId);
  const ossUrl = await downloadAndUpload(opts.userId, vendorUrl);


  return { ossUrl, chargePoints: null };
}

/** 单镜头分镜图：KIE nano-banana-pro 多图参考（image_input） */
async function generatePanelImageWithKie(opts: {
  userId: string;
  projectId: string;
  modelKey: string;
  prompt: string;
  refGuide: string;
  aspectRatio: "16:9" | "9:16";
  panelIndex: number;
  refImageUrls: string[];
}): Promise<{ ossUrl: string; chargePoints: number | null }> {
  const apiModel = resolveStoryboardKieModel(opts.modelKey);
  const refImageUrls = await ensureStoryboardRefImagesForWan27({
    userId: opts.userId,
    urls: opts.refImageUrls.slice(0, 8),
  });

  const baseMeta: Record<string, unknown> = {
    projectId: opts.projectId,
    kind: "storyboard_panel",
    panelIndex: opts.panelIndex,
    aspectRatio: opts.aspectRatio,
    refModel: apiModel,
    refCount: refImageUrls.length,
  };

  const promptText = buildStoryboardPanelInvokePrompt({
    refGuide: opts.refGuide,
    panelPrompt: opts.prompt,
    refCount: refImageUrls.length,
  });
  const { model, input } = buildKieImageCreateArgs({
    modelKey: apiModel,
    prompt: promptText,
    imageUrls: refImageUrls,
    params: {
      aspect_ratio: opts.aspectRatio,
      resolution: "2K",
      output_format: "png",
    },
  });

  const workspaceId = randomUUID().slice(0, 8);
  const taskKey = `ecom-sb-img:${opts.projectId}:${workspaceId}`;
  const clientPage = ecomClientPage(opts.userId, workspaceId, ECOM_STORYBOARD_TOOL_KEY);


  const { taskId, logId } = await ecomGwCreateKieJob(opts.userId, {
    model,
    input,
    clientPage,
  });

  const vendorUrl = await pollKieImage(opts.userId, taskId, logId);
  const ossUrl = await downloadAndUpload(opts.userId, vendorUrl);


  return { ossUrl, chargePoints: null };
}

export async function ecomGenerateStoryboardSheetImage(opts: {
  userId: string;
  projectId: string;
  sheet: StoryboardSheet;
  references: StoryboardReference[];
  modelKey?: string;
  aspectRatio?: "16:9" | "9:16";
  imageSize?: string;
  autoGenCharacter?: boolean;
  /** 仅自动生成角色参考图，不生成分镜图 */
  characterOnly?: boolean;
  /** 仅重生成指定镜头；省略则生成全部镜头 */
  panelIndex?: number;
}): Promise<{
  references: StoryboardReference[];
  sheet: StoryboardSheet;
  chargePoints: number | null;
}> {
  await assertEcomToolkitGatewayAccess(opts.userId);
  requireStoryboardProductRef(opts.references);
  const projectRow = await getEcomStoryboardProject(opts.userId, opts.projectId);
  if (!projectRow) throw new Error("项目不存在");
  const wf = projectRow.meta?.workflow ?? {};
  const sheet = storyboardSheetSchema.parse(opts.sheet);
  const basePromptCtx = buildStoryboardImagePromptContext(projectRow);
  const promptCtx = {
    ...basePromptCtx,
    aspectRatio: opts.aspectRatio ?? "9:16",
    characterAppearance:
      basePromptCtx.characterAppearance ||
      resolveCharacterAppearance(sheet, basePromptCtx, {
        characterPresetKey: wf.characterPresetKey,
        collectedParams: wf.collectedParams,
      }),
  };
  const modelKey =
    opts.modelKey?.trim() ||
    wf.imageModelKey?.trim() ||
    ECOM_STORYBOARD_DEFAULT_IMAGE_MODEL;
  if (!isStoryboardRefCapableImageModel(modelKey)) {
    throw new Error(
      "该模型仅支持纯文生图，分镜生图须使用支持参考图的模型（如 wan2.7-image、wan2.7-image-pro）",
    );
  }
  const aspectRatio = opts.aspectRatio ?? "9:16";
  const imageSize = resolveWanxImageSize({ aspectRatio, imageSize: opts.imageSize });
  const wan27Size = resolveWan27ImageSize({ aspectRatio, imageSize: opts.imageSize });

  let references = [...opts.references];

  const panelsToGen =
    typeof opts.panelIndex === "number"
      ? sheet.panels.filter((p) => p.index === opts.panelIndex)
      : sheet.panels;
  if (!opts.characterOnly && panelsToGen.length === 0) {
    throw new Error(
      typeof opts.panelIndex === "number"
        ? `找不到镜头 ${opts.panelIndex}`
        : "分镜表为空，无法生图",
    );
  }
  const panelIndexesToGen = panelsToGen.map((p) => p.index);
  if (!opts.characterOnly) {
    await markStoryboardPanelImagesPending(opts.projectId, panelIndexesToGen, modelKey);
  }

  const hasCharacterRef = references.some((r) => r.role === "character");
  const shouldAutoGenCharacter =
    !hasCharacterRef &&
    !wf.skippedCharacter &&
    (opts.autoGenCharacter ||
      Boolean(wf.autoGenCharacter) ||
      Boolean(wf.characterPresetKey) ||
      wf.fashionCharacterMode === "ai" ||
      wf.proCharacterMode === "ai");

  try {
    if (shouldAutoGenCharacter) {
      const charPrompt = buildCharacterRefPrompt(sheet, promptCtx);
      const productRef = requireStoryboardProductRef(references);
      const charResult = await generateOneImage({
        userId: opts.userId,
        projectId: opts.projectId,
        modelKey,
        prompt: charPrompt,
        action: "image",
        imageSize,
        aspectRatio,
        refImg: productRef.ossUrl.trim(),
        meta: { projectId: opts.projectId, kind: "character_ref" } as Prisma.InputJsonValue,
      });

      const bufRes = await fetch(charResult.ossUrl);
      const buf = Buffer.from(await bufRes.arrayBuffer());
      const ref = await addStoryboardReferenceUpload(opts.userId, opts.projectId, {
        label: "自动生成角色",
        role: "character",
        buf,
      });
      references = [...references, ref];
    }

    if (opts.characterOnly) {
      if (!references.some((r) => r.role === "character")) {
        throw new Error("角色参考图生成失败，请检查脚本中的角色描述，或改用手动上传角色图");
      }
      return { references, sheet, chargePoints: null };
    }

    const { refImageUrls, productRefUrls } = resolveStoryboardImageGenRefs(references);
    assertEcomStoryboardImageEditRefs(modelKey, refImageUrls.length);
    const maxRefs = ecomStoryboardImageEditMaxRefs(modelKey);
    const panelRefUrls = refImageUrls.slice(0, maxRefs);
    const refGuide = buildStoryboardPanelRefGuideForUrls(
      panelRefUrls,
      references,
      promptCtx,
    );

    const panelGenFailures: { index: number; message: string }[] = [];
    const concurrency =
      panelsToGen.length > 1
        ? await resolveEcomImageGenConcurrency(
            opts.userId,
            {} as ProductDesignSettings,
          )
        : 1;

    await mapWithConcurrency(
      panelsToGen,
      async (panel) => {
        try {
          const prompt = resolveStoryboardPanelImagePrompt(
            panel,
            sheet,
            references,
            promptCtx,
            panelRefUrls,
            refGuide,
          );
          const imgResult = isStoryboardKieImageModel(modelKey)
            ? await generatePanelImageWithKie({
                userId: opts.userId,
                projectId: opts.projectId,
                modelKey,
                prompt,
                refGuide,
                aspectRatio,
                panelIndex: panel.index,
                refImageUrls: panelRefUrls,
              })
            : isStoryboardKlingImageModel(modelKey)
              ? await generatePanelImageWithKling({
                  userId: opts.userId,
                  projectId: opts.projectId,
                  modelKey,
                  prompt,
                  refGuide,
                  aspectRatio,
                  panelIndex: panel.index,
                  refImageUrls: panelRefUrls,
                })
              : isDashscopeMultimodalImageGenModel(modelKey)
                ? await generatePanelImageWithMultimodalSync({
                    userId: opts.userId,
                    projectId: opts.projectId,
                    modelKey,
                    prompt,
                    refGuide,
                    wan27Size,
                    panelIndex: panel.index,
                    refImageUrls: panelRefUrls,
                  })
                : await generatePanelImageWithRefs({
                    userId: opts.userId,
                    projectId: opts.projectId,
                    modelKey,
                    prompt,
                    refGuide,
                    wan27Size,
                    panelIndex: panel.index,
                    refImageUrls: panelRefUrls,
                  });

          await prisma.ecomAsset.create({
            data: {
              userId: opts.userId,
              module: ECOM_STORYBOARD_MODULE,
              kind: "image",
              title: `${sheet.overview.title} · 镜头${panel.index}`.slice(0, 80),
              prompt,
              ossUrl: imgResult.ossUrl,
              thumbnailUrl: imgResult.ossUrl,
              meta: {
                projectId: opts.projectId,
                modelKey,
                kind: "storyboard_panel",
                panelIndex: panel.index,
                productRefCount: productRefUrls.length,
                refImageCount: panelRefUrls.length,
              },
            },
          });

          await persistStoryboardPanelImageUrl({
            userId: opts.userId,
            projectId: opts.projectId,
            panelIndex: panel.index,
            imageUrl: imgResult.ossUrl,
          });
          await clearStoryboardPanelImagesPending(opts.projectId, [panel.index]);
        } catch (e) {
          panelGenFailures.push({
            index: panel.index,
            message: e instanceof Error ? e.message : "生成失败",
          });
        }
      },
      concurrency,
    );

    if (panelGenFailures.length > 0) {
      const summary = panelGenFailures
        .sort((a, b) => a.index - b.index)
        .map((f) => `镜头 ${f.index}：${f.message}`)
        .join("；");
      throw new Error(summary);
    }
  } catch (e) {
    await clearStoryboardPanelImagesPending(opts.projectId, panelIndexesToGen);
    throw e;
  }

  const latestAfterGen = await getEcomStoryboardProject(opts.userId, opts.projectId);
  if (!latestAfterGen?.sheet) {
    throw new Error("项目不存在");
  }
  const mergedPanels = latestAfterGen.sheet.panels;
  const baseSheet = latestAfterGen.sheet;

  const updatedSheet: StoryboardSheet = { ...baseSheet, panels: mergedPanels };
  const allPanelsReady = mergedPanels.every((p) => Boolean(p.imageUrl));

  const existing = await getEcomStoryboardProject(opts.userId, opts.projectId);
  const existingMeta = (existing?.meta as Record<string, unknown> | null) ?? {};
  const existingWorkflow =
    (existingMeta.workflow as Record<string, unknown> | undefined) ?? {};
  const { pendingPanelImages: _pending, ...workflowRest } = existingWorkflow;

  await updateEcomStoryboardProject(opts.userId, opts.projectId, {
    sheet: updatedSheet,
    references,
    status: allPanelsReady ? "image_ready" : "image_partial",
    meta: {
      ...existingMeta,
      workflow: {
        ...workflowRest,
        phase: "image",
        imageModelKey: modelKey,
        autoGenCharacter: Boolean(opts.autoGenCharacter),
        aspectRatio,
        imageSize,
      },
    },
  });

  return {
    references,
    sheet: updatedSheet,
    chargePoints: null,
  };
}
