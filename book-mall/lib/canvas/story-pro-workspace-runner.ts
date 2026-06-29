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
import { normalizePortraitAssetRefs } from "./canvas-portrait-import-service";
import { assertStoryVideoFrameGate } from "./story-frame-gate";
import { resolveStoryRowRefUrls, parseMentionIds } from "./story-row-ref-urls";
import { resolveStoryProVideoRefUrls } from "./story-pro-video-ref-resolve";
import { resolveCharacterRowAssetRefUrls } from "./story-pro-character-ref-resolve";
import { buildStoryProFrameImageInputs } from "./story-pro-frame-image-inputs";
import {
  STORY_PRO2_THEME_OUTLINE_SYSTEM,
  STORY_PRO2_THEME_OUTLINE_USER_PREFIX,
} from "./story-pro2-theme-outline-prompt";
import {
  buildScriptStudioContinuationPrompt,
  buildScriptStudioFirstRoundPrompt,
  scriptStudioBatchRange,
} from "./script-studio-prompts";
import { isPro2GeneralTextNode, isPro2StoryOutlineTextNode } from "./pro2-text-purpose";
import { assertStoryLlmVisionModel } from "./story-llm-vision-models";

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

/** 2.0 文本/脚本节点 · 主题 → 工业化剧本批次（不自动 spawn 下游列） */
export async function runStoryProStarterThemeOutline(
  args: RunEngineNodeArgs,
): Promise<RunEngineNodeResult> {
  const data = args.node.data ?? {};
  const isHub = args.node.type === "story-pro-script-hub";
  const scriptStudioMode = data.scriptStudioMode === true;
  const theme =
    (typeof data.scriptStudioThemeInput === "string"
      ? data.scriptStudioThemeInput
      : ""
    ).trim() ||
    (typeof data.themeInput === "string" ? data.themeInput : "").trim() ||
    (args.node.textInputs ?? []).filter(Boolean).join("\n\n").trim();
  if (!theme) {
    throw new Error("请先填写故事主题或内容");
  }
  if (!scriptStudioMode && !isPro2StoryOutlineTextNode(data)) {
    throw new Error(
      "该文本节点用于提示词/下游引用，不会走故事大纲链路；请使用故事大纲模式的文本节点",
    );
  }
  if (isHub && !scriptStudioMode) {
    throw new Error("该脚本节点未开启工业化剧本创作模式");
  }

  let prompt: string;
  let system: string;

  if (scriptStudioMode) {
    const totalEpisodes = Number(data.scriptStudioTotalEpisodes) || 30;
    const batchIndex = Number(data.scriptStudioBatchIndex) || 0;
    const systemKind =
      data.scriptStudioSystem === "adaptation" ? "adaptation" : "original";
    const inputMode =
      data.scriptStudioInputMode === "upload" || data.starterMode === "upload"
        ? "upload"
        : "generate";
    const rawScript =
      inputMode === "upload"
        ? String(data.uploadedScriptMd ?? "").trim()
        : undefined;
    if (batchIndex <= 0) {
      prompt = buildScriptStudioFirstRoundPrompt({
        system: systemKind,
        totalEpisodes,
        genre: theme,
        rawScript,
      });
    } else {
      const { start, end } = scriptStudioBatchRange(batchIndex, totalEpisodes);
      const frozen = String(data.scriptStudioFrozenBiblesMd ?? "").trim();
      const completed = String(data.scriptStudioCompletedBatchesMd ?? "").trim();
      const continuation = buildScriptStudioContinuationPrompt({
        system: systemKind,
        totalEpisodes,
        batchStart: start,
        batchEnd: end,
        rawScript,
      });
      prompt = [frozen, completed, continuation].filter(Boolean).join("\n\n");
    }
    system =
      "你是资深工业影视总编剧，严格执行用户消息中的工业化剧本生产规范；输出 Markdown，不要 JSON。";
  } else {
    system =
      (typeof data.themeOutlineSystemPrompt === "string"
        ? data.themeOutlineSystemPrompt
        : ""
      ).trim() || STORY_PRO2_THEME_OUTLINE_SYSTEM;
    prompt = `${STORY_PRO2_THEME_OUTLINE_USER_PREFIX}\n\n${theme}`;
  }

  const node: CanvasRunNodeInput = {
    ...args.node,
    type: "story-outline-engine",
    data: {
      ...data,
      prompt,
      systemPrompt: system,
    },
  };
  return runStoryLlmEngineNode({
    ...args,
    clientPage: proClientPage(args.projectId),
    storyScope: args.storyScope ?? { mediaKind: "themeOutline" },
    node,
    engineKind: "story-outline-engine",
    executeAsync: args.executeAsync ?? true,
  });
}

