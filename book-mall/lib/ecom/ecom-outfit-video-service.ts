import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { buildWorkflowEnvelope } from "@/lib/ecom/video-workflow/envelope";
import {
  normalizeSceneIndices,
  sanitizeSceneList,
  type OutfitSceneFusion,
  type SceneShot,
  type WorkflowComposeResult,
  type WorkflowRefs,
} from "@/lib/ecom/video-workflow/shot-spine";
import {
  mergeSceneListWithGenerateResults,
  sanitizeOutfitSceneList,
} from "@/lib/ecom/video-workflow/templates/outfit-v1/parser";
import {
  OUTFIT_V1_DEFAULT_SPLIT_CONFIG,
  OUTFIT_V1_DEFAULT_VIDEO_MODEL,
  OUTFIT_V1_LLM_JSON_PREFIX,
  OUTFIT_V1_NEGATIVE_PROMPT,
  OUTFIT_V1_POSITIVE_PROMPT,
  OUTFIT_V1_TEMPLATE_ID,
} from "@/lib/ecom/video-workflow/templates/outfit-v1/constants";
import { inferOutfitPhase, isOutfitRefsReadyToLock } from "@/lib/ecom/video-workflow/templates/outfit-v1/ui-config";
import type { WorkflowEnvelope } from "@/lib/ecom/video-workflow/envelope";
import {
  ECOM_OUTFIT_VIDEO_MODULE,
  type OutfitGarmentMode,
  type OutfitRefMode,
  type OutfitVideoProjectDto,
  type OutfitVideoSettings,
  type OutfitSplitProgress,
} from "@/lib/ecom/ecom-outfit-video-types";
import {
  isOutfitSplitInProgress,
  reconcileStaleOutfitSplitState,
  releaseOutfitSplitLock,
  tryAcquireOutfitSplitLock,
} from "@/lib/ecom/ecom-outfit-video-split-lock";
import {
  inferKindFromOssUrl,
  resolveMediaDecomposeFromUrl,
  resolveMediaDecomposeUpload,
} from "@/lib/ecom/ecom-media-decompose-media";
import { ecomGenerateOutfitVideoShot } from "@/lib/ecom/ecom-outfit-video-generate";
import { runEcomOutfitVideoTryOn } from "@/lib/ecom/ecom-outfit-video-tryon";
import {
  runOutfitVideoSceneFusion,
  type OutfitSceneFusionMode,
} from "@/lib/ecom/ecom-outfit-video-scene-fusion";
import { OUTFIT_DEFAULT_FUSION_MODEL } from "@/lib/ecom/ecom-outfit-video-fusion-models";
import { OUTFIT_V1_DEFAULT_SPLIT_MODEL } from "@/lib/ecom/ecom-outfit-video-split-prompts";
import {
  buildOutfitSplitSystemPromptDisplay,
  outfitSplitUserPromptDisplay,
  resolveOutfitSplitSystemPromptForRun,
} from "@/lib/ecom/ecom-outfit-video-split-prompts";
import {
  formatOutfitSplitPromptValidationError,
  validateOutfitSplitPrompts,
} from "@/lib/ecom/ecom-outfit-video-split-prompt-validate";
import { splitOutfitReferenceVideoPhysical } from "@/lib/ecom/ecom-outfit-video-split";

function assertOutfitVideoPrismaDelegate(): void {
  const delegate = (
    prisma as unknown as {
      ecomVideoWorkflowProject?: { create?: unknown };
    }
  ).ecomVideoWorkflowProject;
  if (typeof delegate?.create !== "function") {
    throw new Error(
      "数据库客户端未包含短视频工作流项目表，请在 book-mall 执行 pnpm db:generate 并重启 dev:all",
    );
  }
}

function sanitizeOutfitRefMode(raw: unknown): OutfitRefMode {
  return raw === "already_dressed" ? "already_dressed" : "need_tryon";
}

function sanitizeGarmentMode(raw: unknown): OutfitGarmentMode {
  return raw === "one_piece" ? "one_piece" : "two_piece";
}

function sanitizeSettings(raw: unknown): OutfitVideoSettings {
  if (!raw || typeof raw !== "object") {
    return {
      videoModelKey: OUTFIT_V1_DEFAULT_VIDEO_MODEL,
      splitModelKey: OUTFIT_V1_DEFAULT_SPLIT_MODEL,
      outfitRefMode: "need_tryon",
      garmentMode: "two_piece",
      fusionModelKey: OUTFIT_DEFAULT_FUSION_MODEL,
    };
  }
  const o = raw as Record<string, unknown>;
  return {
    videoModelKey:
      typeof o.videoModelKey === "string" && o.videoModelKey.trim()
        ? o.videoModelKey.trim()
        : OUTFIT_V1_DEFAULT_VIDEO_MODEL,
    splitModelKey:
      typeof o.splitModelKey === "string" && o.splitModelKey.trim()
        ? o.splitModelKey.trim()
        : OUTFIT_V1_DEFAULT_SPLIT_MODEL,
    outfitRefMode: sanitizeOutfitRefMode(o.outfitRefMode),
    garmentMode: sanitizeGarmentMode(o.garmentMode),
    fusionModelKey:
      typeof o.fusionModelKey === "string" && o.fusionModelKey.trim()
        ? o.fusionModelKey.trim()
        : OUTFIT_DEFAULT_FUSION_MODEL,
    splitSystemPrompt:
      typeof o.splitSystemPrompt === "string" && o.splitSystemPrompt.trim()
        ? o.splitSystemPrompt
        : undefined,
    splitUserPrompt:
      typeof o.splitUserPrompt === "string" && o.splitUserPrompt.trim()
        ? o.splitUserPrompt
        : undefined,
    lastSplitPrompt:
      typeof o.lastSplitPrompt === "string" && o.lastSplitPrompt.trim()
        ? o.lastSplitPrompt
        : undefined,
  };
}

