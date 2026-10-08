import { randomUUID } from "crypto";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { resolveMediaDecomposeUpload } from "@/lib/ecom/ecom-media-decompose-media";
import { generateVtonModelImage } from "@/lib/ecom/ecom-vton/model-generate";
import { runEcomVtonTryOn } from "@/lib/ecom/ecom-vton/tryon";
import { ecomClientPage } from "@/lib/ecom/ecom-tool-keys";
import { resolveEcomImageGenConcurrency } from "@/lib/ecom/ecom-image-gen-concurrency";
import { mapWithConcurrency } from "@/lib/generation/poll-parallel";
import { parseRenderProfile } from "@/lib/media/timeline-types";
import type { WorkflowComposeResult } from "@/lib/ecom/video-workflow/shot-spine";

import {
  ECOM_SIMPLE_FUSION_VIDEO_TOOL_KEY,
  moduleToVariant,
  SIMPLE_FUSION_DANCE_GARMENT_MAX,
  SIMPLE_FUSION_DANCE_GARMENT_MIN,
  SIMPLE_FUSION_MODULES,
  SIMPLE_FUSION_V1_TEMPLATE_ID,
  SIMPLE_FUSION_DEFAULT_FUSION_MODEL,
  SIMPLE_FUSION_DEFAULT_VIDEO_MODEL,
  SIMPLE_FUSION_VIDEO_DURATION_SEC,
  variantDefaultTitle,
  type SimpleFusionModule,
} from "./constants";
import { invokeEcomMultiRefImageFusion } from "./fusion";
import { runSimpleFusionI2v } from "./i2v";
import { resolveSimpleFusionFusionPromptForLook, resolveSimpleFusionPrompts } from "./prompts";
import { recordSimpleFusionGeneration } from "./records";
import {
  resolveComposeRenderProfile,
  resolveComposeWorkbenchState,
  workbenchToMediaTimeline,
  type SimpleFusionComposeWorkbenchState,
  newImportComposeClip,
  parseComposeWorkbenchFromMeta,
} from "./compose-workbench";
import { resolveSimpleFusionBgmUrl } from "./render";
import {
  saveSimpleFusionDeliverableSnapshot,
  type SimpleFusionDeliverableSnapshot,
} from "./snapshot";
import type {
  SimpleFusionGarmentRef,
  SimpleFusionProjectDto,
  SimpleFusionProjectSummary,
  SimpleFusionPrompts,
  SimpleFusionReferences,
  SimpleFusionSettings,
  SimpleFusionLook,
} from "./types";

function assertModule(module: string): SimpleFusionModule {
  if (!SIMPLE_FUSION_MODULES.includes(module as SimpleFusionModule)) {
    throw new Error("无效的 module");
  }
  return module as SimpleFusionModule;
}

