import type { Edge, Node, Viewport } from "@xyflow/react";
import {
  AI_ENGINE_PROMPT_TEMPLATE,
  IMAGE_ENGINE_PROMPT_TEMPLATE_DEFAULT,
  THREE_VIEW_ENGINE_PROMPT_DEFAULT,
} from "./builtin-prompt-templates";
import {
  STORY_CHARACTER_ENGINE_PROMPT,
  STORY_FRAME_IMAGE_PROMPT_DEFAULT,
  STORY_OUTLINE_ENGINE_PROMPT,
  STORY_OUTLINE_LLM_PARAMS,
  STORY_OUTLINE_USER_PROMPT,
  STORY_STORYBOARD_ENGINE_PROMPT,
  STORY_THEME_SYSTEM_PROMPT_DEFAULT,
  STORY_THEME_SYSTEM_PROMPT_TEMPLATES,
  type StoryThemeSystemPromptTemplateId,
  STORY_VIDEO_ENGINE_PROMPT_DEFAULT,
} from "./story-prompts";
import {
  STORY_PRO_CHARACTER_PROMPT,
  STORY_PRO_OUTLINE_USER_PROMPT,
  STORY_PRO_STORYBOARD_PROMPT,
  STORY_PRO_HUB_LLM_SYSTEM,
  STORY_PRO_LLM_PARAMS_DEFAULT,
  STORY_PRO_THEME_SYSTEM_PROMPT_DEFAULT,
} from "./story-pro-prompts";
import {
  STORY_PRO2_CHARACTER_PROMPT,
  STORY_PRO2_HUB_OUTLINE_FROM_THEME_PROMPT,
  STORY_PRO2_PACK_PROMPT_VERSION,
  STORY_PRO2_SCENE_PROMPT,
  STORY_PRO2_STORYBOARD_PROMPT,
} from "./story-pro2-theme-outline-prompt";
import {
  STORY_CONTROL_NODE_HEIGHT,
  STORY_CONTROL_NODE_WIDTH,
} from "./story-node-chrome";
import {
  PRO2_COLUMN_CARD_HEIGHT,
  PRO2_COLUMN_CARD_WIDTH,
  PRO2_CONTROL_CARD_HEIGHT,
  PRO2_CONTROL_CARD_WIDTH,
  PRO2_TEXT_NODE_HEIGHT,
  PRO2_TEXT_NODE_WIDTH,
  PRO2_IMAGE_NODE_HEIGHT,
  PRO2_CHARACTER_THREE_VIEW_HEIGHT,
  PRO2_CHARACTER_THREE_VIEW_WIDTH,
  PRO2_IMAGE_NODE_WIDTH,
  PRO2_SCRIPT_NODE_HEIGHT,
  PRO2_SCRIPT_NODE_WIDTH,
  PRO2_FRAME_BOARD_HEIGHT,
  PRO2_FRAME_BOARD_WIDTH,
} from "./story-pro2-node-chrome";
import {
  SBV1_DEFAULT_IMAGE_NODE_DATA,
  SBV1_DEFAULT_VIDEO_ENGINE_DATA,
} from "./sbv1-workspace-types";
import {
  SBV1_IMAGE_NODE_HEIGHT,
  SBV1_IMAGE_NODE_WIDTH,
  SBV1_VIDEO_ENGINE_HEIGHT,
  SBV1_VIDEO_ENGINE_WIDTH,
} from "./sbv1-node-chrome";
import {
  REF_GRID_NODE_SIZE,
  REF_VIDEO_DEFAULT_MODEL_KEY,
  REF_VIDEO_MODEL_META,
  REF_VIDEO_NODE_SIZE,
  emptyRefGridSlots,
} from "./ref-video-models";

export {
  AI_ENGINE_PROMPT_TEMPLATE,
  AI_ENGINE_PROMPT_TEMPLATE_V2,
  IMAGE_ENGINE_PROMPT_TEMPLATE_DEFAULT,
  THREE_VIEW_ENGINE_PROMPT_DEFAULT,
  THREE_VIEW_ENGINE_MODEL_KEYS,
} from "./builtin-prompt-templates";

export {
  STORY_OUTLINE_ENGINE_PROMPT,
  STORY_OUTLINE_USER_PROMPT,
  STORY_CHARACTER_ENGINE_PROMPT,
  STORY_STORYBOARD_ENGINE_PROMPT,
  STORY_THEME_SYSTEM_PROMPT_DEFAULT,
  STORY_THEME_SYSTEM_PROMPT_TEMPLATES,
  type StoryThemeSystemPromptTemplateId,
  STORY_LLM_MODEL_KEYS,
  STORY_VIDEO_MODEL_KEYS,
  STORY_PRO_VIDEO_MODEL_KEYS,
  STORY_PRO_VIDEO_BAILIAN_MODEL_KEYS,
  STORY_PRO_VIDEO_VOLCENGINE_MODEL_KEYS,
  STORY_PRO_FRAME_IMAGE_MODEL_KEYS,
  STORY_PRO_FRAME_IMAGE_SINGLE_REF_MODEL_KEYS,
  STORY_TTS_MODEL_KEYS,
} from "./story-prompts";

/**
 * 节点类型清单（v2 · 已清理 v1）
 * - 旧 `ai-text` / `image-gen` / `product-params` 由 lib/canvas/migrate.ts 在 hydrate 时
 *   in-memory 转成 `ai-engine` / `image-engine` / `text`，渲染层不再需要识别
 * - `group` 为容器，不参与拓扑
 */
