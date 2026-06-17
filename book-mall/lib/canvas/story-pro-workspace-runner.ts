/**
 * 影视专业版 · 文案/列 run（Gateway only）
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
import { prependStoryProStyleAnchor } from "./story-pro-style-anchor";
import { assertStoryVideoFrameGate } from "./story-frame-gate";
import { resolveStoryRowRefUrls, parseMentionIds } from "./story-row-ref-urls";
import { resolveStoryProVideoRefUrls } from "./story-pro-video-ref-resolve";
import { resolveCharacterRowAssetRefUrls } from "./story-pro-character-ref-resolve";
import { buildStoryProFrameImageInputs } from "./story-pro-frame-image-inputs";
import {
  STORY_PRO2_THEME_OUTLINE_SYSTEM,
  STORY_PRO2_THEME_OUTLINE_USER_PREFIX,
} from "./story-pro2-theme-outline-prompt";

function proClientPage(projectId: string): string {
  return `canvas/${projectId}/story-pro`;
}

export type StoryProLlmSection = "outline" | "character" | "scene" | "storyboard";

const PROMPT_KEY: Record<StoryProLlmSection, string> = {
  outline: "promptOutline",
  character: "promptCharacter",
  scene: "promptScene",
  storyboard: "promptStoryboard",
};

type StoryRow = Record<string, unknown>;

function pickRow(rows: StoryRow[], rowKey: string): StoryRow {
  const row = rows.find((r) => String(r.key ?? "") === rowKey);
  if (!row) throw new Error(`找不到行 ${rowKey}`);
  return row;
}

function hashSalt(args: {
  rowKey?: string;
  llmSection?: string;
  mediaKind?: string;
}): string {
  return [args.llmSection, args.rowKey, args.mediaKind].filter(Boolean).join(":");
}

/** 2.0 文本节点 · 主题 → 故事大纲（第一步，不创建脚本节点） */
export async function runStoryProStarterThemeOutline(
  args: RunEngineNodeArgs,
): Promise<RunEngineNodeResult> {
  const data = args.node.data ?? {};
  const theme =
    (typeof data.themeInput === "string" ? data.themeInput : "").trim() ||
    (args.node.textInputs ?? []).filter(Boolean).join("\n\n").trim();
  if (!theme) {
    throw new Error("请先填写故事主题或内容");
  }
  const system =
    (typeof data.themeOutlineSystemPrompt === "string"
      ? data.themeOutlineSystemPrompt
      : ""
    ).trim() || STORY_PRO2_THEME_OUTLINE_SYSTEM;
  const node: CanvasRunNodeInput = {
    ...args.node,
    type: "story-outline-engine",
    data: {
      ...data,
      prompt: `${STORY_PRO2_THEME_OUTLINE_USER_PREFIX}\n\n${theme}`,
      systemPrompt: system,
    },
  };
  return runStoryLlmEngineNode({
    ...args,
    clientPage: proClientPage(args.projectId),
    storyScope: args.storyScope ?? { mediaKind: "themeOutline" },
    node,
    engineKind: "story-outline-engine",
  });
}

export async function runStoryProScriptHubSection(
  args: RunEngineNodeArgs & {
    llmSection: StoryProLlmSection;
    styleAnchor?: Parameters<typeof prependStoryProStyleAnchor>[1];
  },
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
    clientPage: proClientPage(args.projectId),
    storyScope: args.storyScope ?? { llmSection: args.llmSection },
    node,
    engineKind: "story-outline-engine",
  });
}

const STORY_PRO_STYLE_DRAFT_SYSTEM = `你是视觉导演。根据剧本题材与基调，输出 JSON：
{
  "mainStyle": "anime|american-comic|webtoon|chibi|cg|photorealistic|game-cg|chinese-3d|other",
  "colorTone": "bright-warm|dark-moody|vivid|soft|high-contrast",
  "renderQuality": "flat|thick-paint|watercolor|oil",
  "styleAnchorZh": "中文风格锚定段落",
  "styleAnchorEn": "English style anchor paragraph",
  "negativePrompt": "comma separated negatives"
}`;

