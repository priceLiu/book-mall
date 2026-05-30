/**
 * 漫剧四节点 · 文案中枢段 / 列行级 run
 */

import type { CanvasRunNodeInput } from "./canvas-task-service";
import {
  runImageEngineNode,
  runStoryLlmEngineNode,
  runTtsEngineNode,
  runVideoEngineNode,
  type RunEngineNodeArgs,
  type RunEngineNodeResult,
} from "./canvas-engine-runner";
import { assertStoryVideoFrameGate } from "./story-frame-gate";
import { resolveStoryRowRefUrls } from "./story-row-ref-urls";
import { resolveStoryProVideoRefUrls } from "./story-pro-video-ref-resolve";

type StoryLlmSection = "outline" | "character" | "storyboard";

export type { StoryLlmSection };

const SECTION_ENGINE: Record<
  StoryLlmSection,
  "story-outline-engine" | "character-engine" | "storyboard-engine"
> = {
  outline: "story-outline-engine",
  character: "character-engine",
  storyboard: "storyboard-engine",
};

const PROMPT_KEY: Record<StoryLlmSection, string> = {
  outline: "promptOutline",
  character: "promptCharacter",
  storyboard: "promptStoryboard",
};

type StoryRow = Record<string, unknown>;

/** 分镜视频：分镜图为主图；@ 三视图仅作参考（不替代主图） */
function collectStoryVideoImageInputs(row: StoryRow): {
  frameImageUrl: string;
  referenceImageUrls: string[];
} {
  const frameImageUrl = String(row.frameImageUrl ?? "").trim();
  const refUrls = resolveStoryRowRefUrls(row, "videoPrompt");
  const referenceImageUrls: string[] = [];
  for (const u of refUrls) {
    if (!/^https?:\/\//.test(u)) continue;
    if (u === frameImageUrl) continue;
    if (!referenceImageUrls.includes(u)) referenceImageUrls.push(u);
  }
  return {
    frameImageUrl,
    referenceImageUrls: referenceImageUrls.slice(0, 7),
  };
}

function pickRow(rows: StoryRow[], rowKey: string): StoryRow {
  const row = rows.find((r) => String(r.key ?? "") === rowKey);
  if (!row) {
    throw new Error(`找不到行 ${rowKey}`);
  }
  return row;
}

function hashSalt(args: {
  rowKey?: string;
  llmSection?: string;
  mediaKind?: string;
}): string {
  return [args.llmSection, args.rowKey, args.mediaKind].filter(Boolean).join(":");
}

/** 文案中枢 · 单段 LLM */
export async function runStoryScriptHubSection(
  args: RunEngineNodeArgs & { llmSection: StoryLlmSection },
): Promise<RunEngineNodeResult> {
  const data = args.node.data ?? {};
  const prompt = String(data[PROMPT_KEY[args.llmSection]] ?? data.prompt ?? "");
  const salt = hashSalt({ llmSection: args.llmSection });
  const node: CanvasRunNodeInput = {
    ...args.node,
    type: "story-outline-engine",
    data: {
      ...data,
      prompt: salt ? `${prompt}\n\n<!-- ${salt} -->` : prompt,
    },
  };
  return runStoryLlmEngineNode({
    ...args,
    storyScope: args.storyScope ?? { llmSection: args.llmSection },
    node,
    engineKind: SECTION_ENGINE[args.llmSection],
  });
}

/** 角色列 · 三视图 */
export async function runStoryCharacterColumnRow(
  args: RunEngineNodeArgs & { rowKey: string },
): Promise<RunEngineNodeResult> {
  const data = args.node.data ?? {};
  const rows = (data.rows as StoryRow[]) ?? [];
  const row = pickRow(rows, args.rowKey);
  const batch = (data.batchImage as Record<string, unknown>) ?? {};
  const providerId = String(batch.providerId ?? "");
  const modelKey = String(batch.modelKey ?? "");
  const params = (batch.params as Record<string, unknown>) ?? {};
  const prompt = String(row.prompt ?? "");
  const salt = hashSalt({ rowKey: args.rowKey, mediaKind: "threeView" });

  return runImageEngineNode({
    ...args,
    storyScope: args.storyScope ?? {
      rowKey: args.rowKey,
      mediaKind: "threeView",
    },
    node: {
      type: "three-view-engine",
      modelKey,
      data: {
        providerId,
        modelKey,
        params,
        prompt: `${prompt}\n\n<!-- ${salt} -->`,
        characterName: row.name,
      },
      imageInputs: [],
      textInputs: args.node.textInputs,
    },
  });
}

/** 分镜列 · 静帧 */
export async function runStoryFrameColumnRow(
  args: RunEngineNodeArgs & { rowKey: string },
): Promise<RunEngineNodeResult> {
  const data = args.node.data ?? {};
  const rows = (data.rows as StoryRow[]) ?? [];
  const row = pickRow(rows, args.rowKey);
  const batch = (data.batchImage as Record<string, unknown>) ?? {};
  const providerId = String(batch.providerId ?? "");
  const modelKey = String(batch.modelKey ?? "");
  const params = (batch.params as Record<string, unknown>) ?? {};
  const prompt = String(row.prompt ?? "");
  const refUrls = resolveStoryRowRefUrls(row);
  const salt = hashSalt({ rowKey: args.rowKey, mediaKind: "frameImage" });

  return runImageEngineNode({
    ...args,
    storyScope: args.storyScope ?? {
      rowKey: args.rowKey,
      mediaKind: "frameImage",
    },
    node: {
      type: "image-engine",
      modelKey,
      data: {
        providerId,
        modelKey,
        params,
        prompt: `${prompt}\n\n<!-- ${salt} -->`,
        frameIndex: row.frameIndex,
        frameDialogue: row.dialogue,
        frameVideoPrompt: row.videoPrompt,
      },
      imageInputs: refUrls.slice(0, 8),
      textInputs: args.node.textInputs,
    },
  });
}

/** 视频列 · 视频 */
export async function runStoryVideoColumnVideoRow(
  args: RunEngineNodeArgs & { rowKey: string },
): Promise<RunEngineNodeResult> {
  const data = args.node.data ?? {};
  const rows = (data.rows as StoryRow[]) ?? [];
  const row = pickRow(rows, args.rowKey);
  const batch = (data.batchVideo as Record<string, unknown>) ?? {};
  const providerId = String(batch.providerId ?? "");
  const modelKey = String(batch.modelKey ?? "");
  const params = (batch.params as Record<string, unknown>) ?? {};
  const refUrls = await resolveStoryProVideoRefUrls(
    args.userId,
    args.projectId,
    row,
    "videoPrompt",
  );
  const frameImageUrl = assertStoryVideoFrameGate(row);
  const referenceImageUrls: string[] = [];
  for (const u of refUrls) {
    if (!/^https?:\/\//.test(u)) continue;
    if (u === frameImageUrl) continue;
    if (!referenceImageUrls.includes(u)) referenceImageUrls.push(u);
  }
  referenceImageUrls.splice(7);
  const promptBase = String(row.videoPrompt ?? "").trim() || "分镜视频";
  const prompt =
    referenceImageUrls.length && refUrls.length
      ? `${promptBase}\n\n（以分镜图为主参考，保持构图与角色一致；@ 角色三视图仅辅助人设）`
      : `${promptBase}\n\n（以分镜图为主参考生成视频，保持构图与角色一致）`;
  const salt = hashSalt({ rowKey: args.rowKey, mediaKind: "video" });

  return runVideoEngineNode({
    ...args,
    storyScope: args.storyScope ?? {
      rowKey: args.rowKey,
      mediaKind: "video",
    },
    node: {
      type: "video-engine",
      modelKey,
      data: {
        providerId,
        modelKey,
        params,
        prompt: `${prompt}\n\n<!-- ${salt} -->`,
        frameIndex: row.frameIndex,
        mainFrameImageUrl: frameImageUrl,
        referenceImageUrls,
      },
      imageInputs: [frameImageUrl, ...referenceImageUrls],
      textInputs: [],
    },
  });
}

/** 视频列 · TTS */
export async function runStoryVideoColumnTtsRow(
  args: RunEngineNodeArgs & { rowKey: string },
): Promise<RunEngineNodeResult> {
  const data = args.node.data ?? {};
  const rows = (data.rows as StoryRow[]) ?? [];
  const row = pickRow(rows, args.rowKey);
  const batch = (data.batchTts as Record<string, unknown>) ?? {};
  const providerId = String(batch.providerId ?? "");
  const modelKey = String(batch.modelKey ?? "tts-1");
  const params = (batch.params as Record<string, unknown>) ?? {};
  const text = String(
    row.ttsPrompt ?? row.dialogue ?? "",
  ).trim();
  const salt = hashSalt({ rowKey: args.rowKey, mediaKind: "tts" });

  return runTtsEngineNode({
    ...args,
    storyScope: args.storyScope ?? {
      rowKey: args.rowKey,
      mediaKind: "tts",
    },
    node: {
      type: "tts-engine",
      modelKey,
      data: {
        providerId,
        modelKey,
        params,
        text: salt ? `${text}\n\n<!-- ${salt} -->` : text,
        frameIndex: row.frameIndex,
      },
      imageInputs: [],
      textInputs: [],
    },
  });
}
