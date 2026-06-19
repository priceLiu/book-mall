/**
 * 漫剧 AI 任务调度服务（KIE）。
 *
 * 状态机：
 *   PENDING ──createTask 200──▶ SUBMITTED ──callback/poll success──▶ SUCCEEDED
 *      │                                ╲──fail/timeout──▶ FAILED
 *      └──createTask 5xx, retry≤3──▶ FAILED
 *
 * 详见 story-web/docs/ai/plan.md §6 与 doc/logic/story-ai-pipeline.md
 */
import type {
  Prisma,
  StoryCharacter,
  StoryGenerationKind,
  StoryGenerationStatus,
  StoryGenerationTask,
  StoryProject,
  StoryStoryboardFrame,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getStoryStylePrompt } from "./comic-styles";
import {
  STORY_AI_KIE_MODELS,
  STORY_AI_TASK_TIMEOUT_MIN,
  STORY_VIDEO_MODELS,
  STORY_VIDEO_MODEL_IDS,
  aspectRatioToKie,
  buildStoryAiKieCallbackUrl,
  getStoryAiUserInflightMax,
  type StoryVideoModelId,
  type StoryVideoOptions,
} from "./story-ai-constants";
import { failGatewayLogIfStillRunning } from "@/lib/gateway/fail-gateway-log-on-timeout";
import { getGenerationPollBatch } from "@/lib/canvas/canvas-constants";
import {
  getGenerationPollConcurrency,
  getGenerationPollMaxPasses,
  getGenerationPollTimeBudgetMs,
} from "@/lib/generation/poll-config";
import { mapWithConcurrency } from "@/lib/generation/poll-parallel";
import {
  pollShardOverFetchSize,
  selectPollShardTasks,
} from "@/lib/generation/poll-shard";
import { isTrafficControlEnabled } from "@/lib/generation/traffic-control/constants";
import { dispatchQueuedStoryTasks } from "@/lib/generation/traffic-control/dispatch-story";
import { resolveStoryProjectTrafficScope } from "@/lib/generation/traffic-control/scope-key";
import {
  buildCanvasVideoVolcengineInput,
  isVolcengineStoryVideoModelKey,
} from "@/lib/canvas/canvas-video-volcengine";
import {
  storyGwCreateKieJob,
  storyGwCreateVolcengineVideoJob,
  storyGwPollVolcengineVideo,
  storyGwRecordInfo,
} from "./story-gateway-client";
import {
  extractKieResultUrl,
  isKieRecordFail,
  isKieRecordSuccess,
  formatKieTaskFailMessage,
  KieError,
  logKieEvent,
  type KieRecordResponse,
} from "./kie-client";
import { persistKieResultToOss } from "./story-oss";
import { StoryProjectError } from "./story-project-service";

// —— Helpers ——

async function ensureUserInflightCapacity(
  userId: string,
  addingCount = 1,
): Promise<void> {
  const max = getStoryAiUserInflightMax();
  const current = await prisma.storyGenerationTask.count({
    where: {
      project: { userId, deletedAt: null },
      status: { in: ["PENDING", "SUBMITTED"] },
    },
  });
  if (current + addingCount > max) {
    throw new StoryProjectError(
      "TOO_MANY_INFLIGHT",
      `inflight tasks ${current + addingCount} exceeds limit ${max}`,
      429,
    );
  }
}

function buildCharacterKieInput(args: {
  project: StoryProject;
  character: StoryCharacter;
}): { model: string; input: Record<string, unknown> } {
  const stylePrompt = getStoryStylePrompt(args.project.styleId);
  const finalPrompt = `[STYLE] ${stylePrompt}\n${args.character.imagePrompt}`;
  return {
    model: STORY_AI_KIE_MODELS.IMAGE,
    input: {
      prompt: finalPrompt,
      aspect_ratio: aspectRatioToKie(args.project.aspectRatio),
      resolution: "2K",
      output_format: "png",
    },
  };
}

function buildCoverKieInput(args: { project: StoryProject }): {
  model: string;
  input: Record<string, unknown>;
} {
  const stylePrompt = getStoryStylePrompt(args.project.styleId);
  const outlineSnippet = args.project.storyOutline.slice(0, 200);
  const finalPrompt = [
    `[STYLE] ${stylePrompt}`,
    `[SUBJECT] ${args.project.name} 漫剧封面，呈现核心冲突氛围`,
    outlineSnippet ? `[REFERENCE] 大纲摘要：${outlineSnippet}` : "",
    "[LAYOUT] 主视觉构图，留出漫剧标题位",
  ]
    .filter(Boolean)
    .join("\n");
  return {
    model: STORY_AI_KIE_MODELS.IMAGE,
    input: {
      prompt: finalPrompt,
      aspect_ratio: aspectRatioToKie(args.project.aspectRatio),
      resolution: "2K",
      output_format: "png",
    },
  };
}

function buildFrameImageKieInput(args: {
  project: StoryProject;
  frame: StoryStoryboardFrame;
  characters: StoryCharacter[];
}): { model: string; input: Record<string, unknown> } {
  const stylePrompt = getStoryStylePrompt(args.project.styleId);
  const finalPrompt = `[STYLE] ${stylePrompt}\n${args.frame.imagePrompt}`;
  const refUrls = args.characters
    .filter((c) => args.frame.characterIds.includes(c.id) && c.avatarUrl)
    .map((c) => c.avatarUrl)
    .slice(0, 8); // KIE 限制 8 张
  return {
    model: STORY_AI_KIE_MODELS.IMAGE,
    input: {
      prompt: finalPrompt,
      ...(refUrls.length > 0 ? { image_input: refUrls } : {}),
      aspect_ratio: aspectRatioToKie(args.project.aspectRatio),
      resolution: "2K",
      output_format: "png",
    },
  };
}

