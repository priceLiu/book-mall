import type { CanvasNodeRuntime } from "./types";
import type { StoryTextRevision } from "./story-revision";

export type StoryLlmSection =
  | "outline"
  | "character"
  | "scene"
  | "storyboard"
  | "shot_prompts";

/** 快手/专业版 hub 文案槽（book-mall runner / hydrate） */
export type StoryScriptHubNodeData = {
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
  hubGenerateIntent?: boolean;
  scriptFinalized?: boolean;
};
