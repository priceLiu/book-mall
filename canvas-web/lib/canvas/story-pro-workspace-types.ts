/**
 * 影视专业版（story-pro）工作区类型 — 与快手版完全隔离
 */
import type { CanvasEnginePick, CanvasNodeRuntime } from "./types";
import type { StoryProThemeSystemPromptTemplateId } from "./story-pro-theme-templates";
import type { StoryTextRevision } from "./story-revision";
import type { StoryRefImage } from "./story-ref-image";
import type { StoryLlmSection } from "./story-workspace-types";

export type { StoryLlmSection };

export type StoryProRunContext = {
  llmSection?: StoryLlmSection;
  rowKey?: string;
  mediaKind?:
    | "threeView"
    | "sceneRef"
    | "frameImage"
    | "video"
    | "tts"
    | "themeOutline";
};

export type StoryProFeasibilityItem = {
  id: string;
  label: string;
  level: "low" | "medium" | "high";
  note?: string;
};

export type StoryProFeasibilityAssessment = {
  items: StoryProFeasibilityItem[];
  highRiskCount: number;
  confirmedAt?: string;
};

/** 故事定稿瞬间的剧本快照（只读历史，最多保留 10 条） */
export type StoryProFinalizedScriptSnapshot = {
  version: number;
  theme: string;
  finalizedAt: string;
  outlineMd: string;
  characterMd: string;
  storyboardMd: string;
};

export type StoryProStyleRefImage = StoryRefImage & {
  kind?: "character" | "scene" | "atmosphere";
  note?: string;
};

export type StoryProMainStyle =
  | "anime"
  | "american-comic"
  | "webtoon"
  | "chibi"
  | "cg"
  | "photorealistic"
  | "game-cg"
  | "chinese-3d"
  | "other";

export type StoryProColorTone =
  | "bright-warm"
  | "dark-moody"
  | "vivid"
  | "soft"
  | "high-contrast";

export type StoryProRenderQuality = "flat" | "thick-paint" | "watercolor" | "oil";

export type StoryProStyleNodeData = {
  projectName?: string;
  audience?: string;
  genre?: string;
  tone?: string;
  mainStyle?: StoryProMainStyle;
  colorTone?: StoryProColorTone;
  renderQuality?: StoryProRenderQuality;
  styleAnchorZh?: string;
  styleAnchorEn?: string;
  negativePrompt?: string;
  refImages?: StoryProStyleRefImage[];
  styleFinalized?: boolean;
  hubNodeId?: string;
  providerId?: string;
  modelKey?: string;
  params?: Record<string, unknown>;
  runtime?: CanvasNodeRuntime;
};

export type StoryProScriptHubNodeData = {
  outlineMd: string;
  characterMd: string;
  /** 2.0 · 场景视觉提示词（LLM 根据大纲场景辞典扩写） */
  sceneMd?: string;
  /** 2.0 · 场景图组同步行（原场景设计列 rows，现挂 hub） */
  sceneRows?: StoryProSceneRow[];
  /** 2.0 · hub 顶栏批量场景图默认模型（弹层可覆盖） */
  sceneBatchImage?: {
    providerId?: string;
    modelKey?: string;
    params?: Record<string, unknown>;
  };
  storyboardMd: string;
  /** 2.0 输入坞 · 用户提示词 */
  dockInput?: string;
  /** 2.0 输入坞 · 粘贴的角色/场景等参考图 */
  dockRefImages?: StoryRefImage[];
  outlineRuntime?: CanvasNodeRuntime;
  characterRuntime?: CanvasNodeRuntime;
  sceneRuntime?: CanvasNodeRuntime;
  storyboardRuntime?: CanvasNodeRuntime;
  providerId: string;
  modelKey: string;
  params?: Record<string, unknown>;
  outlineSystemPrompt?: string;
  promptOutline: string;
  promptCharacter: string;
  promptScene?: string;
  promptStoryboard: string;
  outlineHistory?: StoryTextRevision[];
  characterHistory?: StoryTextRevision[];
  sceneHistory?: StoryTextRevision[];
  storyboardHistory?: StoryTextRevision[];
  referencedNodeIds?: string[];
  scriptFinalized?: boolean;
  /** 每次「故事定稿」追加一条，供「查看定稿剧本」只读历史 */
  finalizedScriptHistory?: StoryProFinalizedScriptSnapshot[];
  feasibility?: StoryProFeasibilityAssessment;
};

export type StoryProCharacterRow = {
  key: string;
  name: string;
  role: string;
  appearance: string;
  prompt: string;
  promptHistory?: StoryTextRevision[];
  /** 绑定角色资产库 */
  assetId?: string;
  lockedRefIds?: string[];
  runtime?: CanvasNodeRuntime;
};

export type StoryProSceneRow = {
  key: string;
  name: string;
  description: string;
  prompt: string;
  promptHistory?: StoryTextRevision[];
  refImages?: StoryRefImage[];
  runtime?: CanvasNodeRuntime;
};

