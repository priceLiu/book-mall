import type { CanvasChatContentPart, CanvasChatMessage } from "@/lib/canvas/providers/types";
import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import {
  assertStoryLlmVisionModel,
  isStoryLlmVisionModel,
} from "@/lib/canvas/story-llm-vision-models";
import {
  getEcomMediaDecomposeProject,
  updateEcomMediaDecomposeProject,
} from "@/lib/ecom/ecom-media-decompose-service";
import type { MediaDecomposeProjectDto } from "@/lib/ecom/ecom-media-decompose-types";
import {
  effectiveDecomposeVoiceover,
  extractMediaDecomposePatch,
  type MediaDecomposePatch,
} from "@/lib/ecom/ecom-media-decompose-structured";
import {
  appendReplicaReference,
  buildReplicaMentionCatalog,
  listReplicaModelRefs,
  listReplicaProductRefs,
  primaryReplicaModelRef,
  removeReplicaReference,
  REPLICA_REF_MAX_PER_ROLE,
  resolveReplicaCollectPhase,
  replicaMentionSummary,
} from "@/lib/ecom/ecom-media-decompose-replica-refs";
import {
  buildDraftShotsFromDecompose,
  buildReplicaModelImagePromptSystem,
  buildReplicaModelImagePromptUserMessage,
  buildReplicaProductRecognizePrompt,
  buildReplicaScriptSystemPrompt,
  buildReplicaScriptUserContent,
  buildReplicaScriptRetryUserPrompt,
  buildReplicaSellingPointsPrompt,
  buildReplicaVoiceoverSystemPrompt,
  buildReplicaVoiceoverUserPrompt,
  extractReplicaScriptPatch,
  extractReplicaVoiceoverPatch,
  formatProductBriefFromRecognition,
  mapReplicaScriptToShots,
  normalizeReplicaModelImagePrompt,
  normalizeSellingPointsText,
  parseProductRecognitionResult,
} from "@/lib/ecom/ecom-media-decompose-replica-script";
import {
  createEcomSeedVideoProject,
  getEcomSeedVideoProject,
  updateEcomSeedVideoProject,
  type EcomSeedVideoProjectDto,
} from "@/lib/ecom/ecom-seed-video-service";
import { generateEcomImage } from "@/lib/ecom/ecom-image-gen-invoke";
import {
  ECOM_MEDIA_DECOMPOSE_DEFAULT_TEXT_MODEL,
  ECOM_MEDIA_DECOMPOSE_REPLICA_MODEL_GENERATE_ACTION,
  ECOM_MEDIA_DECOMPOSE_REPLICA_MODEL_PROMPT_ACTION,
  ECOM_MEDIA_DECOMPOSE_REPLICA_RECOGNIZE_PRODUCT_ACTION,
  ECOM_MEDIA_DECOMPOSE_REPLICA_SCRIPT_ACTION,
  ECOM_MEDIA_DECOMPOSE_REPLICA_SELLING_POINTS_ACTION,
  ECOM_MEDIA_DECOMPOSE_REPLICA_VOICEOVER_ACTION,
  ECOM_MEDIA_DECOMPOSE_TOOL_KEY,
} from "@/lib/ecom/ecom-media-decompose-types";
import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { ecomClientPage } from "@/lib/ecom/ecom-tool-keys";
import {
  ECOM_DEFAULT_VISION_MODEL,
  ECOM_RECOGNIZE_PRODUCT_MODEL,
  ECOM_STORYBOARD_DEFAULT_IMAGE_MODEL,
} from "@/lib/gateway/ecom-storyboard-chat-models";
import { ecomGwChatComplete } from "@/lib/gateway/ecom-tool-gateway-client";
import {
  ECOM_SEED_VIDEO_DEFAULT_VIDEO_MODEL,
  type SeedVideoReference,
  type SeedVideoShot,
} from "@/lib/ecom/ecom-seed-video-types";
import { prisma } from "@/lib/prisma";

const SHOT_DURATION_MIN = 3;
const SHOT_DURATION_MAX = 15;

/** 识产品 / 视觉理解：非 Vision 模型（如 deepseek）不可发 image_url */
export function resolveReplicaVisionChatModel(
  explicitModelKey?: string,
  projectChatModelKey?: string,
  context = "AI 识产品",
): string {
  for (const candidate of [explicitModelKey?.trim(), projectChatModelKey?.trim()]) {
    if (candidate && isStoryLlmVisionModel(candidate)) return candidate;
  }
  assertStoryLlmVisionModel(ECOM_DEFAULT_VISION_MODEL, context);
  return ECOM_DEFAULT_VISION_MODEL;
}

