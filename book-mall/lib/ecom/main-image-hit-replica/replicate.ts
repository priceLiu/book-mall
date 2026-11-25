import { randomUUID } from "crypto";

import { assertStoryLlmVisionModel } from "@/lib/canvas/story-llm-vision-models";
import {
  resolveEcomImageGenConcurrency,
  resolveEcomPromptGenConcurrency,
} from "@/lib/ecom/ecom-image-gen-concurrency";
import { formatEcomImageGenUserError } from "@/lib/ecom/ecom-image-processing-error";
import { generateEcomImage } from "@/lib/ecom/ecom-image-gen-invoke";
import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { persistEcomGenerationRecord } from "@/lib/ecom/ecom-generation-record";
import { drainEcomGwChat } from "@/lib/ecom/ecom-product-design-vision";
import { ecomClientPage } from "@/lib/ecom/ecom-tool-keys";
import { ECOM_DEFAULT_VISION_MODEL } from "@/lib/gateway/ecom-storyboard-chat-models";
import { ECOM_STORYBOARD_DEFAULT_IMAGE_MODEL } from "@/lib/gateway/ecom-storyboard-chat-models";
import { mapWithConcurrency } from "@/lib/generation/poll-parallel";

import {
  buildHitReplicaPromptSystem,
  buildHitReplicaUserText,
  parseHitReplicaPromptJson,
} from "./hit-replica-prompts";
import {
  ECOM_MAIN_IMAGE_HIT_REPLICA_ACTION,
  ECOM_MAIN_IMAGE_HIT_REPLICA_MODULE,
  ECOM_MAIN_IMAGE_HIT_REPLICA_TOOL_KEY,
  hitReplicaAspectToEcomRatio,
  hitReplicaBuildImageGenSize,
  type MainImageHitReplicaResult,
} from "./types";
import {
  getMainImageHitReplicaProject,
  patchMainImageHitReplicaResultSlot,
  updateMainImageHitReplicaProject,
} from "./project-service";

type RefWorkItem = {
  ref: { id: string; ossUrl: string; referenceRequirement?: string };
  slot: MainImageHitReplicaResult;
};

type PromptWorkItem = RefWorkItem & {
  prompt: string;
};

async function buildVisionPromptForRef(
  userId: string,
  opts: {
    visionKey: string;
    ref: RefWorkItem["ref"];
    productUrls: string[];
    settings: NonNullable<Awaited<ReturnType<typeof getMainImageHitReplicaProject>>>["settings"];
    globalReq: string;
    refBatchSize: number;
    styleAnchorImageUrl?: string;
    clientPage: string;
  },
): Promise<string> {
  const perRefReq = opts.ref.referenceRequirement?.trim();
  const userText = buildHitReplicaUserText({
    category: opts.settings.replicaCategory,
    degree: opts.settings.replicaDegree,
    language: opts.settings.language,
    globalRequirements: opts.globalReq,
    perRefRequirement: perRefReq,
    hasProductImages: opts.productUrls.length > 0,
    productImageCount: opts.productUrls.length,
    keepStyleConsistent: opts.settings.keepOutputStyleConsistent !== false,
    multiRefBatch: opts.refBatchSize > 1,
    hasStyleAnchor: Boolean(opts.styleAnchorImageUrl),
  });

  const productVisionUrls = opts.productUrls.slice(0, 3);
  const raw = await drainEcomGwChat(userId, {
    modelKey: opts.visionKey,
    messages: [
      {
        role: "system",
        content: buildHitReplicaPromptSystem(opts.settings.replicaDegree),
      },
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: opts.ref.ossUrl } },
          ...productVisionUrls.map((url) => ({
            type: "image_url" as const,
            image_url: { url },
          })),
          ...(opts.styleAnchorImageUrl
            ? [
                {
                  type: "image_url" as const,
                  image_url: { url: opts.styleAnchorImageUrl },
                },
              ]
            : []),
          { type: "text", text: userText },
        ],
      },
    ],
    clientPage: opts.clientPage,
  });

  const { prompt } = parseHitReplicaPromptJson(raw);
  return prompt;
}

