/**
 * 我的 AI 空间 · 口播分镜项目与镜级 CRUD
 */

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import {
  type BroadcastBrief,
  type BroadcastProjectDto,
  type BroadcastScriptDto,
  type BroadcastShotDto,
  type BroadcastSplitShotInput,
  DEFAULT_BROADCAST_PRESENTER,
  DEFAULT_BROADCAST_VISUAL,
  normalizePresenter,
  normalizeVisual,
  validateBroadcastShot,
  AI_SPACE_S2V_MAX_AUDIO_SEC,
} from "./ai-space-broadcast-types";

export class AiSpaceBroadcastError extends Error {
  constructor(
    message: string,
    readonly status: number = 400,
  ) {
    super(message);
    this.name = "AiSpaceBroadcastError";
  }
}

function parseBrief(raw: unknown): BroadcastBrief {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  return {
    platform: typeof o.platform === "string" ? o.platform : undefined,
    tone: typeof o.tone === "string" ? o.tone : undefined,
    presenterMode:
      o.presenterMode === "always" ||
      o.presenterMode === "partial" ||
      o.presenterMode === "none"
        ? o.presenterMode
        : undefined,
  };
}

function shotToDto(row: {
  id: string;
  scriptId: string;
  index: number;
  startSec: number;
  endSec: number;
  durationSec: number;
  voiceoverText: string;
  sceneDescription: string;
  presenter: unknown;
  visual: unknown;
  audioAssetId: string | null;
  backgroundVideoId: string | null;
  digitalHumanId: string | null;
  shotStatus: string;
  composeTaskId: string | null;
  outputVideoUrl: string | null;
  errorMessage: string | null;
}): BroadcastShotDto {
  const presenter = normalizePresenter(row.presenter);
  const visual = normalizeVisual(row.visual);
  const digitalHumanId =
    row.digitalHumanId ?? presenter.digitalHumanId ?? null;
  return {
    id: row.id,
    scriptId: row.scriptId,
    index: row.index,
    startSec: row.startSec,
    endSec: row.endSec,
    durationSec: row.durationSec,
    voiceoverText: row.voiceoverText,
    sceneDescription: row.sceneDescription || visual.sceneDescription,
    presenter,
    visual,
    audioAssetId: row.audioAssetId,
    backgroundVideoId: row.backgroundVideoId ?? visual.backgroundVideoId ?? null,
    digitalHumanId,
    shotStatus: row.shotStatus,
    composeTaskId: row.composeTaskId,
    outputVideoUrl: row.outputVideoUrl,
    errorMessage: row.errorMessage,
    validation: validateBroadcastShot({
      durationSec: row.durationSec,
      voiceoverText: row.voiceoverText,
      presenter,
      visual,
      audioAssetId: row.audioAssetId,
      digitalHumanId,
    }),
  };
}

async function scriptToDto(
  script: {
    id: string;
    projectId: string;
    version: number;
    status: string;
    createdAt: Date;
  },
  shots: BroadcastShotDto[],
): Promise<BroadcastScriptDto> {
  return {
    id: script.id,
    projectId: script.projectId,
    version: script.version,
    status: script.status,
    shots,
    createdAt: script.createdAt.toISOString(),
  };
}

export async function listAiSpaceBroadcastProjects(
  userId: string,
): Promise<BroadcastProjectDto[]> {
  const rows = await prisma.aiSpaceBroadcastProject.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
  const result: BroadcastProjectDto[] = [];
  for (const row of rows) {
    result.push(await projectToDto(row));
  }
  return result;
}

export async function getAiSpaceBroadcastProject(
  userId: string,
  id: string,
): Promise<BroadcastProjectDto | null> {
  const row = await prisma.aiSpaceBroadcastProject.findFirst({
    where: { id, userId },
  });
  return row ? projectToDto(row) : null;
}

