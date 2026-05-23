import type {
  Prisma,
  StoryCharacter,
  StoryGenerationStatus,
  StoryGenerationTask,
  StoryProject,
  StoryProjectAspect,
  StoryStoryboardFrame,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getStoryStyleById, isValidStoryStyleId } from "./comic-styles";

export class StoryProjectError extends Error {
  constructor(
    public code:
      | "INVALID_INPUT"
      | "NOT_FOUND"
      | "EMPTY_PROMPT"
      | "MISSING_DEPENDENCY"
      | "TASK_ALREADY_INFLIGHT"
      | "TOO_MANY_INFLIGHT",
    message: string,
    public httpStatus: number = 400,
  ) {
    super(message);
    this.name = "StoryProjectError";
  }
}

export type StoryProjectAspectClient = "16:9" | "9:16";

export function aspectClientToEnum(aspect: string): StoryProjectAspect {
  if (aspect === "16:9") return "RATIO_16_9";
  if (aspect === "9:16") return "RATIO_9_16";
  throw new StoryProjectError("INVALID_INPUT", `unsupported aspectRatio: ${aspect}`);
}

export function aspectEnumToClient(
  aspect: StoryProjectAspect,
): StoryProjectAspectClient {
  return aspect === "RATIO_16_9" ? "16:9" : "9:16";
}

// —— Serialization ——

export type StoryProjectListDto = {
  id: string;
  name: string;
  description: string;
  aspectRatio: StoryProjectAspectClient;
  styleId: number;
  status: string;
  storyOutline: string;
  coverImageUrl: string;
  styleFallbackUrl: string;
  createdAt: string;
  updatedAt: string;
};

