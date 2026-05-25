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
  STORY_STORYBOARD_ENGINE_PROMPT,
  STORY_VIDEO_ENGINE_PROMPT_DEFAULT,
} from "./story-prompts";

export {
  AI_ENGINE_PROMPT_TEMPLATE,
  AI_ENGINE_PROMPT_TEMPLATE_V2,
  IMAGE_ENGINE_PROMPT_TEMPLATE_DEFAULT,
  THREE_VIEW_ENGINE_PROMPT_DEFAULT,
  THREE_VIEW_ENGINE_MODEL_KEYS,
} from "./builtin-prompt-templates";

export {
  STORY_OUTLINE_ENGINE_PROMPT,
  STORY_CHARACTER_ENGINE_PROMPT,
  STORY_STORYBOARD_ENGINE_PROMPT,
  STORY_LLM_MODEL_KEYS,
  STORY_VIDEO_MODEL_KEYS,
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
  | "ai-engine"
  | "image-engine"
  | "three-view-engine"
  | "story-outline-engine"
  | "character-engine"
  | "storyboard-engine"
  | "video-engine"
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
  | "ai-engine"
  | "image-engine"
  | "three-view-engine"
  | "story-outline-engine"
  | "character-engine"
  | "storyboard-engine"
  | "video-engine"
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
  "ai-engine",
  "image-engine",
  "three-view-engine",
  "story-outline-engine",
  "character-engine",
  "storyboard-engine",
  "video-engine",
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
  textOutput?: string;
  failCode?: string;
  failMessage?: string;
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
  | "media_done";

export type StoryLlmEngineIds = {
  outlineId: string;
  characterId: string;
  storyboardId: string;
};

export type StoryComicStarterNodeData = {
  theme: string;
  providerId: string;
  modelKey: string;
  params?: Record<string, unknown>;
  pipelineStage?: StoryComicPipelineStage;
  /** 本启动节点创建/绑定的三文案引擎 id（避免画布上有多套引擎时跑错节点） */
  llmEngineIds?: StoryLlmEngineIds;
  runtime?: CanvasNodeRuntime;
};

/** 视频引擎：图生视频，可选镜号。 */
export type VideoEngineNodeData = ImageEngineNodeData & {
  /** 对应分镜表镜号（1-based） */
  frameIndex?: number;
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

export type JianyingExportNodeData = {
  label?: string;
  runtime?: CanvasNodeRuntime;
};

export type OutputNodeData = {
  title: string;
  saveToGallery: boolean;
  runtime?: CanvasNodeRuntime;
};

export type GroupNodeData = {
  /** 组名（用户输入） */
  label: string;
  /** 主色（hex），用于边框 / 背景透明度叠加 */
  color: string;
};

export type CanvasNodeData =
  | (ImageNodeData & { __t: "image" })
  | (TextNodeData & { __t: "text" })
  | (StoryComicStarterNodeData & { __t: "story-comic-starter" })
  | (AiEngineNodeData & { __t: "ai-engine" })
  | (ImageEngineNodeData & { __t: "image-engine" })
  | (ThreeViewEngineNodeData & { __t: "three-view-engine" })
  | (StoryEngineNodeData & { __t: "story-outline-engine" })
  | (StoryEngineNodeData & { __t: "character-engine" })
  | (StoryEngineNodeData & { __t: "storyboard-engine" })
  | (VideoEngineNodeData & { __t: "video-engine" })
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
};

/**
 * Schema 版本：
 * - 1 = v1（含 ai-text / image-gen / product-params）
 * - 2 = v2（双引擎）
 * 加载 schemaVersion < 2 的 graph 时由 lib/canvas/migrate.ts 做 in-memory 迁移
 */
export const CANVAS_SCHEMA_VERSION = 2;

export const NODE_DEFAULT_DATA: Record<CanvasNodeType, Record<string, unknown>> = {
  image: {} satisfies ImageNodeData as Record<string, unknown>,
  text: { text: "", mode: "manual" } satisfies TextNodeData as Record<string, unknown>,
  "story-comic-starter": {
    theme: "故事创意：例如「赛博朋克城市里，外卖员发现 AI 有了自我意识…」",
    providerId: "",
    modelKey: "",
    params: { reasoning_effort: "low", max_tokens: 4000, temperature: 0.7 },
    pipelineStage: "idle",
  } satisfies StoryComicStarterNodeData as Record<string, unknown>,
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
    prompt: STORY_OUTLINE_ENGINE_PROMPT,
    referencedNodeIds: [],
    params: { reasoning_effort: "low", max_tokens: 4000, temperature: 0.7 },
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
    color: "#a78bfa",
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
  "story-comic-starter": { width: 420, height: 380 },
  "ai-engine": { width: 480, height: 540 },
  "image-engine": { width: 380, height: 560 },
  "three-view-engine": { width: 420, height: 480 },
  "story-outline-engine": { width: 480, height: 540 },
  "character-engine": { width: 480, height: 540 },
  "storyboard-engine": { width: 500, height: 560 },
  "video-engine": { width: 380, height: 560 },
  "tts-engine": { width: 380, height: 360 },
  "md-preview": { width: 420, height: 360 },
  "audio-preview": { width: 380, height: 200 },
  "video-preview": { width: 380, height: 320 },
  "image-preview": { width: 380, height: 320 },
  "jianying-export": { width: 400, height: 280 },
  output: { width: 380, height: 480 },
  group: { width: 360, height: 240 },
};

/** 漫剧分镜图 image-engine 初始尺寸 */
export const STORY_FRAME_IMAGE_ENGINE_SIZE = {
  width: 640,
  height: 480,
} as const;

/** 6 个预设分组色（与暗紫主题搭） */
export const GROUP_COLOR_PRESETS = [
  "#a78bfa", // 主紫
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
  "ai-engine": "text",
  "image-engine": "image",
  "three-view-engine": "image",
  "story-outline-engine": "text",
  "character-engine": "text",
  "storyboard-engine": "text",
  "video-engine": "video",
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
    t === "video-engine" ||
    t === "tts-engine"
  );
}

/** group 节点是容器、不参与拓扑 / 输入解析。 */
export function isGroupNode(t: string | undefined): boolean {
  return t === "group";
}