async function projectToDto(row: {
  id: string;
  title: string;
  sourceKind: string;
  sourceText: string | null;
  brief: unknown;
  targetDurationSec: number | null;
  aspectRatio: string;
  status: string;
  activeScriptId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): Promise<BroadcastProjectDto> {
  let activeScript: BroadcastScriptDto | null = null;
  if (row.activeScriptId) {
    const script = await prisma.aiSpaceBroadcastScript.findFirst({
      where: { id: row.activeScriptId, projectId: row.id },
    });
    if (script) {
      const shots = await prisma.aiSpaceBroadcastShot.findMany({
        where: { scriptId: script.id },
        orderBy: { index: "asc" },
      });
      activeScript = await scriptToDto(
        script,
        shots.map(shotToDto),
      );
    }
  }
  return {
    id: row.id,
    title: row.title,
    sourceKind: row.sourceKind,
    sourceText: row.sourceText,
    brief: parseBrief(row.brief),
    targetDurationSec: row.targetDurationSec,
    aspectRatio: row.aspectRatio,
    status: row.status,
    activeScriptId: row.activeScriptId,
    activeScript,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function createAiSpaceBroadcastProject(args: {
  userId: string;
  tenantId?: string | null;
  title?: string;
  sourceText?: string;
  brief?: BroadcastBrief;
  targetDurationSec?: number;
  aspectRatio?: string;
}): Promise<BroadcastProjectDto> {
  const row = await prisma.aiSpaceBroadcastProject.create({
    data: {
      userId: args.userId,
      tenantId: args.tenantId ?? null,
      title: args.title?.trim().slice(0, 120) || "未命名口播项目",
      sourceText: args.sourceText?.trim() || null,
      brief: (args.brief ?? {}) as Prisma.InputJsonValue,
      targetDurationSec: args.targetDurationSec ?? null,
      aspectRatio: args.aspectRatio?.trim() || "9:16",
    },
  });
  return projectToDto(row);
}

export async function updateAiSpaceBroadcastProject(
  userId: string,
  id: string,
  patch: {
    title?: string;
    sourceText?: string;
    brief?: BroadcastBrief;
    targetDurationSec?: number | null;
    aspectRatio?: string;
  },
): Promise<BroadcastProjectDto | null> {
  const existing = await prisma.aiSpaceBroadcastProject.findFirst({
    where: { id, userId },
  });
  if (!existing) return null;
  if (existing.status === "locked" || existing.status === "rendering") {
    throw new AiSpaceBroadcastError("项目已锁定或渲染中，无法修改 Brief", 409);
  }
  const data: Prisma.AiSpaceBroadcastProjectUpdateInput = {};
  if (patch.title !== undefined) data.title = patch.title.trim().slice(0, 120);
  if (patch.sourceText !== undefined) data.sourceText = patch.sourceText.trim();
  if (patch.brief !== undefined) data.brief = patch.brief as Prisma.InputJsonValue;
  if (patch.targetDurationSec !== undefined) {
    data.targetDurationSec = patch.targetDurationSec;
  }
  if (patch.aspectRatio !== undefined) data.aspectRatio = patch.aspectRatio;
  const row = await prisma.aiSpaceBroadcastProject.update({
    where: { id },
    data,
  });
  return projectToDto(row);
}

export async function deleteAiSpaceBroadcastProject(
  userId: string,
  id: string,
): Promise<boolean> {
  const existing = await prisma.aiSpaceBroadcastProject.findFirst({
    where: { id, userId },
  });
  if (!existing) return false;
  if (existing.status === "rendering") {
    throw new AiSpaceBroadcastError("渲染进行中，无法删除", 409);
  }
  await prisma.aiSpaceBroadcastProject.delete({ where: { id } });
  return true;
}

/** 按累计 durationSec 重算 startSec/endSec */
export function recalcShotTimeline(
  shots: Array<{ durationSec: number }>,
): Array<{ startSec: number; endSec: number; durationSec: number }> {
  let cursor = 0;
  return shots.map((s) => {
    const durationSec = Math.max(0, s.durationSec);
    const startSec = cursor;
    const endSec = cursor + durationSec;
    cursor = endSec;
    return { startSec, endSec, durationSec };
  });
}

export async function createBroadcastScriptWithShots(args: {
  projectId: string;
  shots: BroadcastSplitShotInput[];
  llmMeta?: Record<string, unknown>;
}): Promise<BroadcastScriptDto> {
  const last = await prisma.aiSpaceBroadcastScript.findFirst({
    where: { projectId: args.projectId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const version = (last?.version ?? 0) + 1;

  const normalized = args.shots
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((s, i) => {
      const durationSec =
        typeof s.durationSec === "number" && s.durationSec > 0
          ? s.durationSec
          : Math.min(8, Math.max(3, s.voiceoverText.length * 0.15));
      const presenter = normalizePresenter({
        ...DEFAULT_BROADCAST_PRESENTER,
        ...s.presenter,
      });
      const visual = normalizeVisual({
        ...DEFAULT_BROADCAST_VISUAL,
        sceneDescription: s.sceneDescription ?? "",
        ...s.visual,
      });
      return {
        index: s.index || i + 1,
        durationSec,
        voiceoverText: s.voiceoverText.trim(),
        sceneDescription: s.sceneDescription?.trim() || visual.sceneDescription,
        presenter,
        visual,
      };
    });

  const timeline = recalcShotTimeline(normalized);

  const script = await prisma.aiSpaceBroadcastScript.create({
    data: {
      projectId: args.projectId,
      version,
      status: "draft",
      llmMeta: (args.llmMeta ?? undefined) as Prisma.InputJsonValue,
      shots: {
        create: normalized.map((s, i) => ({
          index: s.index,
          startSec: timeline[i]!.startSec,
          endSec: timeline[i]!.endSec,
          durationSec: timeline[i]!.durationSec,
          voiceoverText: s.voiceoverText,
          sceneDescription: s.sceneDescription,
          presenter: s.presenter as Prisma.InputJsonValue,
          visual: s.visual as Prisma.InputJsonValue,
          digitalHumanId: s.presenter.digitalHumanId ?? null,
          backgroundVideoId: s.visual.backgroundVideoId ?? null,
        })),
      },
    },
    include: { shots: { orderBy: { index: "asc" } } },
  });

  await prisma.aiSpaceBroadcastProject.update({
    where: { id: args.projectId },
    data: { activeScriptId: script.id, status: "draft" },
  });

  return scriptToDto(script, script.shots.map(shotToDto));
}

export async function lockBroadcastProject(
  userId: string,
  projectId: string,
): Promise<BroadcastProjectDto> {
  const project = await prisma.aiSpaceBroadcastProject.findFirst({
    where: { id: projectId, userId },
  });
  if (!project) throw new AiSpaceBroadcastError("项目不存在", 404);
  if (!project.activeScriptId) {
    throw new AiSpaceBroadcastError("请先 AI 拆镜或手动添加分镜", 400);
  }
  const shots = await prisma.aiSpaceBroadcastShot.findMany({
    where: { scriptId: project.activeScriptId },
    orderBy: { index: "asc" },
  });
  if (shots.length === 0) {
    throw new AiSpaceBroadcastError("分镜表为空", 400);
  }
  for (const shot of shots) {
    const dto = shotToDto(shot);
    if (dto.validation.audioTooLong) {
      throw new AiSpaceBroadcastError(
        `镜 ${shot.index} 口播时长 ≥ ${AI_SPACE_S2V_MAX_AUDIO_SEC} 秒，请拆镜或缩短台词`,
        400,
      );
    }
    if (dto.validation.missingDigitalHuman && dto.presenter.enabled) {
      throw new AiSpaceBroadcastError(`镜 ${shot.index} 已启用数字人但未选择形象`, 400);
    }
  }
  await prisma.$transaction([
    prisma.aiSpaceBroadcastScript.update({
      where: { id: project.activeScriptId },
      data: { status: "locked" },
    }),
    prisma.aiSpaceBroadcastProject.update({
      where: { id: projectId },
      data: { status: "locked" },
    }),
  ]);
  const updated = await getAiSpaceBroadcastProject(userId, projectId);
  if (!updated) throw new AiSpaceBroadcastError("项目不存在", 404);
  return updated;
}

export async function updateBroadcastShot(
  userId: string,
  shotId: string,
  patch: {
    voiceoverText?: string;
    sceneDescription?: string;
    durationSec?: number;
    presenter?: Partial<BroadcastShotDto["presenter"]>;
    visual?: Partial<BroadcastShotDto["visual"]>;
    backgroundVideoId?: string | null;
    digitalHumanId?: string | null;
    audioAssetId?: string | null;
  },
): Promise<BroadcastShotDto | null> {
  const shot = await prisma.aiSpaceBroadcastShot.findUnique({
    where: { id: shotId },
    include: { script: { include: { project: true } } },
  });
  if (!shot || shot.script.project.userId !== userId) return null;
  if (
    shot.script.project.status === "locked" ||
    shot.script.project.status === "rendering"
  ) {
    throw new AiSpaceBroadcastError("脚本已锁定，请先解锁或新建版本", 409);
  }

  const basePresenter = normalizePresenter(shot.presenter);
  const presenter = normalizePresenter({
    ...basePresenter,
    ...patch.presenter,
    overlay: {
      ...basePresenter.overlay,
      ...(patch.presenter?.overlay ?? {}),
    },
  });
  const baseVisual = normalizeVisual(shot.visual);
  const visual = normalizeVisual({
    ...baseVisual,
    ...patch.visual,
    ...(patch.sceneDescription !== undefined
      ? { sceneDescription: patch.sceneDescription }
      : {}),
    ...(patch.backgroundVideoId !== undefined
      ? {
          type: patch.backgroundVideoId ? "video" : "placeholder",
          backgroundVideoId: patch.backgroundVideoId ?? undefined,
        }
      : {}),
  });

  const data: Prisma.AiSpaceBroadcastShotUpdateInput = {
    voiceoverText:
      patch.voiceoverText !== undefined
        ? patch.voiceoverText.trim()
        : undefined,
    sceneDescription:
      patch.sceneDescription !== undefined
        ? patch.sceneDescription.trim()
        : visual.sceneDescription,
    presenter: presenter as Prisma.InputJsonValue,
    visual: visual as Prisma.InputJsonValue,
    digitalHumanId:
      patch.digitalHumanId !== undefined
        ? patch.digitalHumanId
        : presenter.digitalHumanId ?? null,
    backgroundVideoId:
      patch.backgroundVideoId !== undefined
        ? patch.backgroundVideoId
        : visual.backgroundVideoId ?? null,
    audioAssetId:
      patch.audioAssetId !== undefined ? patch.audioAssetId : undefined,
    durationSec:
      patch.durationSec !== undefined ? patch.durationSec : undefined,
  };

  const updated = await prisma.aiSpaceBroadcastShot.update({
    where: { id: shotId },
    data,
  });

  // 重算时间轴
  const all = await prisma.aiSpaceBroadcastShot.findMany({
    where: { scriptId: shot.scriptId },
    orderBy: { index: "asc" },
  });
  const timeline = recalcShotTimeline(all);
  await Promise.all(
    all.map((s, i) =>
      prisma.aiSpaceBroadcastShot.update({
        where: { id: s.id },
        data: timeline[i]!,
      }),
    ),
  );

  const fresh = await prisma.aiSpaceBroadcastShot.findUnique({
    where: { id: shotId },
  });
  return fresh ? shotToDto(fresh) : null;
}

export async function listBroadcastShots(
  userId: string,
  scriptId: string,
): Promise<BroadcastShotDto[]> {
  const script = await prisma.aiSpaceBroadcastScript.findFirst({
    where: { id: scriptId, project: { userId } },
  });
  if (!script) return [];
  const rows = await prisma.aiSpaceBroadcastShot.findMany({
    where: { scriptId },
    orderBy: { index: "asc" },
  });
  return rows.map(shotToDto);
}