export async function runStoryProStyleDraft(
  args: RunEngineNodeArgs,
): Promise<RunEngineNodeResult> {
  const data = args.node.data ?? {};
  const outline = (args.node.textInputs ?? []).filter(Boolean).join("\n\n");
  const node: CanvasRunNodeInput = {
    ...args.node,
    type: "ai-engine",
    data: {
      ...data,
      prompt: `【系统任务】\n${STORY_PRO_STYLE_DRAFT_SYSTEM}\n\n根据已连接的故事大纲，输出影视专业版风格定义 JSON（仅输出 JSON 对象，不要 markdown 说明）。\n\n--- 故事大纲 ---\n${outline || "（未连接故事剧本或无大纲正文）"}`,
    },
  };
  return runAiEngineNodeFromArgs(args, node);
}

async function runAiEngineNodeFromArgs(
  args: RunEngineNodeArgs,
  node: CanvasRunNodeInput,
): Promise<RunEngineNodeResult> {
  const { runAiEngineNode } = await import("./canvas-engine-runner");
  return runAiEngineNode({
    ...args,
    clientPage: proClientPage(args.projectId),
    node,
  });
}

export async function runStoryProCharacterRow(
  args: RunEngineNodeArgs & {
    rowKey: string;
    styleAnchor?: Parameters<typeof prependStoryProStyleAnchor>[1];
  },
): Promise<RunEngineNodeResult> {
  const rows = (args.node.data?.rows as StoryRow[]) ?? [];
  const row = pickRow(rows, args.rowKey);
  const rawPrompt = String(row.prompt ?? "");
  const prompt = prependStoryProStyleAnchor(rawPrompt, args.styleAnchor);
  const assetRefUrls = await resolveCharacterRowAssetRefUrls(
    args.userId,
    args.projectId,
    {
      key: String(row.key ?? ""),
      lockedRefIds: row.lockedRefIds as string[] | undefined,
    },
    { excludeThreeView: true },
  );
  const clientUrls = (args.node.imageInputs ?? []).filter(
    (u): u is string => typeof u === "string" && /^https?:\/\//.test(u),
  );
  const imageInputs =
    parseMentionIds(rawPrompt).length > 0 && clientUrls.length > 0
      ? clientUrls.slice(0, 8)
      : assetRefUrls;
  const node: CanvasRunNodeInput = {
    ...args.node,
    type: "three-view-engine",
    data: {
      providerId: args.node.data?.batchImage
        ? (args.node.data.batchImage as { providerId?: string }).providerId
        : args.node.data?.providerId,
      modelKey: args.node.data?.batchImage
        ? (args.node.data.batchImage as { modelKey?: string }).modelKey
        : args.node.data?.modelKey,
      prompt,
      params: (args.node.data?.batchImage as { params?: Record<string, unknown> })
        ?.params,
    },
    imageInputs,
  };
  return runImageEngineNode({
    ...args,
    clientPage: proClientPage(args.projectId),
    storyScope: { rowKey: args.rowKey, mediaKind: "threeView" },
    node,
  });
}

export async function runStoryProSceneRow(
  args: RunEngineNodeArgs & {
    rowKey: string;
    styleAnchor?: Parameters<typeof prependStoryProStyleAnchor>[1];
  },
): Promise<RunEngineNodeResult> {
  const rows = (args.node.data?.rows as StoryRow[]) ?? [];
  const row = pickRow(rows, args.rowKey);
  const prompt = prependStoryProStyleAnchor(String(row.prompt ?? ""), args.styleAnchor);
  const node: CanvasRunNodeInput = {
    ...args.node,
    type: "image-engine",
    data: {
      prompt,
      providerId: (args.node.data?.batchImage as { providerId?: string })?.providerId,
      modelKey: (args.node.data?.batchImage as { modelKey?: string })?.modelKey,
      params: (args.node.data?.batchImage as { params?: Record<string, unknown> })
        ?.params,
    },
  };
  return runImageEngineNode({
    ...args,
    clientPage: proClientPage(args.projectId),
    storyScope: { rowKey: args.rowKey, mediaKind: "sceneRef" },
    node,
  });
}

