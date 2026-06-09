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
  resolveWan26ImageSize,
  resolveWan27ImageSize,
  resolveWanxImageSize,
  type EcomStoryboardWanxSize,
} from "@/lib/ecom/ecom-storyboard-gen-params";
import {
  buildCharacterRefPrompt,
  buildStoryboardImagePromptContext,
  resolveCharacterAppearance,
  buildStoryboardPanelImagePrompt,
  buildStoryboardPanelRefGuide,
} from "@/lib/ecom/ecom-storyboard-image-prompt";
import {
  isStoryboardKieImageModel,
  isStoryboardKlingImageModel,
  isWan26ImageModel,
  resolveStoryboardDashscopeModel,
  resolveStoryboardKieModel,
  resolveStoryboardKlingModel,
} from "@/lib/ecom/ecom-storyboard-image-models";
import { ensureStoryboardRefImagesForWan27 } from "@/lib/ecom/ecom-storyboard-ref-image";
import {
  requireStoryboardProductRef,
  resolveStoryboardImageGenRefs,
} from "@/lib/ecom/ecom-storyboard-refs";
import {
  addStoryboardReferenceUpload,
  getEcomStoryboardProject,
  updateEcomStoryboardProject,
} from "@/lib/ecom/ecom-storyboard-service";

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
  return generateOneWanxImage(opts);
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
  const taskKey = `ecom-sb-img:${opts.projectId}:${workspaceId}`;
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
  const imageSize = wan26 ? resolveWan26ImageSize() : opts.wan27Size;
  const refImageUrls = await ensureStoryboardRefImagesForWan27({
    userId: opts.userId,
    urls: opts.refImageUrls,
  });

  const baseMeta: Record<string, unknown> = {
    projectId: opts.projectId,
    kind: "storyboard_panel",
    panelIndex: opts.panelIndex,
    imageSize,
    refModel: apiModel,
    refCount: refImageUrls.length,
  };

  const promptText = `${opts.refGuide}\n\n${opts.prompt}`;
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

  const content: Array<{ text: string } | { image: string }> = [
    ...refImageUrls.map((url) => ({ image: url })),
    { text: `${opts.refGuide}\n\n${opts.prompt}` },
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
  const refImageUrls = opts.refImageUrls.slice(0, 8);

  const baseMeta: Record<string, unknown> = {
    projectId: opts.projectId,
    kind: "storyboard_panel",
    panelIndex: opts.panelIndex,
    aspectRatio: opts.aspectRatio,
    refModel: apiModel,
    refCount: refImageUrls.length,
  };

  const { model, input } = buildKieImageCreateArgs({
    modelKey: apiModel,
    prompt: `${opts.refGuide}\n\n${opts.prompt}`,
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
  const modelKey = opts.modelKey?.trim() || ECOM_STORYBOARD_DEFAULT_IMAGE_MODEL;
  const aspectRatio = opts.aspectRatio ?? "9:16";
  const imageSize = resolveWanxImageSize({ aspectRatio, imageSize: opts.imageSize });
  const wan27Size = resolveWan27ImageSize({ aspectRatio, imageSize: opts.imageSize });
  const { productRefUrl, extraRefUrls } = resolveStoryboardImageGenRefs(opts.references);
  const refImageUrls = [productRefUrl, ...extraRefUrls];

  let references = [...opts.references];
  let totalCharge = 0;

  const hasCharacterRef = references.some((r) => r.role === "character");
  const shouldAutoGenCharacter =
    !hasCharacterRef &&
    !wf.skippedCharacter &&
    (opts.autoGenCharacter ||
      Boolean(wf.autoGenCharacter) ||
      Boolean(wf.characterPresetKey));
  if (shouldAutoGenCharacter) {
    const charPrompt = buildCharacterRefPrompt(sheet, promptCtx);
    const charResult = await generateOneImage({
      userId: opts.userId,
      projectId: opts.projectId,
      modelKey,
      prompt: charPrompt,
      action: "image",
      imageSize,
      aspectRatio,
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

  const panelsToGen =
    typeof opts.panelIndex === "number"
      ? sheet.panels.filter((p) => p.index === opts.panelIndex)
      : sheet.panels;
  if (panelsToGen.length === 0) {
    throw new Error(`找不到镜头 ${opts.panelIndex}`);
  }

  let updatedPanels = [...sheet.panels];
  const refGuide = buildStoryboardPanelRefGuide(references, promptCtx);

  for (const panel of panelsToGen) {
    const prompt = buildStoryboardPanelImagePrompt(panel, sheet, references, promptCtx);
    const imgResult = isStoryboardKieImageModel(modelKey)
      ? await generatePanelImageWithKie({
          userId: opts.userId,
          projectId: opts.projectId,
          modelKey,
          prompt,
          refGuide,
          aspectRatio,
          panelIndex: panel.index,
          refImageUrls,
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
            refImageUrls,
          })
        : await generatePanelImageWithRefs({
            userId: opts.userId,
            projectId: opts.projectId,
            modelKey,
            prompt,
            refGuide,
            wan27Size,
            panelIndex: panel.index,
            refImageUrls,
          });
    
    updatedPanels = updatedPanels.map((p) =>
      p.index === panel.index ? { ...p, imageUrl: imgResult.ossUrl } : p,
    );

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
        },
      },
    });
  }

  const updatedSheet: StoryboardSheet = { ...sheet, panels: updatedPanels };
  const allPanelsReady = updatedPanels.every((p) => Boolean(p.imageUrl));

  const existing = await getEcomStoryboardProject(opts.userId, opts.projectId);
  const existingMeta = (existing?.meta as Record<string, unknown> | null) ?? {};

  await updateEcomStoryboardProject(opts.userId, opts.projectId, {
    sheet: updatedSheet,
    references,
    status: allPanelsReady ? "image_ready" : "image_partial",
    meta: {
      ...existingMeta,
      workflow: {
        ...((existingMeta.workflow as Record<string, unknown> | undefined) ?? {}),
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