/**
 * 按所选视频模型构造 KIE 入参。
 *
 * 不同模型字段不同（皆图生视频）：
 *  - kling-2.6/image-to-video    image_urls + sound + duration(5|10)
 *  - bytedance/seedance-2       reference_image_urls(数组) + aspect_ratio
 *  - wan/2-7-image-to-video      first_frame_url(单张) + prompt_extend / watermark
 *                                （画幅由首帧图自动决定，KIE 文档未提供 ratio 字段）
 *  - happyhorse/image-to-video   image_urls(单元素数组) + 仅 prompt/resolution/duration
 */
function buildFrameVideoVolcengineInput(args: {
  project: StoryProject;
  frame: StoryStoryboardFrame;
  modelId: StoryVideoModelId;
  options: StoryVideoOptions;
}): { model: string; input: Record<string, unknown> } {
  const desc = STORY_VIDEO_MODELS[args.modelId];
  const resolution = args.options.resolution ?? desc.defaults.resolution;
  const duration = args.options.duration ?? desc.defaults.duration;
  const built = buildCanvasVideoVolcengineInput({
    modelKey: args.modelId,
    prompt: args.frame.videoPrompt,
    imageUrl: args.frame.imageUrl ?? "",
    options: {
      resolution,
      duration,
      generateAudio:
        args.options.generateAudio ?? desc.defaults.generateAudio ?? false,
      watermark: args.options.watermark ?? false,
    },
    aspectRatio: aspectRatioToKie(args.project.aspectRatio),
  });
  return { model: built.model, input: built.body };
}

function buildFrameVideoKieInput(args: {
  project: StoryProject;
  frame: StoryStoryboardFrame;
  modelId: StoryVideoModelId;
  options: StoryVideoOptions;
}): { model: string; input: Record<string, unknown> } {
  const desc = STORY_VIDEO_MODELS[args.modelId];
  const resolution = args.options.resolution ?? desc.defaults.resolution;
  const duration = args.options.duration ?? desc.defaults.duration;

  if (args.modelId === "bytedance/seedance-2") {
    return {
      model: "bytedance/seedance-2",
      input: {
        prompt: args.frame.videoPrompt,
        reference_image_urls: args.frame.imageUrl ? [args.frame.imageUrl] : [],
        aspect_ratio: aspectRatioToKie(args.project.aspectRatio),
        resolution,
        duration,
        generate_audio:
          args.options.generateAudio ??
          desc.defaults.generateAudio ??
          false,
      },
    };
  }

  if (args.modelId === "happyhorse/image-to-video") {
    return {
      model: "happyhorse/image-to-video",
      input: {
        prompt: args.frame.videoPrompt,
        image_urls: args.frame.imageUrl ? [args.frame.imageUrl] : [],
        resolution,
        duration,
      },
    };
  }

  if (args.modelId === "kling-2.6/image-to-video") {
    const rawDur = Number(args.options.duration ?? desc.defaults.duration);
    const dur = Number.isFinite(rawDur) && rawDur >= 10 ? "10" : "5";
    return {
      model: "kling-2.6/image-to-video",
      input: {
        prompt: args.frame.videoPrompt,
        image_urls: args.frame.imageUrl ? [args.frame.imageUrl] : [],
        sound:
          args.options.generateAudio ??
          desc.defaults.generateAudio ??
          false,
        duration: dur,
      },
    };
  }

  // wan/2-7-image-to-video
  return {
    model: "wan/2-7-image-to-video",
    input: {
      prompt: args.frame.videoPrompt,
      first_frame_url: args.frame.imageUrl,
      resolution,
      duration,
      prompt_extend:
        args.options.promptExtend ?? desc.defaults.promptExtend ?? true,
      watermark: args.options.watermark ?? desc.defaults.watermark ?? false,
    },
  };
}

function validateAndNormalizeVideoOptions(
  modelId: StoryVideoModelId,
  options: StoryVideoOptions,
): StoryVideoOptions {
  const desc = STORY_VIDEO_MODELS[modelId];
  const out: StoryVideoOptions = {};
  if (options.resolution !== undefined) {
    if (!desc.resolutions.includes(options.resolution)) {
      throw new StoryProjectError(
        "INVALID_INPUT",
        `resolution must be one of ${desc.resolutions.join(", ")}`,
      );
    }
    out.resolution = options.resolution;
  }
  if (options.duration !== undefined) {
    const [min, max] = desc.durationRange;
    if (
      typeof options.duration !== "number" ||
      !Number.isInteger(options.duration) ||
      options.duration < min ||
      options.duration > max
    ) {
      throw new StoryProjectError(
        "INVALID_INPUT",
        `duration must be integer in [${min}, ${max}]`,
      );
    }
    out.duration = options.duration;
  }
  if (options.generateAudio !== undefined) {
    if (!desc.supports.generateAudio) {
      throw new StoryProjectError(
        "INVALID_INPUT",
        `${modelId} does not support generateAudio`,
      );
    }
    out.generateAudio = !!options.generateAudio;
  }
  if (options.promptExtend !== undefined) {
    if (!desc.supports.promptExtend) {
      throw new StoryProjectError(
        "INVALID_INPUT",
        `${modelId} does not support promptExtend`,
      );
    }
    out.promptExtend = !!options.promptExtend;
  }
  if (options.watermark !== undefined) {
    if (!desc.supports.watermark) {
      throw new StoryProjectError(
        "INVALID_INPUT",
        `${modelId} does not support watermark`,
      );
    }
    out.watermark = !!options.watermark;
  }
  return out;
}

// —— Submit a task ——

type SubmitArgs = {
  projectId: string;
  kind: StoryGenerationKind;
  model: string;
  input: Record<string, unknown>;
  characterId?: string | null;
  frameId?: string | null;
};

