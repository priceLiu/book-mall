/**
 * 影视专业版 · 节点视觉与尺寸（与快手版 story-node-chrome 隔离）
 * 设计规范：`canvas-web/docs/design.md` §14
 */

export const PRO_NODE_ACCENT = "#22d3ee";
export const PRO_NODE_ACCENT_SOFT = "rgba(34, 211, 238, 0.12)";
export const PRO_NODE_BORDER = "rgba(34, 211, 238, 0.35)";

export const STORY_PRO_CONTROL_NODE_WIDTH = 1020;
export const STORY_PRO_CONTROL_NODE_HEIGHT = 1200;
export const STORY_PRO_STYLE_NODE_EXTRA_H = 220;

export const PRO_NODE_SHELL_FOOTER_CLASS =
  "shrink-0 border-t border-cyan-400/15 bg-gradient-to-t from-cyan-950/20 to-transparent px-3 pb-3 pt-2.5";

export const PRO_NODE_ACTION_BTN_CLASS =
  "nodrag inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-cyan-400/40 bg-cyan-500/15 px-2 text-[12px] font-medium text-cyan-100 transition hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-40";

export const PRO_NODE_ACTION_BTN_SPLIT_CLASS =
  "nodrag inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-md border border-cyan-400/40 bg-cyan-500/15 px-2 text-[12px] font-medium leading-tight text-cyan-100 transition hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-40";

/** 字段标签（与 §8 绿色 chrome 一致，专业版表单共用） */
export const PRO_HINT_LABEL_CLASS =
  "text-[10px] font-medium uppercase tracking-wider text-emerald-300/85";

export const PRO_SELECT_CLASS =
  "w-full rounded border border-cyan-400/20 bg-black/40 px-2 py-1.5 text-[12px] text-white disabled:cursor-not-allowed disabled:opacity-45";

export const PRO_TEXTAREA_CLASS =
  "w-full resize-y rounded border border-cyan-400/20 bg-black/40 px-2 py-1.5 text-[12px] text-white disabled:cursor-not-allowed disabled:opacity-45";

export const PRO_TEMPLATE_CHIP_CLASS =
  "nodrag rounded border border-cyan-400/15 bg-cyan-500/8 px-1.5 py-0.5 text-[10px] text-cyan-100/90 transition hover:border-cyan-400/45 hover:bg-cyan-500/18 disabled:cursor-not-allowed disabled:opacity-40";

export const PRO_TEMPLATE_CHIP_SELECTED_CLASS =
  "border-cyan-300/70 bg-cyan-500/20 text-cyan-50";

/** 行内资产四槽 / 三槽面板 */
export const PRO_ASSET_PANEL_CLASS =
  "rounded-md border border-cyan-400/12 bg-black/25 p-2";

/** 槽位工具栏：上传 / 锁定 / 删除（中性灰） */
export const PRO_SLOT_TOOLBAR_BTN_CLASS =
  "nodrag rounded p-0.5 text-white/45 hover:bg-white/5 hover:text-white/75 disabled:opacity-40";

/** 槽位工具栏：入库到项目资产（青色图标） */
export const PRO_SLOT_IMPORT_BTN_CLASS =
  "nodrag rounded p-0.5 text-cyan-300/75 hover:bg-white/5 hover:text-cyan-200 disabled:opacity-30";

export const PRO_ASSET_IMPORT_ICON_CLASS = "size-3 shrink-0 text-cyan-300/85";

/** 行内次要操作（裁切、保存到三视图槽等） */
export const PRO_ROW_SECONDARY_BTN_CLASS =
  "nodrag rounded border border-white/15 px-2 py-0.5 text-[10px] text-white/75 hover:bg-white/5 disabled:opacity-40";

/** 行内主操作（快捷保存三视图等） */
export const PRO_ROW_PRIMARY_BTN_CLASS =
  "nodrag w-full rounded border border-cyan-400/30 bg-cyan-500/10 px-2 py-1 text-[10px] text-cyan-100 hover:bg-cyan-500/20 disabled:opacity-40";

/** 保存到项目资产（全局风格等，翡翠绿次要 CTA） */
export const PRO_SAVE_TO_ASSETS_BTN_CLASS =
  "nodrag w-full rounded border border-emerald-400/25 bg-emerald-500/8 px-2 py-1.5 text-[11px] text-emerald-100 hover:bg-emerald-500/15 disabled:opacity-40";

/** 阶段指引面板 */
export const PRO_GUIDE_PANEL_CLASS =
  "nodrag shrink-0 rounded-lg border border-cyan-400/15 bg-gradient-to-br from-cyan-950/30 to-transparent px-2.5 py-2";

export const PRO_GUIDE_TITLE_CLASS =
  "mb-1.5 text-[10px] font-medium uppercase tracking-wider text-cyan-300/70";

export const PRO_GUIDE_STEP_ICON_CLASS = "mt-0.5 size-3 shrink-0 text-cyan-400/60";

export const PRO_GUIDE_STEP_NUM_CLASS = "font-mono text-[9px] text-cyan-400/50";

/** 风格节点 · 参考图上传区 */
export const PRO_UPLOAD_DROPZONE_CLASS =
  "nodrag flex w-full items-center gap-2 rounded border border-dashed border-cyan-400/25 bg-cyan-500/8 px-2 py-2 text-left text-[11px] text-white/80 transition hover:border-cyan-400/45 hover:bg-cyan-500/12 disabled:cursor-not-allowed disabled:opacity-45";

export const PRO_REF_THUMB_CLASS =
  "group relative size-14 overflow-hidden rounded border border-cyan-400/20 bg-black/40";