export type CanvasNodeType =
  | "image"
  | "text"
  | "story-comic-starter"
  | "story-script-hub"
  | "story-character-column"
  | "story-frame-column"
  | "story-video-column"
  | "story-pro2-starter"
  | "story-pro2-image"
  | "story-pro2-three-view"
  | "story-pro2-script-hub"
  | "story-pro2-style"
  | "story-pro2-style-asset"
  | "story-pro2-character"
  | "story-pro2-scene"
  | "story-pro2-frame"
  | "story-pro2-video"
  | "jianying-export-pro2"
  | "sbv1-image"
  | "sbv1-video-engine"
  | "story-pro-starter"
  | "story-pro-script-hub"
  | "story-pro-style"
  | "story-pro-character"
  | "story-pro-scene"
  | "story-pro-frame"
  | "story-pro-video"
  | "jianying-export-pro"
  | "ai-engine"
  | "image-engine"
  | "three-view-engine"
  | "story-outline-engine"
  | "character-engine"
  | "storyboard-engine"
  | "video-engine"
  | "ref-grid-4"
  | "ref-grid-6"
  | "ref-grid-9"
  | "ai-video-engine"
  | "video-generate"
  | "tts-engine"
  | "md-preview"
  | "audio-preview"
  | "video-preview"
  | "image-preview"
  | "jianying-export"
  | "output"
  | "group";

/** "可放进画布、用户能添加" 的内容节点类型 — 不含 group + 不含 v1 兼容。 */
export type CanvasContentNodeType =
  | "image"
  | "text"
  | "story-comic-starter"
  | "story-script-hub"
  | "story-character-column"
  | "story-frame-column"
  | "story-video-column"
  | "story-pro2-starter"
  | "story-pro2-image"
  | "story-pro2-three-view"
  | "story-pro2-script-hub"
  | "story-pro2-style"
  | "story-pro2-style-asset"
  | "story-pro2-character"
  | "story-pro2-scene"
  | "story-pro2-frame"
  | "story-pro2-video"
  | "jianying-export-pro2"
  | "sbv1-image"
  | "sbv1-video-engine"
  | "story-pro-starter"
  | "story-pro-script-hub"
  | "story-pro-style"
  | "story-pro-character"
  | "story-pro-scene"
  | "story-pro-frame"
  | "story-pro-video"
  | "jianying-export-pro"
  | "ai-engine"
  | "image-engine"
  | "three-view-engine"
  | "story-outline-engine"
  | "character-engine"
  | "storyboard-engine"
  | "video-engine"
  | "ref-grid-4"
  | "ref-grid-6"
  | "ref-grid-9"
  | "ai-video-engine"
  | "video-generate"
  | "tts-engine"
  | "md-preview"
  | "audio-preview"
  | "video-preview"
  | "image-preview"
  | "jianying-export"
  | "output";

/** 内容节点（非 group / 非 v1 兼容）按钮面板用。 */
export const CONTENT_NODE_TYPES: CanvasContentNodeType[] = [
  "image",
  "text",
  "story-comic-starter",
  "story-script-hub",
  "story-character-column",
  "story-frame-column",
  "story-video-column",
  "story-pro2-starter",
  "story-pro2-image",
  "story-pro2-three-view",
  "story-pro2-script-hub",
  "story-pro2-style",
  "story-pro2-style-asset",
  "story-pro2-character",
  "story-pro2-scene",
  "story-pro2-frame",
  "story-pro2-video",
  "jianying-export-pro2",
  "sbv1-image",
  "sbv1-video-engine",
  "story-pro-starter",
  "story-pro-script-hub",
  "story-pro-style",
  "story-pro-character",
  "story-pro-scene",
  "story-pro-frame",
  "story-pro-video",
  "jianying-export-pro",
  "ai-engine",
  "image-engine",
  "three-view-engine",
  "story-outline-engine",
  "character-engine",
  "storyboard-engine",
  "video-engine",
  "ref-grid-4",
  "ref-grid-6",
  "ref-grid-9",
  "ai-video-engine",
  "video-generate",
  "tts-engine",
  "md-preview",
  "audio-preview",
  "video-preview",
  "image-preview",
  "jianying-export",
  "output",
];

/** Story LLM 引擎 type 集合 */
export const STORY_LLM_NODE_TYPES = [
  "story-outline-engine",
  "character-engine",
  "storyboard-engine",
] as const;

export type StoryLlmNodeType = (typeof STORY_LLM_NODE_TYPES)[number];

export function isStoryLlmNodeType(t: string): t is StoryLlmNodeType {
  return (STORY_LLM_NODE_TYPES as readonly string[]).includes(t);
}

export type CanvasNodeRunStatus =
  | "idle"
  | "pending"
  | "running"
  | "done"
  | "error";

/** 节点上"运行结果"片段。前端用于渲染缩略图 + 错误提示。 */
export type CanvasNodeRuntime = {
  status: CanvasNodeRunStatus;
  taskId?: string;
  ossUrl?: string;
  ephemeralUrl?: string;
  /** 视频节点首帧封面（OSS JPEG），画布内只展示此图，点击播放再拉 mp4 */
  posterUrl?: string;
  textOutput?: string;
  failCode?: string;
  failMessage?: string;
  /** 用户已关闭底部错误条的任务 id · 轮询勿再写回同一条失败 */
  dismissedFailTaskId?: string;
};