function refOssUrl(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeRefs(raw: unknown): SimpleFusionReferences {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as SimpleFusionReferences;
  const modelUrl = refOssUrl(r.model?.ossUrl);
  return {
    model: modelUrl && r.model ? { ...r.model, ossUrl: modelUrl } : undefined,
    scene: r.scene,
    garments: Array.isArray(r.garments)
      ? r.garments
          .map((g) => {
            const ossUrl = refOssUrl(g?.ossUrl);
            return ossUrl ? { ...g, ossUrl } : null;
          })
          .filter((g): g is NonNullable<typeof g> => Boolean(g))
      : [],
  };
}

function clampPanelDurationSec(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return SIMPLE_FUSION_VIDEO_DURATION_SEC;
  return Math.min(15, Math.max(3, Math.round(n)));
}

function sanitizeSettings(raw: unknown, module: string): SimpleFusionSettings {
  const variant = moduleToVariant(module);
  const base = (raw && typeof raw === "object" ? raw : {}) as SimpleFusionSettings;
  return {
    variant: base.variant ?? variant,
    fusionModelKey: base.fusionModelKey?.trim() || SIMPLE_FUSION_DEFAULT_FUSION_MODEL,
    videoModelKey:
      base.videoModelKey?.trim() || SIMPLE_FUSION_DEFAULT_VIDEO_MODEL[variant],
    panelDurationSec: clampPanelDurationSec(
      base.panelDurationSec ?? SIMPLE_FUSION_VIDEO_DURATION_SEC,
    ),
    bgmPresetId: base.bgmPresetId,
  };
}

function sanitizeMeta(raw: unknown): SimpleFusionProjectDto["meta"] {
  if (!raw || typeof raw !== "object") return { prompts: {}, looks: [] };
  const m = raw as Record<string, unknown>;
  return {
    ...m,
    prompts: (m.prompts as SimpleFusionPrompts) ?? {},
    looks: Array.isArray(m.looks) ? (m.looks as SimpleFusionLook[]) : [],
  };
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
  composeResult: unknown;
  meta: unknown;
  createdAt: Date;
  updatedAt: Date;
}): SimpleFusionProjectDto {
  return {
    id: row.id,
    title: row.title,
    module: row.module,
    templateId: row.templateId,
    status: row.status,
    phase: row.phase,
    settings: sanitizeSettings(row.settings, row.module),
    references: sanitizeRefs(row.references),
    composeResult: (row.composeResult as WorkflowComposeResult | null) ?? null,
    meta: sanitizeMeta(row.meta),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function getOwnedRow(userId: string, projectId: string, module?: string) {
  return prisma.ecomVideoWorkflowProject.findFirst({
    where: {
      userId,
      id: projectId,
      ...(module ? { module } : { module: { in: [...SIMPLE_FUSION_MODULES] } }),
    },
  });
}

export async function listSimpleFusionProjects(
  userId: string,
  module: string,
): Promise<SimpleFusionProjectSummary[]> {
  assertModule(module);
  const rows = await prisma.ecomVideoWorkflowProject.findMany({
    where: { userId, module },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: { id: true, title: true, updatedAt: true, phase: true },
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    updatedAt: r.updatedAt.toISOString(),
    phase: r.phase,
  }));
}

export async function createSimpleFusionProject(
  userId: string,
  module: string,
  opts?: { title?: string },
): Promise<SimpleFusionProjectDto> {
  const mod = assertModule(module);
  const variant = moduleToVariant(mod);
  const row = await prisma.ecomVideoWorkflowProject.create({
    data: {
      userId,
      module: mod,
      templateId: SIMPLE_FUSION_V1_TEMPLATE_ID,
      title: opts?.title?.trim() || variantDefaultTitle(variant),
      phase: "refs",
      status: "draft",
      settings: sanitizeSettings({}, mod) as Prisma.InputJsonValue,
      references: Prisma.JsonNull,
      structured: Prisma.JsonNull,
      sceneList: Prisma.JsonNull,
      composeResult: Prisma.JsonNull,
      meta: { prompts: {}, looks: [] } as Prisma.InputJsonValue,
    },
  });
  return rowToDto(row);
}

export async function getSimpleFusionProject(
  userId: string,
  projectId: string,
): Promise<SimpleFusionProjectDto | null> {
  const row = await getOwnedRow(userId, projectId);
  if (!row) return null;
  return rowToDto(row);
}

export async function updateSimpleFusionProject(
  userId: string,
  projectId: string,
  patch: Partial<{
    title: string;
    settings: SimpleFusionSettings;
    references: SimpleFusionReferences;
    meta: SimpleFusionProjectDto["meta"];
    composeResult: WorkflowComposeResult | null;
    phase: string;
    status: string;
  }>,
): Promise<SimpleFusionProjectDto> {
  const existing = await getOwnedRow(userId, projectId);
  if (!existing) throw new Error("项目不存在");

  const data: Prisma.EcomVideoWorkflowProjectUpdateInput = {};
  if (typeof patch.title === "string") {
    data.title = patch.title.trim() || variantDefaultTitle(moduleToVariant(existing.module));
  }
  if (patch.settings) {
    data.settings = {
      ...sanitizeSettings(existing.settings, existing.module),
      ...patch.settings,
    } as Prisma.InputJsonValue;
  }
  if (patch.references) data.references = patch.references as Prisma.InputJsonValue;
  if (patch.meta) {
    data.meta = {
      ...sanitizeMeta(existing.meta),
      ...patch.meta,
    } as Prisma.InputJsonValue;
  }
  if (patch.composeResult !== undefined) {
    data.composeResult =
      patch.composeResult === null
        ? Prisma.JsonNull
        : (patch.composeResult as Prisma.InputJsonValue);
  }
  if (patch.phase) data.phase = patch.phase;
  if (patch.status) data.status = patch.status;

  const row = await prisma.ecomVideoWorkflowProject.update({
    where: { id: projectId },
    data,
  });
  return rowToDto(row);
}

export async function uploadSimpleFusionImage(
  userId: string,
  projectId: string,
  slot: "model" | "scene" | "garment",
  file: File,
  firstOrigin?: string,
): Promise<SimpleFusionProjectDto> {
  const project = await getSimpleFusionProject(userId, projectId);
  if (!project) throw new Error("项目不存在");

  const buf = Buffer.from(await file.arrayBuffer());
  const uploaded = await resolveMediaDecomposeUpload({
    userId,
    buf,
    contentType: file.type,
    fileName: file.name,
  });
  if (uploaded.kind !== "image") throw new Error("请上传图片");

  const refs = { ...project.references };
  const origin = firstOrigin ?? "user-upload";

  if (slot === "model") {
    refs.model = {
      ossUrl: uploaded.ossUrl,
      source: "upload",
      label: "模特图",
      firstOrigin: origin,
    };
  } else if (slot === "scene") {
    refs.scene = {
      ossUrl: uploaded.ossUrl,
      source: "upload",
      firstOrigin: origin,
    };
  } else {
    const garments = [...(refs.garments ?? [])];
    if (project.module === "video-dance-swap" && garments.length >= SIMPLE_FUSION_DANCE_GARMENT_MAX) {
      throw new Error(`最多上传 ${SIMPLE_FUSION_DANCE_GARMENT_MAX} 套服装`);
    }
    garments.push({
      id: randomUUID(),
      ossUrl: uploaded.ossUrl,
      label: `服装 ${garments.length + 1}`,
      firstOrigin: origin,
    });
    refs.garments = garments;
  }

  return updateSimpleFusionProject(userId, projectId, { references: refs });
}

export async function attachSimpleFusionRefs(
  userId: string,
  projectId: string,
  patch: Partial<SimpleFusionReferences>,
): Promise<SimpleFusionProjectDto> {
  const project = await getSimpleFusionProject(userId, projectId);
  if (!project) throw new Error("项目不存在");
  return updateSimpleFusionProject(userId, projectId, {
    references: {
      ...project.references,
      ...patch,
      garments: patch.garments ?? project.references.garments,
    },
  });
}

export async function removeSimpleFusionGarment(
  userId: string,
  projectId: string,
  garmentId: string,
): Promise<SimpleFusionProjectDto> {
  const project = await getSimpleFusionProject(userId, projectId);
  if (!project) throw new Error("项目不存在");
  const garments = (project.references.garments ?? []).filter((g) => g.id !== garmentId);
  return updateSimpleFusionProject(userId, projectId, {
    references: { ...project.references, garments },
  });
}

export async function generateSimpleFusionModelFromText(
  userId: string,
  projectId: string,
  prompt: string,
): Promise<SimpleFusionProjectDto> {
  const project = await getSimpleFusionProject(userId, projectId);
  if (!project) throw new Error("项目不存在");
  const ossUrl = await generateVtonModelImage({
    userId,
    prompt: prompt.trim(),
    toolKeySuffix: "simple-fusion__model-generate",
  });
  return updateSimpleFusionProject(userId, projectId, {
    references: {
      ...project.references,
      model: { ossUrl, source: "text", label: "AI 生模特", firstOrigin: "ecom" },
    },
  });
}

function resolveSceneImageUrl(refs: SimpleFusionReferences): string | undefined {
  return refs.scene?.ossUrl?.trim() || undefined;
}

function buildFusionImageUrls(refs: SimpleFusionReferences, garment: SimpleFusionGarmentRef): string[] {
  const model = refs.model?.ossUrl?.trim();
  const garmentUrl = garment.ossUrl.trim();
  if (!model || !garmentUrl) throw new Error("请先绑定模特与服装");
  const scene = resolveSceneImageUrl(refs);
  return scene ? [model, garmentUrl, scene] : [model, garmentUrl];
}

async function fusionWithVtonFallback(opts: {
  userId: string;
  projectId: string;
  clientPage: string;
  refs: SimpleFusionReferences;
  garment: SimpleFusionGarmentRef;
  fusionPrompt: string;
  negativePrompt: string;
  fusionModelKey: string;
}): Promise<string> {
  const urls = buildFusionImageUrls(opts.refs, opts.garment);
  const sceneText = opts.refs.scene?.scenePrompt?.trim();
  const hasSceneImg = Boolean(opts.refs.scene?.ossUrl?.trim());
  const fusionPrompt =
    sceneText && !hasSceneImg && !opts.fusionPrompt.includes(sceneText)
      ? `${opts.fusionPrompt}\n\n【场景补充】${sceneText}`
      : opts.fusionPrompt;
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await invokeEcomMultiRefImageFusion({
        userId: opts.userId,
        clientPage: `${opts.clientPage}/fusion`,
        imageUrls: urls,
        prompt: fusionPrompt,
        negativePrompt: opts.negativePrompt,
        fusionModelKey: opts.fusionModelKey,
      });
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }

  const modelUrl = opts.refs.model!.ossUrl!.trim();
  const tryonUrl = await runEcomVtonTryOn({
    userId: opts.userId,
    consumerToolKey: ECOM_SIMPLE_FUSION_VIDEO_TOOL_KEY,
    projectId: opts.projectId,
    personImageUrl: modelUrl,
    lookKind: "one_piece",
    topGarmentUrl: opts.garment.ossUrl.trim(),
  });
  const scene = resolveSceneImageUrl(opts.refs);
  if (scene) {
    return invokeEcomMultiRefImageFusion({
      userId: opts.userId,
      clientPage: `${opts.clientPage}/fusion-vton`,
      imageUrls: [tryonUrl, scene],
      prompt: fusionPrompt,
      negativePrompt: opts.negativePrompt,
      fusionModelKey: opts.fusionModelKey,
    });
  }
  if (lastErr) throw lastErr;
  return tryonUrl;
}