const STORY_PRO2_GENERAL_TEXT_SYSTEM =
  "你是专业内容创作助手。严格按用户消息中的指令完成任务，直接输出结果正文，不要多余解释或寒暄。";

const STORY_PRO2_IMAGE_TO_PROMPT_SYSTEM =
  "你是专业视觉提示词工程师。根据用户附带的参考图片，反推一份可直接用于 AI 生图的详细中文提示词。只输出提示词正文，不要解释或寒暄。";

const STORY_PRO2_IMAGE_TO_PROMPT_USER =
  "请根据所附图片反推一份详细的生图提示词。";

/** 2.0 文本节点 · general 模式：按 Dock 提示词调用 LLM，结果写入节点卡片 */
export async function runStoryProStarterGeneralText(
  args: RunEngineNodeArgs,
): Promise<RunEngineNodeResult> {
  const data = args.node.data ?? {};
  if (!isPro2GeneralTextNode(data)) {
    throw new Error(
      "该文本节点用于故事大纲，请使用故事大纲生成；general 模式节点才走提示词 LLM",
    );
  }
  const imageUrls = (args.node.imageInputs ?? []).filter(
    (u): u is string => typeof u === "string" && /^https?:\/\//.test(u),
  );
  let prompt =
    (typeof data.themeInput === "string" ? data.themeInput : "").trim() ||
    (args.node.textInputs ?? []).filter(Boolean).join("\n\n").trim();
  const preset = String(data.pro2PresetKind ?? "").trim();
  if (!prompt && preset === "image-to-prompt" && imageUrls.length > 0) {
    prompt = STORY_PRO2_IMAGE_TO_PROMPT_USER;
  }
  if (!prompt && imageUrls.length === 0) {
    throw new Error("请先填写提示词内容，或链接并上传参考图片");
  }

  const modelKey = String(data.modelKey ?? args.node.modelKey ?? "").trim();
  if (imageUrls.length > 0) {
    assertStoryLlmVisionModel(modelKey, "图片反推提示词");
  }

  const customSystem =
    (typeof data.generalTextSystemPrompt === "string"
      ? data.generalTextSystemPrompt
      : typeof data.systemPrompt === "string"
        ? data.systemPrompt
        : ""
    ).trim() ||
    (preset === "image-to-prompt" && imageUrls.length > 0
      ? STORY_PRO2_IMAGE_TO_PROMPT_SYSTEM
      : STORY_PRO2_GENERAL_TEXT_SYSTEM);

  const node: CanvasRunNodeInput = {
    ...args.node,
    type: "story-outline-engine",
    data: {
      ...data,
      prompt,
      systemPrompt: customSystem,
    },
  };
  return runStoryLlmEngineNode({
    ...args,
    clientPage: proClientPage(args.projectId),
    storyScope: args.storyScope ?? { mediaKind: "generalText" },
    node,
    engineKind: "story-outline-engine",
    executeAsync: args.executeAsync ?? true,
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
    executeAsync: args.executeAsync ?? true,
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
  const portraitAssetRefs = normalizePortraitAssetRefs(
    args.node.portraitAssetRefs ?? args.node.data?.portraitAssetRefs,
  );
  const node: CanvasRunNodeInput = {
    ...args.node,
    type: "video-engine",
    portraitAssetRefs,
    data: {
      prompt: videoPrompt,
      providerId: (args.node.data?.batchVideo as { providerId?: string })?.providerId,
      modelKey: (args.node.data?.batchVideo as { modelKey?: string })?.modelKey,
      params: (args.node.data?.batchVideo as { params?: Record<string, unknown> })
        ?.params,
      frameImageUrl,
      mainFrameImageUrl: frameImageUrl,
      referenceImageUrls,
      forceReferenceMode: portraitAssetRefs.length > 0,
      portraitAssetRefs,
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
