import type { Pro2ScriptCategoryId } from "./pro2-script-category-presets";

/** book-mall 侧 Pro2 hub 节点 data 子集（Gateway run / 制作包 prompt 用） */
export type StoryProScriptHubNodeData = {
  scriptCategoryId?: Pro2ScriptCategoryId;
  scriptCategoryDocBody?: string;
  dockInput?: string;
};