// —— 各节点 data 形状 ——

export type ImageNodeData = {
  /** 已上传到 OSS 的稳定 URL（首选） */
  ossUrl?: string;
  /** 拖入即时显示的 blob URL（仅本会话有效） */
  blobUrl?: string;
  /** 是否仍在后台上传中 */
  uploading?: boolean;
  label?: string;
  /** 上传错误信息 */
  uploadError?: string;
  runtime?: CanvasNodeRuntime;
};

export type TextNodeData = {
  text: string;
  /**
   * v2: 文本节点也是双向的——
   * - manual：用户手写（默认）
   * - piped：来自上游 ai-engine 的 textOutput；展示 runtime.textOutput 优先；用户点 ✎ 切回 manual
   */
  mode?: "manual" | "piped";
  runtime?: CanvasNodeRuntime;
};

/**
 * v2 · AI 引擎节点：调 LLM 出文本。
 * provider+model 二级选择；params 由 model.paramsSchema 动态渲染。
 */
export type AiEngineNodeData = {
  /** 引用的 user CanvasProvider id；空表示尚未选择 */
  providerId: string;
  /** Provider 端 model key */
  modelKey: string;
  /**
   * 富文本 prompt：包含 `@<nodeId>` mention token；序列化由 MentionsTextarea 处理
   * 三段式默认结构（用户可一键插入）：
   *   【输入变量】... 【系统任务】... 【强制运算逻辑】...
   */
  prompt: string;
  /** prompt 里被引用到的上游 nodeId 列表，用于"高亮 chip" */
  referencedNodeIds?: string[];
  /** 最近一次选用的提示词模板 id（含内置 id；归档后仍可追溯） */
  promptTemplateId?: string;
  /** 选用时的模板名称快照 */
  promptTemplateNameSnap?: string;
  /** 模型参数（temperature / max_tokens / reasoning_effort 等） */
  params?: Record<string, unknown>;
  runtime?: CanvasNodeRuntime;
};

/** v2 · 生图引擎节点：调图像模型，支持重复生成（历史 / 对比由 store 不直接保存）。 */
export type ImageEngineNodeData = {
  providerId: string;
  modelKey: string;
  prompt: string;
  referencedNodeIds?: string[];
  promptTemplateId?: string;
  promptTemplateNameSnap?: string;
  params?: Record<string, unknown>;
  /** 阶段 4：当前展示的 task id（来自历史 chip 切换） */
  activeTaskId?: string;
  /** 漫剧分镜镜号（1-based） */
  frameIndex?: number;
  /** 从工具栏拖入的「分镜图」节点（尚未绑定镜号） */
  storyFrameMode?: boolean;
  /** 漫剧角色名（三视图用） */
  characterName?: string;
  /** 分镜图节点：单镜 + 视频 使用的 VIDEO 模型 */
  frameVideo?: CanvasEnginePick;
  /** 分镜图节点：单镜 + 配音 使用的 TTS 模型 */
  frameTts?: CanvasEnginePick;
  /** 从分镜表带入的视频运镜提示 */
  frameVideoPrompt?: string;
  /** 从分镜表带入的台词 / 对白 */
  frameDialogue?: string;
  runtime?: CanvasNodeRuntime;
};

/** 三视图引擎：结构与生图引擎相同，默认 prompt / 模型白名单不同。 */
export type ThreeViewEngineNodeData = ImageEngineNodeData;

/** 引擎 Provider + 模型选择（弹窗 Tab / 批量下一步共用） */
export type CanvasEnginePick = {
  providerId: string;
  modelKey: string;
  params?: Record<string, unknown>;
};

/** Story LLM 引擎族：结构与 ai-engine 相同，默认 prompt 不同。 */
export type StoryEngineNodeData = AiEngineNodeData & {
  /** 大纲引擎 · system（故事主题同步） */
  outlineSystemPrompt?: string;
  /** 「三视图 / 分镜图」Tab 选择的 IMAGE 模型 */
  batchImage?: CanvasEnginePick;
  /** 「对白」Tab 选择的 TTS 模型（供分镜图节点 + 配音 继承） */
  batchTts?: CanvasEnginePick;
  /** 分镜脚本节点：批量视频模型（可选，单镜优先用分镜图节点上的选择） */
  batchVideo?: CanvasEnginePick;
};

export type StoryComicPipelineStage =
  | "idle"
  | "llm_done"
  | "tv_done"
  | "frames_done"
  | "media_done"
  /** 故事大纲已「输出工作流」，故事主题锁定 */
  | "finalized";

export type StoryLlmEngineIds = {
  outlineId: string;
  characterId: string;
  storyboardId: string;
};

export type StoryComicStarterNodeData = {
  /** 大纲 LLM 的 system 提示词（可编辑） */
  systemPrompt: string;
  /** 当前选用的内置模板 id；与正文不一致时视为自定义 */
  systemPromptTemplateId?: StoryThemeSystemPromptTemplateId;
  /** @deprecated 已并入 systemPrompt；加载时迁移 */
  theme?: string;
  providerId: string;
  modelKey: string;
  params?: Record<string, unknown>;
  pipelineStage?: StoryComicPipelineStage;
  /** @deprecated 旧三引擎；新画布用 workspaceIds */
  llmEngineIds?: StoryLlmEngineIds;
  workspaceIds?: import("./story-workspace-types").StoryWorkspaceIds;
  runtime?: CanvasNodeRuntime;
};