/** AI 识产品：统一低成本 VL Flash，不跟项目 chat 模型走 */
export function resolveRecognizeProductModel(): string {
  assertStoryLlmVisionModel(ECOM_RECOGNIZE_PRODUCT_MODEL, "AI 识产品");
  return ECOM_RECOGNIZE_PRODUCT_MODEL;
}

/** 纯文本 LLM（口播/卖点文案等）：不走 3.8 等 Vision 模型，默认 DeepSeek */
export function resolveReplicaTextChatModel(
  explicitModelKey?: string,
  projectChatModelKey?: string,
): string {
  for (const candidate of [explicitModelKey?.trim(), projectChatModelKey?.trim()]) {
    if (candidate && !isStoryLlmVisionModel(candidate)) return candidate;
  }
  return ECOM_MEDIA_DECOMPOSE_DEFAULT_TEXT_MODEL;
}

function clampDuration(n: number, fallback = 5): number {
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.max(SHOT_DURATION_MIN, Math.min(SHOT_DURATION_MAX, Math.round(n)));
}

/** 解析「3s」「0-4s」「4‑9s」等分镜时长 */
export function parseMediaDecomposeShotDurationSec(raw: string, fallback = 5): number {
  const t = raw.replace(/[‑–—]/g, "-").trim();
  if (!t) return fallback;
  const range = t.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*s?/i);
  if (range) {
    const a = Number(range[1]);
    const b = Number(range[2]);
    return clampDuration(Math.abs(b - a), fallback);
  }
  const single = t.match(/(\d+(?:\.\d+)?)\s*s?/i);
  if (single) return clampDuration(Number(single[1]), fallback);
  return fallback;
}

function joinPromptParts(parts: string[]): string {
  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .join("，");
}

export function readReplicaSellingPoints(
  decompose: MediaDecomposeProjectDto,
  seedVideo: EcomSeedVideoProjectDto,
): string {
  const fromProject =
    typeof decompose.meta?.replicaSellingPoints === "string"
      ? decompose.meta.replicaSellingPoints.trim()
      : "";
  if (fromProject) return fromProject;
  const fromSeed =
    typeof seedVideo.meta?.replicaSellingPoints === "string"
      ? String(seedVideo.meta.replicaSellingPoints).trim()
      : "";
  return fromSeed;
}

export type ReplicaVoiceoverDraftDto = {
  shots: Array<{ index: number; voiceover: string }>;
  generatedAt?: string;
};

export function readReplicaVoiceoverDraft(
  seedVideo: EcomSeedVideoProjectDto,
): ReplicaVoiceoverDraftDto | null {
  const raw = seedVideo.meta?.replicaVoiceoverDraft;
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.shots)) return null;
  const shots = o.shots
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const index = Number(r.index);
      if (!Number.isFinite(index) || index < 1) return null;
      return {
        index: Math.round(index),
        voiceover: typeof r.voiceover === "string" ? r.voiceover : "",
      };
    })
    .filter((s): s is { index: number; voiceover: string } => s != null);
  if (shots.length === 0) return null;
  return {
    shots,
    generatedAt: typeof o.generatedAt === "string" ? o.generatedAt : undefined,
  };
}

function mergeReplicaCopyMeta(
  decompose: MediaDecomposeProjectDto,
  seedVideo: EcomSeedVideoProjectDto,
  patch: { productBrief?: string; sellingPoints?: string },
): { projectMeta: Record<string, unknown>; seedMeta: Record<string, unknown> } {
  const projectMeta = { ...(decompose.meta ?? {}) };
  const seedMeta = { ...(seedVideo.meta ?? {}) };
  if (patch.productBrief !== undefined) {
    projectMeta.replicaProductBrief = patch.productBrief;
    seedMeta.replicaProductBrief = patch.productBrief;
  }
  if (patch.sellingPoints !== undefined) {
    projectMeta.replicaSellingPoints = patch.sellingPoints;
    seedMeta.replicaSellingPoints = patch.sellingPoints;
  }
  return { projectMeta, seedMeta };
}

