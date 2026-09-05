import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import type { CanvasChatContentPart } from "@/lib/canvas/providers/types";
import {
  extractFilmPullAnalyzePatch,
  type FilmPullAnalyzePatch,
} from "@/lib/ecom/ecom-film-pull-structured";
import { resolveFilmPullAnalyzePatchForDisplay } from "@/lib/canvas/pro2-shot-analysis-view";
import {
  getEcomFilmPullProject,
  updateEcomFilmPullProject,
} from "@/lib/ecom/ecom-film-pull-service";
import type { FilmPullProjectDto } from "@/lib/ecom/ecom-film-pull-types";
import {
  ECOM_FILM_PULL_DEFAULT_CHAT_MODEL,
  ECOM_FILM_PULL_REPLICA_MODEL_GENERATE_ACTION,
  ECOM_FILM_PULL_REPLICA_MODEL_PROMPT_ACTION,
  ECOM_FILM_PULL_REPLICA_RECOGNIZE_PRODUCT_ACTION,
  ECOM_FILM_PULL_REPLICA_SCRIPT_ACTION,
  ECOM_FILM_PULL_TOOL_KEY,
} from "@/lib/ecom/ecom-film-pull-types";
import {
  appendReplicaReference,
  buildReplicaMentionCatalog,
  listReplicaModelRefs,
  listReplicaProductRefs,
  primaryReplicaModelRef,
  removeReplicaReference,
  resolveReplicaCollectPhase,
  replicaMentionSummary,
} from "@/lib/ecom/ecom-media-decompose-replica-refs";
import { resolveRecognizeProductModel } from "@/lib/ecom/ecom-media-decompose-replica";
import {
  buildDraftShotsFromFilmPull,
  buildFilmPullReplicaModelImagePromptUserMessage,
  buildFilmPullReplicaScriptUserPrompt,
} from "@/lib/ecom/ecom-film-pull-replica-script";
import {
  buildReplicaModelImagePromptSystem,
  buildReplicaProductRecognizePrompt,
  buildReplicaScriptSystemPrompt,
  extractReplicaScriptPatch,
  formatProductBriefFromRecognition,
  mapReplicaScriptToShots,
  normalizeReplicaModelImagePrompt,
} from "@/lib/ecom/ecom-media-decompose-replica-script";
import {
  createEcomSeedVideoProject,
  getEcomSeedVideoProject,
  updateEcomSeedVideoProject,
  type EcomSeedVideoProjectDto,
} from "@/lib/ecom/ecom-seed-video-service";
import { generateEcomImage } from "@/lib/ecom/ecom-image-gen-invoke";
import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { ecomClientPage } from "@/lib/ecom/ecom-tool-keys";
import { ECOM_STORYBOARD_DEFAULT_IMAGE_MODEL } from "@/lib/gateway/ecom-storyboard-chat-models";
import { ecomGwChatComplete } from "@/lib/gateway/ecom-tool-gateway-client";
import {
  ECOM_SEED_VIDEO_DEFAULT_VIDEO_MODEL,
  type SeedVideoReference,
} from "@/lib/ecom/ecom-seed-video-types";