/** 视频引擎：图生视频，可选镜号。 */
export type VideoEngineNodeData = ImageEngineNodeData & {
  /** 对应分镜表镜号（1-based） */
  frameIndex?: number;
};

export type RefImageGridSlot = {
  ossUrl?: string;
  blobUrl?: string;
  uploading?: boolean;
  uploadError?: string;
};

/** 四 / 六 / 九宫格参考图 */
export type RefImageGridNodeData = {
  slots: RefImageGridSlot[];
  /** 粘贴 / 点击目标格（0-based） */
  activeSlotIndex?: number;
  runtime?: CanvasNodeRuntime;
};

/** 参考生视频 · AI 视频引擎 */
export type AiVideoEngineNodeData = {
  providerId: string;
  modelKey: string;
  prompt: string;
  params?: Record<string, unknown>;
  linkedGridSlotCount?: number;
  /** 视频预览区占分隔容器高度比例（0.15–0.68），分隔条拖拽持久化 */
  videoPreviewRatio?: number;
  /** @deprecated 旧版 px 高度，加载时迁移为 videoPreviewRatio */
  videoPreviewHeight?: number;
  runtime?: CanvasNodeRuntime;
};

/** 参考生视频 · 成片展示 */
export type VideoGenerateNodeData = {
  label?: string;
  runtime?: CanvasNodeRuntime;
};

/** TTS 引擎：一镜一条台词 → 一条音频。 */
export type TtsEngineNodeData = {
  providerId: string;
  modelKey: string;
  /** 台词文本（可从上游分镜表 batch 写入） */
  text: string;
  frameIndex?: number;
  params?: Record<string, unknown>;
  runtime?: CanvasNodeRuntime;
};

export type MdPreviewNodeData = {
  /** 展示用标签 */
  label?: string;
  runtime?: CanvasNodeRuntime;
};

export type AudioPreviewNodeData = {
  label?: string;
  frameIndex?: number;
  runtime?: CanvasNodeRuntime;
};

export type VideoPreviewNodeData = {
  label?: string;
  frameIndex?: number;
  runtime?: CanvasNodeRuntime;
};

export type ImagePreviewNodeData = {
  label?: string;
  /** 角色名（三视图预览用） */
  characterName?: string;
  frameIndex?: number;
  runtime?: CanvasNodeRuntime;
};

export type JianyingMediaRenderResult = {
  downloadUrl: string;
  expiresAt: string;
  completedAt: string;
};

export type JianyingExportNodeData = {
  label?: string;
  /** 所属故事大纲 hub，多工作流画布按此隔离帧数据 */
  hubNodeId?: string;
  runtime?: CanvasNodeRuntime;
  /** 云端自动剪辑成片结果（持久化，避免缩放/重绘后下载链接丢失） */
  mediaRenderResult?: JianyingMediaRenderResult | null;
};

export type OutputNodeData = {
  title: string;
  saveToGallery: boolean;
  runtime?: CanvasNodeRuntime;
};

/** Pro2 媒体组类型（分镜图 / 三视图 / 分镜视频） */
export type Pro2MediaGroupKind =
  | "frame-board"
  | "character-board"
  | "scene-board"
  | "video-board";

export type GroupNodeData = {
  /** 组名（用户输入） */
  label: string;
  /** 主色（hex），用于边框 / 背景透明度叠加 */
  color: string;
  /** Pro2 · 媒体组语义 */
  pro2Kind?: Pro2MediaGroupKind;
  pro2HubNodeId?: string;
  /** 批量跑任务的隐藏列节点 id */
  pro2ControllerNodeId?: string;
  /** Pro2 · 手动框选打的组：统一走图1 暗色壳（即便不是媒体组） */
  pro2Styled?: boolean;
  /** 画布底部 Dock 快捷预设组（LibTV 壳 + 水平排布，非媒体宫格） */
  pro2ShortcutPreset?: boolean;
  /** sbv1 · 分镜视频 1.0 媒体组（子节点 sbv1-image） */
  sbv1Styled?: boolean;
};

export type CanvasNodeData =
  | (ImageNodeData & { __t: "image" })
  | (TextNodeData & { __t: "text" })
  | (StoryComicStarterNodeData & { __t: "story-comic-starter" })
  | (import("./story-workspace-types").StoryScriptHubNodeData & {
      __t: "story-script-hub";
    })
  | (import("./story-workspace-types").StoryCharacterColumnNodeData & {
      __t: "story-character-column";
    })
  | (import("./story-workspace-types").StoryFrameColumnNodeData & {
      __t: "story-frame-column";
    })
  | (import("./story-workspace-types").StoryVideoColumnNodeData & {
      __t: "story-video-column";
    })
  | (AiEngineNodeData & { __t: "ai-engine" })
  | (ImageEngineNodeData & { __t: "image-engine" })
  | (ThreeViewEngineNodeData & { __t: "three-view-engine" })
  | (StoryEngineNodeData & { __t: "story-outline-engine" })
  | (StoryEngineNodeData & { __t: "character-engine" })
  | (StoryEngineNodeData & { __t: "storyboard-engine" })
  | (VideoEngineNodeData & { __t: "video-engine" })
  | (RefImageGridNodeData & { __t: "ref-grid-4" })
  | (RefImageGridNodeData & { __t: "ref-grid-6" })
  | (RefImageGridNodeData & { __t: "ref-grid-9" })
  | (AiVideoEngineNodeData & { __t: "ai-video-engine" })
  | (VideoGenerateNodeData & { __t: "video-generate" })
  | (TtsEngineNodeData & { __t: "tts-engine" })
  | (MdPreviewNodeData & { __t: "md-preview" })
  | (AudioPreviewNodeData & { __t: "audio-preview" })
  | (VideoPreviewNodeData & { __t: "video-preview" })
  | (ImagePreviewNodeData & { __t: "image-preview" })
  | (JianyingExportNodeData & { __t: "jianying-export" })
  | (OutputNodeData & { __t: "output" })
  | (GroupNodeData & { __t: "group" });