function syncLooksFromGarments(project: SimpleFusionProjectDto): SimpleFusionLook[] {
  const garments = project.references.garments ?? [];
  const prev = project.meta?.looks ?? [];
  return garments.map((g) => {
    const existing = prev.find((l) => l.garmentId === g.id);
    return (
      existing ?? {
        lookId: randomUUID(),
        garmentId: g.id,
        status: "pending" as const,
      }
    );
  });
}

async function persistSimpleFusionPipelineFailure(
  userId: string,
  projectId: string,
  err: unknown,
): Promise<void> {
  const current = await getSimpleFusionProject(userId, projectId);
  if (!current) return;
  const message = err instanceof Error ? err.message : "生成失败";
  const prevLooks = current.meta?.looks ?? [];
  let looksTouched = false;
  const looks = prevLooks.map((look) => {
    if (look.status !== "generating" && look.status !== "fusing") return look;
    looksTouched = true;
    return {
      ...look,
      status: look.status === "fusing" ? ("fusion_failed" as const) : ("failed" as const),
      failReason: look.failReason ?? message,
    };
  });
  const phase =
    current.phase === "generating"
      ? looks.some((l) => l.fusedImageUrl?.trim())
        ? "fused"
        : "refs"
      : current.phase;
  await updateSimpleFusionProject(userId, projectId, {
    ...(looksTouched ? { meta: { ...current.meta, looks } } : {}),
    phase,
    status: "failed",
  });
}