export async function runStoryProFrameRow(
  args: RunEngineNodeArgs & {
    rowKey: string;
    styleAnchor?: Parameters<typeof prependStoryProStyleAnchor>[1];
  },
): Promise<RunEngineNodeResult> {
  const rows = (args.node.data?.rows as StoryRow[]) ?? [];
  const row = pickRow(rows, args.rowKey);
  const nodeData = args.node.data ?? {};
  const { imageInputs, promptSuffix } = buildStoryProFrameImageInputs({
    row,
    nodeData,
    clientImageInputs: args.node.imageInputs,
  });
  let prompt = prependStoryProStyleAnchor(String(row.prompt ?? ""), args.styleAnchor);
  if (promptSuffix) prompt = `${prompt}\n\n${promptSuffix}`;
  const batch = (nodeData.batchImage as Record<string, unknown>) ?? {};
  const node: CanvasRunNodeInput = {
    ...args.node,
    type: "image-engine",
    data: {
      prompt,
      providerId: batch.providerId,
      modelKey: batch.modelKey,
      params: batch.params,
    },
    imageInputs,
  };
  return runImageEngineNode({
    ...args,
    clientPage: proClientPage(args.projectId),
    storyScope: { rowKey: args.rowKey, mediaKind: "frameImage" },
    node,
  });
}

export async function runStoryProVideoRow(
  args: RunEngineNodeArgs & {
    rowKey: string;
    styleAnchor?: Parameters<typeof prependStoryProStyleAnchor>[1];
  },
): Promise<RunEngineNodeResult> {
  const rows = (args.node.data?.rows as StoryRow[]) ?? [];
  const row = pickRow(rows, args.rowKey);
  const frameImageUrl = assertStoryVideoFrameGate(row);
  const refUrls = await resolveStoryProVideoRefUrls(
    args.userId,
    args.projectId,
    row,
    "videoPrompt",
  );
  const referenceImageUrls = refUrls
    .filter((u) => u !== frameImageUrl)
    .slice(0, 7);
  const videoPrompt = prependStoryProStyleAnchor(
    String(row.videoPrompt ?? row.dialogue ?? ""),
    args.styleAnchor,
  );
  const node: CanvasRunNodeInput = {
    ...args.node,
    type: "video-engine",
    data: {
      prompt: videoPrompt,
      providerId: (args.node.data?.batchVideo as { providerId?: string })?.providerId,
      modelKey: (args.node.data?.batchVideo as { modelKey?: string })?.modelKey,
      params: (args.node.data?.batchVideo as { params?: Record<string, unknown> })
        ?.params,
      frameImageUrl,
      mainFrameImageUrl: frameImageUrl,
      referenceImageUrls,
    },
    imageInputs: [frameImageUrl, ...referenceImageUrls],
  };
  return runVideoEngineNode({
    ...args,
    clientPage: proClientPage(args.projectId),
    storyScope: { rowKey: args.rowKey, mediaKind: "video" },
    node,
  });
}

export async function runStoryProTtsRow(
  args: RunEngineNodeArgs & { rowKey: string },
): Promise<RunEngineNodeResult> {
  const rows = (args.node.data?.rows as StoryRow[]) ?? [];
  const row = pickRow(rows, args.rowKey);
  const node: CanvasRunNodeInput = {
    ...args.node,
    type: "tts-engine",
    data: {
      text: String(row.ttsPrompt ?? row.dialogue ?? ""),
      providerId: (args.node.data?.batchTts as { providerId?: string })?.providerId,
      modelKey: (args.node.data?.batchTts as { modelKey?: string })?.modelKey,
      params: (args.node.data?.batchTts as { params?: Record<string, unknown> })?.params,
    },
  };
  return runTtsEngineNode({
    ...args,
    clientPage: proClientPage(args.projectId),
    storyScope: { rowKey: args.rowKey, mediaKind: "tts" },
    node,
  });
}