export type StoryProFrameRow = {
  frameIndex: number;
  key: string;
  shotNo?: string;
  shotSize?: string;
  cameraMove?: string;
  durationSec?: number;
  aiDifficulty?: number;
  sceneRefId?: string;
  scene: string;
  description: string;
  dialogue: string;
  videoPrompt: string;
  prompt: string;
  promptHistory?: StoryTextRevision[];
  referencedNodeIds?: string[];
  runtime?: CanvasNodeRuntime;
  refImages?: StoryRefImage[];
  refImageUrls?: string[];
  frameApprovedAt?: string;
  frameRejectedReason?: string;
  /** P-B2 · 保存 @ 引用时的资产 version 快照 */
  characterRefSnapshotAt?: string;
  characterAssetVersions?: Record<string, number>;
  characterRefIds?: string[];
};

export type StoryProVideoRow = {
  frameIndex: number;
  key: string;
  dialogue: string;
  videoPrompt?: string;
  videoPromptHistory?: StoryTextRevision[];
  videoReferencedNodeIds?: string[];
  ttsPrompt?: string;
  ttsPromptHistory?: StoryTextRevision[];
  refImages?: StoryRefImage[];
  frameImageUrl?: string;
  videoRuntime?: CanvasNodeRuntime;
  ttsRuntime?: CanvasNodeRuntime;
};

export type StoryProCharacterColumnNodeData = {
  rows: StoryProCharacterRow[];
  batchImage?: CanvasEnginePick;
  hubNodeId?: string;
};

export type StoryProSceneColumnNodeData = {
  rows: StoryProSceneRow[];
  batchImage?: CanvasEnginePick;
  hubNodeId?: string;
};

export type StoryProFrameColumnNodeData = {
  rows: StoryProFrameRow[];
  batchImage?: CanvasEnginePick;
  batchVideo?: CanvasEnginePick;
  hubNodeId?: string;
  /** P-A2 · 静帧生成时追加风格节点参考图（最多 2 张） */
  injectStyleRefs?: boolean;
  styleRefImageUrls?: string[];
};

export type StoryProVideoColumnNodeData = {
  rows: StoryProVideoRow[];
  batchVideo?: CanvasEnginePick;
  batchTts?: CanvasEnginePick;
  hubNodeId?: string;
  frameColumnId?: string;
};

export type StoryProUploadedScriptMeta = {
  fileName: string;
  format: "md" | "txt";
  charCount: number;
  uploadedAt: string;
};

export type StoryProStarterMode = "upload" | "generate";

export type StoryProStarterNodeData = {
  /** upload=上传剧本；generate=主题输入生成大纲（2.0 文本节点） */
  starterMode?: StoryProStarterMode;
  /** 2.0 文本节点 · 用户输入的故事主题 */
  themeInput?: string;
  /** 2.0 文本节点 · 主题生成的大纲正文（Markdown） */
  generatedOutlineMd?: string;
  /** 2.0 文本节点 · 大纲编辑历史（最多 3 条） */
  generatedOutlineHistory?: import("./story-revision").StoryTextRevision[];
  /** 文本节点用途：story-outline=生成故事大纲；general=提示词/下游引用（文生图/生视频/反推等） */
  pro2TextPurpose?: import("./pro2-text-purpose").Pro2TextPurpose;
  /** 快捷预设组标记（image-to-prompt 等） */
  pro2PresetKind?: string;
  themeOutlineRuntime?: CanvasNodeRuntime;
  themeOutlineSystemPrompt?: string;
  /** 运行时内存/会话用；autosave 时剥离，以 OSS 为准 */
  uploadedScriptMd?: string;
  /** 剧本正文 OSS URL（持久化） */
  uploadedScriptOssUrl?: string;
  uploadedScriptMeta?: StoryProUploadedScriptMeta;
  systemPrompt: string;
  systemPromptTemplateId?: StoryProThemeSystemPromptTemplateId;
  providerId: string;
  modelKey: string;
  params?: Record<string, unknown>;
  /** 文本节点 · Gateway IMAGE 槽（文生图 / 下游图片节点） */
  imageEngine?: import("./types").CanvasEnginePick;
  /** 文本节点 · Gateway VIDEO 槽（文生视频 / 下游视频合成） */
  videoEngine?: import("./types").CanvasEnginePick;
  pipelineStage?: "idle" | "llm_done" | "script_finalized" | "style_finalized" | "finalized";
  workspaceIds?: StoryProWorkspaceIds;
};

export type StoryProWorkspaceIds = {
  scriptHubId: string;
  styleNodeId?: string;
  characterColumnId?: string;
  sceneColumnId?: string;
  frameColumnId?: string;
  videoColumnId?: string;
  jianyingExportId?: string;
};

export const STORY_PRO_NODE_TYPES = [
  "story-pro-starter",
  "story-pro-script-hub",
  "story-pro-style",
  "story-pro-character",
  "story-pro-scene",
  "story-pro-frame",
  "story-pro-video",
  "jianying-export-pro",
] as const;

export type StoryProNodeType = (typeof STORY_PRO_NODE_TYPES)[number];

export function isStoryProNodeType(t: string): t is StoryProNodeType {
  return (STORY_PRO_NODE_TYPES as readonly string[]).includes(t);
}

export function isStoryProWorkspaceNodeType(t: string): boolean {
  return (
    t === "story-pro-script-hub" ||
    t === "story-pro-style" ||
    t === "story-pro-character" ||
    t === "story-pro-scene" ||
    t === "story-pro-frame" ||
    t === "story-pro-video"
  );
}

export function isStoryProHubType(t: string): boolean {
  return t === "story-pro-script-hub";
}