export function serializeProjectListItem(p: StoryProject): StoryProjectListDto {
  const style = getStoryStyleById(p.styleId);
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    aspectRatio: aspectEnumToClient(p.aspectRatio),
    styleId: p.styleId,
    status: p.status,
    storyOutline: p.storyOutline,
    coverImageUrl: p.coverImageUrl,
    styleFallbackUrl: style?.url ?? "",
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export type StoryCharacterDto = {
  id: string;
  name: string;
  role: string;
  description: string;
  imagePrompt: string;
  avatarUrl: string;
  avatarTaskStatus: StoryGenerationStatus | null;
  avatarTaskFailCode: string | null;
  avatarTaskFailMessage: string | null;
  sortOrder: number;
};

type CharacterTaskFields = Pick<
  StoryGenerationTask,
  "status" | "failCode" | "failMessage"
>;

export function serializeCharacter(
  c: StoryCharacter,
  task: CharacterTaskFields | null = null,
): StoryCharacterDto {
  return {
    id: c.id,
    name: c.name,
    role: c.role,
    description: c.description,
    imagePrompt: c.imagePrompt,
    avatarUrl: c.avatarUrl,
    avatarTaskStatus: task?.status ?? null,
    avatarTaskFailCode: task?.failCode ?? null,
    avatarTaskFailMessage: task?.failMessage ?? null,
    sortOrder: c.sortOrder,
  };
}

export type StoryFrameDto = {
  id: string;
  index: number;
  sceneText: string;
  sceneDescription: string;
  characterIds: string[];
  imagePrompt: string;
  videoPrompt: string;
  imageUrl: string;
  videoUrl: string;
  imageTaskStatus: StoryGenerationStatus | null;
  videoTaskStatus: StoryGenerationStatus | null;
  imageTaskFailCode: string | null;
  imageTaskFailMessage: string | null;
  videoTaskFailCode: string | null;
  videoTaskFailMessage: string | null;
  /** 该 frame 当前 imageUrl 对应任务的 KIE 计算耗时（ms） */
  imageCostMs: number | null;
  /** 该 frame 当前 videoUrl 对应任务的 KIE 计算耗时（ms） */
  videoCostMs: number | null;
  /** 该 frame 上次提交视频生成所用模型 id */
  videoModelId: string | null;
};

type FrameTaskFields = Pick<
  StoryGenerationTask,
  "status" | "model" | "resultPayload" | "failCode" | "failMessage"
>;

function extractCostMs(task: FrameTaskFields | null): number | null {
  if (!task) return null;
  const payload = task.resultPayload as
    | { costTime?: number }
    | null
    | undefined;
  const v = payload?.costTime;
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function serializeFrame(
  f: StoryStoryboardFrame,
  imageTask: FrameTaskFields | null = null,
  videoTask: FrameTaskFields | null = null,
): StoryFrameDto {
  return {
    id: f.id,
    index: f.index,
    sceneText: f.sceneText,
    sceneDescription: f.sceneDescription,
    characterIds: f.characterIds,
    imagePrompt: f.imagePrompt,
    videoPrompt: f.videoPrompt,
    imageUrl: f.imageUrl,
    videoUrl: f.videoUrl,
    imageTaskStatus: imageTask?.status ?? null,
    videoTaskStatus: videoTask?.status ?? null,
    imageTaskFailCode: imageTask?.failCode ?? null,
    imageTaskFailMessage: imageTask?.failMessage ?? null,
    videoTaskFailCode: videoTask?.failCode ?? null,
    videoTaskFailMessage: videoTask?.failMessage ?? null,
    imageCostMs: extractCostMs(imageTask),
    videoCostMs: extractCostMs(videoTask),
    videoModelId: videoTask?.model ?? null,
  };
}

export type StoryProjectDetailDto = StoryProjectListDto & {
  coverTaskStatus: StoryGenerationStatus | null;
  coverTaskFailCode: string | null;
  coverTaskFailMessage: string | null;
  characters: StoryCharacterDto[];
  frames: StoryFrameDto[];
  pendingTasks: PendingTaskDto[];
};

export type PendingTaskDto = {
  id: string;
  kind: string;
  status: StoryGenerationStatus;
  characterId: string | null;
  frameId: string | null;
  failCode: string | null;
  failMessage: string | null;
};

export function serializePendingTask(t: StoryGenerationTask): PendingTaskDto {
  return {
    id: t.id,
    kind: t.kind,
    status: t.status,
    characterId: t.characterId,
    frameId: t.frameId,
    failCode: t.failCode,
    failMessage: t.failMessage,
  };
}

// —— Queries ——

export async function listProjectsForUser(
  userId: string,
): Promise<StoryProjectListDto[]> {
  const rows = await prisma.storyProject.findMany({
    where: { userId, deletedAt: null },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map(serializeProjectListItem);
}

export async function getProjectDetail(
  userId: string,
  projectId: string,
): Promise<StoryProjectDetailDto> {
  const project = await prisma.storyProject.findFirst({
    where: { id: projectId, userId, deletedAt: null },
    include: {
      characters: { orderBy: { sortOrder: "asc" } },
      frames: { orderBy: { index: "asc" } },
    },
  });
  if (!project) {
    throw new StoryProjectError("NOT_FOUND", "project not found", 404);
  }

  // 拉每个 character / frame 当前指向的 task 状态（若有）
  const taskIds = [
    project.coverTaskId,
    ...project.characters.map((c) => c.avatarTaskId),
    ...project.frames.flatMap((f) => [f.imageTaskId, f.videoTaskId]),
  ].filter((v): v is string => Boolean(v));

  const tasks = taskIds.length
    ? await prisma.storyGenerationTask.findMany({
        where: { id: { in: taskIds } },
        select: {
          id: true,
          status: true,
          kind: true,
          characterId: true,
          frameId: true,
          failCode: true,
          failMessage: true,
          model: true,
          resultPayload: true,
        },
      })
    : [];
  const tasksById = new Map(tasks.map((t) => [t.id, t]));
  const coverTask = project.coverTaskId
    ? (tasksById.get(project.coverTaskId) ?? null)
    : null;

  const pendingTasks = await prisma.storyGenerationTask.findMany({
    where: {
      projectId: project.id,
      status: { in: ["PENDING", "SUBMITTED"] },
    },
    orderBy: { createdAt: "desc" },
  });

  return {
    ...serializeProjectListItem(project),
    coverTaskStatus: coverTask?.status ?? null,
    coverTaskFailCode: coverTask?.failCode ?? null,
    coverTaskFailMessage: coverTask?.failMessage ?? null,
    characters: project.characters.map((c) =>
      serializeCharacter(
        c,
        c.avatarTaskId ? (tasksById.get(c.avatarTaskId) ?? null) : null,
      ),
    ),
    frames: project.frames.map((f) =>
      serializeFrame(
        f,
        f.imageTaskId ? (tasksById.get(f.imageTaskId) ?? null) : null,
        f.videoTaskId ? (tasksById.get(f.videoTaskId) ?? null) : null,
      ),
    ),
    pendingTasks: pendingTasks.map(serializePendingTask),
  };
}

// —— Mutations ——

export type CreateProjectInput = {
  name: string;
  description: string;
  aspectRatio: string;
  styleId: number;
};

function validateName(name: unknown): string {
  if (typeof name !== "string" || !name.trim()) {
    throw new StoryProjectError("INVALID_INPUT", "name is required");
  }
  const trimmed = name.trim();
  if (trimmed.length > 80) {
    throw new StoryProjectError("INVALID_INPUT", "name too long (max 80)");
  }
  return trimmed;
}

function validateDescription(description: unknown): string {
  if (typeof description !== "string" || !description.trim()) {
    throw new StoryProjectError("INVALID_INPUT", "description is required");
  }
  const trimmed = description.trim();
  if (trimmed.length > 2000) {
    throw new StoryProjectError("INVALID_INPUT", "description too long (max 2000)");
  }
  return trimmed;
}

function validateStyleId(styleId: unknown): number {
  if (!isValidStoryStyleId(styleId)) {
    throw new StoryProjectError("INVALID_INPUT", `invalid styleId: ${styleId}`);
  }
  return styleId;
}

export async function createProjectForUser(
  userId: string,
  input: CreateProjectInput,
): Promise<StoryProjectListDto> {
  const name = validateName(input.name);
  const description = validateDescription(input.description);
  const aspectRatio = aspectClientToEnum(input.aspectRatio);
  const styleId = validateStyleId(input.styleId);

  const project = await prisma.storyProject.create({
    data: {
      userId,
      name,
      description,
      aspectRatio,
      styleId,
    },
  });
  return serializeProjectListItem(project);
}

export type PatchProjectInput = {
  name?: unknown;
  description?: unknown;
  aspectRatio?: unknown;
  styleId?: unknown;
  status?: unknown;
  storyOutline?: unknown;
};

export async function patchProjectForUser(
  userId: string,
  projectId: string,
  patch: PatchProjectInput,
): Promise<StoryProjectListDto> {
  const project = await prisma.storyProject.findFirst({
    where: { id: projectId, userId, deletedAt: null },
  });
  if (!project) {
    throw new StoryProjectError("NOT_FOUND", "project not found", 404);
  }

  const data: Prisma.StoryProjectUpdateInput = {};
  if (patch.name !== undefined) {
    data.name = validateName(patch.name);
  }
  if (patch.description !== undefined) {
    data.description = validateDescription(patch.description);
  }
  if (patch.aspectRatio !== undefined) {
    if (typeof patch.aspectRatio !== "string") {
      throw new StoryProjectError("INVALID_INPUT", "aspectRatio must be string");
    }
    data.aspectRatio = aspectClientToEnum(patch.aspectRatio);
  }
  if (patch.styleId !== undefined) {
    // 仅 DRAFT 状态允许改 styleId（避免分镜图风格漂移到旧版）
    if (project.status !== "DRAFT") {
      throw new StoryProjectError(
        "INVALID_INPUT",
        "styleId can only be changed in DRAFT status",
      );
    }
    data.styleId = validateStyleId(patch.styleId);
  }
  if (patch.status !== undefined) {
    if (
      patch.status !== "DRAFT" &&
      patch.status !== "ARCHIVED" &&
      patch.status !== "READY"
    ) {
      throw new StoryProjectError("INVALID_INPUT", "invalid status");
    }
    // 只允许用户在 READY ↔ ARCHIVED 之间切换；其他状态由后端流程驱动
    if (
      !(
        (project.status === "READY" && patch.status === "ARCHIVED") ||
        (project.status === "ARCHIVED" && patch.status === "READY")
      )
    ) {
      throw new StoryProjectError(
        "INVALID_INPUT",
        `status transition ${project.status} -> ${patch.status} not allowed`,
      );
    }
    data.status = patch.status;
  }
  if (patch.storyOutline !== undefined) {
    if (typeof patch.storyOutline !== "string") {
      throw new StoryProjectError("INVALID_INPUT", "storyOutline must be string");
    }
    if (patch.storyOutline.length > 8000) {
      throw new StoryProjectError("INVALID_INPUT", "storyOutline too long (<=8000)");
    }
    data.storyOutline = patch.storyOutline;
  }

  const updated = await prisma.storyProject.update({
    where: { id: project.id },
    data,
  });
  return serializeProjectListItem(updated);
}

export type SoftDeleteResult = {
  projectId: string;
  cleanupItemCount: number;
};

/**
 * 软删项目 + 把所有媒体 ossUrl 入异步清理队列。
 * 接口立即返回；OSS 真正删除由 cron worker 处理（plan §6.5 / story-ai-pipeline.md §6）。
 */
export async function softDeleteProjectForUser(
  userId: string,
  projectId: string,
): Promise<SoftDeleteResult> {
  const project = await prisma.storyProject.findFirst({
    where: { id: projectId, userId, deletedAt: null },
    include: {
      characters: { select: { avatarUrl: true } },
      frames: { select: { imageUrl: true, videoUrl: true } },
    },
  });
  if (!project) {
    throw new StoryProjectError("NOT_FOUND", "project not found", 404);
  }

  const ossUrls: string[] = [];
  if (project.coverImageUrl) ossUrls.push(project.coverImageUrl);
  for (const c of project.characters) {
    if (c.avatarUrl) ossUrls.push(c.avatarUrl);
  }
  for (const f of project.frames) {
    if (f.imageUrl) ossUrls.push(f.imageUrl);
    if (f.videoUrl) ossUrls.push(f.videoUrl);
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.storyProject.update({
      where: { id: project.id },
      data: { deletedAt: now },
    });
    if (ossUrls.length > 0) {
      await tx.storyOssCleanupQueue.createMany({
        data: ossUrls.map((url) => ({
          source: `project_delete:${project.id}`,
          projectId: project.id,
          ossUrl: url,
          notBefore: now,
        })),
      });
    }
  });

  return { projectId: project.id, cleanupItemCount: ossUrls.length };
}

// —— Character / Frame Mutations ——

export type PatchCharacterInput = {
  name?: unknown;
  role?: unknown;
  description?: unknown;
  imagePrompt?: unknown;
};

export async function patchCharacterForUser(
  userId: string,
  projectId: string,
  characterId: string,
  patch: PatchCharacterInput,
): Promise<StoryCharacterDto> {
  const character = await prisma.storyCharacter.findFirst({
    where: { id: characterId, project: { id: projectId, userId, deletedAt: null } },
  });
  if (!character) {
    throw new StoryProjectError("NOT_FOUND", "character not found", 404);
  }
  const data: Prisma.StoryCharacterUpdateInput = {};
  if (patch.name !== undefined) {
    if (typeof patch.name !== "string" || !patch.name.trim() || patch.name.length > 40) {
      throw new StoryProjectError("INVALID_INPUT", "name invalid (1~40)");
    }
    data.name = patch.name.trim();
  }
  if (patch.role !== undefined) {
    if (typeof patch.role !== "string" || patch.role.length > 40) {
      throw new StoryProjectError("INVALID_INPUT", "role invalid (<=40)");
    }
    data.role = patch.role.trim();
  }
  if (patch.description !== undefined) {
    if (typeof patch.description !== "string" || patch.description.length > 400) {
      throw new StoryProjectError("INVALID_INPUT", "description too long");
    }
    data.description = patch.description.trim();
  }
  if (patch.imagePrompt !== undefined) {
    if (typeof patch.imagePrompt !== "string" || !patch.imagePrompt.trim()) {
      throw new StoryProjectError("EMPTY_PROMPT", "imagePrompt required");
    }
    data.imagePrompt = patch.imagePrompt.trim();
  }
  const updated = await prisma.storyCharacter.update({
    where: { id: characterId },
    data,
  });
  return serializeCharacter(updated);
}

export async function deleteCharacterForUser(
  userId: string,
  projectId: string,
  characterId: string,
): Promise<{ deleted: true }> {
  const character = await prisma.storyCharacter.findFirst({
    where: { id: characterId, project: { id: projectId, userId, deletedAt: null } },
    include: { project: { select: { frames: { select: { id: true, characterIds: true } } } } },
  });
  if (!character) {
    throw new StoryProjectError("NOT_FOUND", "character not found", 404);
  }

  await prisma.$transaction(async (tx) => {
    // OSS 清理
    if (character.avatarUrl) {
      await tx.storyOssCleanupQueue.create({
        data: {
          source: `delete_character:${characterId}`,
          projectId,
          ossUrl: character.avatarUrl,
        },
      });
    }
    // 取消进行中任务
    await tx.storyGenerationTask.updateMany({
      where: {
        characterId,
        status: { in: ["PENDING", "SUBMITTED"] },
      },
      data: { status: "CANCELLED", completedAt: new Date() },
    });
    // 从所有 frame.characterIds 中剔除
    for (const frame of character.project.frames) {
      if (frame.characterIds.includes(characterId)) {
        await tx.storyStoryboardFrame.update({
          where: { id: frame.id },
          data: {
            characterIds: frame.characterIds.filter((id) => id !== characterId),
          },
        });
      }
    }
    await tx.storyCharacter.delete({ where: { id: characterId } });
  });

  return { deleted: true };
}

export type PatchFrameInput = {
  sceneText?: unknown;
  sceneDescription?: unknown;
  imagePrompt?: unknown;
  videoPrompt?: unknown;
  characterIds?: unknown;
};

export async function patchFrameForUser(
  userId: string,
  projectId: string,
  frameId: string,
  patch: PatchFrameInput,
): Promise<StoryFrameDto> {
  const frame = await prisma.storyStoryboardFrame.findFirst({
    where: { id: frameId, project: { id: projectId, userId, deletedAt: null } },
    include: { project: { select: { characters: { select: { id: true } } } } },
  });
  if (!frame) {
    throw new StoryProjectError("NOT_FOUND", "frame not found", 404);
  }
  const data: Prisma.StoryStoryboardFrameUpdateInput = {};
  if (patch.sceneText !== undefined) {
    if (typeof patch.sceneText !== "string" || patch.sceneText.length > 80) {
      throw new StoryProjectError("INVALID_INPUT", "sceneText invalid");
    }
    data.sceneText = patch.sceneText.trim();
  }
  if (patch.sceneDescription !== undefined) {
    if (
      typeof patch.sceneDescription !== "string" ||
      patch.sceneDescription.length > 1000
    ) {
      throw new StoryProjectError("INVALID_INPUT", "sceneDescription too long");
    }
    data.sceneDescription = patch.sceneDescription.trim();
  }
  if (patch.imagePrompt !== undefined) {
    if (typeof patch.imagePrompt !== "string" || !patch.imagePrompt.trim()) {
      throw new StoryProjectError("EMPTY_PROMPT", "imagePrompt required");
    }
    data.imagePrompt = patch.imagePrompt.trim();
  }
  if (patch.videoPrompt !== undefined) {
    if (typeof patch.videoPrompt !== "string" || !patch.videoPrompt.trim()) {
      throw new StoryProjectError("EMPTY_PROMPT", "videoPrompt required");
    }
    data.videoPrompt = patch.videoPrompt.trim();
  }
  if (patch.characterIds !== undefined) {
    if (
      !Array.isArray(patch.characterIds) ||
      !patch.characterIds.every((v) => typeof v === "string")
    ) {
      throw new StoryProjectError("INVALID_INPUT", "characterIds must be string[]");
    }
    const validIds = new Set(frame.project.characters.map((c) => c.id));
    const filtered = patch.characterIds.filter((id) => validIds.has(id as string));
    data.characterIds = filtered as string[];
  }
  const updated = await prisma.storyStoryboardFrame.update({
    where: { id: frameId },
    data,
  });
  return serializeFrame(updated);
}

export async function deleteFrameForUser(
  userId: string,
  projectId: string,
  frameId: string,
): Promise<{ deleted: true }> {
  const frame = await prisma.storyStoryboardFrame.findFirst({
    where: { id: frameId, project: { id: projectId, userId, deletedAt: null } },
  });
  if (!frame) {
    throw new StoryProjectError("NOT_FOUND", "frame not found", 404);
  }
  await prisma.$transaction(async (tx) => {
    if (frame.imageUrl) {
      await tx.storyOssCleanupQueue.create({
        data: {
          source: `delete_frame:${frameId}`,
          projectId,
          ossUrl: frame.imageUrl,
        },
      });
    }
    if (frame.videoUrl) {
      await tx.storyOssCleanupQueue.create({
        data: {
          source: `delete_frame:${frameId}`,
          projectId,
          ossUrl: frame.videoUrl,
        },
      });
    }
    await tx.storyGenerationTask.updateMany({
      where: { frameId, status: { in: ["PENDING", "SUBMITTED"] } },
      data: { status: "CANCELLED", completedAt: new Date() },
    });
    await tx.storyStoryboardFrame.delete({ where: { id: frameId } });
  });
  return { deleted: true };
}

// —— Tasks list ——

export type StoryTaskListItem = PendingTaskDto & {
  model: string;
  createdAt: string;
  completedAt: string | null;
  ossUrl: string | null;
};

export async function listTasksForProject(
  userId: string,
  projectId: string,
  limit: number,
): Promise<StoryTaskListItem[]> {
  const project = await prisma.storyProject.findFirst({
    where: { id: projectId, userId, deletedAt: null },
    select: { id: true },
  });
  if (!project) {
    throw new StoryProjectError("NOT_FOUND", "project not found", 404);
  }
  const tasks = await prisma.storyGenerationTask.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit || 50, 1), 200),
  });
  return tasks.map((t) => ({
    ...serializePendingTask(t),
    model: t.model,
    createdAt: t.createdAt.toISOString(),
    completedAt: t.completedAt?.toISOString() ?? null,
    ossUrl: t.ossUrl,
  }));
}