export type CanvasFlowNode = Node<Record<string, unknown>, CanvasNodeType>;
export type CanvasFlowEdge = Edge;

export type CanvasGraph = {
  schemaVersion: number;
  nodes: CanvasFlowNode[];
  edges: CanvasFlowEdge[];
  viewport?: Viewport;
  /** 漫剧轨道标记（pro2 / sbv1 等） */
  meta?: { edition?: "pro2" | "sbv1" };
};

/**
 * Schema 版本：
 * - 1 = v1（含 ai-text / image-gen / product-params）
 * - 2 = v2（双引擎）
 * - 3 = story-pro2（薄卡 + 检视面板）
 * - 4 = sbv1（分镜视频 1.0）
 * 加载 schemaVersion < 2 的 graph 时由 lib/canvas/migrate.ts 做 in-memory 迁移
 */
export const CANVAS_SCHEMA_VERSION = 2;
export const CANVAS_SCHEMA_VERSION_PRO2 = 3;
export const CANVAS_SCHEMA_VERSION_SBV1 = 4;

export const NODE_DEFAULT_DATA: Record<CanvasNodeType, Record<string, unknown>> = {
  image: {} satisfies ImageNodeData as Record<string, unknown>,
  text: { text: "", mode: "manual" } satisfies TextNodeData as Record<string, unknown>,
  "story-comic-starter": {
    systemPrompt: STORY_THEME_SYSTEM_PROMPT_DEFAULT,
    systemPromptTemplateId: "full-pack-detailed",
    providerId: "",
    modelKey: "",
    params: { ...STORY_OUTLINE_LLM_PARAMS },
    pipelineStage: "idle",
  } satisfies StoryComicStarterNodeData as Record<string, unknown>,
  "story-script-hub": {
    outlineMd: "",
    characterMd: "",
    storyboardMd: "",
    providerId: "",
    modelKey: "",
    params: { ...STORY_OUTLINE_LLM_PARAMS },
    outlineSystemPrompt: "",
    promptOutline: STORY_OUTLINE_USER_PROMPT,
    promptCharacter: STORY_CHARACTER_ENGINE_PROMPT,
    promptStoryboard: STORY_STORYBOARD_ENGINE_PROMPT,
    referencedNodeIds: [],
  } as Record<string, unknown>,
  "story-character-column": {
    rows: [],
    batchImage: undefined,
  } as Record<string, unknown>,
  "story-frame-column": {
    rows: [],
    batchImage: undefined,
  } as Record<string, unknown>,
  "story-video-column": {
    rows: [],
    batchVideo: undefined,
    batchTts: undefined,
  } as Record<string, unknown>,
  "story-pro2-starter": {
    starterMode: "generate",
    themeInput: "",
    generatedOutlineMd: "",
    pro2TextPurpose: "story-outline",
    uploadedScriptMd: "",
    systemPrompt: "",
    providerId: "",
    modelKey: "",
    params: { ...STORY_PRO_LLM_PARAMS_DEFAULT },
    pipelineStage: "idle",
  } as Record<string, unknown>,
  "story-pro2-image": {
    label: "图片",
    dockInput: "",
  } as Record<string, unknown>,
  "story-pro2-three-view": {
    label: "角色",
    dockInput: "",
  } as Record<string, unknown>,
  "story-pro2-script-hub": {
    outlineMd: "",
    characterMd: "",
    sceneMd: "",
    storyboardMd: "",
    providerId: "",
    modelKey: "",
    params: { ...STORY_PRO_LLM_PARAMS_DEFAULT },
    outlineSystemPrompt: STORY_PRO_HUB_LLM_SYSTEM,
    promptOutline: STORY_PRO2_HUB_OUTLINE_FROM_THEME_PROMPT,
    promptCharacter: STORY_PRO2_CHARACTER_PROMPT,
    promptScene: STORY_PRO2_SCENE_PROMPT,
    promptStoryboard: STORY_PRO2_STORYBOARD_PROMPT,
    storyPro2PackPromptVersion: STORY_PRO2_PACK_PROMPT_VERSION,
    referencedNodeIds: [],
    dockInput: "",
    dockRefImages: [],
  } as Record<string, unknown>,
  "story-pro2-style": {
    styleAnchorZh: "",
    styleAnchorEn: "",
    negativePrompt: "",
    refImages: [],
    styleFinalized: false,
    providerId: "",
    modelKey: "",
  } as Record<string, unknown>,
  "story-pro2-style-asset": {
    presetId: "",
    styleName: "",
    stylePrompt: "",
    imageUrl: "",
    label: "素材-风格",
    styleAnchorZh: "",
  } as Record<string, unknown>,
  "story-pro2-character": { rows: [], batchImage: undefined } as Record<string, unknown>,
  "story-pro2-scene": { rows: [], batchImage: undefined } as Record<string, unknown>,
  "story-pro2-frame": { rows: [], batchImage: undefined } as Record<string, unknown>,
  "story-pro2-video": { rows: [], batchVideo: undefined, batchTts: undefined } as Record<
    string,
    unknown
  >,
  "jianying-export-pro2": {
    label: "剪映导出 · 专业版 2.0",
  } as Record<string, unknown>,
  "sbv1-image": {
    ...SBV1_DEFAULT_IMAGE_NODE_DATA,
  } as Record<string, unknown>,
  "sbv1-video-engine": {
    ...SBV1_DEFAULT_VIDEO_ENGINE_DATA,
  } as Record<string, unknown>,
  "story-pro-starter": {
    starterMode: "upload",
    uploadedScriptMd: "",
    systemPrompt: STORY_PRO_THEME_SYSTEM_PROMPT_DEFAULT,
    systemPromptTemplateId: "director-from-script",
    providerId: "",
    modelKey: "",
    params: { ...STORY_PRO_LLM_PARAMS_DEFAULT },
    pipelineStage: "idle",
  } as Record<string, unknown>,
  "story-pro-script-hub": {
    outlineMd: "",
    characterMd: "",
    storyboardMd: "",
    providerId: "",
    modelKey: "",
    params: { ...STORY_PRO_LLM_PARAMS_DEFAULT },
    outlineSystemPrompt: STORY_PRO_HUB_LLM_SYSTEM,
    promptOutline: STORY_PRO_OUTLINE_USER_PROMPT,
    promptCharacter: STORY_PRO_CHARACTER_PROMPT,
    promptStoryboard: STORY_PRO_STORYBOARD_PROMPT,
    referencedNodeIds: [],
  } as Record<string, unknown>,
  "story-pro-style": {
    styleAnchorZh: "",
    styleAnchorEn: "",
    negativePrompt: "",
    refImages: [],
    styleFinalized: false,
    providerId: "",
    modelKey: "",
  } as Record<string, unknown>,
  "story-pro-character": { rows: [], batchImage: undefined } as Record<
    string,
    unknown
  >,
  "story-pro-scene": { rows: [], batchImage: undefined } as Record<
    string,
    unknown
  >,
  "story-pro-frame": { rows: [], batchVideo: undefined } as Record<
    string,
    unknown
  >,
  "story-pro-video": {
    rows: [],
    batchVideo: undefined,
    batchTts: undefined,
  } as Record<string, unknown>,
  "jianying-export-pro": {
    label: "剪映导出 · 专业版",
  } as Record<string, unknown>,
  "ai-engine": {
    providerId: "",
    modelKey: "",
    prompt: AI_ENGINE_PROMPT_TEMPLATE,
    referencedNodeIds: [],
    params: { reasoning_effort: "low", max_tokens: 4000, temperature: 0.7 },
  } satisfies AiEngineNodeData as Record<string, unknown>,
  "image-engine": {
    providerId: "",
    modelKey: "",
    prompt: IMAGE_ENGINE_PROMPT_TEMPLATE_DEFAULT,
    referencedNodeIds: [],
    params: { aspect_ratio: "1:1", resolution: "2K", output_format: "png" },
  } satisfies ImageEngineNodeData as Record<string, unknown>,
  "three-view-engine": {
    providerId: "",
    modelKey: "",
    prompt: THREE_VIEW_ENGINE_PROMPT_DEFAULT,
    referencedNodeIds: [],
    params: { aspect_ratio: "16:9", resolution: "2K", output_format: "png" },
  } satisfies ThreeViewEngineNodeData as Record<string, unknown>,
  "story-outline-engine": {
    providerId: "",
    modelKey: "",
    outlineSystemPrompt: "",
    prompt: STORY_OUTLINE_USER_PROMPT,
    referencedNodeIds: [],
    params: { ...STORY_OUTLINE_LLM_PARAMS },
  } satisfies StoryEngineNodeData as Record<string, unknown>,
  "character-engine": {
    providerId: "",
    modelKey: "",
    prompt: STORY_CHARACTER_ENGINE_PROMPT,
    referencedNodeIds: [],
    params: { reasoning_effort: "low", max_tokens: 4000, temperature: 0.7 },
  } satisfies StoryEngineNodeData as Record<string, unknown>,
  "storyboard-engine": {
    providerId: "",
    modelKey: "",
    prompt: STORY_STORYBOARD_ENGINE_PROMPT,
    referencedNodeIds: [],
    params: { reasoning_effort: "low", max_tokens: 6000, temperature: 0.7 },
  } satisfies StoryEngineNodeData as Record<string, unknown>,
  "video-engine": {
    providerId: "",
    modelKey: "",
    prompt: STORY_VIDEO_ENGINE_PROMPT_DEFAULT,
    referencedNodeIds: [],
    params: { resolution: "1080p", duration: 5 },
  } satisfies VideoEngineNodeData as Record<string, unknown>,
  "ref-grid-4": {
    slots: emptyRefGridSlots(4),
    activeSlotIndex: 0,
  } satisfies RefImageGridNodeData as Record<string, unknown>,
  "ref-grid-6": {
    slots: emptyRefGridSlots(6),
    activeSlotIndex: 0,
  } satisfies RefImageGridNodeData as Record<string, unknown>,
  "ref-grid-9": {
    slots: emptyRefGridSlots(9),
    activeSlotIndex: 0,
  } satisfies RefImageGridNodeData as Record<string, unknown>,
  "ai-video-engine": {
    providerId: "",
    modelKey: REF_VIDEO_DEFAULT_MODEL_KEY,
    prompt: "",
    params: {
      ...REF_VIDEO_MODEL_META[REF_VIDEO_DEFAULT_MODEL_KEY].defaultParams,
    },
  } satisfies AiVideoEngineNodeData as Record<string, unknown>,
  "video-generate": {
    label: "视频生成",
  } satisfies VideoGenerateNodeData as Record<string, unknown>,
  "tts-engine": {
    providerId: "",
    modelKey: "",
    text: "",
    params: { voice: "alloy" },
  } satisfies TtsEngineNodeData as Record<string, unknown>,
  "md-preview": {
    label: "MD 预览",
  } satisfies MdPreviewNodeData as Record<string, unknown>,
  "audio-preview": {
    label: "音频预览",
  } satisfies AudioPreviewNodeData as Record<string, unknown>,
  "video-preview": {
    label: "视频预览",
  } satisfies VideoPreviewNodeData as Record<string, unknown>,
  "image-preview": {
    label: "三视图预览",
  } satisfies ImagePreviewNodeData as Record<string, unknown>,
  "jianying-export": {
    label: "剪映导出",
  } satisfies JianyingExportNodeData as Record<string, unknown>,
  output: {
    title: "未命名画作",
    saveToGallery: true,
  } satisfies OutputNodeData as Record<string, unknown>,
  group: {
    label: "未命名分组",
    color: "#238636",
  } satisfies GroupNodeData as Record<string, unknown>,
};

