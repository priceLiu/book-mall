import type { Pro2ScriptCategoryId } from "./pro2-script-category-presets";
import type { StoryProVisualStylePack } from "./story-pro-visual-style-pack";
import type { StoryTextRevision } from "./story-revision";
import type { StoryRefImage } from "./story-ref-image";
import type { CanvasNodeRuntime } from "./types";
import type { Pro2ProductionScript } from "./data/pro2-production-script-schema";

export type StoryProStudioRow = {
  key: string;
  name?: string;
  description?: string;
  prompt?: string;
  frameKey?: string;
};

/** book-mall 侧 Pro2 hub 节点 data（Gateway run / 制作包 hydrate） */
export type StoryProScriptHubNodeData = {
  scriptCategoryId?: Pro2ScriptCategoryId;
  scriptCategoryDocBody?: string;
  scriptCategoryDocTitle?: string;
  scriptCategoryLabel?: string;
  scriptPromptViewId?: "category-doc" | "upstream-outline";
  /** 制作包 prompt 版本 · ≥13 为 JSON-only（与 canvas-web 同步） */
  storyPro2PackPromptVersion?: number;
  /** 大纲段 system/user prompt 摘要 · 可含 json-only-v13 标记 */
  promptOutline?: string;
  dockInput?: string;
  dockRefImages?: StoryRefImage[];
  productionScript?: Pro2ProductionScript;
  outlineMd?: string;
  characterMd?: string;
  sceneMd?: string;
  storyboardMd?: string;
  outlineHistory?: StoryTextRevision[];
  characterHistory?: StoryTextRevision[];
  sceneHistory?: StoryTextRevision[];
  storyboardHistory?: StoryTextRevision[];
  outlineRuntime?: CanvasNodeRuntime;
  characterRuntime?: CanvasNodeRuntime;
  sceneRuntime?: CanvasNodeRuntime;
  storyboardRuntime?: CanvasNodeRuntime;
  visualStylePack?: StoryProVisualStylePack;
  sceneRows?: StoryProStudioRow[];
  scriptStudioCharacterRows?: StoryProStudioRow[];
  scriptStudioFrameRows?: StoryProStudioRow[];
  scriptStudioPropRows?: StoryProStudioRow[];
  scriptStudioMoodRows?: StoryProStudioRow[];
  scriptStudioAudioRows?: StoryProStudioRow[];
};