const REF_IMAGE_KEYS = [
  "model",
  "clothing",
  "topGarment",
  "bottomGarment",
  "dressedImage",
] as const;

type RefImageKey = (typeof REF_IMAGE_KEYS)[number];

function sanitizeRefImageEntry(
  v: unknown,
): WorkflowRefs[RefImageKey] | undefined {
  if (!v || typeof v !== "object") return undefined;
  const r = v as Record<string, unknown>;
  if (typeof r.ossUrl !== "string" || !r.ossUrl.trim()) return undefined;
  return {
    ossUrl: r.ossUrl.trim(),
    label: typeof r.label === "string" ? r.label : undefined,
    source:
      typeof r.source === "string"
        ? (r.source as NonNullable<WorkflowRefs[RefImageKey]>["source"])
        : undefined,
  };
}

function sanitizeRefs(raw: unknown): WorkflowRefs {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const out: WorkflowRefs = {};
  for (const key of ["referenceVideo", ...REF_IMAGE_KEYS] as const) {
    const v = o[key];
    if (key === "referenceVideo") {
      if (!v || typeof v !== "object") continue;
      const r = v as Record<string, unknown>;
      if (typeof r.ossUrl === "string" && r.ossUrl.trim()) {
        out.referenceVideo = {
          ossUrl: r.ossUrl.trim(),
          label: typeof r.label === "string" ? r.label : undefined,
        };
      }
      continue;
    }
    const parsed = sanitizeRefImageEntry(v);
    if (parsed) out[key] = parsed;
  }
  return out;
}

function sanitizeStructured(raw: unknown): Record<string, WorkflowEnvelope> | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const out: Record<string, WorkflowEnvelope> = {};
  for (const [k, v] of Object.entries(o)) {
    if (!v || typeof v !== "object") continue;
    const env = v as WorkflowEnvelope;
    if (env.schemaVersion === "ecom-video-workflow/v1" && env.templateId) {
      out[k] = env;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

function sanitizeComposeResult(raw: unknown): WorkflowComposeResult | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.videoUrl === "string" && o.videoUrl.trim()) {
    return o as WorkflowComposeResult;
  }
  return null;
}

function inferPhaseFromProject(row: {
  references: unknown;
  sceneList: unknown;
  composeResult: unknown;
}): ReturnType<typeof inferOutfitPhase> {
  const refs = sanitizeRefs(row.references);
  const scenes = sanitizeOutfitSceneList(row.sceneList);
  const compose = sanitizeComposeResult(row.composeResult);
  return inferOutfitPhase({
    hasReferenceVideo: Boolean(refs.referenceVideo?.ossUrl),
    sceneCount: scenes.length,
    hasDressedImage: Boolean(refs.dressedImage?.ossUrl),
    allShotsHaveVideo:
      scenes.length > 0 && scenes.every((s) => Boolean(s.videoUrl?.trim())),
    hasComposeVideo: Boolean(compose?.videoUrl?.trim()),
  });
}

