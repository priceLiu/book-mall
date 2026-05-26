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

export type StoryLlmSection = "outline" | "character" | "storyboard";

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

type StoryRefImageRow = { id: string; url?: string };

function parseMentionIds(prompt: string): string[] {
  const ids: string[] = [];
  const re = /@<([^>\s]+)>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(prompt)) !== null) {
    ids.push(m[1]!);
  }
  return ids;
}

function resolveStoryRowRefUrls(row: StoryRow, promptField = "prompt"): string[] {
  const prompt = String(row[promptField] ?? row.prompt ?? "");
  const refImages = row.refImages as StoryRefImageRow[] | undefined;
  if (refImages?.length) {
    const byId = new Map(
      refImages
        .filter((r) => r.url && /^https?:\/\//.test(String(r.url)))
        .map((r) => [r.id, String(r.url)]),
    );
    const fromMentions = parseMentionIds(prompt)
      .map((id) => byId.get(id))
      .filter((u): u is string => Boolean(u));
    if (fromMentions.length) return fromMentions;
    return Array.from(byId.values());
  }
  const legacy = row.refImageUrls;
  if (Array.isArray(legacy)) {
    return legacy.filter((u): u is string => typeof u === "string" && /^https?:\/\//.test(u));
  }
  return [];
}

/** 分镜视频：分镜图 + @ 角色参考图（分镜图始终在前，供 image-to-video） */
function collectStoryVideoImageInputs(row: StoryRow): string[] {
  const urls: string[] = [];
  const add = (raw: unknown) => {
    const u = String(raw ?? "").trim();
    if (!/^https?:\/\//.test(u)) return;
    if (!urls.includes(u)) urls.push(u);
  };
  add(row.frameImageUrl);
  for (const u of resolveStoryRowRefUrls(row, "videoPrompt")) add(u);
  return urls.slice(0, 8);
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
  const refUrls = resolveStoryRowRefUrls(row, "videoPrompt");
  const imageInputs = collectStoryVideoImageInputs(row);
  const promptBase = String(row.videoPrompt ?? "").trim() || "分镜视频";
  const prompt =
    imageInputs.length && refUrls.length
      ? `${promptBase}\n\n（以分镜图为主参考，保持构图与角色一致；@ 角色参考图辅助人设）`
      : imageInputs.length
        ? `${promptBase}\n\n（以分镜图为主参考生成视频，保持构图与角色一致）`
        : promptBase;
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
      },
      imageInputs,
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