/**
 * 各节点默认尺寸：用于 addNode 落 `node.style` 给 NodeResizer 提供初值。
 * 所有非 group 节点都允许用户拖角调整大小。
 */
export const NODE_DEFAULT_SIZE: Record<
  CanvasNodeType,
  { width: number; height: number }
> = {
  image: { width: 380, height: 320 },
  text: { width: 380, height: 260 },
  "story-comic-starter": {
    width: STORY_CONTROL_NODE_WIDTH,
    height: STORY_CONTROL_NODE_HEIGHT,
  },
  "story-script-hub": {
    width: STORY_CONTROL_NODE_WIDTH,
    height: STORY_CONTROL_NODE_HEIGHT,
  },
  "story-character-column": { width: 560, height: 2100 },
  "story-frame-column": { width: 1080, height: 2100 },
  "story-video-column": { width: 540, height: 2100 },
  "story-pro2-starter": {
    width: PRO2_TEXT_NODE_WIDTH,
    height: PRO2_TEXT_NODE_HEIGHT,
  },
  "story-pro2-image": {
    width: PRO2_IMAGE_NODE_WIDTH,
    height: PRO2_IMAGE_NODE_HEIGHT,
  },
  "story-pro2-three-view": {
    width: PRO2_CHARACTER_THREE_VIEW_WIDTH,
    height: PRO2_CHARACTER_THREE_VIEW_HEIGHT,
  },
  "story-pro2-script-hub": {
    width: PRO2_SCRIPT_NODE_WIDTH,
    height: PRO2_SCRIPT_NODE_HEIGHT,
  },
  "story-pro2-style": {
    width: PRO2_CONTROL_CARD_WIDTH,
    height: PRO2_CONTROL_CARD_HEIGHT,
  },
  "story-pro2-style-asset": {
    width: PRO2_IMAGE_NODE_WIDTH,
    height: PRO2_IMAGE_NODE_HEIGHT,
  },
  "story-pro2-character": {
    width: PRO2_FRAME_BOARD_WIDTH,
    height: PRO2_FRAME_BOARD_HEIGHT,
  },
  "story-pro2-scene": {
    width: PRO2_COLUMN_CARD_WIDTH,
    height: PRO2_COLUMN_CARD_HEIGHT,
  },
  "story-pro2-frame": {
    width: PRO2_FRAME_BOARD_WIDTH,
    height: PRO2_FRAME_BOARD_HEIGHT,
  },
  "story-pro2-video": {
    width: PRO2_COLUMN_CARD_WIDTH,
    height: PRO2_COLUMN_CARD_HEIGHT,
  },
  "jianying-export-pro2": {
    width: 400,
    height: PRO2_COLUMN_CARD_HEIGHT,
  },
  "sbv1-image": {
    width: SBV1_IMAGE_NODE_WIDTH,
    height: SBV1_IMAGE_NODE_HEIGHT,
  },
  "sbv1-video-engine": {
    width: SBV1_VIDEO_ENGINE_WIDTH,
    height: SBV1_VIDEO_ENGINE_HEIGHT,
  },
  "story-pro-starter": {
    width: STORY_CONTROL_NODE_WIDTH,
    height: STORY_CONTROL_NODE_HEIGHT,
  },
  "story-pro-script-hub": {
    width: STORY_CONTROL_NODE_WIDTH,
    height: STORY_CONTROL_NODE_HEIGHT,
  },
  "story-pro-style": {
    width: STORY_CONTROL_NODE_WIDTH,
    height: STORY_CONTROL_NODE_HEIGHT + 80,
  },
  "story-pro-character": { width: 560, height: 2100 },
  "story-pro-scene": { width: 480, height: 2100 },
  "story-pro-frame": { width: 1080, height: 2100 },
  "story-pro-video": { width: 540, height: 2100 },
  "jianying-export-pro": { width: 400, height: 920 },
  "ai-engine": { width: 480, height: 540 },
  "image-engine": { width: 380, height: 560 },
  "three-view-engine": { width: 670, height: 880 },
  "story-outline-engine": { width: 480, height: 540 },
  "character-engine": { width: 480, height: 540 },
  "storyboard-engine": { width: 500, height: 560 },
  "video-engine": { width: 380, height: 560 },
  "ref-grid-4": REF_GRID_NODE_SIZE["ref-grid-4"],
  "ref-grid-6": REF_GRID_NODE_SIZE["ref-grid-6"],
  "ref-grid-9": REF_GRID_NODE_SIZE["ref-grid-9"],
  "ai-video-engine": REF_VIDEO_NODE_SIZE,
  "video-generate": REF_VIDEO_NODE_SIZE,
  "tts-engine": { width: 380, height: 360 },
  "md-preview": { width: 420, height: 360 },
  "audio-preview": { width: 380, height: 200 },
  "video-preview": { width: 380, height: 320 },
  "image-preview": { width: 380, height: 320 },
  "jianying-export": { width: 400, height: 920 },
  output: { width: 380, height: 480 },
  group: { width: 360, height: 240 },
};