export function buildReplicaShotsFromDecompose(
  structured: MediaDecomposePatch,
  ref: SeedVideoReference,
): SeedVideoShot[] {
  if (structured.mediaType === "image") {
    const e = structured.elements;
    const sceneDescription = joinPromptParts([
      e.subject,
      e.subjectPose,
      e.sceneEnvironment,
      e.composition,
      e.colorSystem,
      e.atmosphere,
    ]);
    return [
      {
        index: 1,
        timeSlice: "0-5s",
        refImageId: ref.id,
        refImageLabel: ref.label,
        sceneDescription: sceneDescription || "静态画面复刻",
        videoPrompt: structured.positivePrompt.trim(),
        voiceover: "",
        durationSec: 5,
      },
    ];
  }

  const globalPrefix = joinPromptParts([
    structured.visualStyle,
    structured.globalColorTone,
    structured.cameraLanguageSummary,
    structured.scenePrep.venue,
    structured.scenePrep.fixedProps,
  ]);

  return structured.storyboardTable.map((row, i) => {
    const index = Number.isFinite(row.shotNo) && row.shotNo > 0 ? row.shotNo : i + 1;
    const durationSec = parseMediaDecomposeShotDurationSec(row.duration, 5);
    const videoPrompt = joinPromptParts([
      globalPrefix,
      row.shotSize,
      row.cameraMove,
      row.cameraAngle,
      row.composition,
      row.lightingSetup,
      row.toneContrast,
      row.visualContent,
      row.characterAction,
      row.expression,
      row.sfx,
      row.bgm,
      row.transition,
      row.editRhythm,
    ]);
    return {
      index,
      timeSlice: row.duration.trim() || `${index}`,
      refImageId: ref.id,
      refImageLabel: ref.label,
      sceneDescription: row.visualContent.trim() || row.characterAction.trim() || `镜头 ${index}`,
      videoPrompt: videoPrompt || row.visualContent.trim() || `镜头 ${index}`,
      voiceover: effectiveDecomposeVoiceover(row),
      durationSec,
    };
  });
}

