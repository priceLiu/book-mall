/** 故事大纲审阅弹层 · 编辑区统一文案与按钮（真源，改 UX 须同步 design.md §6） */

export const STORY_HUB_TOGGLE_BTN_CLASS =
  "rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-[11px] text-neutral-600 hover:bg-neutral-50";

export const STORY_HUB_TOGGLE_TO_SOURCE_LABEL = "切换 Markdown 源码";
export const STORY_HUB_TOGGLE_TO_TABLE_LABEL = "切换表格编辑";
export const STORY_HUB_TOGGLE_TO_RENDER_LABEL = "切换渲染编辑";

export const STORY_HUB_LEFT_HINT = {
  outline:
    "左侧块级渲染编辑 · 表格可点格改，正文点段落后上方保持渲染；保存后写入故事大纲",
  character: "左侧表格编辑 · 右侧为渲染原稿；保存后写入角色设定",
  storyboard: "左侧表格编辑 · 右侧为渲染原稿；台词说话人须与角色表一致",
  dialogue: "",
  sourceOnly: "左侧 Markdown 源码 · 右侧为渲染预览；保存后写入正式副本",
  readOnlyTable: "已定稿只读 · 左侧为表格排版审阅（非 Markdown 源码）",
  readOnlyOutline: "已定稿只读 · 块级渲染审阅",
} as const;

export const STORY_HUB_RIGHT_PREVIEW_HINT =
  "表格 / 标题在此正确排版 · 随左侧实时更新";