/** 漫剧分镜图 image-engine 初始尺寸 */
export const STORY_FRAME_IMAGE_ENGINE_SIZE = {
  width: 640,
  height: 480,
} as const;

/** 6 个预设分组色 */
export const GROUP_COLOR_PRESETS = [
  "#238636", // Gateway 主色
  "#60a5fa", // 蓝
  "#34d399", // 绿
  "#fbbf24", // 琥珀
  "#f472b6", // 粉
  "#94a3b8", // 中性
] as const;

export const NODE_OUTPUT_KIND: Record<
  CanvasNodeType,
  "image" | "text" | "audio" | "video" | "none"
> = {
  image: "image",
  text: "text",
  "story-comic-starter": "text",
  "story-script-hub": "text",
  "story-character-column": "image",
  "story-frame-column": "image",
  "story-video-column": "video",
  "story-pro2-starter": "text",
  "story-pro2-image": "image",
  "story-pro2-three-view": "image",
  "story-pro2-script-hub": "text",
  "story-pro2-style": "text",
  "story-pro2-style-asset": "image",
  "story-pro2-character": "image",
  "story-pro2-scene": "image",
  "story-pro2-frame": "image",
  "story-pro2-video": "video",
  "jianying-export-pro2": "none",
  "sbv1-image": "image",
  "sbv1-video-engine": "video",
  "story-pro-starter": "text",
  "story-pro-script-hub": "text",
  "story-pro-style": "text",
  "story-pro-character": "image",
  "story-pro-scene": "image",
  "story-pro-frame": "image",
  "story-pro-video": "video",
  "jianying-export-pro": "none",
  "ai-engine": "text",
  "image-engine": "image",
  "three-view-engine": "image",
  "story-outline-engine": "text",
  "character-engine": "text",
  "storyboard-engine": "text",
  "video-engine": "video",
  "ref-grid-4": "image",
  "ref-grid-6": "image",
  "ref-grid-9": "image",
  "ai-video-engine": "video",
  "video-generate": "none",
  "tts-engine": "audio",
  "md-preview": "none",
  "audio-preview": "none",
  "video-preview": "none",
  "image-preview": "none",
  "jianying-export": "none",
  output: "none",
  group: "none",
};

