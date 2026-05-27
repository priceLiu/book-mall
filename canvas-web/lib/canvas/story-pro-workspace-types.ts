/**
 * 影视专业版（story-pro）工作区类型 — 与快手版完全隔离
 */
import type { CanvasEnginePick, CanvasNodeRuntime } from "./types";
import type { StoryTextRevision } from "./story-revision";
import type { StoryRefImage } from "./story-ref-image";
import type { StoryLlmSection } from "./story-workspace-types";

export type { StoryLlmSection };

export type StoryProRunContext = {
  llmSection?: StoryLlmSection;
  rowKey?: string;
  mediaKind?: "threeView" | "sceneRef" | "frameImage" | "video" | "tts";
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
  storyboardMd: string;
  outlineRuntime?: CanvasNodeRuntime;
  characterRuntime?: CanvasNodeRuntime;
  storyboardRuntime?: CanvasNodeRuntime;
  providerId: string;
  modelKey: string;
  params?: Record<string, unknown>;
  outlineSystemPrompt?: string;
  promptOutline: string;
  promptCharacter: string;
  promptStoryboard: string;
  outlineHistory?: StoryTextRevision[];
  characterHistory?: StoryTextRevision[];
  storyboardHistory?: StoryTextRevision[];
  referencedNodeIds?: string[];
  scriptFinalized?: boolean;
  feasibility?: StoryProFeasibilityAssessment;
};

export type StoryProCharacterRow = {
  key: string;
  name: string;
  role: string;
  appearance: string;
  prompt: string;
  promptHistory?: StoryTextRevision[];
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
  batchVideo?: CanvasEnginePick;
  hubNodeId?: string;
};

export type StoryProVideoColumnNodeData = {
  rows: StoryProVideoRow[];
  batchVideo?: CanvasEnginePick;
  batchTts?: CanvasEnginePick;
  hubNodeId?: string;
  frameColumnId?: string;
};

export type StoryProStarterNodeData = {
  systemPrompt: string;
  systemPromptTemplateId?: string;
  providerId: string;
  modelKey: string;
  params?: Record<string, unknown>;
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