export function readReplicaSeedVideoProjectId(meta: Record<string, unknown> | null): string | null {
  const id = meta?.replicaSeedVideoProjectId;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

function readDecomposeStructured(decompose: MediaDecomposeProjectDto): MediaDecomposePatch | null {
  return (
    decompose.result?.structured ??
    (decompose.result?.rawText ? extractMediaDecomposePatch(decompose.result.rawText) : null)
  );
}

function normalizeReplicaReferences(existing: SeedVideoReference[]): SeedVideoReference[] {
  const models = listReplicaModelRefs(existing);
  const products = listReplicaProductRefs(existing);
  return [...models, ...products];
}

async function requireReplicaPair(
  userId: string,
  decomposeProjectId: string,
): Promise<{
  decompose: MediaDecomposeProjectDto;
  seedVideo: EcomSeedVideoProjectDto;
  structured: MediaDecomposePatch;
}> {
  const decompose = await getEcomMediaDecomposeProject(userId, decomposeProjectId);
  if (!decompose) throw new Error("项目不存在");
  const structured = readDecomposeStructured(decompose);
  if (!structured) throw new Error("请先完成拆解");
  const seedVideoId = readReplicaSeedVideoProjectId(decompose.meta);
  if (!seedVideoId) throw new Error("请先开始一键复刻");
  const seedVideo = await getEcomSeedVideoProject(userId, seedVideoId);
  if (!seedVideo) throw new Error("复刻项目不存在");
  return { decompose, seedVideo, structured };
}

/** 创建/关联复刻用 seed-video 项目（空镜头表，待助手采集模特/产品后生成脚本） */
export async function ensureReplicaSeedProject(
  userId: string,
  projectId: string,
): Promise<{ project: MediaDecomposeProjectDto; seedVideo: EcomSeedVideoProjectDto }> {
  const decompose = await getEcomMediaDecomposeProject(userId, projectId);
  if (!decompose) throw new Error("项目不存在");
  const structured = readDecomposeStructured(decompose);
  if (!structured) {
    throw new Error("拆解结果里还没有可用的 Prompt 或分镜表，请先完成拆解后再复刻");
  }
  if (!decompose.media?.ossUrl) throw new Error("请先上传素材");

  const resultAt = decompose.result?.completedAt?.trim() || "";
  const existingId = readReplicaSeedVideoProjectId(decompose.meta);
  const existingAt =
    typeof decompose.meta?.replicaResultAt === "string" ? decompose.meta.replicaResultAt : "";

  if (existingId && existingAt === resultAt) {
    const existing = await getEcomSeedVideoProject(userId, existingId);
    if (existing) {
      return { project: decompose, seedVideo: existing };
    }
  }

  const title = `拆图复刻 · ${(decompose.title?.trim() || "未命名").slice(0, 40)}`;
  const seedVideo = await createEcomSeedVideoProject(userId, { title });

  await updateEcomSeedVideoProject(userId, seedVideo.id, {
    title,
    references: [],
    plan: { shots: [] },
    settings: {
      aspectRatio: "9:16",
      videoModelKey: ECOM_SEED_VIDEO_DEFAULT_VIDEO_MODEL,
    },
    meta: {
      workflow: {
        phase: "production",
        productionMode: "fine",
        planSynced: false,
      },
      sourceMediaDecomposeProjectId: projectId,
      replicaCollectPhase: "model",
    },
    status: "production",
  });

  const project = await updateEcomMediaDecomposeProject(userId, projectId, {
    meta: {
      replicaSeedVideoProjectId: seedVideo.id,
      replicaResultAt: resultAt || new Date().toISOString(),
      replicaProductBrief: null,
    },
  });
  const freshSeed = await getEcomSeedVideoProject(userId, seedVideo.id);
  if (!freshSeed) throw new Error("复刻项目创建失败");
  return { project, seedVideo: freshSeed };
}

export async function upsertReplicaReference(
  userId: string,
  decomposeProjectId: string,
  role: "model" | "product",
  buf: Buffer,
): Promise<{
  project: MediaDecomposeProjectDto;
  seedVideo: EcomSeedVideoProjectDto;
  reference: SeedVideoReference;
}> {
  const { decompose, seedVideo } = await requireReplicaPair(userId, decomposeProjectId);

  const ossUrl = await uploadCanvasUserBuffer({
    userId,
    ext: "png",
    buf,
    contentType: "image/png",
  });

  return upsertReplicaReferenceUrl(userId, decomposeProjectId, role, ossUrl, {
    decompose,
    seedVideo,
    source: "upload",
  });
}

/** 从平台模特库追加模特参考图（OSS URL 直引，不上传副本） */
export async function attachReplicaModelFromLibrary(
  userId: string,
  decomposeProjectId: string,
  entry: { id: string; name?: string; ossUrl: string },
): Promise<{
  project: MediaDecomposeProjectDto;
  seedVideo: EcomSeedVideoProjectDto;
  reference: SeedVideoReference;
}> {
  const ossUrl = entry.ossUrl?.trim();
  if (!entry.id?.trim() || !ossUrl || !/^https?:\/\//i.test(ossUrl)) {
    throw new Error("无效的模特库条目");
  }
  await ensureReplicaSeedProject(userId, decomposeProjectId);
  return upsertReplicaReferenceUrl(userId, decomposeProjectId, "model", ossUrl);
}

/** 从「我的资产」追加模特/产品参考图（不重新上传 OSS） */
export async function attachReplicaRefsFromAssets(
  userId: string,
  decomposeProjectId: string,
  role: "model" | "product",
  assetIds: string[],
): Promise<{
  project: MediaDecomposeProjectDto;
  seedVideo: EcomSeedVideoProjectDto;
  addedCount: number;
}> {
  await ensureReplicaSeedProject(userId, decomposeProjectId);
  const { decompose, seedVideo } = await requireReplicaPair(userId, decomposeProjectId);
  const existing =
    role === "model"
      ? listReplicaModelRefs(seedVideo.references)
      : listReplicaProductRefs(seedVideo.references);
  const remaining = REPLICA_REF_MAX_PER_ROLE - existing.length;
  if (remaining <= 0) {
    throw new Error(
      role === "model"
        ? `模特图最多 ${REPLICA_REF_MAX_PER_ROLE} 张`
        : `产品图最多 ${REPLICA_REF_MAX_PER_ROLE} 张`,
    );
  }

  const ids = [...new Set(assetIds.map((id) => id.trim()).filter(Boolean))].slice(0, remaining);
  if (ids.length === 0) throw new Error("请至少选择一张资产图");

  const assets = await prisma.ecomAsset.findMany({
    where: { userId, id: { in: ids }, kind: "image" },
    select: { id: true, ossUrl: true },
  });
  if (assets.length === 0) throw new Error("找不到所选资产");

  let currentDecompose = decompose;
  let currentSeed = seedVideo;
  let addedCount = 0;

  for (const asset of assets) {
    const url = asset.ossUrl?.trim();
    if (!url || !/^https?:\/\//i.test(url)) continue;
    const currentExisting =
      role === "model"
        ? listReplicaModelRefs(currentSeed.references)
        : listReplicaProductRefs(currentSeed.references);
    if (currentExisting.length >= REPLICA_REF_MAX_PER_ROLE) break;
    const result = await upsertReplicaReferenceUrl(
      userId,
      decomposeProjectId,
      role,
      url,
      { decompose: currentDecompose, seedVideo: currentSeed },
    );
    currentDecompose = result.project;
    currentSeed = result.seedVideo;
    addedCount += 1;
  }

  if (addedCount === 0) throw new Error("所选资产不可用");
  return { project: currentDecompose, seedVideo: currentSeed, addedCount };
}

async function upsertReplicaReferenceUrl(
  userId: string,
  decomposeProjectId: string,
  role: "model" | "product",
  ossUrl: string,
  ctx?: {
    decompose?: MediaDecomposeProjectDto;
    seedVideo?: EcomSeedVideoProjectDto;
    source?: "upload" | "ai-generate";
  },
): Promise<{
  project: MediaDecomposeProjectDto;
  seedVideo: EcomSeedVideoProjectDto;
  reference: SeedVideoReference;
}> {
  let decompose = ctx?.decompose;
  let seedVideo = ctx?.seedVideo;
  if (!decompose || !seedVideo) {
    const pair = await requireReplicaPair(userId, decomposeProjectId);
    decompose = pair.decompose;
    seedVideo = pair.seedVideo;
  }

  const { references, reference: appended } = appendReplicaReference(
    seedVideo.references,
    role,
    ossUrl,
  );

  const updatedSeed = await updateEcomSeedVideoProject(userId, seedVideo.id, {
    references,
    meta: {
      ...(seedVideo.meta ?? {}),
      replicaCollectPhase: resolveReplicaCollectPhase(references),
    },
  });

  return { project: decompose, seedVideo: updatedSeed, reference: appended };
}

export async function deleteReplicaReference(
  userId: string,
  decomposeProjectId: string,
  refId: string,
): Promise<{
  project: MediaDecomposeProjectDto;
  seedVideo: EcomSeedVideoProjectDto;
}> {
  const { decompose, seedVideo } = await requireReplicaPair(userId, decomposeProjectId);
  const references = removeReplicaReference(seedVideo.references, refId);
  const updatedSeed = await updateEcomSeedVideoProject(userId, seedVideo.id, {
    references,
    meta: {
      ...(seedVideo.meta ?? {}),
      replicaCollectPhase: resolveReplicaCollectPhase(references),
    },
  });
  return { project: decompose, seedVideo: updatedSeed };
}

export async function generateReplicaModelPrompt(
  userId: string,
  decomposeProjectId: string,
  modelKey?: string,
): Promise<{ prompt: string }> {
  await assertEcomToolkitGatewayAccess(userId);
  const { decompose, structured } = await requireReplicaPair(userId, decomposeProjectId);

  const chatModel = resolveReplicaTextChatModel(
    modelKey,
    decompose.settings.chatModelKey,
  );

  const { text } = await ecomGwChatComplete(userId, {
    modelKey: chatModel,
    messages: [
      { role: "system", content: buildReplicaModelImagePromptSystem() },
      { role: "user", content: buildReplicaModelImagePromptUserMessage(structured) },
    ],
    clientPage: ecomClientPage(
      userId,
      decomposeProjectId,
      `${ECOM_MEDIA_DECOMPOSE_TOOL_KEY}__${ECOM_MEDIA_DECOMPOSE_REPLICA_MODEL_PROMPT_ACTION}`,
    ),
  });

  const prompt = normalizeReplicaModelImagePrompt(text);
  if (!prompt) throw new Error("AI 未能生成有效的模特 Prompt");
  return { prompt };
}

export async function generateReplicaModelImage(
  userId: string,
  decomposeProjectId: string,
  opts: { prompt: string; modelKey?: string; imageSize?: string },
): Promise<{
  project: MediaDecomposeProjectDto;
  seedVideo: EcomSeedVideoProjectDto;
  reference: SeedVideoReference;
}> {
  await assertEcomToolkitGatewayAccess(userId);
  const { decompose, seedVideo } = await requireReplicaPair(userId, decomposeProjectId);

  const prompt = opts.prompt.trim();
  if (!prompt) throw new Error("请填写模特生图 Prompt");

  const modelKey = opts.modelKey?.trim() || ECOM_STORYBOARD_DEFAULT_IMAGE_MODEL;

  const ossUrl = await generateEcomImage({
    userId,
    modelKey,
    prompt,
    ratio: "3:4",
    imageSize: opts.imageSize,
    refImageUrls: [],
    toolKey: `${ECOM_MEDIA_DECOMPOSE_TOOL_KEY}__${ECOM_MEDIA_DECOMPOSE_REPLICA_MODEL_GENERATE_ACTION}`,
  });

  await updateEcomSeedVideoProject(userId, seedVideo.id, {
    meta: {
      ...(seedVideo.meta ?? {}),
      replicaModelPrompt: prompt.slice(0, 2000),
    },
  });

  return upsertReplicaReferenceUrl(userId, decomposeProjectId, "model", ossUrl, {
    decompose,
    seedVideo,
    source: "ai-generate",
  });
}

export async function recognizeReplicaProduct(
  userId: string,
  decomposeProjectId: string,
  opts?: { userDraft?: string },
): Promise<{
  project: MediaDecomposeProjectDto;
  seedVideo: EcomSeedVideoProjectDto;
  productBrief: string;
}> {
  const { decompose, seedVideo } = await requireReplicaPair(userId, decomposeProjectId);
  const productRefs = listReplicaProductRefs(seedVideo.references);
  if (productRefs.length === 0) throw new Error("请先上传产品图");

  const chatModel = resolveRecognizeProductModel();

  const userDraft = opts?.userDraft?.trim() ?? "";
  const parts: CanvasChatContentPart[] = [
    ...productRefs.map(
      (ref) =>
        ({ type: "image_url", image_url: { url: ref.ossUrl } }) satisfies CanvasChatContentPart,
    ),
    {
      type: "text",
      text: buildReplicaProductRecognizePrompt(productRefs.length, userDraft || undefined),
    },
  ];

  const { text } = await ecomGwChatComplete(userId, {
    modelKey: chatModel,
    messages: [{ role: "user", content: parts }],
    clientPage: ecomClientPage(
      userId,
      decomposeProjectId,
      `${ECOM_MEDIA_DECOMPOSE_TOOL_KEY}__${ECOM_MEDIA_DECOMPOSE_REPLICA_RECOGNIZE_PRODUCT_ACTION}`,
    ),
  });

  const productBrief = formatProductBriefFromRecognition(text);
  const parsed = parseProductRecognitionResult(text);
  const { projectMeta, seedMeta } = mergeReplicaCopyMeta(decompose, seedVideo, {
    productBrief: parsed.productBrief || productBrief,
    sellingPoints: parsed.sellingPoints,
  });
  const project = await updateEcomMediaDecomposeProject(userId, decomposeProjectId, {
    meta: projectMeta,
  });
  const updatedSeed = await updateEcomSeedVideoProject(userId, seedVideo.id, {
    meta: {
      ...seedMeta,
      replicaCollectPhase: "ready",
    },
  });

  return { project, seedVideo: updatedSeed, productBrief: parsed.productBrief || productBrief };
}

export async function generateReplicaScript(
  userId: string,
  decomposeProjectId: string,
  opts?: { productBrief?: string; sellingPoints?: string; modelKey?: string },
): Promise<{
  project: MediaDecomposeProjectDto;
  seedVideo: EcomSeedVideoProjectDto;
}> {
  const { decompose, seedVideo, structured } = await requireReplicaPair(
    userId,
    decomposeProjectId,
  );

  const modelRefs = listReplicaModelRefs(seedVideo.references);
  const productRefs = listReplicaProductRefs(seedVideo.references);
  if (modelRefs.length === 0) throw new Error("请先上传模特图");
  if (productRefs.length === 0) throw new Error("请先上传产品图");

  const mentionCatalog = buildReplicaMentionCatalog(seedVideo.references);
  const primaryModel = primaryReplicaModelRef(seedVideo.references)!;

  const productBrief =
    opts?.productBrief?.trim() ||
    (typeof decompose.meta?.replicaProductBrief === "string"
      ? decompose.meta.replicaProductBrief.trim()
      : "") ||
    (typeof seedVideo.meta?.replicaProductBrief === "string"
      ? String(seedVideo.meta.replicaProductBrief).trim()
      : "");

  const sellingPoints =
    (typeof opts?.sellingPoints === "string" ? opts.sellingPoints.trim() : "") ||
    readReplicaSellingPoints(decompose, seedVideo);

  if (!productBrief && !sellingPoints) {
    throw new Error("请先 AI 识产品或填写产品描述/卖点");
  }

  const draftShots = buildDraftShotsFromDecompose(structured);
  if (draftShots.length === 0) {
    throw new Error("拆解结果中没有可用分镜，请重新拆解后再生成复刻脚本");
  }

  const chatModel = resolveReplicaVisionChatModel(
    opts?.modelKey,
    decompose.settings.chatModelKey,
    "复刻脚本",
  );
  const mentionSummary = replicaMentionSummary(mentionCatalog);
  const clientPage = ecomClientPage(
    userId,
    decomposeProjectId,
    `${ECOM_MEDIA_DECOMPOSE_TOOL_KEY}__${ECOM_MEDIA_DECOMPOSE_REPLICA_SCRIPT_ACTION}`,
  );
  const baseMessages: CanvasChatMessage[] = [
    { role: "system", content: buildReplicaScriptSystemPrompt(mentionCatalog) },
    {
      role: "user",
      content: buildReplicaScriptUserContent({
        structured,
        productBrief,
        sellingPoints,
        draftShots,
        mentionSummary,
        mentionCatalog,
      }),
    },
  ];

  async function callReplicaScriptModel(messages: CanvasChatMessage[]): Promise<string> {
    const { text } = await ecomGwChatComplete(userId, {
      modelKey: chatModel,
      messages,
      clientPage,
    });
    return text;
  }

  let text = await callReplicaScriptModel(baseMessages);
  let patch = extractReplicaScriptPatch(text);
  if (!patch) {
    text = await callReplicaScriptModel([
      ...baseMessages,
      { role: "assistant", content: text },
      { role: "user", content: buildReplicaScriptRetryUserPrompt(draftShots.length) },
    ]);
    patch = extractReplicaScriptPatch(text);
  }
  if (!patch) {
    throw new Error("脚本生成失败：模型未返回有效的 replica-script JSON");
  }

  let shots = mapReplicaScriptToShots(patch, draftShots, primaryModel, mentionCatalog);
  const modelTokens = mentionCatalog.filter((e) => e.role === "model").map((e) => e.token);
  const productTokens = mentionCatalog.filter((e) => e.role === "product").map((e) => e.token);
  const defaultMentionPrefix = [...modelTokens, ...productTokens].join(" ");
  shots = shots.map((s) => ({
    ...s,
    refImageId: primaryModel.id,
    refImageLabel: modelTokens[0] ?? "@图片1",
    videoPrompt:
      modelTokens.some((t) => s.videoPrompt.includes(t)) &&
      productTokens.some((t) => s.videoPrompt.includes(t))
        ? s.videoPrompt
        : defaultMentionPrefix
          ? `${defaultMentionPrefix}，${s.videoPrompt}`
          : s.videoPrompt,
  }));

  const references = normalizeReplicaReferences(seedVideo.references);

  const { projectMeta, seedMeta } = mergeReplicaCopyMeta(decompose, seedVideo, {
    productBrief,
    sellingPoints,
  });
  const updatedSeed = await updateEcomSeedVideoProject(userId, seedVideo.id, {
    references,
    plan: { shots },
    meta: {
      ...seedMeta,
      workflow: {
        ...(typeof seedVideo.meta?.workflow === "object" && seedVideo.meta?.workflow
          ? seedVideo.meta.workflow
          : {}),
        phase: "production",
        productionMode: "fine",
        planSynced: true,
      },
      replicaCollectPhase: "script-done",
      replicaScriptGeneratedAt: new Date().toISOString(),
    },
  });

  const project = await updateEcomMediaDecomposeProject(userId, decomposeProjectId, {
    meta: projectMeta,
  });

  return { project, seedVideo: updatedSeed };
}

export async function saveReplicaCopyFields(
  userId: string,
  decomposeProjectId: string,
  patch: { productBrief?: string; sellingPoints?: string },
): Promise<{
  project: MediaDecomposeProjectDto;
  seedVideo: EcomSeedVideoProjectDto;
}> {
  const { decompose, seedVideo } = await requireReplicaPair(userId, decomposeProjectId);
  const { projectMeta, seedMeta } = mergeReplicaCopyMeta(decompose, seedVideo, patch);
  const project = await updateEcomMediaDecomposeProject(userId, decomposeProjectId, {
    meta: projectMeta,
  });
  const updatedSeed = await updateEcomSeedVideoProject(userId, seedVideo.id, {
    meta: {
      ...seedMeta,
      replicaCollectPhase: "ready",
    },
  });
  return { project, seedVideo: updatedSeed };
}

export async function generateReplicaSellingPoints(
  userId: string,
  decomposeProjectId: string,
  opts?: { userDraft?: string; productBrief?: string; modelKey?: string },
): Promise<{
  project: MediaDecomposeProjectDto;
  seedVideo: EcomSeedVideoProjectDto;
  sellingPoints: string;
}> {
  const { decompose, seedVideo } = await requireReplicaPair(userId, decomposeProjectId);
  const productRefs = listReplicaProductRefs(seedVideo.references);
  if (productRefs.length === 0) throw new Error("请先上传产品图");

  const productBrief =
    opts?.productBrief?.trim() ||
    (typeof decompose.meta?.replicaProductBrief === "string"
      ? decompose.meta.replicaProductBrief.trim()
      : "") ||
    (typeof seedVideo.meta?.replicaProductBrief === "string"
      ? String(seedVideo.meta.replicaProductBrief).trim()
      : "");

  const userDraft = opts?.userDraft?.trim() || undefined;

  const chatModel = resolveRecognizeProductModel();
  const parts: CanvasChatContentPart[] = [
    ...productRefs.map(
      (ref) =>
        ({ type: "image_url", image_url: { url: ref.ossUrl } }) satisfies CanvasChatContentPart,
    ),
    {
      type: "text",
      text: buildReplicaSellingPointsPrompt({
        imageCount: productRefs.length,
        productBrief: productBrief || undefined,
        userDraft: userDraft || undefined,
      }),
    },
  ];

  const { text } = await ecomGwChatComplete(userId, {
    modelKey: chatModel,
    messages: [{ role: "user", content: parts }],
    clientPage: ecomClientPage(
      userId,
      decomposeProjectId,
      `${ECOM_MEDIA_DECOMPOSE_TOOL_KEY}__${ECOM_MEDIA_DECOMPOSE_REPLICA_SELLING_POINTS_ACTION}`,
    ),
  });

  const sellingPoints = normalizeSellingPointsText(text);
  const { projectMeta, seedMeta } = mergeReplicaCopyMeta(decompose, seedVideo, {
    sellingPoints,
  });
  const project = await updateEcomMediaDecomposeProject(userId, decomposeProjectId, {
    meta: projectMeta,
  });
  const updatedSeed = await updateEcomSeedVideoProject(userId, seedVideo.id, {
    meta: seedMeta,
  });

  return { project, seedVideo: updatedSeed, sellingPoints };
}

export async function generateReplicaVoiceoverDraft(
  userId: string,
  decomposeProjectId: string,
  opts?: { productBrief?: string; sellingPoints?: string; modelKey?: string },
): Promise<{
  project: MediaDecomposeProjectDto;
  seedVideo: EcomSeedVideoProjectDto;
  voiceoverDraft: ReplicaVoiceoverDraftDto;
}> {
  const { decompose, seedVideo, structured } = await requireReplicaPair(
    userId,
    decomposeProjectId,
  );

  if (structured.mediaType !== "video") {
    throw new Error("AI 口播文案仅支持视频拆解项目");
  }

  const productBrief =
    opts?.productBrief?.trim() ||
    (typeof decompose.meta?.replicaProductBrief === "string"
      ? decompose.meta.replicaProductBrief.trim()
      : "") ||
    (typeof seedVideo.meta?.replicaProductBrief === "string"
      ? String(seedVideo.meta.replicaProductBrief).trim()
      : "");

  const sellingPoints =
    (typeof opts?.sellingPoints === "string" ? opts.sellingPoints.trim() : "") ||
    readReplicaSellingPoints(decompose, seedVideo);

  const planShots = seedVideo.plan?.shots ?? [];
  const draftShots = planShots.length > 0 ? planShots : buildDraftShotsFromDecompose(structured);
  if (draftShots.length === 0) {
    throw new Error("缺少分镜表，请先完成视频拆解或生成复刻脚本");
  }

  const chatModel = resolveReplicaTextChatModel(
    opts?.modelKey,
    decompose.settings.chatModelKey,
  );

  const shotInputs = draftShots.map((s) => ({
    index: s.index,
    timeSlice: s.timeSlice,
    durationSec: s.durationSec,
    sceneDescription: s.sceneDescription,
    voiceover: s.voiceover,
  }));

  const { text } = await ecomGwChatComplete(userId, {
    modelKey: chatModel,
    messages: [
      { role: "system", content: buildReplicaVoiceoverSystemPrompt() },
      {
        role: "user",
        content: buildReplicaVoiceoverUserPrompt({
          structured,
          productBrief,
          sellingPoints,
          shots: shotInputs,
        }),
      },
    ],
    clientPage: ecomClientPage(
      userId,
      decomposeProjectId,
      `${ECOM_MEDIA_DECOMPOSE_TOOL_KEY}__${ECOM_MEDIA_DECOMPOSE_REPLICA_VOICEOVER_ACTION}`,
    ),
  });

  const patch = extractReplicaVoiceoverPatch(text);
  if (!patch) {
    throw new Error("口播生成失败：模型未返回有效的 replica-voiceover JSON");
  }

  const byIndex = new Map(patch.shots.map((s) => [s.index, s.voiceover.trim()]));
  const voiceoverDraft: ReplicaVoiceoverDraftDto = {
    shots: draftShots.map((s) => ({
      index: s.index,
      voiceover: byIndex.get(s.index) ?? "",
    })),
    generatedAt: new Date().toISOString(),
  };

  const updatedSeed = await updateEcomSeedVideoProject(userId, seedVideo.id, {
    meta: {
      ...(seedVideo.meta ?? {}),
      replicaVoiceoverDraft: voiceoverDraft,
    },
  });

  return { project: decompose, seedVideo: updatedSeed, voiceoverDraft };
}

/** @deprecated 别名：开始复刻 = 创建空复刻项目 */
export async function startMediaDecomposeReplica(
  userId: string,
  projectId: string,
): Promise<{ project: MediaDecomposeProjectDto; seedVideo: EcomSeedVideoProjectDto }> {
  return ensureReplicaSeedProject(userId, projectId);
}
