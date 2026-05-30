import type { CanvasEnginePick, CanvasNodeRuntime } from "./types";
import type { StoryTextRevision } from "./story-revision";
import type { StoryRefImage } from "./story-ref-image";

export type StoryLlmSection = "outline" | "character" | "storyboard";

export type StoryRunContext = {
  llmSection?: StoryLlmSection;
  rowKey?: string;
  mediaKind?: "threeView" | "frameImage" | "video" | "tts" | "sceneRef";
};

export type StoryCharacterRow = {
  key: string;
  name: string;
  role: string;
  appearance: string;
  prompt: string;
  promptHistory?: StoryTextRevision[];
  runtime?: CanvasNodeRuntime;
  /** 影视专业版 · 已绑定人物资产库 */
  assetId?: string;
  lockedRefIds?: string[];
};

export type StoryFrameRow = {
  frameIndex: number;
  key: string;
  scene: string;
  /** 分镜表「景别」列；与场景名列分离，勿用景别充当场景设计行名 */
  shotSize?: string;
  description: string;
  dialogue: string;
  videoPrompt: string;
  prompt: string;
  promptHistory?: StoryTextRevision[];
  referencedNodeIds?: string[];
  runtime?: CanvasNodeRuntime;
  /** 上游参考图（角色三视图），prompt 内用 @<id> 引用 */
  refImages?: StoryRefImage[];
  /** @deprecated 由 refImages 推导；runner 兼容 */
  refImageUrls?: string[];
  /** 分镜静帧人工过审时间（ISO）；空 = 未过审，不可生成视频 */
  frameApprovedAt?: string;
  frameRejectedReason?: string;
  /** 影视专业版 · P-B2 资产 version 快照 */
  characterRefSnapshotAt?: string;
  characterAssetVersions?: Record<string, number>;
  characterRefIds?: string[];
};

export type StoryVideoRow = {
  frameIndex: number;
  key: string;
  dialogue: string;
  videoPrompt?: string;
  videoPromptHistory?: StoryTextRevision[];
  videoReferencedNodeIds?: string[];
  ttsPrompt?: string;
  ttsPromptHistory?: StoryTextRevision[];
  /** 分镜图参考 */
  refImages?: StoryRefImage[];
  frameImageUrl?: string;
  /** 从分镜行同步 · 视频门禁 */
  frameApprovedAt?: string;
  videoRuntime?: CanvasNodeRuntime;
  ttsRuntime?: CanvasNodeRuntime;
};

export type StoryScriptHubNodeData = {
  outlineMd: string;
  characterMd: string;
  storyboardMd: string;
  outlineRuntime?: CanvasNodeRuntime;
  characterRuntime?: CanvasNodeRuntime;
  storyboardRuntime?: CanvasNodeRuntime;
  providerId: string;
  modelKey: string;
  params?: Record<string, unknown>;
  /** 大纲段 LLM system（通常由故事主题同步） */
  outlineSystemPrompt?: string;
  promptOutline: string;
  promptCharacter: string;
  promptStoryboard: string;
  outlineHistory?: StoryTextRevision[];
  characterHistory?: StoryTextRevision[];
  storyboardHistory?: StoryTextRevision[];
  referencedNodeIds?: string[];
  /** 已定稿并生成工作流后锁定 hub 文案；删除本套媒体列后自动解除 */
  scriptFinalized?: boolean;
};

export type StoryCharacterColumnNodeData = {
  rows: StoryCharacterRow[];
  batchImage?: CanvasEnginePick;
  hubNodeId?: string;
};

export type StoryFrameColumnNodeData = {
  rows: StoryFrameRow[];
  /** 分镜脚本列 · 批量视频模型 */
  batchVideo?: CanvasEnginePick;
  /** @deprecated 改用 batchVideo */
  batchImage?: CanvasEnginePick;
  hubNodeId?: string;
  /** 影视专业版 · P-A2 静帧注入风格参考图 */
  injectStyleRefs?: boolean;
  styleRefImageUrls?: string[];
};

export type StoryVideoColumnNodeData = {
  rows: StoryVideoRow[];
  batchVideo?: CanvasEnginePick;
  batchTts?: CanvasEnginePick;
  hubNodeId?: string;
  frameColumnId?: string;
};

export type StoryWorkspaceIds = {
  scriptHubId: string;
  /** 后续步骤再创建媒体列 */
  characterColumnId?: string;
  frameColumnId?: string;
  videoColumnId?: string;
  jianyingExportId?: string;
};