function rowToDto(row: {
  id: string;
  title: string | null;
  module: string;
  templateId: string;
  status: string;
  phase: string;
  settings: unknown;
  references: unknown;
  structured: unknown;
  sceneList: unknown;
  composeResult: unknown;
  meta: unknown;
  createdAt: Date;
  updatedAt: Date;
}): OutfitVideoProjectDto {
  const sceneList = sanitizeOutfitSceneList(row.sceneList);
  const phase = inferPhaseFromProject(row);
  return {
    id: row.id,
    title: row.title,
    module: row.module,
    templateId: row.templateId,
    status: row.status,
    phase,
    settings: sanitizeSettings(row.settings),
    references: sanitizeRefs(row.references),
    structured: sanitizeStructured(row.structured),
    sceneList,
    composeResult: sanitizeComposeResult(row.composeResult),
    meta: (row.meta as Record<string, unknown> | null) ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function getOwnedRow(userId: string, projectId: string) {
  return prisma.ecomVideoWorkflowProject.findFirst({
    where: { userId, id: projectId, module: ECOM_OUTFIT_VIDEO_MODULE },
  });
}

export async function listEcomOutfitVideoProjects(
  userId: string,
): Promise<OutfitVideoProjectDto[]> {
  const rows = await prisma.ecomVideoWorkflowProject.findMany({
    where: { userId, module: ECOM_OUTFIT_VIDEO_MODULE },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
  return rows.map(rowToDto);
}

export async function createEcomOutfitVideoProject(
  userId: string,
  opts?: { title?: string },
): Promise<OutfitVideoProjectDto> {
  assertOutfitVideoPrismaDelegate();
  const row = await prisma.ecomVideoWorkflowProject.create({
    data: {
      userId,
      module: ECOM_OUTFIT_VIDEO_MODULE,
      templateId: OUTFIT_V1_TEMPLATE_ID,
      title: opts?.title?.trim() || "穿搭视频",
      phase: "upload",
      settings: {
        videoModelKey: OUTFIT_V1_DEFAULT_VIDEO_MODEL,
      } as Prisma.InputJsonValue,
      references: Prisma.JsonNull,
      structured: Prisma.JsonNull,
      sceneList: Prisma.JsonNull,
      composeResult: Prisma.JsonNull,
    },
  });
  return rowToDto(row);
}

export async function getEcomOutfitVideoProject(
  userId: string,
  projectId: string,
): Promise<OutfitVideoProjectDto | null> {
  const row = await getOwnedRow(userId, projectId);
  if (!row) return null;
  const dto = rowToDto(row);
  const reconciled = reconcileStaleOutfitSplitState(dto);
  if (!reconciled.dirty) return dto;

  const patch: Parameters<typeof updateEcomOutfitVideoProject>[2] = {
    meta: reconciled.meta,
  };
  if (reconciled.status) patch.status = reconciled.status;
  return updateEcomOutfitVideoProject(userId, projectId, patch);
}

function outfitReferenceReplacePatch(): Partial<{
  sceneList: SceneShot[];
  structured: Record<string, WorkflowEnvelope> | null;
  composeResult: WorkflowComposeResult | null;
  meta: Record<string, unknown>;
}> {
  return {
    sceneList: [],
    structured: null,
    composeResult: null,
    meta: {
      splitInProgressAt: null,
      splitProgress: null,
      splitLlmStreamTail: null,
    },
  };
}

export async function updateEcomOutfitVideoProject(
  userId: string,
  projectId: string,
  patch: Partial<{
    title: string;
    settings: OutfitVideoSettings;
    references: WorkflowRefs;
    structured: Record<string, WorkflowEnvelope> | null;
    sceneList: SceneShot[];
    composeResult: WorkflowComposeResult | null;
    status: string;
    phase: string;
    meta: Record<string, unknown>;
  }>,
): Promise<OutfitVideoProjectDto> {
  const existing = await getOwnedRow(userId, projectId);
  if (!existing) throw new Error("项目不存在");

  const data: Prisma.EcomVideoWorkflowProjectUpdateInput = {};
  if (typeof patch.title === "string") data.title = patch.title.trim() || "穿搭视频";
  if (patch.settings) {
    data.settings = {
      ...sanitizeSettings(existing.settings),
      ...patch.settings,
    } as Prisma.InputJsonValue;
  }
  if (patch.references) data.references = patch.references as Prisma.InputJsonValue;
  if (patch.structured !== undefined) {
    data.structured =
      patch.structured === null
        ? Prisma.JsonNull
        : (patch.structured as Prisma.InputJsonValue);
  }
  if (patch.sceneList) {
    data.sceneList = normalizeSceneIndices(patch.sceneList) as Prisma.InputJsonValue;
  }
  if (patch.composeResult !== undefined) {
    data.composeResult =
      patch.composeResult === null
        ? Prisma.JsonNull
        : (patch.composeResult as Prisma.InputJsonValue);
  }
  if (typeof patch.status === "string") data.status = patch.status;
  if (typeof patch.phase === "string") data.phase = patch.phase;
  if (patch.meta) {
    data.meta = {
      ...((existing.meta as Record<string, unknown> | null) ?? {}),
      ...patch.meta,
    } as Prisma.InputJsonValue;
  }

  const row = await prisma.ecomVideoWorkflowProject.update({
    where: { id: projectId },
    data,
  });
  return rowToDto(row);
}

function applyOutfitReferenceVideo(
  existing: { references: unknown },
  ossUrl: string,
  label: string,
): WorkflowRefs {
  const refs = sanitizeRefs(existing.references);
  refs.referenceVideo = { ossUrl, label };
  return refs;
}

export async function uploadEcomOutfitVideoReference(
  userId: string,
  projectId: string,
  file: File,
): Promise<OutfitVideoProjectDto> {
  const existing = await getOwnedRow(userId, projectId);
  if (!existing) throw new Error("项目不存在");

  const buf = Buffer.from(await file.arrayBuffer());
  const uploaded = await resolveMediaDecomposeUpload({
    userId,
    buf,
    contentType: file.type,
    fileName: file.name,
  });
  if (uploaded.kind !== "video") throw new Error("穿搭视频仅支持上传参考视频");

  const refs = applyOutfitReferenceVideo(
    existing,
    uploaded.ossUrl,
    file.name?.slice(0, 40) || "参考视频",
  );

  return updateEcomOutfitVideoProject(userId, projectId, {
    references: refs,
    phase: "split",
    status: "draft",
    ...outfitReferenceReplacePatch(),
  });
}

export async function setEcomOutfitVideoReferenceFromUrl(
  userId: string,
  projectId: string,
  url: string,
): Promise<OutfitVideoProjectDto> {
  const existing = await getOwnedRow(userId, projectId);
  if (!existing) throw new Error("项目不存在");

  const { kind, ossUrl } = await resolveMediaDecomposeFromUrl({ userId, url });
  if (kind !== "video") throw new Error("穿搭视频仅支持视频链接");

  const refs = applyOutfitReferenceVideo(existing, ossUrl, "链接视频");

  return updateEcomOutfitVideoProject(userId, projectId, {
    references: refs,
    phase: "split",
    status: "draft",
    ...outfitReferenceReplacePatch(),
  });
}

export async function attachEcomOutfitVideoReferenceFromAsset(
  userId: string,
  projectId: string,
  assetId: string,
): Promise<OutfitVideoProjectDto> {
  const existing = await getOwnedRow(userId, projectId);
  if (!existing) throw new Error("项目不存在");

  const asset = await prisma.ecomAsset.findFirst({
    where: { userId, id: assetId.trim() },
    select: { ossUrl: true, title: true, kind: true },
  });
  if (!asset?.ossUrl?.trim()) throw new Error("资产不存在或无可用 URL");

  const ossUrl = asset.ossUrl.trim();
  const kind =
    asset.kind === "video" || inferKindFromOssUrl(ossUrl) === "video" ? "video" : "image";
  if (kind !== "video") throw new Error("穿搭视频仅支持视频资产");

  const refs = applyOutfitReferenceVideo(
    existing,
    ossUrl,
    asset.title?.slice(0, 40) || "我的资产",
  );

  return updateEcomOutfitVideoProject(userId, projectId, {
    references: refs,
    phase: "split",
    status: "draft",
    ...outfitReferenceReplacePatch(),
  });
}

export async function clearEcomOutfitVideoReference(
  userId: string,
  projectId: string,
): Promise<OutfitVideoProjectDto> {
  const existing = await getOwnedRow(userId, projectId);
  if (!existing) throw new Error("项目不存在");

  const refs = sanitizeRefs(existing.references);
  delete refs.referenceVideo;

  return updateEcomOutfitVideoProject(userId, projectId, {
    references: refs,
    sceneList: [],
    composeResult: null,
    structured: null,
    phase: "upload",
    status: "draft",
  });
}

export function buildMockOutfitSceneList(referenceVideoUrl: string): SceneShot[] {
  const motions = [
    { cameraType: "front_static", motionType: "stand_pose" },
    { cameraType: "slow_pan", motionType: "turn_body" },
    { cameraType: "medium_shot", motionType: "walk_forward" },
    { cameraType: "close_up", motionType: "pose_hold" },
  ];
  return motions.map((m, i) => ({
    sceneId: `s${i + 1}`,
    index: i + 1,
    startTimeSec: i * 3,
    endTimeSec: (i + 1) * 3,
    durationSec: 3,
    cameraType: m.cameraType,
    motionType: m.motionType,
    characterAction: `mock action ${i + 1}`,
    cameraMove: `mock camera ${i + 1}`,
    lightingSetup: "mock soft light",
    sceneBackground: "mock studio",
    previewImageUrl: `https://picsum.photos/seed/outfit-${i + 1}/720/1280`,
    keypointsUrl: `${referenceVideoUrl}#keypoints-s${i + 1}`,
    referenceClipUrl: referenceVideoUrl,
    status: "pending" as const,
  }));
}

export async function splitEcomOutfitVideoScenes(
  userId: string,
  projectId: string,
  opts?: { mock?: boolean; splitModelKey?: string; forceResplit?: boolean },
): Promise<{ project: OutfitVideoProjectDto; envelope: WorkflowEnvelope }> {
  const project = await getEcomOutfitVideoProject(userId, projectId);
  if (!project) throw new Error("项目不存在");
  const refUrl = project.references.referenceVideo?.ossUrl?.trim();
  if (!refUrl) throw new Error("请先上传参考视频");

  if (project.sceneList.length > 0 && !opts?.forceResplit) {
    throw new Error("已完成拆镜；如需重新拆解请确认重置流程");
  }

  if (opts?.forceResplit && project.sceneList.length > 0) {
    await updateEcomOutfitVideoProject(userId, projectId, {
      sceneList: [],
      composeResult: null,
      phase: "split",
      status: "draft",
      meta: {
        splitSceneSource: null,
        splitSceneSourceNote: null,
        splitEnrichCallCount: null,
        splitLlmStreamTail: null,
      },
    });
  }

  if (isOutfitSplitInProgress(project.meta)) {
    throw new Error("拆镜正在进行中，请稍候…");
  }
  if (!tryAcquireOutfitSplitLock(projectId)) {
    throw new Error("拆镜正在进行中，请稍候…");
  }

  const splitModelKey = opts?.splitModelKey?.trim() || project.settings.splitModelKey;
  const enrichWithLlm = Boolean(splitModelKey?.trim());

  const splitSystemDisplay =
    project.settings.splitSystemPrompt?.trim() || buildOutfitSplitSystemPromptDisplay();
  const splitUserDisplay =
    project.settings.splitUserPrompt?.trim() || outfitSplitUserPromptDisplay();

  if (enrichWithLlm) {
    const validation = validateOutfitSplitPrompts(splitSystemDisplay, splitUserDisplay);
    if (!validation.ok) {
      releaseOutfitSplitLock(projectId);
      throw new Error(
        `拆镜指令校验未通过：\n${formatOutfitSplitPromptValidationError(validation)}`,
      );
    }
  }

  const splitSystemPromptForRun = resolveOutfitSplitSystemPromptForRun(splitSystemDisplay);
  const splitUserPromptForRun = splitUserDisplay;

  const reportSplitProgress = async (progress: OutfitSplitProgress) => {
    await updateEcomOutfitVideoProject(userId, projectId, {
      meta: {
        splitInProgressAt: Date.now(),
        splitProgress: progress,
      },
    });
  };

  let streamTail = "";
  const reportStreamChunk = async (accumulated: string) => {
    streamTail = accumulated.slice(-600);
    await updateEcomOutfitVideoProject(userId, projectId, {
      meta: {
        splitInProgressAt: Date.now(),
        splitLlmStreamTail: streamTail,
      },
    });
  };

  await updateEcomOutfitVideoProject(userId, projectId, {
    status: "splitting",
    phase: "split",
    meta: {
      splitInProgressAt: Date.now(),
      splitProgress: {
        phase: "prepare",
        label: "准备拆镜…",
        updatedAt: new Date().toISOString(),
      } satisfies OutfitSplitProgress,
    },
  });

  let sceneList: SceneShot[];
  let splitSceneSource: string;
  let splitSceneSourceNote: string | undefined;
  let totalDurationSec: number | undefined;

  try {
    if (opts?.mock) {
      sceneList = buildMockOutfitSceneList(refUrl);
      splitSceneSource = "stub_v1";
      splitSceneSourceNote = "Mock 模式：固定 4 镜模板（ECOM_OUTFIT_VIDEO_MOCK=1）";
    } else {
      const split = await splitOutfitReferenceVideoPhysical({
        userId,
        projectId,
        referenceVideoUrl: refUrl,
        splitConfig: OUTFIT_V1_DEFAULT_SPLIT_CONFIG,
        splitModelKey,
        splitSystemPrompt: splitSystemPromptForRun,
        splitUserPrompt: splitUserPromptForRun,
        enrichWithLlm,
        onProgress: reportSplitProgress,
        onStreamChunk: enrichWithLlm ? reportStreamChunk : undefined,
      });
      sceneList = split.sceneList;
      splitSceneSource = split.splitSceneSource;
      totalDurationSec = split.totalDurationSec;
      const enrichNote = enrichWithLlm ? " · 每镜关键帧 1 次视觉分析" : "";
      splitSceneSourceNote = `FFmpeg 物理切镜 · ${sceneList.length} 镜 · 每镜含 referenceClip / preview / keypoints${enrichNote}`;
    }
  } catch (e) {
    await updateEcomOutfitVideoProject(userId, projectId, {
      status: "draft",
      meta: {
        splitInProgressAt: null,
        splitProgress: null,
        splitLlmStreamTail: null,
      },
    }).catch(() => undefined);
    throw e;
  } finally {
    releaseOutfitSplitLock(projectId);
  }
  const taskId = `scene_split_${projectId.slice(0, 8)}_${Date.now()}`;
  const envelope = buildWorkflowEnvelope({
    templateId: OUTFIT_V1_TEMPLATE_ID,
    action: "scene_split_complete",
    taskStatus: "success",
    taskId,
    payload: {
      mediaInput: { referenceVideoUrl: refUrl, aspectRatio: "9:16" },
      splitConfig: OUTFIT_V1_DEFAULT_SPLIT_CONFIG,
      splitModelKey,
      llmJsonPrefix: OUTFIT_V1_LLM_JSON_PREFIX,
      promptConfig: {
        positivePrompt: OUTFIT_V1_POSITIVE_PROMPT,
        negativePrompt: OUTFIT_V1_NEGATIVE_PROMPT,
      },
      totalSceneNum: sceneList.length,
      sceneList,
      mock: Boolean(opts?.mock),
    },
  });

  const structured = {
    ...(project.structured ?? {}),
    scene_split_complete: envelope,
  };

  const updated = await updateEcomOutfitVideoProject(userId, projectId, {
    sceneList,
    structured,
    phase: "edit_scenes",
    status: "split_done",
    settings: {
      ...project.settings,
      splitModelKey,
    },
    meta: {
      splitSceneSource,
      splitSceneSourceNote,
      splitInProgressAt: null,
      splitProgress: null,
      splitLlmStreamTail: null,
      ...(enrichWithLlm ? { splitEnrichCallCount: 1 } : {}),
      ...(totalDurationSec != null ? { referenceVideoDurationSec: totalDurationSec } : {}),
    },
  });

  return { project: updated, envelope };
}

export async function patchEcomOutfitVideoScenes(
  userId: string,
  projectId: string,
  sceneList: SceneShot[],
): Promise<OutfitVideoProjectDto> {
  const normalized = normalizeSceneIndices(sceneList);
  if (normalized.length === 0) throw new Error("至少保留 1 个分镜");

  const envelope = buildWorkflowEnvelope({
    templateId: OUTFIT_V1_TEMPLATE_ID,
    action: "scenes_edited",
    taskStatus: "success",
    taskId: `scenes_edited_${Date.now()}`,
    payload: { sceneList: normalized },
  });

  const project = await getEcomOutfitVideoProject(userId, projectId);
  if (!project) throw new Error("项目不存在");

  return updateEcomOutfitVideoProject(userId, projectId, {
    sceneList: normalized,
    structured: {
      ...(project.structured ?? {}),
      scenes_edited: envelope,
    },
    phase: "bind_refs",
  });
}

export async function attachEcomOutfitVideoRefs(
  userId: string,
  projectId: string,
  patch: Partial<WorkflowRefs>,
): Promise<OutfitVideoProjectDto> {
  const project = await getEcomOutfitVideoProject(userId, projectId);
  if (!project) throw new Error("项目不存在");

  const refs: WorkflowRefs = {
    ...project.references,
    ...patch,
  };

  const envelope = buildWorkflowEnvelope({
    templateId: OUTFIT_V1_TEMPLATE_ID,
    action: "refs_locked",
    taskStatus: "success",
    taskId: `refs_locked_${Date.now()}`,
    payload: {
      refs,
      sceneList: project.sceneList,
    },
  });

  return updateEcomOutfitVideoProject(userId, projectId, {
    references: refs,
    structured: {
      ...(project.structured ?? {}),
      refs_locked: envelope,
    },
    phase: refs.dressedImage?.ossUrl ? "generate_shots" : "bind_refs",
  });
}

export async function lockEcomOutfitVideoRefs(
  userId: string,
  projectId: string,
): Promise<OutfitVideoProjectDto> {
  const project = await getEcomOutfitVideoProject(userId, projectId);
  if (!project) throw new Error("项目不存在");

  const settings = sanitizeSettings(project.settings);
  const refs = sanitizeRefs(project.references);
  const mode = settings.outfitRefMode ?? "need_tryon";
  const garmentMode = settings.garmentMode ?? "two_piece";

  if (!isOutfitRefsReadyToLock(settings, refs)) {
    if (mode === "already_dressed") {
      throw new Error("请先上传已穿搭全身照");
    }
    if (garmentMode === "two_piece") {
      throw new Error("请先上传模特全身照、上装与下装");
    }
    throw new Error("请先上传模特全身照与服装图");
  }

  let dressedImage: NonNullable<WorkflowRefs["dressedImage"]>;

  if (mode === "already_dressed") {
    const url = refs.model!.ossUrl.trim();
    dressedImage = {
      ossUrl: url,
      source: refs.model?.source ?? "upload",
      label: refs.model?.label ?? "已穿搭",
    };
  } else {
    const personImageUrl = refs.model!.ossUrl.trim();
    let topGarmentUrl: string;
    let bottomGarmentUrl: string | undefined;
    if (garmentMode === "two_piece") {
      topGarmentUrl = refs.topGarment!.ossUrl.trim();
      bottomGarmentUrl = refs.bottomGarment!.ossUrl.trim();
    } else {
      topGarmentUrl = refs.clothing!.ossUrl.trim();
    }

    const tryOnUrl = await runEcomOutfitVideoTryOn({
      userId,
      projectId,
      personImageUrl,
      garmentMode,
      topGarmentUrl,
      bottomGarmentUrl,
    });
    dressedImage = {
      ossUrl: tryOnUrl,
      source: "aitryon-plus",
      label: "AI 试衣成片",
    };
  }

  const nextRefs: WorkflowRefs = {
    ...refs,
    dressedImage,
  };

  const envelope = buildWorkflowEnvelope({
    templateId: OUTFIT_V1_TEMPLATE_ID,
    action: "refs_locked",
    taskStatus: "success",
    taskId: `refs_locked_${Date.now()}`,
    payload: {
      refs: nextRefs,
      sceneList: project.sceneList,
    },
  });

  return updateEcomOutfitVideoProject(userId, projectId, {
    references: nextRefs,
    structured: {
      ...(project.structured ?? {}),
      refs_locked: envelope,
    },
    phase: "generate_shots",
  });
}

export async function uploadEcomOutfitVideoRefImage(
  userId: string,
  projectId: string,
  role: "model" | "clothing" | "topGarment" | "bottomGarment",
  file: File,
): Promise<OutfitVideoProjectDto> {
  const buf = Buffer.from(await file.arrayBuffer());
  const uploaded = await resolveMediaDecomposeUpload({
    userId,
    buf,
    contentType: file.type,
    fileName: file.name,
  });
  if (uploaded.kind !== "image") throw new Error("请上传图片");

  const labelByRole: Record<typeof role, string> = {
    model: "模特图",
    clothing: "服装图",
    topGarment: "上装",
    bottomGarment: "下装",
  };

  const patch: Partial<WorkflowRefs> = {
    [role]: {
      ossUrl: uploaded.ossUrl,
      source: "upload",
      label: labelByRole[role],
    },
  };

  return attachEcomOutfitVideoRefs(userId, projectId, patch);
}

export async function generateEcomOutfitVideoShot(
  userId: string,
  projectId: string,
  sceneIndex: number,
  opts?: { mock?: boolean; videoModelKey?: string; scenePrompts?: Record<string, string> },
): Promise<{ project: OutfitVideoProjectDto; envelope: WorkflowEnvelope }> {
  let project = await getEcomOutfitVideoProject(userId, projectId);
  if (!project) throw new Error("项目不存在");

  let scene = project.sceneList.find((s) => s.index === sceneIndex);
  if (!scene) throw new Error(`找不到分镜 ${sceneIndex}`);

  const promptOverride = opts?.scenePrompts?.[scene.sceneId];
  if (promptOverride !== undefined) {
    scene = { ...scene, userGeneratePrompt: promptOverride };
    project = await updateEcomOutfitVideoProject(userId, projectId, {
      sceneList: project.sceneList.map((s) =>
        s.sceneId === scene!.sceneId ? scene! : s,
      ),
    });
  }

  let videoUrl: string;
  if (opts?.mock) {
    videoUrl = `https://storage.example.com/mock/outfit-${projectId}-${sceneIndex}.mp4`;
  } else {
    videoUrl = await ecomGenerateOutfitVideoShot({
      userId,
      projectId,
      scene,
      refs: project.references,
      videoModelKey: opts?.videoModelKey ?? project.settings.videoModelKey,
    });
  }

  const updatedScenes = mergeSceneListWithGenerateResults(project.sceneList, [
    {
      sceneId: scene.sceneId,
      sceneVideoUrl: videoUrl,
      status: "success",
    },
  ]);

  const envelope = buildWorkflowEnvelope({
    templateId: OUTFIT_V1_TEMPLATE_ID,
    action: "shot_generate_complete",
    taskStatus: "success",
    taskId: `shot_gen_${scene.sceneId}_${Date.now()}`,
    payload: {
      refs: project.references,
      sceneTaskList: [
        {
          sceneId: scene.sceneId,
          keypointsUrl: scene.keypointsUrl,
          previewImageUrl: scene.previewImageUrl,
        },
      ],
      sceneResultList: [
        {
          sceneId: scene.sceneId,
          sceneVideoUrl: videoUrl,
          status: "success" as const,
        },
      ],
    },
  });

  project = await updateEcomOutfitVideoProject(userId, projectId, {
    sceneList: updatedScenes,
    structured: {
      ...(project.structured ?? {}),
      [`shot_generate_${sceneIndex}`]: envelope,
    },
    phase: updatedScenes.every((s) => s.videoUrl?.trim()) ? "compose" : "generate_shots",
    status: "generating",
  });

  return { project, envelope };
}

export async function batchGenerateEcomOutfitVideoShots(
  userId: string,
  projectId: string,
  indices: number[],
  opts?: { mock?: boolean; videoModelKey?: string; scenePrompts?: Record<string, string> },
): Promise<OutfitVideoProjectDto> {
  let project = await getEcomOutfitVideoProject(userId, projectId);
  if (!project) throw new Error("项目不存在");

  for (const index of indices) {
    const result = await generateEcomOutfitVideoShot(userId, projectId, index, opts);
    project = result.project;
  }
  return project;
}

export function sanitizeSceneListExport(raw: unknown): SceneShot[] {
  return sanitizeSceneList(raw);
}

export async function renderEcomOutfitVideo(
  userId: string,
  projectId: string,
): Promise<{ jobId: string; expiresAt: string }> {
  const { MediaRenderSourceApp } = await import("@prisma/client");
  const { fromOutfitVideoScenes } = await import("@/lib/media/timeline-adapters");
  const { createMediaRenderJob, enqueueMediaRenderJob } = await import(
    "@/lib/media/media-render-service"
  );
  const { parseRenderProfile } = await import("@/lib/media/timeline-types");

  const project = await getEcomOutfitVideoProject(userId, projectId);
  if (!project) throw new Error("项目不存在");

  const missing = project.sceneList.filter((s) => !s.videoUrl?.trim());
  if (missing.length > 0) {
    throw new Error("请先为全部分镜生成视频后再合成");
  }

  const timeline = fromOutfitVideoScenes(project.sceneList);
  if (timeline.clips.length < 1) {
    throw new Error("没有可合成的视频片段");
  }

  const profile = parseRenderProfile(null);
  const job = await createMediaRenderJob({
    userId,
    sourceApp: MediaRenderSourceApp.ecom,
    sourceRef: { projectId, title: project.title ?? "穿搭视频" },
    timeline,
    profile: {
      ...profile,
      audio: { ...profile.audio, mixTts: false },
      subtitle: { ...profile.subtitle, mode: "none", burnIn: false },
    },
  });
  enqueueMediaRenderJob(job.id);

  await updateEcomOutfitVideoProject(userId, projectId, {
    status: "rendering",
    phase: "compose",
    meta: {
      ...(project.meta ?? {}),
      renderJobId: job.id,
    },
  });

  return { jobId: job.id, expiresAt: job.expiresAt.toISOString() };
}

export async function syncEcomOutfitVideoRenderResult(
  userId: string,
  projectId: string,
): Promise<OutfitVideoProjectDto> {
  const { getMediaRenderJobForUser } = await import("@/lib/media/media-render-service");
  const project = await getEcomOutfitVideoProject(userId, projectId);
  if (!project) throw new Error("项目不存在");

  const jobId =
    typeof project.meta?.renderJobId === "string" ? project.meta.renderJobId.trim() : "";
  if (!jobId) return project;

  const job = await getMediaRenderJobForUser(jobId, userId);
  if (!job) return project;

  if (job.status === "SUCCEEDED" && job.downloadUrl?.trim()) {
    const composeResult: WorkflowComposeResult = {
      videoUrl: job.downloadUrl.trim(),
      coverUrl: project.sceneList[0]?.previewImageUrl,
      videoInfo: {
        durationSec: project.sceneList.reduce((sum, s) => sum + (s.durationSec ?? 0), 0),
        resolution: "1080*1920",
        fps: 30,
        aspectRatio: "9:16",
      },
      constraintResult: {
        modelIdentityConsistent: true,
        clothingConsistent: true,
        motionReplicationDegree: "high",
        sceneReplicationDegree: "high",
        lightingReplicationDegree: "medium",
      },
      sceneResultList: project.sceneList.map((s) => ({
        sceneId: s.sceneId,
        sceneVideoUrl: s.videoUrl,
        status: s.videoUrl ? ("success" as const) : ("failed" as const),
      })),
    };

    const envelope = buildWorkflowEnvelope({
      templateId: OUTFIT_V1_TEMPLATE_ID,
      action: "compose_complete",
      taskStatus: "success",
      taskId: `compose_${jobId}`,
      payload: { composeResult },
    });

    return updateEcomOutfitVideoProject(userId, projectId, {
      composeResult,
      structured: {
        ...(project.structured ?? {}),
        compose_complete: envelope,
      },
      status: "completed",
      phase: "done",
    });
  }

  if (job.status === "FAILED") {
    return updateEcomOutfitVideoProject(userId, projectId, {
      status: "render_failed",
      meta: {
        ...(project.meta ?? {}),
        renderFailMessage: job.errorMessage ?? "合成失败",
      },
    });
  }

  return project;
}

function mergeSceneFusionPatch(
  scene: SceneShot,
  patch: Partial<OutfitSceneFusion>,
): SceneShot {
  return {
    ...scene,
    sceneFusion: {
      ...(scene.sceneFusion ?? {}),
      ...patch,
    },
  };
}

export async function fuseEcomOutfitVideoShotScene(
  userId: string,
  projectId: string,
  sceneIndex: number,
  opts: {
    mode: OutfitSceneFusionMode;
    libraryEntryId?: string;
    sceneRefUrl?: string;
    fusionModelKey?: string;
  },
): Promise<OutfitVideoProjectDto> {
  const project = await getEcomOutfitVideoProject(userId, projectId);
  if (!project) throw new Error("项目不存在");
  if (!project.references.dressedImage?.ossUrl) {
    throw new Error("请先锁定穿搭参考图");
  }

  const scene = project.sceneList.find((s) => s.index === sceneIndex);
  if (!scene) throw new Error(`找不到分镜 ${sceneIndex}`);

  const fusionInput: OutfitSceneFusion = {
    mode: opts.mode,
    libraryEntryId: opts.libraryEntryId,
    sceneRefUrl: opts.sceneRefUrl ?? scene.sceneFusion?.sceneRefUrl,
    fusionModelKey:
      opts.fusionModelKey ??
      project.settings.fusionModelKey ??
      OUTFIT_DEFAULT_FUSION_MODEL,
    status: "generating",
  };

  const working = await updateEcomOutfitVideoProject(userId, projectId, {
    sceneList: project.sceneList.map((s) =>
      s.sceneId === scene.sceneId ? mergeSceneFusionPatch(s, fusionInput) : s,
    ),
  });

  try {
    const current = working.sceneList.find((s) => s.sceneId === scene.sceneId)!;
    const fused = await runOutfitVideoSceneFusion({
      userId,
      projectId,
      scene: current,
      refs: working.references,
      fusion: fusionInput,
      fusionModelKey: fusionInput.fusionModelKey,
    });

    return updateEcomOutfitVideoProject(userId, projectId, {
      sceneList: working.sceneList.map((s) =>
        s.sceneId === scene.sceneId ? mergeSceneFusionPatch(s, fused) : s,
      ),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "场景融图失败";
    await updateEcomOutfitVideoProject(userId, projectId, {
      sceneList: working.sceneList.map((s) =>
        s.sceneId === scene.sceneId
          ? mergeSceneFusionPatch(s, { status: "failed", failReason: message })
          : s,
      ),
    });
    throw new Error(message);
  }
}

export async function applyEcomOutfitSceneFusionToAll(
  userId: string,
  projectId: string,
  sourceIndex: number,
): Promise<OutfitVideoProjectDto> {
  const project = await getEcomOutfitVideoProject(userId, projectId);
  if (!project) throw new Error("项目不存在");

  const source = project.sceneList.find((s) => s.index === sourceIndex);
  if (!source?.sceneFusion?.fusedImageUrl?.trim()) {
    throw new Error("请先在来源镜生成场景融合图");
  }

  const snapshot: OutfitSceneFusion = {
    ...source.sceneFusion,
    sharedFromShotIndex: sourceIndex,
  };

  return updateEcomOutfitVideoProject(userId, projectId, {
    sceneList: project.sceneList.map((s) =>
      mergeSceneFusionPatch(s, {
        ...snapshot,
        sharedFromShotIndex: sourceIndex,
      }),
    ),
  });
}

export async function uploadEcomOutfitSceneRefImage(
  userId: string,
  projectId: string,
  sceneIndex: number,
  file: File,
): Promise<OutfitVideoProjectDto> {
  const project = await getEcomOutfitVideoProject(userId, projectId);
  if (!project) throw new Error("项目不存在");

  const scene = project.sceneList.find((s) => s.index === sceneIndex);
  if (!scene) throw new Error(`找不到分镜 ${sceneIndex}`);

  const buf = Buffer.from(await file.arrayBuffer());
  const uploaded = await resolveMediaDecomposeUpload({
    userId,
    buf,
    contentType: file.type,
    fileName: file.name,
  });
  if (uploaded.kind !== "image") throw new Error("请上传图片");

  return updateEcomOutfitVideoProject(userId, projectId, {
    sceneList: project.sceneList.map((s) =>
      s.sceneId === scene.sceneId
        ? mergeSceneFusionPatch(s, {
            mode: "upload_ref",
            sceneRefUrl: uploaded.ossUrl,
            fusedImageUrl: undefined,
            status: undefined,
            failReason: undefined,
            sharedFromShotIndex: undefined,
          })
        : s,
    ),
  });
}

export async function patchEcomOutfitShotSceneFusionConfig(
  userId: string,
  projectId: string,
  sceneIndex: number,
  patch: Partial<OutfitSceneFusion>,
): Promise<OutfitVideoProjectDto> {
  const project = await getEcomOutfitVideoProject(userId, projectId);
  if (!project) throw new Error("项目不存在");

  const scene = project.sceneList.find((s) => s.index === sceneIndex);
  if (!scene) throw new Error(`找不到分镜 ${sceneIndex}`);

  const modeChanged = patch.mode != null && patch.mode !== scene.sceneFusion?.mode;

  return updateEcomOutfitVideoProject(userId, projectId, {
    sceneList: project.sceneList.map((s) =>
      s.sceneId === scene.sceneId
        ? mergeSceneFusionPatch(s, {
            ...patch,
            fusedImageUrl: modeChanged ? undefined : patch.fusedImageUrl ?? s.sceneFusion?.fusedImageUrl,
            sharedFromShotIndex: undefined,
          })
        : s,
    ),
  });
}