/** 创建一笔 PENDING/QUEUED 任务，立即尝试调 KIE（视频可走 QUEUED）；失败也保留任务（后续 poll worker 重试 ≤3 次）。 */
async function submitGenerationTask(args: SubmitArgs): Promise<string> {
  const project = await prisma.storyProject.findUnique({
    where: { id: args.projectId },
    select: { userId: true },
  });
  if (!project) {
    throw new StoryProjectError("NOT_FOUND", "project not found", 404);
  }

  const useVideoQueue =
    args.kind === "FRAME_VIDEO" && isTrafficControlEnabled();
  const scope = useVideoQueue
    ? await resolveStoryProjectTrafficScope(args.projectId, project.userId)
    : null;

  const task = await prisma.storyGenerationTask.create({
    data: {
      projectId: args.projectId,
      kind: args.kind,
      model: args.model,
      inputPayload: args.input as Prisma.InputJsonValue,
      characterId: args.characterId ?? null,
      frameId: args.frameId ?? null,
      status: useVideoQueue ? "QUEUED" : "PENDING",
      queuedAt: useVideoQueue ? new Date() : undefined,
      tenantId: scope?.tenantId ?? null,
      actorUserId: project.userId,
    },
  });

  // 提交即关联 *TaskId，前端可通过 imageTaskStatus 等字段感知进行中/失败（不仅靠 pendingTasks）
  switch (args.kind) {
    case "COVER_IMAGE":
      await prisma.storyProject.update({
        where: { id: args.projectId },
        data: { coverTaskId: task.id },
      });
      break;
    case "CHARACTER_AVATAR":
      if (args.characterId) {
        await prisma.storyCharacter.update({
          where: { id: args.characterId },
          data: { avatarTaskId: task.id },
        });
      }
      break;
    case "FRAME_IMAGE":
      if (args.frameId) {
        await prisma.storyStoryboardFrame.update({
          where: { id: args.frameId },
          data: { imageTaskId: task.id },
        });
      }
      break;
    case "FRAME_VIDEO":
      if (args.frameId) {
        await prisma.storyStoryboardFrame.update({
          where: { id: args.frameId },
          data: { videoTaskId: task.id },
        });
      }
      break;
  }

  if (useVideoQueue) {
    void dispatchQueuedStoryTasks({ projectId: args.projectId }).catch(() => undefined);
    return task.id;
  }

  const callBackUrl =
    args.kind === "FRAME_VIDEO"
      ? buildStoryAiKieCallbackUrl("video", task.id)
      : buildStoryAiKieCallbackUrl("image", task.id);

  try {
    const isVolcengine =
      args.kind === "FRAME_VIDEO" && isVolcengineStoryVideoModelKey(args.model);
    const { taskId, logId } = isVolcengine
      ? await storyGwCreateVolcengineVideoJob(project.userId, {
          model: args.model,
          body: args.input,
          storyProjectId: args.projectId,
          storyTaskId: task.id,
        })
      : await storyGwCreateKieJob(project.userId, {
          model: args.model,
          input: args.input,
          callBackUrl,
          storyProjectId: args.projectId,
          storyTaskId: task.id,
        });
    await prisma.storyGenerationTask.update({
      where: { id: task.id },
      data: {
        status: "SUBMITTED",
        kieTaskId: taskId,
        gatewayLogId: logId,
        submittedAt: new Date(),
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const code = e instanceof KieError ? e.code : "KIE_HTTP_ERROR";
    const friendly = formatKieTaskFailMessage(code, msg);
    logKieEvent("warn", `createTask failed (will retry via poll worker)`, {
      taskId: task.id,
      code,
      msg,
    });
    await prisma.storyGenerationTask.update({
      where: { id: task.id },
      data: {
        failCode: code,
        failMessage: friendly.slice(0, 500),
      },
    });
    // 故意不 throw —— 任务保留 PENDING，poll worker 后续会重试
  }

  return task.id;
}

// —— Apply result（callback / poll 共用） ——

/**
 * 处理 KIE 状态：
 *   - state=success：下载 + 上传 OSS → 写回目标实体 → task SUCCEEDED
 *   - state=fail：写 failCode/failMessage → task FAILED
 *   - 其他：无操作（仍保持 SUBMITTED）
 */
export async function applyVolcengineVideoTaskResult(
  taskId: string,
  videoUrl: string | null | undefined,
  raw?: unknown,
): Promise<void> {
  const task = await prisma.storyGenerationTask.findUnique({
    where: { id: taskId },
    include: { project: true },
  });
  if (!task) return;
  if (task.status === "SUCCEEDED" || task.status === "CANCELLED") return;

  const ephemeralUrl = videoUrl?.trim();
  if (!ephemeralUrl || !/^https?:\/\//.test(ephemeralUrl)) {
    await prisma.storyGenerationTask.update({
      where: { id: taskId },
      data: {
        status: "FAILED",
        failCode: "VOLCENGINE_NO_RESULT_URL",
        failMessage: "火山方舟任务成功但未返回 video_url",
        resultPayload: raw as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });
    return;
  }

  let ossUrl: string | null = null;
  let ossError: string | null = null;
  try {
    ossUrl = await persistKieResultToOss({
      ephemeralUrl,
      kind: ossKindForTaskKind(task.kind),
      projectId: task.projectId,
      refId: task.characterId ?? task.frameId ?? undefined,
    });
  } catch (e) {
    ossError = e instanceof Error ? e.message : String(e);
  }

  if (!ossUrl) {
    await prisma.storyGenerationTask.update({
      where: { id: taskId },
      data: {
        status: "FAILED",
        failCode: "OSS_UPLOAD_FAILED",
        failMessage: ossError ?? "OSS upload failed",
        ephemeralUrl,
        resultPayload: raw as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.storyGenerationTask.update({
      where: { id: taskId },
      data: {
        status: "SUCCEEDED",
        ossUrl,
        ephemeralUrl,
        resultPayload: raw as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });
    if (task.kind === "FRAME_VIDEO" && task.frameId) {
      const cleanupNotBefore = new Date(Date.now() + 5 * 60 * 1000);
      const frame = await tx.storyStoryboardFrame.findUnique({
        where: { id: task.frameId },
        select: { videoUrl: true, projectId: true },
      });
      if (frame?.videoUrl && frame.videoUrl !== ossUrl) {
        await tx.storyOssCleanupQueue.create({
          data: {
            source: `regenerate_frame_video:${task.frameId}`,
            projectId: frame.projectId,
            ossUrl: frame.videoUrl,
            notBefore: cleanupNotBefore,
          },
        });
      }
      await tx.storyStoryboardFrame.update({
        where: { id: task.frameId },
        data: { videoUrl: ossUrl, videoTaskId: task.id },
      });
    }
  });
}

export async function applyKieTaskResult(
  taskId: string,
  record: KieRecordResponse,
): Promise<void> {
  const task = await prisma.storyGenerationTask.findUnique({
    where: { id: taskId },
    include: { project: true },
  });
  if (!task) {
    logKieEvent("warn", "applyKieTaskResult: task not found", { taskId });
    return;
  }
  if (task.status === "SUCCEEDED" || task.status === "CANCELLED") {
    return; // 幂等
  }

  if (isKieRecordSuccess(record.state)) {
    const ephemeralUrl = extractKieResultUrl(record);
    if (!ephemeralUrl) {
      await prisma.storyGenerationTask.update({
        where: { id: taskId },
        data: {
          status: "FAILED",
          failCode: "KIE_NO_RESULT_URL",
          failMessage: "KIE returned success but resultUrls empty",
          resultPayload: record as unknown as Prisma.InputJsonValue,
          completedAt: new Date(),
        },
      });
      return;
    }

    let ossUrl: string | null = null;
    let ossError: string | null = null;
    try {
      ossUrl = await persistKieResultToOss({
        ephemeralUrl,
        kind: ossKindForTaskKind(task.kind),
        projectId: task.projectId,
        refId: task.characterId ?? task.frameId ?? undefined,
      });
    } catch (e) {
      ossError = e instanceof Error ? e.message : String(e);
      logKieEvent("error", "persistKieResultToOss failed", {
        taskId,
        ephemeralUrl,
        ossError,
      });
    }

    if (!ossUrl) {
      await prisma.storyGenerationTask.update({
        where: { id: taskId },
        data: {
          status: "FAILED",
          failCode: "OSS_UPLOAD_FAILED",
          failMessage: ossError ?? "OSS upload failed",
          ephemeralUrl,
          resultPayload: record as unknown as Prisma.InputJsonValue,
          completedAt: new Date(),
        },
      });
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.storyGenerationTask.update({
        where: { id: taskId },
        data: {
          status: "SUCCEEDED",
          ossUrl,
          ephemeralUrl,
          resultPayload: record as unknown as Prisma.InputJsonValue,
          completedAt: new Date(),
        },
      });
      // 旧资源入清理队列（5 分钟窗口期，避免 CDN/前端缓存里仍指向旧 URL）
      const cleanupNotBefore = new Date(Date.now() + 5 * 60 * 1000);

      switch (task.kind) {
        case "COVER_IMAGE": {
          const project = await tx.storyProject.findUnique({
            where: { id: task.projectId },
            select: { coverImageUrl: true },
          });
          if (project?.coverImageUrl && project.coverImageUrl !== ossUrl) {
            await tx.storyOssCleanupQueue.create({
              data: {
                source: `regenerate_cover:${task.projectId}`,
                projectId: task.projectId,
                ossUrl: project.coverImageUrl,
                notBefore: cleanupNotBefore,
              },
            });
          }
          await tx.storyProject.update({
            where: { id: task.projectId },
            data: { coverImageUrl: ossUrl, coverTaskId: task.id },
          });
          break;
        }
        case "CHARACTER_AVATAR": {
          if (!task.characterId) break;
          const character = await tx.storyCharacter.findUnique({
            where: { id: task.characterId },
            select: { avatarUrl: true, projectId: true },
          });
          if (character?.avatarUrl && character.avatarUrl !== ossUrl) {
            await tx.storyOssCleanupQueue.create({
              data: {
                source: `regenerate_avatar:${task.characterId}`,
                projectId: character.projectId,
                ossUrl: character.avatarUrl,
                notBefore: cleanupNotBefore,
              },
            });
          }
          await tx.storyCharacter.update({
            where: { id: task.characterId },
            data: { avatarUrl: ossUrl, avatarTaskId: task.id },
          });
          break;
        }
        case "FRAME_IMAGE": {
          if (!task.frameId) break;
          const frame = await tx.storyStoryboardFrame.findUnique({
            where: { id: task.frameId },
            select: { imageUrl: true, projectId: true },
          });
          if (frame?.imageUrl && frame.imageUrl !== ossUrl) {
            await tx.storyOssCleanupQueue.create({
              data: {
                source: `regenerate_frame_image:${task.frameId}`,
                projectId: frame.projectId,
                ossUrl: frame.imageUrl,
                notBefore: cleanupNotBefore,
              },
            });
          }
          await tx.storyStoryboardFrame.update({
            where: { id: task.frameId },
            data: { imageUrl: ossUrl, imageTaskId: task.id },
          });
          break;
        }
        case "FRAME_VIDEO": {
          if (!task.frameId) break;
          const frame = await tx.storyStoryboardFrame.findUnique({
            where: { id: task.frameId },
            select: { videoUrl: true, projectId: true },
          });
          if (frame?.videoUrl && frame.videoUrl !== ossUrl) {
            await tx.storyOssCleanupQueue.create({
              data: {
                source: `regenerate_frame_video:${task.frameId}`,
                projectId: frame.projectId,
                ossUrl: frame.videoUrl,
                notBefore: cleanupNotBefore,
              },
            });
          }
          await tx.storyStoryboardFrame.update({
            where: { id: task.frameId },
            data: { videoUrl: ossUrl, videoTaskId: task.id },
          });
          break;
        }
      }

      // 项目状态推进：所有初始任务（封面 + 头像）完成 → READY
      if (
        task.kind === "COVER_IMAGE" ||
        task.kind === "CHARACTER_AVATAR"
      ) {
        const remaining = await tx.storyGenerationTask.count({
          where: {
            projectId: task.projectId,
            kind: { in: ["COVER_IMAGE", "CHARACTER_AVATAR"] },
            status: { in: ["PENDING", "SUBMITTED"] },
          },
        });
        if (remaining === 0) {
          const project = await tx.storyProject.findUnique({
            where: { id: task.projectId },
            select: { status: true },
          });
          if (project?.status === "INITIALIZING") {
            await tx.storyProject.update({
              where: { id: task.projectId },
              data: { status: "READY" },
            });
          }
        }
      }
    });

    logKieEvent("info", "task succeeded", {
      taskId,
      kind: task.kind,
      ossUrl,
    });
  } else if (isKieRecordFail(record.state)) {
    await prisma.storyGenerationTask.update({
      where: { id: taskId },
      data: {
        status: "FAILED",
        failCode: record.failCode || "KIE_FAILED",
        failMessage: record.failMsg ?? null,
        resultPayload: record as unknown as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });
    logKieEvent("warn", "task failed", {
      taskId,
      kind: task.kind,
      failCode: record.failCode,
      failMsg: record.failMsg,
    });
  }
  // 其他状态（waiting / queuing / generating）：保持 SUBMITTED
}

function ossKindForTaskKind(
  kind: StoryGenerationKind,
):
  | "cover"
  | "character"
  | "frame-image"
  | "frame-video" {
  switch (kind) {
    case "COVER_IMAGE":
      return "cover";
    case "CHARACTER_AVATAR":
      return "character";
    case "FRAME_IMAGE":
      return "frame-image";
    case "FRAME_VIDEO":
      return "frame-video";
  }
}

// —— High-level submit helpers（调用方使用） ——

export async function submitInitialMediaTasks(
  projectId: string,
): Promise<string[]> {
  const project = await prisma.storyProject.findUnique({
    where: { id: projectId },
    include: { characters: { orderBy: { sortOrder: "asc" } } },
  });
  if (!project) return [];

  // 已存在的封面 / 头像任务（活跃或成功）跳过，避免初始化幂等被滥用
  const existing = await prisma.storyGenerationTask.findMany({
    where: {
      projectId,
      kind: { in: ["COVER_IMAGE", "CHARACTER_AVATAR"] },
      status: { in: ["PENDING", "SUBMITTED", "SUCCEEDED"] },
    },
    select: { kind: true, characterId: true },
  });
  const hasCover = existing.some((t) => t.kind === "COVER_IMAGE");
  const charactersWithTask = new Set(
    existing
      .filter((t) => t.kind === "CHARACTER_AVATAR" && t.characterId)
      .map((t) => t.characterId as string),
  );

  const toSubmit: SubmitArgs[] = [];
  if (!hasCover && !project.coverImageUrl) {
    toSubmit.push({
      projectId: project.id,
      kind: "COVER_IMAGE",
      ...buildCoverKieInput({ project }),
    });
  }
  for (const character of project.characters) {
    if (charactersWithTask.has(character.id)) continue;
    if (character.avatarUrl) continue;
    toSubmit.push({
      projectId: project.id,
      kind: "CHARACTER_AVATAR",
      characterId: character.id,
      ...buildCharacterKieInput({ project, character }),
    });
  }

  if (toSubmit.length === 0) return [];

  await ensureUserInflightCapacity(project.userId, toSubmit.length);

  const ids: string[] = [];
  for (const args of toSubmit) {
    const id = await submitGenerationTask(args);
    ids.push(id);
  }
  return ids;
}

export async function submitCoverRegeneration(
  userId: string,
  projectId: string,
): Promise<string> {
  const project = await prisma.storyProject.findFirst({
    where: { id: projectId, userId, deletedAt: null },
  });
  if (!project) {
    throw new StoryProjectError("NOT_FOUND", "project not found", 404);
  }
  await assertNoActiveTaskForCover(projectId);
  await ensureUserInflightCapacity(userId);
  const { model, input } = buildCoverKieInput({ project });
  return submitGenerationTask({
    projectId: project.id,
    kind: "COVER_IMAGE",
    model,
    input,
  });
}

export async function submitCharacterAvatar(
  userId: string,
  projectId: string,
  characterId: string,
): Promise<string> {
  const project = await prisma.storyProject.findFirst({
    where: { id: projectId, userId, deletedAt: null },
    include: { characters: { where: { id: characterId } } },
  });
  if (!project) {
    throw new StoryProjectError("NOT_FOUND", "project not found", 404);
  }
  const character = project.characters[0];
  if (!character) {
    throw new StoryProjectError("NOT_FOUND", "character not found", 404);
  }
  await assertNoActiveTaskForCharacter(characterId);
  await ensureUserInflightCapacity(userId);
  const { model, input } = buildCharacterKieInput({ project, character });
  return submitGenerationTask({
    projectId: project.id,
    kind: "CHARACTER_AVATAR",
    characterId,
    model,
    input,
  });
}

export async function submitFrameImage(
  userId: string,
  projectId: string,
  frameId: string,
): Promise<string> {
  const project = await prisma.storyProject.findFirst({
    where: { id: projectId, userId, deletedAt: null },
    include: {
      characters: true,
      frames: { where: { id: frameId } },
    },
  });
  if (!project) {
    throw new StoryProjectError("NOT_FOUND", "project not found", 404);
  }
  const frame = project.frames[0];
  if (!frame) {
    throw new StoryProjectError("NOT_FOUND", "frame not found", 404);
  }
  if (!frame.imagePrompt.trim()) {
    throw new StoryProjectError("EMPTY_PROMPT", "frame.imagePrompt is empty");
  }
  // 校验角色头像就绪
  const refs = project.characters.filter((c) =>
    frame.characterIds.includes(c.id),
  );
  if (refs.length > 0) {
    const missing = refs.filter((c) => !c.avatarUrl);
    if (missing.length > 0) {
      throw new StoryProjectError(
        "MISSING_DEPENDENCY",
        `${missing.length} character avatar(s) not ready: ${missing.map((c) => c.name).join(", ")}`,
        409,
      );
    }
  }
  await assertNoActiveTaskForFrameImage(frameId);
  await ensureUserInflightCapacity(userId);
  const { model, input } = buildFrameImageKieInput({
    project,
    frame,
    characters: project.characters,
  });
  return submitGenerationTask({
    projectId: project.id,
    kind: "FRAME_IMAGE",
    frameId,
    model,
    input,
  });
}

export type SubmitFrameVideoOptions = {
  /** 模型 id；不传则用默认（seedance-2） */
  modelId?: string;
  options?: StoryVideoOptions;
};

export async function submitFrameVideo(
  userId: string,
  projectId: string,
  frameId: string,
  args: SubmitFrameVideoOptions = {},
): Promise<string> {
  const project = await prisma.storyProject.findFirst({
    where: { id: projectId, userId, deletedAt: null },
    include: { frames: { where: { id: frameId } } },
  });
  if (!project) {
    throw new StoryProjectError("NOT_FOUND", "project not found", 404);
  }
  const frame = project.frames[0];
  if (!frame) {
    throw new StoryProjectError("NOT_FOUND", "frame not found", 404);
  }

  // 选模型 + 校验 options
  const requestedModel = args.modelId ?? STORY_AI_KIE_MODELS.VIDEO;
  if (
    !(STORY_VIDEO_MODEL_IDS as readonly string[]).includes(requestedModel)
  ) {
    throw new StoryProjectError(
      "INVALID_INPUT",
      `unsupported video model: ${requestedModel}`,
    );
  }
  const modelId = requestedModel as StoryVideoModelId;
  const desc = STORY_VIDEO_MODELS[modelId];
  if (desc.requiresImage && !frame.imageUrl) {
    throw new StoryProjectError(
      "MISSING_DEPENDENCY",
      `${modelId} requires frame.imageUrl`,
      409,
    );
  }
  if (!frame.videoPrompt.trim()) {
    throw new StoryProjectError("EMPTY_PROMPT", "frame.videoPrompt is empty");
  }
  const normalizedOptions = validateAndNormalizeVideoOptions(
    modelId,
    args.options ?? {},
  );

  await assertNoActiveTaskForFrameVideo(frameId);
  await ensureUserInflightCapacity(userId);
  const { model, input } = isVolcengineStoryVideoModelKey(modelId)
    ? buildFrameVideoVolcengineInput({
        project,
        frame,
        modelId,
        options: normalizedOptions,
      })
    : buildFrameVideoKieInput({
        project,
        frame,
        modelId,
        options: normalizedOptions,
      });
  return submitGenerationTask({
    projectId: project.id,
    kind: "FRAME_VIDEO",
    frameId,
    model,
    input,
  });
}

async function assertNoActiveTaskForCover(projectId: string): Promise<void> {
  const active = await prisma.storyGenerationTask.findFirst({
    where: {
      projectId,
      kind: "COVER_IMAGE",
      status: { in: ["PENDING", "SUBMITTED"] },
    },
  });
  if (active) {
    throw new StoryProjectError(
      "TASK_ALREADY_INFLIGHT",
      "cover image task already in progress",
      409,
    );
  }
}

async function assertNoActiveTaskForCharacter(
  characterId: string,
): Promise<void> {
  const active = await prisma.storyGenerationTask.findFirst({
    where: {
      characterId,
      kind: "CHARACTER_AVATAR",
      status: { in: ["PENDING", "SUBMITTED"] },
    },
  });
  if (active) {
    throw new StoryProjectError(
      "TASK_ALREADY_INFLIGHT",
      "character avatar task already in progress",
      409,
    );
  }
}

async function assertNoActiveTaskForFrameImage(
  frameId: string,
): Promise<void> {
  const active = await prisma.storyGenerationTask.findFirst({
    where: {
      frameId,
      kind: "FRAME_IMAGE",
      status: { in: ["PENDING", "SUBMITTED"] },
    },
  });
  if (active) {
    throw new StoryProjectError(
      "TASK_ALREADY_INFLIGHT",
      "frame image task already in progress",
      409,
    );
  }
}

async function assertNoActiveTaskForFrameVideo(
  frameId: string,
): Promise<void> {
  const active = await prisma.storyGenerationTask.findFirst({
    where: {
      frameId,
      kind: "FRAME_VIDEO",
      status: { in: ["PENDING", "SUBMITTED"] },
    },
  });
  if (active) {
    throw new StoryProjectError(
      "TASK_ALREADY_INFLIGHT",
      "frame video task already in progress",
      409,
    );
  }
}

// —— Polling worker ——

/** 提交 KIE 任务后异步 poll 一次，避免仅依赖 cron/回调 */
export function schedulePollWorkerForProject(projectId: string): void {
  void runPollWorker({ projectId }).catch((e) => {
    console.warn("[story] opportunistic poll failed", {
      projectId,
      error: e instanceof Error ? e.message : String(e),
    });
  });
}

const POLL_INNER_TIMEOUT_MS = 8000;
const RETRY_PENDING_LIMIT = 3;

function shouldPollNow(
  task: Pick<StoryGenerationTask, "lastPolledAt" | "pollCount">,
): boolean {
  if (!task.lastPolledAt) return true;
  const intervalSec = Math.min(2 * 2 ** task.pollCount, 60);
  return (
    Date.now() - task.lastPolledAt.getTime() >= intervalSec * 1000
  );
}

/** 对单条 SUBMITTED 漫剧任务拉一次 Gateway/厂商状态；终态则写回任务表。 */
async function pollOneSubmittedStoryTask(
  task: StoryGenerationTask,
): Promise<"succeeded" | "failed" | "pending"> {
  const before = task.status;
  const project = await prisma.storyProject.findUnique({
    where: { id: task.projectId },
    select: { userId: true },
  });
  if (!project || !task.kieTaskId) return "pending";

  const isVolcengine =
    task.kind === "FRAME_VIDEO" &&
    isVolcengineStoryVideoModelKey(task.model);

  if (isVolcengine) {
    const polled = await Promise.race([
      storyGwPollVolcengineVideo(project.userId, {
        taskId: task.kieTaskId,
        gatewayLogId: task.gatewayLogId,
        model: task.model,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("volcengine poll timeout")),
          POLL_INNER_TIMEOUT_MS,
        ),
      ),
    ]);
    await prisma.storyGenerationTask.update({
      where: { id: task.id },
      data: {
        lastPolledAt: new Date(),
        pollCount: task.pollCount + 1,
      },
    });
    if (polled.state === "success") {
      await applyVolcengineVideoTaskResult(
        task.id,
        polled.videoUrl,
        polled.raw,
      );
    } else if (polled.state === "fail") {
      await prisma.storyGenerationTask.update({
        where: { id: task.id },
        data: {
          status: "FAILED",
          failCode: "VOLCENGINE_TASK_FAILED",
          failMessage: polled.failMessage?.slice(0, 500) ?? "failed",
          resultPayload: polled.raw as Prisma.InputJsonValue,
          completedAt: new Date(),
        },
      });
    }
  } else {
    const record = await Promise.race([
      storyGwRecordInfo(project.userId, {
        taskId: task.kieTaskId,
        gatewayLogId: task.gatewayLogId,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("recordInfo timeout")),
          POLL_INNER_TIMEOUT_MS,
        ),
      ),
    ]);
    await prisma.storyGenerationTask.update({
      where: { id: task.id },
      data: {
        lastPolledAt: new Date(),
        pollCount: task.pollCount + 1,
      },
    });
    if (isKieRecordSuccess(record.state)) {
      await applyKieTaskResult(task.id, record);
    } else if (isKieRecordFail(record.state)) {
      await applyKieTaskResult(task.id, record);
    }
  }

  const after = await prisma.storyGenerationTask.findUnique({
    where: { id: task.id },
    select: { status: true },
  });
  if (after?.status === "SUCCEEDED" && before !== "SUCCEEDED") return "succeeded";
  if (after?.status === "FAILED" && before !== "FAILED") return "failed";
  return "pending";
}

type StorySubmittedPollDelta = {
  scanned: number;
  succeeded: number;
  failed: number;
  timedOut: number;
};

async function advanceOneSubmittedStoryTask(
  task: StoryGenerationTask,
  now: number,
): Promise<StorySubmittedPollDelta> {
  const delta: StorySubmittedPollDelta = {
    scanned: 1,
    succeeded: 0,
    failed: 0,
    timedOut: 0,
  };
  if (!task.kieTaskId) return delta;
  if (!shouldPollNow(task)) {
    delta.scanned = 0;
    return delta;
  }

  const timeoutMs = STORY_AI_TASK_TIMEOUT_MIN * 60 * 1000;
  const submittedTs = (task.submittedAt ?? task.createdAt).getTime();
  if (now - submittedTs >= timeoutMs) {
    try {
      const outcome = await pollOneSubmittedStoryTask(task);
      if (outcome === "succeeded") {
        delta.succeeded = 1;
        return delta;
      }
      if (outcome === "failed") {
        delta.failed = 1;
        return delta;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logKieEvent("warn", "final poll before timeout error", {
        taskId: task.id,
        msg,
      });
    }

    await prisma.storyGenerationTask.update({
      where: { id: task.id },
      data: {
        status: "FAILED",
        failCode: "timeout",
        failMessage: `task exceeded ${STORY_AI_TASK_TIMEOUT_MIN} min`,
        lastPolledAt: new Date(),
        pollCount: task.pollCount + 1,
        completedAt: new Date(),
      },
    });
    const gatewayLogId = task.gatewayLogId?.trim();
    if (gatewayLogId) {
      await failGatewayLogIfStillRunning({
        gatewayLogId,
        durationMs: now - submittedTs,
        timeoutMin: STORY_AI_TASK_TIMEOUT_MIN,
        externalTaskId: task.kieTaskId,
      });
    }
    delta.timedOut = 1;
    return delta;
  }

  try {
    const outcome = await pollOneSubmittedStoryTask(task);
    if (outcome === "succeeded") delta.succeeded = 1;
    else if (outcome === "failed") delta.failed = 1;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logKieEvent("warn", "recordInfo poll error", {
      taskId: task.id,
      kieTaskId: task.kieTaskId,
      msg,
    });
    await prisma.storyGenerationTask.update({
      where: { id: task.id },
      data: {
        lastPolledAt: new Date(),
        pollCount: task.pollCount + 1,
        failMessage: msg.slice(0, 500),
      },
    });
  }
  return delta;
}

/**
 * 选取一批 PENDING（重试 createTask）+ SUBMITTED（查询 KIE）任务推进。
 * 由 cron `/api/story/kie/poll` 与脚本 `pnpm story:poll-once` 调用。
 */
export async function runPollWorker(opts?: {
  /** 仅推进指定项目的任务（项目页 GET 按需 poll 用） */
  projectId?: string;
}): Promise<{
  scanned: number;
  retried: number;
  succeeded: number;
  failed: number;
  timedOut: number;
}> {
  const result = { scanned: 0, retried: 0, succeeded: 0, failed: 0, timedOut: 0 };
  const projectFilter = opts?.projectId ? { projectId: opts.projectId } : {};

  await dispatchQueuedStoryTasks({ projectId: opts?.projectId }).catch(() => undefined);

  // 1) PENDING 任务（createTask 失败的）：重试 createTask，最多 RETRY_PENDING_LIMIT 次
  const pendings = await prisma.storyGenerationTask.findMany({
    where: {
      status: "PENDING",
      pollCount: { lt: RETRY_PENDING_LIMIT },
      ...projectFilter,
    },
    orderBy: { createdAt: "asc" },
    take: getGenerationPollBatch(),
  });
  for (const task of pendings) {
    result.scanned++;
    if (!shouldPollNow(task)) continue;
    const callBackUrl =
      task.kind === "FRAME_VIDEO"
        ? buildStoryAiKieCallbackUrl("video", task.id)
        : buildStoryAiKieCallbackUrl("image", task.id);
    try {
      const project = await prisma.storyProject.findUnique({
        where: { id: task.projectId },
        select: { userId: true },
      });
      if (!project) continue;

      const isVolcengine =
        task.kind === "FRAME_VIDEO" &&
        isVolcengineStoryVideoModelKey(task.model);
      const submitPromise = isVolcengine
        ? storyGwCreateVolcengineVideoJob(project.userId, {
            model: task.model,
            body: task.inputPayload as Record<string, unknown>,
            storyProjectId: task.projectId,
            storyTaskId: task.id,
          })
        : storyGwCreateKieJob(project.userId, {
            model: task.model,
            input: task.inputPayload as Record<string, unknown>,
            callBackUrl,
            storyProjectId: task.projectId,
            storyTaskId: task.id,
          });
      const { taskId, logId } = await Promise.race([
        submitPromise,
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("createTask retry timeout")),
            POLL_INNER_TIMEOUT_MS,
          ),
        ),
      ]);
      await prisma.storyGenerationTask.update({
        where: { id: task.id },
        data: {
          status: "SUBMITTED",
          kieTaskId: taskId,
          gatewayLogId: logId,
          submittedAt: new Date(),
          lastPolledAt: new Date(),
          pollCount: task.pollCount + 1,
        },
      });
      result.retried++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const errCode = e instanceof KieError ? e.code : "KIE_HTTP_ERROR";
      const nextCount = task.pollCount + 1;
      const exhausted = nextCount >= RETRY_PENDING_LIMIT;
      const friendly = formatKieTaskFailMessage(errCode, msg);
      await prisma.storyGenerationTask.update({
        where: { id: task.id },
        data: {
          lastPolledAt: new Date(),
          pollCount: nextCount,
          ...(exhausted
            ? {
                status: "FAILED" as StoryGenerationStatus,
                failCode: errCode,
                failMessage: friendly.slice(0, 500),
                completedAt: new Date(),
              }
            : { failMessage: friendly.slice(0, 500) }),
        },
      });
      if (exhausted) result.failed++;
    }
  }

  // 2) SUBMITTED 任务：并行 poll + 多轮扫描
  const pollBatch = getGenerationPollBatch();
  const scaledPoll = !opts?.projectId;
  const deadline = scaledPoll
    ? Date.now() + getGenerationPollTimeBudgetMs()
    : Number.MAX_SAFE_INTEGER;
  const maxPasses = scaledPoll ? getGenerationPollMaxPasses() : 1;
  const concurrency = scaledPoll ? getGenerationPollConcurrency() : 1;

  for (let pass = 0; pass < maxPasses && Date.now() < deadline; pass++) {
    const fetchSize = scaledPoll ? pollShardOverFetchSize(pollBatch) : pollBatch;
    const candidates = await prisma.storyGenerationTask.findMany({
      where: {
        status: "SUBMITTED",
        kieTaskId: { not: null },
        ...projectFilter,
      },
      orderBy: { lastPolledAt: { sort: "asc", nulls: "first" } },
      take: fetchSize,
    });
    const submitted = scaledPoll
      ? selectPollShardTasks(candidates, pollBatch)
      : candidates;
    if (submitted.length === 0) break;

    const tickNow = Date.now();
    await mapWithConcurrency(
      submitted,
      async (task) => {
        const d = await advanceOneSubmittedStoryTask(task, tickNow);
        result.scanned += d.scanned;
        result.succeeded += d.succeeded;
        result.failed += d.failed;
        result.timedOut += d.timedOut;
      },
      concurrency,
    );
  }

  return result;
}

// —— Cleanup worker ——

const CLEANUP_BATCH = 50;
const CLEANUP_MAX_ATTEMPTS = 3;

export async function runCleanupWorker(): Promise<{
  scanned: number;
  deleted: number;
  failed: number;
}> {
  const { deleteManagedOssObjectByUrl } = await import(
    "@/lib/oss-delete-object"
  );
  const result = { scanned: 0, deleted: 0, failed: 0 };

  const items = await prisma.storyOssCleanupQueue.findMany({
    where: {
      doneAt: null,
      attempts: { lt: CLEANUP_MAX_ATTEMPTS },
      notBefore: { lte: new Date() },
    },
    orderBy: { createdAt: "asc" },
    take: CLEANUP_BATCH,
  });

  for (const item of items) {
    result.scanned++;
    try {
      const r = await deleteManagedOssObjectByUrl(item.ossUrl);
      if (r.ok) {
        await prisma.storyOssCleanupQueue.update({
          where: { id: item.id },
          data: {
            doneAt: new Date(),
            lastTriedAt: new Date(),
            attempts: item.attempts + 1,
          },
        });
        result.deleted++;
      } else {
        await prisma.storyOssCleanupQueue.update({
          where: { id: item.id },
          data: {
            lastTriedAt: new Date(),
            lastError: r.error.slice(0, 500),
            attempts: item.attempts + 1,
          },
        });
        result.failed++;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await prisma.storyOssCleanupQueue.update({
        where: { id: item.id },
        data: {
          lastTriedAt: new Date(),
          lastError: msg.slice(0, 500),
          attempts: item.attempts + 1,
        },
      });
      result.failed++;
    }
  }

  return result;
}
