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
    | "themeOutline"
    | "generalText"
    | "music";
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
  /** 剧本创作 · 工业化分批（与 starter 同步） */
  scriptStudioMode?: boolean;
  /** 小白生剧 / 上传剧本 */
  scriptStudioInputMode?: StoryProStarterMode;
  /** 剧本创作 · 主题或描述（hub 入口） */
  scriptStudioThemeInput?: string;
  scriptStudioSystem?: "original" | "adaptation";
  scriptStudioTotalEpisodes?: number;
  scriptStudioBatchIndex?: number;
  scriptStudioFrozenBiblesMd?: string;
  scriptStudioFrozenBiblesOssUrl?: string;
  scriptStudioCompletedBatchesMd?: string;
  scriptStudioCompletedBatchesOssUrl?: string;
  /** 工业化批次 LLM runtime（hub 入口） */
  themeOutlineRuntime?: CanvasNodeRuntime;
  /** 上传剧本（hub 入口 · autosave 剥离大正文） */
  uploadedScriptMd?: string;
  uploadedScriptOssUrl?: string;
  uploadedScriptMeta?: StoryProUploadedScriptMeta;
  /** 解析行暂存（发布前 · 不自动 spawn 列节点） */
  scriptStudioCharacterRows?: StoryProCharacterRow[];
  scriptStudioPropRows?: StoryProPropRow[];
  scriptStudioFrameRows?: StoryProFrameRow[];
  scriptStudioMoodRows?: StoryProMoodRow[];
  scriptStudioAudioRows?: StoryProAudioRow[];
  /** 发布剧本后 · 剧组公告条 */
  crewBulletin?: import("./crew-bulletin-types").CrewBulletinState;
  scriptPublished?: boolean;
  /** 关联的 SCRIPT_PACKAGE 资产 id（发布同步后写入） */
  linkedScriptPackageAssetId?: string;
  /** 按运行栏种类归档的完成快照 */
  scriptPackageSnapshots?: import("./script-package-snapshots").ScriptPackageSnapshotsByKind;
};

/** 公告栏行编辑 · 名称/描述/提示词快照 */
export type StoryRowFieldRevision = {
  savedAt: string;
  name?: string;
  description?: string;
  prompt?: string;
  appearance?: string;
  role?: string;
};

export type StoryProCharacterRow = {
  key: string;
  name: string;
  role: string;
  appearance: string;
  prompt: string;
  promptHistory?: StoryTextRevision[];
  rowRevisionHistory?: StoryRowFieldRevision[];
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
  rowRevisionHistory?: StoryRowFieldRevision[];
  refImages?: StoryRefImage[];
  runtime?: CanvasNodeRuntime;
};

/** 2.0 · 全局道具行（角色/场景同构：设定 + 提示词 + 细节图） */
export type StoryProPropRow = {
  key: string;
  name: string;
  /** 道具设定：剧情作用、新旧质感、年代合规、材质色彩 */
  description: string;
  prompt: string;
  promptHistory?: StoryTextRevision[];
  rowRevisionHistory?: StoryRowFieldRevision[];
  refImages?: StoryRefImage[];
  /** 绑定道具资产库（ProjectAssetKind.PROP） */
  assetId?: string;
  /** 剧本创作 · 对应 LibTV 媒体卡节点 id */
  mediaNodeId?: string;
  lockedRefIds?: string[];
  runtime?: CanvasNodeRuntime;
};

/** 2.0 · 全局氛围行（氛围板：色调/光影/环境关键词） */
export type StoryProMoodRow = {
  key: string;
  name: string;
  /** 氛围描述：烟火气/冷清压抑/紧张肃杀/暧昧柔和 等 */
  description: string;
  prompt: string;
  promptHistory?: StoryTextRevision[];
  rowRevisionHistory?: StoryRowFieldRevision[];
  refImages?: StoryRefImage[];
  /** 剧本创作 · 对应 LibTV 媒体卡节点 id */
  mediaNodeId?: string;
  runtime?: CanvasNodeRuntime;
};