export function readFilmPullReplicaSeedVideoProjectId(
  meta: Record<string, unknown> | null | undefined,
): string | null {
  const id = meta?.replicaSeedVideoProjectId;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

function readFilmPullStructured(project: FilmPullProjectDto): FilmPullAnalyzePatch | null {
  const fromStored = resolveFilmPullAnalyzePatchForDisplay(
    project.analyzeResult?.structured,
  );
  if (fromStored) return fromStored;
  return project.analyzeResult?.rawText
    ? extractFilmPullAnalyzePatch(project.analyzeResult.rawText)
    : null;
}

function normalizeReplicaReferences(existing: SeedVideoReference[]): SeedVideoReference[] {
  const models = listReplicaModelRefs(existing);
  const products = listReplicaProductRefs(existing);
  return [...models, ...products];
}

async function requireFilmPullReplicaPair(
  userId: string,
  filmPullProjectId: string,
): Promise<{
  filmPull: FilmPullProjectDto;
  seedVideo: EcomSeedVideoProjectDto;
  structured: FilmPullAnalyzePatch;
}> {
  const filmPull = await getEcomFilmPullProject(userId, filmPullProjectId);
  if (!filmPull) throw new Error("项目不存在");
  const structured = readFilmPullStructured(filmPull);
  if (!structured) throw new Error("请先完成拉片");
  const seedVideoId = readFilmPullReplicaSeedVideoProjectId(filmPull.meta);
  if (!seedVideoId) throw new Error("请先开始一键复刻");
  const seedVideo = await getEcomSeedVideoProject(userId, seedVideoId);
  if (!seedVideo) throw new Error("复刻项目不存在");
  return { filmPull, seedVideo, structured };
}

/** 创建/关联复刻用 seed-video 项目（空镜头表，待采集模特/产品后生成脚本） */
export async function ensureFilmPullReplicaSeedProject(
  userId: string,
  projectId: string,
): Promise<{ project: FilmPullProjectDto; seedVideo: EcomSeedVideoProjectDto }> {
  const filmPull = await getEcomFilmPullProject(userId, projectId);
  if (!filmPull) throw new Error("项目不存在");
  const structured = readFilmPullStructured(filmPull);
  if (!structured) {
    throw new Error("拉片结果里还没有可用的分镜表，请先完成拉片后再复刻");
  }
  if (!filmPull.media?.ossUrl) throw new Error("请先上传视频");

  const resultAt = filmPull.analyzeResult?.completedAt?.trim() || "";
  const existingId = readFilmPullReplicaSeedVideoProjectId(filmPull.meta);
  const existingAt =
    typeof filmPull.meta?.replicaResultAt === "string" ? filmPull.meta.replicaResultAt : "";

  if (existingId && existingAt === resultAt) {
    const existing = await getEcomSeedVideoProject(userId, existingId);
    if (existing) {
      return { project: filmPull, seedVideo: existing };
    }
  }

  const title = `拉片复刻 · ${(filmPull.title?.trim() || "未命名").slice(0, 40)}`;
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
      sourceFilmPullProjectId: projectId,
      replicaCollectPhase: "model",
    },
    status: "production",
  });

  const project = await updateEcomFilmPullProject(userId, projectId, {
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

export async function startFilmPullReplica(
  userId: string,
  projectId: string,
): Promise<{ project: FilmPullProjectDto; seedVideo: EcomSeedVideoProjectDto }> {
  return ensureFilmPullReplicaSeedProject(userId, projectId);
}

export async function upsertFilmPullReplicaReference(
  userId: string,
  filmPullProjectId: string,
  role: "model" | "product",
  buf: Buffer,
): Promise<{
  project: FilmPullProjectDto;
  seedVideo: EcomSeedVideoProjectDto;
  reference: SeedVideoReference;
}> {
  const { filmPull, seedVideo } = await requireFilmPullReplicaPair(userId, filmPullProjectId);

  const ossUrl = await uploadCanvasUserBuffer({
    userId,
    ext: "png",
    buf,
    contentType: "image/png",
  });

  return upsertFilmPullReplicaReferenceUrl(userId, filmPullProjectId, role, ossUrl, {
    filmPull,
    seedVideo,
    source: "upload",
  });
}

async function upsertFilmPullReplicaReferenceUrl(
  userId: string,
  filmPullProjectId: string,
  role: "model" | "product",
  ossUrl: string,
  ctx?: {
    filmPull?: FilmPullProjectDto;
    seedVideo?: EcomSeedVideoProjectDto;
    source?: "upload" | "ai-generate";
  },
): Promise<{
  project: FilmPullProjectDto;
  seedVideo: EcomSeedVideoProjectDto;
  reference: SeedVideoReference;
}> {
  let filmPull = ctx?.filmPull;
  let seedVideo = ctx?.seedVideo;
  if (!filmPull || !seedVideo) {
    const pair = await requireFilmPullReplicaPair(userId, filmPullProjectId);
    filmPull = pair.filmPull;
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

  return { project: filmPull, seedVideo: updatedSeed, reference: appended };
}

export async function deleteFilmPullReplicaReference(
  userId: string,
  filmPullProjectId: string,
  refId: string,
): Promise<{
  project: FilmPullProjectDto;
  seedVideo: EcomSeedVideoProjectDto;
}> {
  const { filmPull, seedVideo } = await requireFilmPullReplicaPair(userId, filmPullProjectId);
  const references = removeReplicaReference(seedVideo.references, refId);
  const updatedSeed = await updateEcomSeedVideoProject(userId, seedVideo.id, {
    references,
    meta: {
      ...(seedVideo.meta ?? {}),
      replicaCollectPhase: resolveReplicaCollectPhase(references),
    },
  });
  return { project: filmPull, seedVideo: updatedSeed };
}

export async function generateFilmPullReplicaModelPrompt(
  userId: string,
  filmPullProjectId: string,
  modelKey?: string,
): Promise<{ prompt: string }> {
  await assertEcomToolkitGatewayAccess(userId);
  const { filmPull, structured } = await requireFilmPullReplicaPair(userId, filmPullProjectId);

  const chatModel =
    modelKey?.trim() ||
    filmPull.settings.chatModelKey?.trim() ||
    ECOM_FILM_PULL_DEFAULT_CHAT_MODEL;

  const { text } = await ecomGwChatComplete(userId, {
    modelKey: chatModel,
    messages: [
      { role: "system", content: buildReplicaModelImagePromptSystem() },
      { role: "user", content: buildFilmPullReplicaModelImagePromptUserMessage(structured) },
    ],
    clientPage: ecomClientPage(
      userId,
      filmPullProjectId,
      `${ECOM_FILM_PULL_TOOL_KEY}__${ECOM_FILM_PULL_REPLICA_MODEL_PROMPT_ACTION}`,
    ),
  });

  const prompt = normalizeReplicaModelImagePrompt(text);
  if (!prompt) throw new Error("AI 未能生成有效的模特 Prompt");
  return { prompt };
}

export async function generateFilmPullReplicaModelImage(
  userId: string,
  filmPullProjectId: string,
  opts: { prompt: string; modelKey?: string; imageSize?: string },
): Promise<{
  project: FilmPullProjectDto;
  seedVideo: EcomSeedVideoProjectDto;
  reference: SeedVideoReference;
}> {
  await assertEcomToolkitGatewayAccess(userId);
  const { filmPull, seedVideo } = await requireFilmPullReplicaPair(userId, filmPullProjectId);

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
    toolKey: `${ECOM_FILM_PULL_TOOL_KEY}__${ECOM_FILM_PULL_REPLICA_MODEL_GENERATE_ACTION}`,
  });

  await updateEcomSeedVideoProject(userId, seedVideo.id, {
    meta: {
      ...(seedVideo.meta ?? {}),
      replicaModelPrompt: prompt.slice(0, 2000),
    },
  });

  return upsertFilmPullReplicaReferenceUrl(userId, filmPullProjectId, "model", ossUrl, {
    filmPull,
    seedVideo,
    source: "ai-generate",
  });
}

export async function recognizeFilmPullReplicaProduct(
  userId: string,
  filmPullProjectId: string,
  opts?: { userDraft?: string },
): Promise<{
  project: FilmPullProjectDto;
  seedVideo: EcomSeedVideoProjectDto;
  productBrief: string;
}> {
  const userDraft = opts?.userDraft?.trim() ?? "";
  const { filmPull, seedVideo } = await requireFilmPullReplicaPair(userId, filmPullProjectId);
  const productRefs = listReplicaProductRefs(seedVideo.references);
  if (productRefs.length === 0) throw new Error("请先上传产品图");

  const chatModel = resolveRecognizeProductModel();

  const parts: CanvasChatContentPart[] = [
    ...productRefs.map(
      (ref) =>
        ({ type: "image_url", image_url: { url: ref.ossUrl } }) satisfies CanvasChatContentPart,
    ),
    { type: "text", text: buildReplicaProductRecognizePrompt(productRefs.length, userDraft || undefined) },
  ];

  const { text } = await ecomGwChatComplete(userId, {
    modelKey: chatModel,
    messages: [{ role: "user", content: parts }],
    clientPage: ecomClientPage(
      userId,
      filmPullProjectId,
      `${ECOM_FILM_PULL_TOOL_KEY}__${ECOM_FILM_PULL_REPLICA_RECOGNIZE_PRODUCT_ACTION}`,
    ),
  });

  const productBrief = formatProductBriefFromRecognition(text);
  const project = await updateEcomFilmPullProject(userId, filmPullProjectId, {
    meta: { replicaProductBrief: productBrief },
  });
  const updatedSeed = await updateEcomSeedVideoProject(userId, seedVideo.id, {
    meta: {
      ...(seedVideo.meta ?? {}),
      replicaCollectPhase: "ready",
      replicaProductBrief: productBrief,
    },
  });

  return { project, seedVideo: updatedSeed, productBrief };
}

export async function generateFilmPullReplicaScript(
  userId: string,
  filmPullProjectId: string,
  opts?: { productBrief?: string; modelKey?: string },
): Promise<{
  project: FilmPullProjectDto;
  seedVideo: EcomSeedVideoProjectDto;
}> {
  const { filmPull, seedVideo, structured } = await requireFilmPullReplicaPair(
    userId,
    filmPullProjectId,
  );

  const modelRefs = listReplicaModelRefs(seedVideo.references);
  const productRefs = listReplicaProductRefs(seedVideo.references);
  if (modelRefs.length === 0) throw new Error("请先上传模特图");
  if (productRefs.length === 0) throw new Error("请先上传产品图");

  const mentionCatalog = buildReplicaMentionCatalog(seedVideo.references);
  const primaryModel = primaryReplicaModelRef(seedVideo.references)!;

  const productBrief =
    opts?.productBrief?.trim() ||
    (typeof filmPull.meta?.replicaProductBrief === "string"
      ? filmPull.meta.replicaProductBrief.trim()
      : "") ||
    (typeof filmPull.meta?.productBrief === "string" ? filmPull.meta.productBrief.trim() : "") ||
    (typeof seedVideo.meta?.replicaProductBrief === "string"
      ? String(seedVideo.meta.replicaProductBrief).trim()
      : "");

  if (!productBrief) {
    throw new Error("请先 AI 识产品或填写产品描述");
  }

  const draftShots = buildDraftShotsFromFilmPull(structured);
  const chatModel =
    opts?.modelKey?.trim() ||
    filmPull.settings.chatModelKey?.trim() ||
    ECOM_FILM_PULL_DEFAULT_CHAT_MODEL;

  const { text } = await ecomGwChatComplete(userId, {
    modelKey: chatModel,
    messages: [
      { role: "system", content: buildReplicaScriptSystemPrompt(mentionCatalog) },
      {
        role: "user",
        content: buildFilmPullReplicaScriptUserPrompt({
          structured,
          productBrief,
          draftShots,
          mentionSummary: replicaMentionSummary(mentionCatalog),
        }),
      },
    ],
    clientPage: ecomClientPage(
      userId,
      filmPullProjectId,
      `${ECOM_FILM_PULL_TOOL_KEY}__${ECOM_FILM_PULL_REPLICA_SCRIPT_ACTION}`,
    ),
  });

  const patch = extractReplicaScriptPatch(text);
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

  const updatedSeed = await updateEcomSeedVideoProject(userId, seedVideo.id, {
    references,
    plan: { shots },
    meta: {
      ...(seedVideo.meta ?? {}),
      workflow: {
        ...(typeof seedVideo.meta?.workflow === "object" && seedVideo.meta?.workflow
          ? seedVideo.meta.workflow
          : {}),
        phase: "production",
        productionMode: "fine",
        planSynced: true,
      },
      replicaCollectPhase: "script-done",
      replicaProductBrief: productBrief,
      replicaScriptGeneratedAt: new Date().toISOString(),
    },
  });

  const project = await updateEcomFilmPullProject(userId, filmPullProjectId, {
    meta: { replicaProductBrief: productBrief },
  });

  return { project, seedVideo: updatedSeed };
}