function assertFusionReadyForVideo(
  step: "fusion" | "video" | "all" | "render",
  targets: SimpleFusionLook[],
): void {
  if (step !== "video") return;
  const missing = targets.filter((l) => !l.fusedImageUrl?.trim());
  if (missing.length > 0) {
    throw new Error("请先生成融合图；图生视频必须基于融合成片，不能直接用模特/服装参考图");
  }
}

function validateBeforeGenerate(project: SimpleFusionProjectDto): void {
  if (!project.references.model?.ossUrl?.trim()) throw new Error("请先选择或上传模特");
  const garments = project.references.garments ?? [];
  if (garments.length === 0) throw new Error("请先上传服装");
  if (project.module === "video-dance-swap") {
    if (garments.length < SIMPLE_FUSION_DANCE_GARMENT_MIN) {
      throw new Error(`卡点跳舞至少需要 ${SIMPLE_FUSION_DANCE_GARMENT_MIN} 套服装`);
    }
  } else if (garments.length !== 1) {
    throw new Error("本模式仅需 1 套服装");
  }
}

function normalizeLookIdFilter(lookIds?: string[]): string[] | undefined {
  const ids = lookIds?.map((id) => id.trim()).filter(Boolean);
  return ids?.length ? ids : undefined;
}

function preparePartialLookRegen(
  allLooks: SimpleFusionLook[],
  lookIdFilter: string[],
  step: "fusion" | "video" | "all",
): void {
  const set = new Set(lookIdFilter);
  for (const look of allLooks) {
    if (!set.has(look.lookId)) continue;
    if (step === "fusion" || step === "all") {
      look.fusedImageUrl = undefined;
      look.clipVideoUrl = undefined;
      look.failReason = undefined;
      look.status = "pending";
      continue;
    }
    if (step === "video") {
      if (!look.fusedImageUrl?.trim()) {
        throw new Error("请先生成该套的融合图");
      }
      look.clipVideoUrl = undefined;
      look.failReason = undefined;
      look.status = "fused";
    }
  }
}