/** 节点是否实际触发后端任务（其它节点为"被动数据源"） */
export function isRunnableNodeType(t: CanvasNodeType): boolean {
  return (
    t === "ai-engine" ||
    t === "image-engine" ||
    t === "three-view-engine" ||
    isStoryLlmNodeType(t) ||
    t === "story-script-hub" ||
    t === "story-character-column" ||
    t === "story-frame-column" ||
    t === "story-video-column" ||
    t === "story-pro-script-hub" ||
    t === "story-pro-style" ||
    t === "story-pro-character" ||
    t === "story-pro-scene" ||
    t === "story-pro-frame" ||
    t === "story-pro-video" ||
    t === "video-engine" ||
    t === "sbv1-video-engine" ||
    t === "ai-video-engine" ||
    t === "tts-engine"
  );
}

export function isStoryWorkspaceNodeType(t: string): boolean {
  return (
    t === "story-comic-starter" ||
    t === "story-pro-starter" ||
    t === "story-pro2-starter" ||
    t === "story-script-hub" ||
    t === "story-character-column" ||
    t === "story-frame-column" ||
    t === "story-video-column" ||
    t === "story-pro-script-hub" ||
    t === "story-pro-style" ||
    t === "story-pro-character" ||
    t === "story-pro-scene" ||
    t === "story-pro-frame" ||
    t === "story-pro-video" ||
    t === "story-pro2-script-hub" ||
    t === "story-pro2-style" ||
    t === "story-pro2-character" ||
    t === "story-pro2-scene" ||
    t === "story-pro2-frame" ||
    t === "story-pro2-video"
  );
}

export function isStoryProPipelineNode(t: string): boolean {
  return (
    t === "story-pro-starter" ||
    t === "story-pro-script-hub" ||
    t === "story-pro-style" ||
    t === "story-pro-character" ||
    t === "story-pro-scene" ||
    t === "story-pro-frame" ||
    t === "story-pro-video" ||
    t === "jianying-export-pro"
  );
}

/** group 节点是容器、不参与拓扑 / 输入解析。 */
export function isGroupNode(t: string | undefined): boolean {
  return t === "group";
}