/** 2.0 · 音效行（环境音/动作音 SFX） */
export type StoryProAudioRow = {
  key: string;
  /** 关联镜号（可空，全局环境音不绑镜） */
  frameKey?: string;
  name: string;
  /** 音效描述：细雨/城市车流/安静空寂/人群嘈杂/风声 等 */
  description: string;
  /** 音效生成提示词 */
  prompt: string;
  promptHistory?: StoryTextRevision[];
  rowRevisionHistory?: StoryRowFieldRevision[];
  /** 剧本创作 · 对应 LibTV 媒体卡节点 id */
  mediaNodeId?: string;
  /** 生成产物 OSS URL */
  audioUrl?: string;
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
  rowRevisionHistory?: StoryRowFieldRevision[];
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
  /** 2.0 · 本镜引用的全局道具行 key（道具资产并入分镜图参考） */
  propRefIds?: string[];
  /** v2.5 · 所属集数（大画布看板） */
  episodeNo?: number;
  /** v2.5 · 制作中 / 已提交（看板交付） */
  stageStatus?: "draft" | "submitted";
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

/** 2.0 · 道具列节点 data */
export type StoryProPropColumnNodeData = {
  rows: StoryProPropRow[];
  batchImage?: CanvasEnginePick;
  hubNodeId?: string;
};

/** 2.0 · 氛围列节点 data（独立节点，引用现有风格库） */
export type StoryProMoodColumnNodeData = {
  rows: StoryProMoodRow[];
  batchImage?: CanvasEnginePick;
  hubNodeId?: string;
};

/** 2.0 · 音效列节点 data */
export type StoryProAudioColumnNodeData = {
  rows: StoryProAudioRow[];
  batchAudio?: CanvasEnginePick;
  hubNodeId?: string;
  /** 上游分镜视频列 id（音效跟随镜头） */
  frameColumnId?: string;
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
  /** 剧本创作画布 · 工业化标准化分批生成 */
  scriptStudioMode?: boolean;
  /** 小白生剧 / 上传剧本 */
  scriptStudioInputMode?: StoryProStarterMode;
  /** 剧本创作 · 主题或描述（迁移前 starter 入口） */
  scriptStudioThemeInput?: string;
  scriptStudioSystem?: "original" | "adaptation";
  scriptStudioTotalEpisodes?: number;
  /** 当前批次 index（0 = 第 1–10 集） */
  scriptStudioBatchIndex?: number;
  /** 4 份冻结档案 + 已完成批次 Markdown（JSON 内嵌，大文本后续可迁 OSS） */
  scriptStudioFrozenBiblesMd?: string;
  /** 冻结档案 OSS（超 32KB 时异步上传） */
  scriptStudioFrozenBiblesOssUrl?: string;
  scriptStudioCompletedBatchesMd?: string;
  /** 已完成批次 OSS（可选） */
  scriptStudioCompletedBatchesOssUrl?: string;
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
  /** 协作画布 · 关联已发布剧本包后的本地公告条 */
  crewBulletin?: import("./crew-bulletin-types").CrewBulletinState;
  /** 迁移前 starter 上的发布标记（迁入 hub 后清除） */
  scriptPublished?: boolean;
  linkedScriptPackageTitle?: string;
  /** 协作画布 · 关联剧本包正文（仅公告条/任务上下文，不在 starter 卡片展示） */
  linkedScriptPackageMarkdown?: string;
  scriptStudioCharacterRows?: StoryProCharacterRow[];
  scriptStudioPropRows?: StoryProPropRow[];
  scriptStudioFrameRows?: StoryProFrameRow[];
  scriptStudioMoodRows?: StoryProMoodRow[];
  scriptStudioAudioRows?: StoryProAudioRow[];
  sceneRows?: StoryProSceneRow[];
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
  /** 剧本创作 · 道具/氛围/音效数据列（解析 rows，UI 走 2.0 媒体卡） */
  propColumnId?: string;
  moodColumnId?: string;
  audioColumnId?: string;
  jianyingExportId?: string;
  /** 生产画布关联的已定稿剧本资产 id */
  linkedScriptPackageAssetId?: string;
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
