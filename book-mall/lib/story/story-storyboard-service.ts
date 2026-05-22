/**
 * 分镜文本生成（LLM 唯一调用）。
 * 详见 plan.md §5.3
 */
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { chatJson } from "./gemini-llm-client";
import { getStoryStyleById } from "./comic-styles";
import {
  STORY_AI_FRAME_COUNT_OPTIONS,
  STORY_AI_DEFAULT_FRAME_COUNT,
  type StoryAiFrameCount,
} from "./story-ai-constants";
import {
  StoryProjectError,
  type StoryProjectDetailDto,
  getProjectDetail,
} from "./story-project-service";

const FrameOutputSchema = z.object({
  frames: z
    .array(
      z.object({
        index: z.number().int().positive(),
        sceneText: z.string().min(1).max(40),
        sceneDescription: z.string().min(20).max(800),
        characterNames: z.array(z.string().min(1)).default([]),
        imagePrompt: z.string().min(20).max(1500),
        videoPrompt: z.string().min(10).max(800),
      }),
    )
    .min(1)
    .max(20),
});

export type GenerateStoryboardArgs = {
  count?: number;
  force?: boolean;
};

export async function generateStoryboardForProject(
  userId: string,
  projectId: string,
  args: GenerateStoryboardArgs,
): Promise<StoryProjectDetailDto> {
  const project = await prisma.storyProject.findFirst({
    where: { id: projectId, userId, deletedAt: null },
    include: {
      characters: { orderBy: { sortOrder: "asc" } },
      frames: { select: { id: true, imageUrl: true, videoUrl: true } },
    },
  });
  if (!project) {
    throw new StoryProjectError("NOT_FOUND", "project not found", 404);
  }

  // 校验 count
  const requested = args.count ?? STORY_AI_DEFAULT_FRAME_COUNT;
  if (
    !STORY_AI_FRAME_COUNT_OPTIONS.includes(requested as StoryAiFrameCount)
  ) {
    throw new StoryProjectError(
      "INVALID_INPUT",
      `count must be one of ${STORY_AI_FRAME_COUNT_OPTIONS.join(",")}`,
    );
  }
  const count = requested as StoryAiFrameCount;

  if (!project.storyOutline.trim()) {
    throw new StoryProjectError(
      "MISSING_DEPENDENCY",
      "story outline not ready (please initialize first)",
      409,
    );
  }
  if (project.characters.length === 0) {
    throw new StoryProjectError(
      "MISSING_DEPENDENCY",
      "characters not ready (please initialize first)",
      409,
    );
  }

  if (project.frames.length > 0 && !args.force) {
    throw new StoryProjectError(
      "TASK_ALREADY_INFLIGHT",
      "storyboard already exists; pass force=true to regenerate",
      409,
    );
  }

  const style = getStoryStyleById(project.styleId);
  const styleHint = style ? `${style.name_cn} · ${style.prompt}` : "";

  const llm = await chatJson({
    schema: FrameOutputSchema,
    reasoningEffort: "low",
    systemPrompt: [
      "你是漫剧分镜师。请根据故事大纲与角色列表，生成恰好 N 个分镜（N 由 user 给出）。",
      "仅返回 JSON：",
      `{"frames":[{"index":1,"sceneText":"<=30 字场景标题","sceneDescription":"100~250 字：景别（特写/中景/全景）、地点、时间、角色站位、动作/对白氛围","characterNames":["..."],"imagePrompt":"用于生成单镜静态图的中英文混排 prompt：构图/机位/动作/表情/关键道具/色调，不含风格段","videoPrompt":"用于将该分镜图驱动成视频的运镜与动效描述：镜头如何移动、人物动起来、节奏，20~80 字"}]}`,
      "约束：",
      "1. frames 长度严格等于 N；",
      "2. characterNames 必须来自给定角色列表；找不到的角色不要写在 characterNames 里；",
      "3. 各分镜按时间顺序推进剧情（起承转合）；",
      "4. 不要在 imagePrompt / videoPrompt 中描述风格（风格由后端按 styleId 拼接）；",
      "5. imagePrompt 末尾追加一行 `[CONSISTENCY] keep characters' appearance consistent with reference avatars`。",
    ].join("\n"),
    userPrompt: [
      `项目名称：${project.name}`,
      `画幅比：${project.aspectRatio === "RATIO_16_9" ? "16:9" : "9:16"}`,
      styleHint ? `视觉风格参考：${styleHint}` : "",
      `分镜数量 N：${count}`,
      `角色列表：${project.characters.map((c) => `${c.name}（${c.role || "—"}）`).join("、")}`,
      `故事大纲：\n${project.storyOutline}`,
    ]
      .filter(Boolean)
      .join("\n"),
  });

  // 后处理：强制 index = 1..N、映射 characterNames -> id
  const characterByName = new Map(
    project.characters.map((c) => [c.name.trim(), c.id] as const),
  );

  const framesData = llm.frames.slice(0, count).map((f, i) => {
    const charIds = (f.characterNames ?? [])
      .map((n) => characterByName.get(n.trim()))
      .filter((id): id is string => Boolean(id));
    return {
      index: i + 1,
      sceneText: f.sceneText.trim(),
      sceneDescription: f.sceneDescription.trim(),
      characterIds: charIds,
      imagePrompt: f.imagePrompt.trim(),
      videoPrompt: f.videoPrompt.trim(),
    };
  });

  // 长度对不上：用最后一帧补位（极少见，但避免严格抛错破坏体验）
  while (framesData.length < count) {
    framesData.push({
      ...framesData[framesData.length - 1],
      index: framesData.length + 1,
    });
  }

  await prisma.$transaction(async (tx) => {
    if (project.frames.length > 0) {
      // 旧 frames 的 imageUrl/videoUrl 入清理队列
      const cleanupRows: Prisma.StoryOssCleanupQueueCreateManyInput[] = [];
      for (const f of project.frames) {
        if (f.imageUrl) {
          cleanupRows.push({
            source: `regenerate_storyboard:${project.id}`,
            projectId: project.id,
            ossUrl: f.imageUrl,
          });
        }
        if (f.videoUrl) {
          cleanupRows.push({
            source: `regenerate_storyboard:${project.id}`,
            projectId: project.id,
            ossUrl: f.videoUrl,
          });
        }
      }
      if (cleanupRows.length > 0) {
        await tx.storyOssCleanupQueue.createMany({ data: cleanupRows });
      }
      // 关联到 frame 的进行中任务直接 CANCELLED
      await tx.storyGenerationTask.updateMany({
        where: {
          projectId: project.id,
          frameId: { in: project.frames.map((f) => f.id) },
          status: { in: ["PENDING", "SUBMITTED"] },
        },
        data: { status: "CANCELLED", completedAt: new Date() },
      });
      await tx.storyStoryboardFrame.deleteMany({
        where: { projectId: project.id },
      });
    }
    await tx.storyStoryboardFrame.createMany({
      data: framesData.map((f) => ({
        projectId: project.id,
        index: f.index,
        sceneText: f.sceneText,
        sceneDescription: f.sceneDescription,
        characterIds: f.characterIds,
        imagePrompt: f.imagePrompt,
        videoPrompt: f.videoPrompt,
      })),
    });
  });

  return getProjectDetail(userId, project.id);
}
