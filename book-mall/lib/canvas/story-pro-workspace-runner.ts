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

function proClientPage(projectId: string): string {
  return `canvas/${projectId}/story-pro`;
}

export type StoryProLlmSection = "outline" | "character" | "storyboard";

const PROMPT_KEY: Record<StoryProLlmSection, string> = {
  outline: "promptOutline",
  character: "promptCharacter",
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

export async function runStoryProStyleDraft(
  args: RunEngineNodeArgs,
): Promise<RunEngineNodeResult> {
  const data = args.node.data ?? {};
  const node: CanvasRunNodeInput = {
    ...args.node,
    type: "ai-engine",
    data: {
      ...data,
      prompt:
        "根据已连接的故事大纲，生成影视专业版风格定义 JSON（mainStyle,colorTone,renderQuality,styleAnchorZh,styleAnchorEn,negativePrompt）。",
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
  const prompt = prependStoryProStyleAnchor(String(row.prompt ?? ""), args.styleAnchor);
  const node: CanvasRunNodeInput = {
    ...args.node,
    type: "image-engine",
    data: {
      prompt,
      providerId: (args.node.data?.batchVideo as { providerId?: string })?.providerId,
      modelKey: (args.node.data?.batchVideo as { modelKey?: string })?.modelKey,
      params: (args.node.data?.batchVideo as { params?: Record<string, unknown> })
        ?.params,
    },
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
      frameImageUrl: row.frameImageUrl,
    },
    imageInputs: row.frameImageUrl ? [String(row.frameImageUrl)] : [],
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
