/**
 * 初始化漫剧项目：
 *   1. 大纲 LLM
 *   2. 角色 LLM（含外观）
 *   3. 落库 storyOutline + StoryCharacter
 *   4. （B3 扩展）为封面 + 角色头像创建 KIE 任务
 *
 * 详见 story-web/docs/ai/plan.md §5.2
 */
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { chatJson } from "./gemini-llm-client";
import { getStoryStyleById } from "./comic-styles";
import {
  StoryProjectError,
  type StoryProjectDetailDto,
  getProjectDetail,
} from "./story-project-service";
import { submitInitialMediaTasks } from "./story-task-service";

const OutlineSchema = z.object({
  outline: z.string().min(20),
});

const CharactersSchema = z.object({
  characters: z
    .array(
      z.object({
        name: z.string().min(1).max(40),
        role: z.string().max(40).default(""),
        description: z.string().max(400).default(""),
        appearance: z.string().min(5).max(800),
      }),
    )
    .min(1)
    .max(12),
});

function buildCharacterImagePrompt(appearance: string): string {
  return [
    `[CHARACTER] ${appearance}`,
    "[COMPOSITION] full body / half body portrait, neutral pose, looking at viewer",
    "[BACKGROUND] pure white background, no scene, no props, no text",
    "[QUALITY] high detail, crisp lines, consistent character design for series use",
  ].join("\n");
}

async function generateOutline(args: {
  userId: string;
  storyProjectId: string;
  name: string;
  description: string;
  styleHint: string;
}): Promise<string> {
  const data = await chatJson({
    userId: args.userId,
    storyProjectId: args.storyProjectId,
    schema: OutlineSchema,
    reasoningEffort: "low",
    maxTokens: 16000,
    systemPrompt: [
      "你是一名资深漫剧编剧。请按下列要求输出，仅返回 JSON：",
      '{"outline":"..."}',
      "约束：",
      "1. outline 无字数上限，须完整展开起承转合（开场 / 冲突 / 高潮 / 收束）；",
      "2. 末尾用一段「人物表」列出关键角色（2~6 个），每个角色一行：「角色名 · 一句话定位」；",
      "3. 不要使用 markdown 标题语法或代码块；",
      "4. outline 字段为纯文本，可包含换行（\\n）。",
    ].join("\n"),
    userPrompt: [
      `项目名称：${args.name}`,
      `项目描述：${args.description}`,
      args.styleHint ? `视觉风格参考：${args.styleHint}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  });
  return data.outline.trim();
}

/** 用户可选的角色数量（与前端 UI 选项保持一致） */
export const STORY_CHARACTER_COUNT_OPTIONS = [3, 5, 8] as const;
export type StoryCharacterCount = (typeof STORY_CHARACTER_COUNT_OPTIONS)[number];

async function generateCharacters(args: {
  userId: string;
  storyProjectId: string;
  name: string;
  description: string;
  outline: string;
  styleHint: string;
  count: StoryCharacterCount;
}): Promise<
  Array<{
    name: string;
    role: string;
    description: string;
    appearance: string;
  }>
> {
  const data = await chatJson({
    userId: args.userId,
    storyProjectId: args.storyProjectId,
    schema: CharactersSchema,
    reasoningEffort: "low",
    systemPrompt: [
      "你是一名漫剧角色设计师。给定故事大纲，请抽取所有出场角色，并为每个角色生成画像 prompt。",
      "仅返回 JSON：",
      '{"characters":[{"name":"中文姓名","role":"主角/配角/NPC","description":"<=150 字剧情向背景","appearance":"用于画像的纯外观描述：发型、瞳色、服饰、神态、年龄段、性别"}]}',
      "约束：",
      `1. characters 长度严格等于 ${args.count}，按重要性排序；如大纲角色不足，请合理补充配角/反派/NPC 凑齐；`,
      "2. appearance 必须是英文/中文混排的视觉描述，不含场景与道具，便于后续作为白底立绘的 prompt；",
      "3. 不要在 appearance 里描述风格（风格由后端按 styleId 拼接）；",
      "4. role 控制在 8 字以内；description 控制在 150 字以内。",
    ].join("\n"),
    userPrompt: [
      `项目名称：${args.name}`,
      `项目描述：${args.description}`,
      args.styleHint ? `视觉风格参考：${args.styleHint}` : "",
      `故事大纲：\n${args.outline}`,
      `请输出 ${args.count} 个角色。`,
    ]
      .filter(Boolean)
      .join("\n"),
  });
  // 严格按用户选择的 count 截断
  return data.characters.slice(0, args.count).map((c) => ({
    name: c.name.trim(),
    role: c.role?.trim() ?? "",
    description: c.description?.trim() ?? "",
    appearance: c.appearance.trim(),
  }));
}

export type InitializeResult = {
  project: StoryProjectDetailDto;
  /** 本次新增的 task ids；空表示已经初始化过（幂等再次调用） */
  newTaskIds: string[];
};

export type InitializeArgs = {
  /** 用户期望的角色数量；不传时默认 5 */
  characterCount?: StoryCharacterCount;
};

function normalizeCharacterCount(
  raw: number | undefined,
): StoryCharacterCount {
  if (
    typeof raw === "number" &&
    (STORY_CHARACTER_COUNT_OPTIONS as readonly number[]).includes(raw)
  ) {
    return raw as StoryCharacterCount;
  }
  return 5;
}

export async function initializeStoryProject(
  userId: string,
  projectId: string,
  args: InitializeArgs = {},
): Promise<InitializeResult> {
  const characterCount = normalizeCharacterCount(args.characterCount);
  const project = await prisma.storyProject.findFirst({
    where: { id: projectId, userId, deletedAt: null },
    include: { characters: true },
  });
  if (!project) {
    throw new StoryProjectError("NOT_FOUND", "project not found", 404);
  }

  const style = getStoryStyleById(project.styleId);
  const styleHint = style ? `${style.name_cn} · ${style.prompt}` : "";

  let outline = project.storyOutline;

  if (!outline.trim()) {
    outline = await generateOutline({
      userId,
      storyProjectId: project.id,
      name: project.name,
      description: project.description,
      styleHint,
    });
    await prisma.storyProject.update({
      where: { id: project.id },
      data: { storyOutline: outline, status: "INITIALIZING" },
    });
  } else if (project.status === "DRAFT") {
    await prisma.storyProject.update({
      where: { id: project.id },
      data: { status: "INITIALIZING" },
    });
  }

  if (project.characters.length === 0) {
    const characters = await generateCharacters({
      userId,
      storyProjectId: project.id,
      name: project.name,
      description: project.description,
      outline,
      styleHint,
      count: characterCount,
    });
    await prisma.storyCharacter.createMany({
      data: characters.map((c, idx) => ({
        projectId: project.id,
        name: c.name,
        role: c.role,
        description: c.description,
        imagePrompt: buildCharacterImagePrompt(c.appearance),
        sortOrder: idx,
      })),
    });
  }

  // B3 接通后由 submitInitialMediaTasks 提交封面 + 头像；现在它会创建 PENDING 任务并尝试调 KIE。
  const newTaskIds = await submitInitialMediaTasks(project.id);

  return {
    project: await getProjectDetail(userId, project.id),
    newTaskIds,
  };
}
