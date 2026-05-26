import type { CanvasEnginePick, CanvasNodeRuntime } from "./types";
import type { StoryTextRevision } from "./story-revision";
import type { StoryRefImage } from "./story-ref-image";

export type StoryLlmSection = "outline" | "character" | "storyboard";

export type StoryRunContext = {
  llmSection?: StoryLlmSection;
  rowKey?: string;
  mediaKind?: "threeView" | "frameImage" | "video" | "tts";
};

export type StoryCharacterRow = {
  key: string;
  name: string;
  role: string;
  appearance: string;
  prompt: string;
  promptHistory?: StoryTextRevision[];
  runtime?: CanvasNodeRuntime;
};

export type StoryFrameRow = {
  frameIndex: number;
  key: string;
  scene: string;
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