export async function runSimpleFusionPipeline(
  userId: string,
  projectId: string,
  opts?: { step?: "fusion" | "video" | "all" | "render"; lookIds?: string[] },
): Promise<SimpleFusionProjectDto> {
  await assertEcomToolkitGatewayAccess(userId);
  let project = await getSimpleFusionProject(userId, projectId);
  if (!project) throw new Error("项目不存在");

  const step = opts?.step ?? "all";
  if (step === "render") {
    if (project.module !== "video-dance-swap") throw new Error("仅卡点跳舞支持合成成片");
    return renderSimpleFusionDanceVideo(userId, projectId);
  }

  validateBeforeGenerate(project);

  const lookIdFilter = normalizeLookIdFilter(opts?.lookIds);
  const isPartial = Boolean(lookIdFilter?.length);
  const variant = moduleToVariant(project.module);
  const prompts = resolveSimpleFusionPrompts(
    variant,
    project.meta?.prompts,
    project.references,
    project.meta?.promptsCustomized === true,
  );
  const clientPage = ecomClientPage(userId, projectId, ECOM_SIMPLE_FUSION_VIDEO_TOOL_KEY);
  const allLooks = syncLooksFromGarments(project);

  if (lookIdFilter) {
    const known = new Set(allLooks.map((l) => l.lookId));
    const missing = lookIdFilter.filter((id) => !known.has(id));
    if (missing.length) throw new Error("未找到指定套装");
    preparePartialLookRegen(allLooks, lookIdFilter, step);
    if (
      isPartial &&
      (step === "video" || step === "all") &&
      project.module === "video-dance-swap"
    ) {
      project = await updateSimpleFusionProject(userId, projectId, {
        composeResult: null,
        meta: { ...project.meta, looks: allLooks },
      });
    }
  }

  const looksToRun = lookIdFilter
    ? allLooks.filter((l) => lookIdFilter.includes(l.lookId))
    : allLooks;

  try {
  project = await updateSimpleFusionProject(userId, projectId, {
    ...(isPartial ? {} : { phase: "generating" }),
    status: "processing",
    meta: { ...project.meta, looks: allLooks, prompts: project.meta?.prompts },
  });

  const fusionModelKey = project.settings.fusionModelKey ?? SIMPLE_FUSION_DEFAULT_FUSION_MODEL;
  const videoModelKey = project.settings.videoModelKey ?? SIMPLE_FUSION_DEFAULT_VIDEO_MODEL[variant];

  const concurrency = await resolveEcomImageGenConcurrency(userId, {} as never);

  if (step === "fusion" || step === "all") {
    await mapWithConcurrency(looksToRun, async (look) => {
      const garment = project!.references.garments!.find((g) => g.id === look.garmentId);
      if (!garment) return;
      look.status = "fusing";
      const garments = project!.references.garments ?? [];
      const garmentIndex = Math.max(1, garments.findIndex((g) => g.id === look.garmentId) + 1);
      const fusionPrompt = resolveSimpleFusionFusionPromptForLook(
        variant,
        project!.references,
        garmentIndex,
        project!.meta?.prompts,
        project!.meta?.promptsCustomized === true,
      );
      const fused = await fusionWithVtonFallback({
        userId,
        projectId,
        clientPage,
        refs: project!.references,
        garment,
        fusionPrompt,
        negativePrompt: prompts.negative,
        fusionModelKey,
      });
      look.fusedImageUrl = fused;
      look.status = "fused";
      project = await getSimpleFusionProject(userId, projectId);
      if (project) {
        await recordSimpleFusionGeneration({
          userId,
          project,
          ossUrl: fused,
          kind: "image",
          title: "融合参考图",
          prompt: fusionPrompt,
          modelKey: fusionModelKey,
          firstOrigin: garment.firstOrigin,
        });
      }
    }, concurrency);
    project = (await updateSimpleFusionProject(userId, projectId, {
      meta: { ...project!.meta, looks: allLooks },
      ...(isPartial ? {} : { phase: "fused" }),
    }))!;
  }

  if (step === "video" || step === "all") {
    const currentLooks = allLooks;
    assertFusionReadyForVideo(step, looksToRun);
    if (step === "all") {
      const missingAfterFusion = looksToRun.filter((l) => !l.fusedImageUrl?.trim());
      if (missingAfterFusion.length > 0) {
        throw new Error("融合未完成，无法进入图生视频");
      }
    }
    const videoErrors: string[] = [];
    const videoTargets = looksToRun.filter((l) => l.fusedImageUrl?.trim());
    if (videoTargets.length === 0) {
      throw new Error("没有可用的融合图，请先完成静态融合");
    }
    const panelDurationSec =
      project?.settings.panelDurationSec ?? SIMPLE_FUSION_VIDEO_DURATION_SEC;
    await mapWithConcurrency(videoTargets, async (look) => {
      if (!look.fusedImageUrl?.trim()) return;
      look.status = "generating";
      try {
        const { videoUrl, modelKey } = await runSimpleFusionI2v({
          userId,
          clientPage: `${clientPage}/i2v`,
          fusedImageUrl: look.fusedImageUrl,
          prompt: prompts.video,
          modelKey: videoModelKey,
          durationSec: panelDurationSec,
        });
        look.clipVideoUrl = videoUrl;
        look.status = "success";
        project = await getSimpleFusionProject(userId, projectId);
        if (project) {
          await recordSimpleFusionGeneration({
            userId,
            project,
            ossUrl: videoUrl,
            kind: "video",
            title: "视频片段",
            prompt: prompts.video,
            modelKey,
            firstOrigin: "ecom",
          });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "图生视频失败";
        look.status = "failed";
        look.failReason = msg;
        videoErrors.push(msg);
      }
    }, Math.min(concurrency, 3));
    const hasClip = currentLooks.some((l) => l.clipVideoUrl?.trim());
    const hasFailed = currentLooks.some((l) => l.status === "failed");
    project = (await updateSimpleFusionProject(userId, projectId, {
      meta: { ...project.meta, looks: currentLooks },
      phase: hasClip ? "clips" : "fused",
      status: hasFailed ? "failed" : "success",
    }))!;

    if (videoErrors.length > 0) {
      throw new Error(
        videoErrors.length === 1
          ? videoErrors[0]!
          : `${videoErrors.length} 个视频片段失败：${videoErrors[0]}`,
      );
    }

    if (project.module !== "video-dance-swap") {
      const clip = currentLooks.find((l) => l.clipVideoUrl)?.clipVideoUrl;
      if (clip) {
        project = await updateSimpleFusionProject(userId, projectId, {
          composeResult: { videoUrl: clip },
          phase: "done",
          status: "success",
        });
        await recordSimpleFusionGeneration({
          userId,
          project,
          ossUrl: clip,
          kind: "video",
          title: variantDefaultTitle(variant),
          prompt: prompts.video,
          modelKey: videoModelKey,
        });
      }
    }
  }

  return (await getSimpleFusionProject(userId, projectId))!;
  } catch (e) {
    await persistSimpleFusionPipelineFailure(userId, projectId, e);
    throw e;
  }
}

export async function saveSimpleFusionComposeWorkbench(
  userId: string,
  projectId: string,
  workbench: SimpleFusionComposeWorkbenchState,
): Promise<SimpleFusionProjectDto> {
  const project = await getSimpleFusionProject(userId, projectId);
  if (!project) throw new Error("项目不存在");
  return updateSimpleFusionProject(userId, projectId, {
    meta: { ...project.meta, composeWorkbench: workbench },
  });
}

function patchComposeClipAudio(
  workbench: SimpleFusionComposeWorkbenchState,
  clipId: string,
  audioUrl: string | undefined,
): SimpleFusionComposeWorkbenchState {
  return {
    ...workbench,
    clips: workbench.clips.map((c) =>
      c.id === clipId ? { ...c, audioUrl: audioUrl?.trim() || undefined } : c,
    ),
  };
}

export async function generateSimpleFusionComposeClipTts(
  userId: string,
  projectId: string,
  clipId: string,
  opts: { text?: string; voice?: string; modelKey?: string },
): Promise<SimpleFusionProjectDto> {
  const project = await getSimpleFusionProject(userId, projectId);
  if (!project) throw new Error("项目不存在");

  const labels = new Map<string, string>();
  const workbench = resolveComposeWorkbenchState(project, labels);
  const clip = workbench.clips.find((c) => c.id === clipId);
  if (!clip) throw new Error("片段不存在");

  const text =
    opts.text?.trim() ||
    clip.subtitle?.trim() ||
    clip.label?.trim() ||
    "";
  if (!text) throw new Error("请先填写字幕/口播文案");

  const { generatePlatformTtsAudioUrl } = await import("@/lib/media/platform-tts-generate");
  const audioUrl = await generatePlatformTtsAudioUrl({
    userId,
    text,
    voice: opts.voice,
    modelKey: opts.modelKey,
  });

  const next = patchComposeClipAudio(workbench, clipId, audioUrl);
  return saveSimpleFusionComposeWorkbench(userId, projectId, next);
}

export async function uploadSimpleFusionComposeClipAudio(
  userId: string,
  projectId: string,
  clipId: string,
  file: File,
): Promise<SimpleFusionProjectDto> {
  const project = await getSimpleFusionProject(userId, projectId);
  if (!project) throw new Error("项目不存在");

  const contentType = file.type || "audio/mpeg";
  if (!contentType.startsWith("audio/") && !/\.(mp3|wav|m4a|aac|ogg)(\?|$)/i.test(file.name)) {
    throw new Error("请上传音频文件");
  }
  const buf = Buffer.from(await file.arrayBuffer());
  const { uploadCanvasUserBuffer } = await import("@/lib/canvas/canvas-oss");
  const ext = file.name.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() || "mp3";
  const ossUrl = await uploadCanvasUserBuffer({
    userId,
    buf,
    contentType,
    ext,
  });

  const labels = new Map<string, string>();
  const workbench = resolveComposeWorkbenchState(project, labels);
  if (!workbench.clips.some((c) => c.id === clipId)) {
    throw new Error("片段不存在");
  }

  const next = patchComposeClipAudio(workbench, clipId, ossUrl);
  return saveSimpleFusionComposeWorkbench(userId, projectId, next);
}

function collectSimpleFusionAllowedComposeAudioUrls(
  project: SimpleFusionProjectDto,
): Set<string> {
  const urls = new Set<string>();
  for (const look of project.meta?.looks ?? []) {
    const u = look.ttsUrl?.trim();
    if (u) urls.add(u);
  }
  const wb = parseComposeWorkbenchFromMeta(project.meta?.composeWorkbench);
  for (const c of wb?.clips ?? []) {
    const u = c.audioUrl?.trim();
    if (u) urls.add(u);
  }
  return urls;
}

/** 绑定本页已生成的 TTS（look.ttsUrl 等），不重新调用 TTS */
export async function assignSimpleFusionComposeClipExistingAudio(
  userId: string,
  projectId: string,
  clipId: string,
  opts: { audioUrl: string; subtitle?: string },
): Promise<SimpleFusionProjectDto> {
  const project = await getSimpleFusionProject(userId, projectId);
  if (!project) throw new Error("项目不存在");

  const audioUrl = opts.audioUrl?.trim();
  if (!audioUrl) throw new Error("缺少 audioUrl");

  const allowed = collectSimpleFusionAllowedComposeAudioUrls(project);
  if (!allowed.has(audioUrl)) {
    throw new Error("该配音不在本项目已生成 TTS 列表中");
  }

  const labels = new Map<string, string>();
  let workbench = resolveComposeWorkbenchState(project, labels);
  if (!workbench.clips.some((c) => c.id === clipId)) {
    throw new Error("片段不存在");
  }

  let next = patchComposeClipAudio(workbench, clipId, audioUrl);
  const subtitle = opts.subtitle?.trim();
  if (subtitle) {
    next = {
      ...next,
      clips: next.clips.map((c) =>
        c.id === clipId ? { ...c, subtitle } : c,
      ),
    };
  }
  return saveSimpleFusionComposeWorkbench(userId, projectId, next);
}

export async function clearSimpleFusionComposeClipAudio(
  userId: string,
  projectId: string,
  clipId: string,
): Promise<SimpleFusionProjectDto> {
  const project = await getSimpleFusionProject(userId, projectId);
  if (!project) throw new Error("项目不存在");
  const labels = new Map<string, string>();
  const workbench = resolveComposeWorkbenchState(project, labels);
  const next = patchComposeClipAudio(workbench, clipId, undefined);
  return saveSimpleFusionComposeWorkbench(userId, projectId, next);
}

export async function uploadSimpleFusionComposeClip(
  userId: string,
  projectId: string,
  file: File,
): Promise<SimpleFusionProjectDto> {
  const project = await getSimpleFusionProject(userId, projectId);
  if (!project) throw new Error("项目不存在");
  if (project.module !== "video-dance-swap") {
    throw new Error("仅卡点跳舞支持导入剪辑片段");
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const uploaded = await resolveMediaDecomposeUpload({
    userId,
    buf,
    contentType: file.type,
    fileName: file.name,
  });
  if (uploaded.kind !== "video") throw new Error("请上传视频文件");

  const clip = newImportComposeClip({
    videoUrl: uploaded.ossUrl,
    label: file.name.replace(/\.[^.]+$/, "") || "导入片段",
  });
  const labels = new Map<string, string>();
  const workbench = resolveComposeWorkbenchState(project, labels);
  const next: SimpleFusionComposeWorkbenchState = {
    ...workbench,
    clips: [...workbench.clips, clip],
    orderedClipIds: [...workbench.orderedClipIds, clip.id],
  };

  return updateSimpleFusionProject(userId, projectId, {
    meta: { ...project.meta, composeWorkbench: next },
  });
}

export async function renderSimpleFusionDanceVideo(
  userId: string,
  projectId: string,
  opts?: {
    workbench?: SimpleFusionComposeWorkbenchState;
    replaceInFlight?: boolean;
  },
): Promise<SimpleFusionProjectDto> {
  const { MediaRenderSourceApp } = await import("@prisma/client");
  const { createMediaRenderJob, enqueueMediaRenderJob } = await import(
    "@/lib/media/media-render-service"
  );

  let project = await getSimpleFusionProject(userId, projectId);
  if (!project) throw new Error("项目不存在");

  const workbench =
    opts?.workbench ??
    resolveComposeWorkbenchState(project, new Map());
  if (opts?.workbench) {
    project = await saveSimpleFusionComposeWorkbench(userId, projectId, workbench);
  }

  const timeline = workbenchToMediaTimeline(workbench);
  const profile = resolveComposeRenderProfile(project.settings, workbench);

  const job = await createMediaRenderJob({
    userId,
    sourceApp: MediaRenderSourceApp.ecom,
    sourceRef: { projectId, title: project.title ?? "卡点跳舞换装" },
    timeline,
    profile,
    replaceInFlight: opts?.replaceInFlight ?? true,
  });
  enqueueMediaRenderJob(job.id);

  return updateSimpleFusionProject(userId, projectId, {
    phase: "rendering",
    status: "processing",
    composeResult: null,
    meta: { ...project.meta, composeWorkbench: workbench, renderJobId: job.id },
  });
}

export async function syncSimpleFusionRenderResult(
  userId: string,
  projectId: string,
): Promise<SimpleFusionProjectDto> {
  const { getMediaRenderJobForUser } = await import("@/lib/media/media-render-service");
  const project = await getSimpleFusionProject(userId, projectId);
  if (!project) throw new Error("项目不存在");
  const jobId = typeof project.meta?.renderJobId === "string" ? project.meta.renderJobId.trim() : "";
  if (!jobId) return project;

  const job = await getMediaRenderJobForUser(jobId, userId);
  if (!job) return project;
  if (job.status === "FAILED" || job.status === "EXPIRED") {
    return updateSimpleFusionProject(userId, projectId, {
      status: "failed",
      phase: "render_failed",
      meta: {
        ...project.meta,
        renderFailReason:
          job.errorMessage?.trim() ||
          (job.status === "EXPIRED" ? "剪辑结果已过期，请重新合成" : "剪辑失败"),
      },
    });
  }
  const videoUrl = job.downloadUrl?.trim();
  if (job.status !== "SUCCEEDED" || !videoUrl) return project;
  const next = await updateSimpleFusionProject(userId, projectId, {
    composeResult: { videoUrl },
    phase: "done",
    status: "success",
    meta: { ...project.meta, renderJobId: jobId },
  });
  await recordSimpleFusionGeneration({
    userId,
    project: next,
    ossUrl: videoUrl,
    kind: "video",
    title: "卡点跳舞成片",
    prompt: resolveSimpleFusionPrompts(
      moduleToVariant(next.module),
      next.meta?.prompts,
      next.references,
      next.meta?.promptsCustomized === true,
    ).video,
    modelKey: next.settings.videoModelKey,
  });
  return next;
}

export async function saveSimpleFusionDeliverable(
  userId: string,
  projectId: string,
): Promise<SimpleFusionProjectDto> {
  const project = await getSimpleFusionProject(userId, projectId);
  if (!project) throw new Error("项目不存在");
  const snapshot: SimpleFusionDeliverableSnapshot = {
    savedAt: new Date().toISOString(),
    project: {
      id: project.id,
      module: project.module,
      title: project.title,
      settings: project.settings,
      references: project.references,
      composeResult: project.composeResult,
      meta: project.meta,
    },
  };
  await saveSimpleFusionDeliverableSnapshot(projectId, snapshot);
  return getSimpleFusionProject(userId, projectId) as Promise<SimpleFusionProjectDto>;
}
