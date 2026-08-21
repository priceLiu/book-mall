import type { StoryProScriptHubNodeData } from "./story-pro-workspace-types";

export type StoryProColumnRow = {
  key: string;
  name?: string;
  description?: string;
  prompt?: string;
  frameKey?: string;
};

export type StoryProColumnSyncExisting = Partial<{
  characterRows: StoryProColumnRow[];
  sceneRows: StoryProColumnRow[];
  frameRows: StoryProColumnRow[];
  videoRows: StoryProColumnRow[];
}>;

/** book-mall 无画布列节点；保留现有行供 productionScript 回写 */
export function syncStoryProColumnRows(
  _hubData: StoryProScriptHubNodeData,
  existing?: StoryProColumnSyncExisting,
  _scriptHubId?: string,
): {
  characterRows: StoryProColumnRow[];
  sceneRows: StoryProColumnRow[];
  frameRows: StoryProColumnRow[];
  videoRows: StoryProColumnRow[];
} {
  return {
    characterRows: existing?.characterRows ?? [],
    sceneRows: existing?.sceneRows ?? [],
    frameRows: existing?.frameRows ?? [],
    videoRows: existing?.videoRows ?? [],
  };
}