/** 专业版弹层顶栏（定稿剧本、上传预览等） */
export const PRO_MODAL_HEADER_CLASS =
  "nodrag flex shrink-0 items-center gap-3 border-b border-cyan-400/20 bg-gradient-to-r from-cyan-950/50 via-[#0b1220] to-cyan-950/30 px-4 py-3";

export const PRO_MODAL_TITLE_CLASS = "truncate text-sm font-medium text-cyan-50";

export const PRO_MODAL_SUBTITLE_CLASS = "truncate text-[11px] text-cyan-200/55";

export const PRO_ICON_ACCENT_CLASS = "text-cyan-300";

/** 项目资产侧栏 / 页 */
export const PRO_ASSETS_SIDEBAR_BORDER_CLASS = "border-cyan-400/15";

export const PRO_ASSETS_CARD_CLASS =
  "rounded-lg border border-cyan-400/15 bg-cyan-950/20 p-3";

export const PRO_ASSETS_TAB_ACTIVE_CLASS =
  "bg-cyan-500/20 text-cyan-50";

export const PRO_ASSETS_TAB_IDLE_CLASS =
  "text-white/60 hover:bg-white/5";

export const PRO_ASSETS_LINK_CLASS =
  "text-cyan-200/70 hover:bg-white/5 hover:text-cyan-100";

/** 五阶段进度条 */
export const PRO_STAGE_CONNECTOR_DONE_CLASS = "bg-cyan-400/50";

export const PRO_STAGE_CONNECTOR_IDLE_CLASS = "bg-white/10";

export const PRO_STAGE_CHIP_ACTIVE_CLASS =
  "border-cyan-400/50 bg-cyan-500/15";

export const PRO_STAGE_CHIP_DONE_CLASS =
  "border-emerald-400/30 bg-emerald-500/8";

export const PRO_STAGE_CHIP_IDLE_CLASS =
  "border-white/8 bg-white/[0.03]";

export const PRO_STAGE_STEP_ACTIVE_CLASS = "text-cyan-300";

export const PRO_STAGE_STEP_DONE_CLASS = "text-emerald-300/80";

export const PRO_STAGE_STEP_IDLE_CLASS = "text-white/35";

export const PRO_STAGE_LABEL_ACTIVE_CLASS = "text-cyan-100";

export const PRO_STAGE_LABEL_DONE_CLASS = "text-emerald-200/90";

export const PRO_STAGE_LABEL_IDLE_CLASS = "text-white/45";

export const PRO_STAGE_BADGE_CLASS =
  "ml-1 shrink-0 rounded px-1 py-0.5 font-mono text-[8px] uppercase tracking-widest text-cyan-400/40";

/** 弹层 Tab / 主按钮（与快手橙对称，供 story-edition-chrome 分流） */
export const PRO_MODAL_TAB_SELECTED_CLASS =
  "bg-cyan-500/25 text-cyan-100";

export const PRO_MODAL_TAB_IDLE_CLASS =
  "text-white/60 hover:bg-white/10 hover:text-white";

export const PRO_MODAL_SAVE_BTN_CLASS =
  "inline-flex shrink-0 items-center gap-1 rounded-md border border-cyan-400/45 bg-cyan-500/20 px-3 py-1.5 text-[12px] font-medium text-cyan-50 disabled:opacity-40";

export const PRO_MODAL_OUTLINE_BTN_CLASS =
  "inline-flex shrink-0 items-center gap-1 rounded-md border border-cyan-400/50 bg-cyan-500/15 px-3 py-1.5 text-[12px] font-medium text-cyan-100 disabled:opacity-40";

export type StoryProStageId = "story" | "style" | "design" | "frame" | "video";

export const STORY_PRO_PIPELINE_STAGES: {
  id: StoryProStageId;
  step: number;
  label: string;
  shortHint: string;
}[] = [
  { id: "story", step: 1, label: "故事", shortHint: "剧本定稿" },
  { id: "style", step: 2, label: "风格", shortHint: "锚定词" },
  { id: "design", step: 3, label: "设计", shortHint: "人物/场景" },
  { id: "frame", step: 4, label: "分镜", shortHint: "静帧脚本" },
  { id: "video", step: 5, label: "视频", shortHint: "生成导出" },
];

export const STORY_PRO_STAGE_GUIDES: Record<
  StoryProStageId | "starter",
  { title: string; steps: string[] }
> = {
  starter: {
    title: "阶段 0 · 启动",
    steps: [
      "上传 .md / .txt 完整剧本（推荐 Markdown）",
      "编辑导演提示词，输入 @ 引用「上传剧本」",
      "点击「解析剧本」→ 在「故事剧本」审阅定稿",
    ],
  },
  story: {
    title: "阶段 1 · 故事层",
    steps: [
      "审阅大纲 / 角色 / 分镜 / 对白",
      "确认 AI 可行性评估",
      "点击「故事定稿」进入风格层（不自动生成媒体）",
    ],
  },
  style: {
    title: "阶段 2 · 风格层",
    steps: [
      "选择主风格 / 色调 / 质感，或套用模板一键填入锚定词",
      "锚定词与参考图均为可选，可点「AI 生成草稿」辅助填写",
      "点击「风格定稿 · 生成工作流」展开人物 / 场景 / 分镜 / 视频列",
    ],
  },
  design: {
    title: "阶段 3 · 设计层",
    steps: ["人物三视图与场景资产", "手动触发生图", "定稿前仅拆分 row"],
  },
  frame: {
    title: "阶段 4 · 分镜层",
    steps: ["镜号 / 景别 / 运镜 / 时长", "逐镜生成静帧", "保持风格锚定注入"],
  },
  video: {
    title: "阶段 5 · 视频层",
    steps: ["分镜视频与配音", "手动触发生成", "剪映导出 ZIP"],
  },
};