async function generateImageForSlot(
  userId: string,
  opts: {
    projectId: string;
    slot: MainImageHitReplicaResult;
    prompt: string;
    modelKey: string;
    productUrls: string[];
    referenceImageUrl: string;
    styleAnchorImageUrl?: string;
    settings: NonNullable<Awaited<ReturnType<typeof getMainImageHitReplicaProject>>>["settings"];
    toolKey: string;
  },
): Promise<{ imageUrl: string; assetId: string; prompt: string }> {
  const refUrls = [
    ...(opts.productUrls.length > 0 ? opts.productUrls : [opts.referenceImageUrl]),
    ...(opts.styleAnchorImageUrl ? [opts.styleAnchorImageUrl] : []),
  ];
  const genRatio = hitReplicaAspectToEcomRatio(opts.settings.imageRatio);
  const imageSize =
    opts.settings.imageGenSize?.trim() ||
    hitReplicaBuildImageGenSize(
      opts.settings.imageRatio,
      opts.settings.outputResolution ?? "2K",
    );
  const imageUrl = await generateEcomImage({
    userId,
    modelKey: opts.modelKey,
    prompt: opts.prompt,
    ratio: genRatio,
    imageSize,
    refImageUrls: refUrls.slice(0, 3),
    toolKey: opts.toolKey,
    workspaceId: opts.projectId,
  });

  const { assetId } = await persistEcomGenerationRecord({
    userId,
    ossUrl: imageUrl,
    prompt: opts.prompt,
    title: `爆款复刻 #${opts.slot.index}`,
    meta: {
      sourceModule: ECOM_MAIN_IMAGE_HIT_REPLICA_MODULE,
      sourceToolKey: opts.toolKey,
      projectId: opts.projectId,
      sourceResultId: opts.slot.id,
      versionKey: `${opts.projectId}::${opts.slot.id}`,
      modelKey: opts.modelKey,
    },
  });

  return { imageUrl, assetId, prompt: opts.prompt };
}

function parseClientPendingSlots(
  raw: unknown,
  refImages: Array<{ id: string }>,
  baseIndex: number,
): MainImageHitReplicaResult[] | null {
  if (!Array.isArray(raw) || raw.length !== refImages.length) return null;
  const out: MainImageHitReplicaResult[] = [];
  for (let i = 0; i < raw.length; i++) {
    const row = raw[i];
    if (!row || typeof row !== "object") return null;
    const x = row as Record<string, unknown>;
    const id = typeof x.id === "string" ? x.id.trim() : "";
    const sourceRefId = typeof x.sourceRefId === "string" ? x.sourceRefId.trim() : "";
    const index = typeof x.index === "number" ? x.index : baseIndex + i + 1;
    if (!id || sourceRefId !== refImages[i]!.id) return null;
    out.push({
      id,
      index,
      sourceRefId,
      prompt: typeof x.prompt === "string" ? x.prompt : "",
      status: "generating",
    });
  }
  return out;
}

export async function replicateMainImageHitBatch(opts: {
  userId: string;
  projectId: string;
  modelKey?: string;
  visionModelKey?: string;
  pendingSlots?: unknown;
}): Promise<{
  project: NonNullable<Awaited<ReturnType<typeof getMainImageHitReplicaProject>>>;
  generated: number;
  failures: Array<{ resultId: string; message: string }>;
}> {
  await assertEcomToolkitGatewayAccess(opts.userId);
  let project = await getMainImageHitReplicaProject(opts.userId, opts.projectId);
  if (!project) throw new Error("项目不存在");

  const refImages = project.references.filter((r) => r.role === "reference");
  if (refImages.length === 0) throw new Error("请先上传至少 1 张参考图");

  const productUrls = project.references
    .filter((r) => r.role === "product")
    .map((r) => r.ossUrl);
  const modelKey =
    opts.modelKey?.trim() ||
    project.settings.imageModelKey?.trim() ||
    ECOM_STORYBOARD_DEFAULT_IMAGE_MODEL;
  const visionKey =
    opts.visionModelKey?.trim() ||
    project.settings.visionModelKey?.trim() ||
    ECOM_DEFAULT_VISION_MODEL;
  assertStoryLlmVisionModel(visionKey, "爆款图复刻");

  const toolKey = `${ECOM_MAIN_IMAGE_HIT_REPLICA_TOOL_KEY}__${ECOM_MAIN_IMAGE_HIT_REPLICA_ACTION}`;
  const globalReq = project.settings.globalRequirements?.trim() ?? "";
  const keepStyleConsistent = project.settings.keepOutputStyleConsistent !== false;
  const clientPage = ecomClientPage(opts.userId, opts.projectId, toolKey);

  const existingResults = project.output.results;
  const baseIndex = existingResults.length;
  const pending: MainImageHitReplicaResult[] =
    parseClientPendingSlots(opts.pendingSlots, refImages, baseIndex) ??
    refImages.map((ref, i) => ({
      id: randomUUID(),
      index: baseIndex + i + 1,
      sourceRefId: ref.id,
      prompt: "",
      status: "generating" as const,
    }));

  project =
    (await updateMainImageHitReplicaProject(opts.userId, opts.projectId, {
      status: "generating",
      meta: { phase: "generating", genStartedAt: new Date().toISOString() },
      output: { results: [...existingResults, ...pending] },
    })) ?? project;

  const batchSettings = project.settings;

  const failures: Array<{ resultId: string; message: string }> = [];
  let generated = 0;
  const workItems: RefWorkItem[] = refImages.map((ref, i) => ({
    ref,
    slot: pending[i]!,
  }));

  const promptConcurrency = await resolveEcomPromptGenConcurrency(opts.userId);
  const imageConcurrency = await resolveEcomImageGenConcurrency(opts.userId, {} as never);

  const promptItems: PromptWorkItem[] = [];

  await mapWithConcurrency(
    workItems,
    async (item) => {
      try {
        const prompt = await buildVisionPromptForRef(opts.userId, {
          visionKey,
          ref: item.ref,
          productUrls,
          settings: batchSettings,
          globalReq,
          refBatchSize: refImages.length,
          styleAnchorImageUrl: undefined,
          clientPage,
        });
        await patchMainImageHitReplicaResultSlot(opts.userId, opts.projectId, item.slot.id, {
          prompt,
        });
        promptItems.push({ ...item, prompt });
      } catch (e) {
        const message = formatEcomImageGenUserError(e).message;
        failures.push({ resultId: item.slot.id, message });
        await patchMainImageHitReplicaResultSlot(opts.userId, opts.projectId, item.slot.id, {
          status: "failed",
          failMessage: message,
        });
      }
    },
    promptConcurrency,
  );

  if (promptItems.length === 0) {
    project =
      (await updateMainImageHitReplicaProject(opts.userId, opts.projectId, {
        status: "draft",
        meta: { phase: "done", genStartedAt: null },
      })) ?? project;
    return { project, generated: 0, failures };
  }

  let styleAnchorImageUrl: string | undefined;

  const runImageSlot = async (item: PromptWorkItem, anchor?: string) => {
    try {
      const out = await generateImageForSlot(opts.userId, {
        projectId: opts.projectId,
        slot: item.slot,
        prompt: item.prompt,
        modelKey,
        productUrls,
        referenceImageUrl: item.ref.ossUrl,
        styleAnchorImageUrl: anchor,
        settings: batchSettings,
        toolKey,
      });
      generated += 1;
      await patchMainImageHitReplicaResultSlot(opts.userId, opts.projectId, item.slot.id, {
        prompt: out.prompt,
        imageUrl: out.imageUrl,
        assetId: out.assetId,
        status: "ready",
        failMessage: undefined,
      });
      return out.imageUrl;
    } catch (e) {
      const message = formatEcomImageGenUserError(e).message;
      failures.push({ resultId: item.slot.id, message });
      await patchMainImageHitReplicaResultSlot(opts.userId, opts.projectId, item.slot.id, {
        status: "failed",
        failMessage: message,
      });
      return undefined;
    }
  };

  if (keepStyleConsistent && promptItems.length > 1) {
    const [first, ...rest] = promptItems;
    const firstUrl = await runImageSlot(first!, undefined);
    if (firstUrl) styleAnchorImageUrl = firstUrl;
    await mapWithConcurrency(
      rest,
      async (item) => {
        await runImageSlot(item, styleAnchorImageUrl);
      },
      imageConcurrency,
    );
  } else {
    await mapWithConcurrency(
      promptItems,
      async (item) => {
        await runImageSlot(item, styleAnchorImageUrl);
      },
      imageConcurrency,
    );
  }

  project =
    (await getMainImageHitReplicaProject(opts.userId, opts.projectId)) ?? project;
  const phase = project.output.results.some((r) => r.imageUrl) ? "done" : "setup";
  project =
    (await updateMainImageHitReplicaProject(opts.userId, opts.projectId, {
      status: "draft",
      meta: { phase, genStartedAt: null },
    })) ?? project;

  return { project, generated, failures };
}