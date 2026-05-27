/**
 * 影视专业版 · 节点视觉与尺寸（与快手版 story-node-chrome 隔离）
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

export const PRO_HINT_LABEL_CLASS =
  "text-[10px] font-medium uppercase tracking-wider text-cyan-200/55";

export const PRO_SELECT_CLASS =
  "w-full rounded border border-cyan-400/20 bg-black/40 px-2 py-1.5 text-[12px] text-white disabled:cursor-not-allowed disabled:opacity-45";

export const PRO_TEXTAREA_CLASS =
  "w-full resize-y rounded border border-cyan-400/20 bg-black/40 px-2 py-1.5 text-[12px] text-white disabled:cursor-not-allowed disabled:opacity-45";

export const PRO_TEMPLATE_CHIP_CLASS =
  "nodrag rounded border border-cyan-400/15 bg-cyan-500/8 px-1.5 py-0.5 text-[10px] text-cyan-100/90 transition hover:border-cyan-400/45 hover:bg-cyan-500/18 disabled:cursor-not-allowed disabled:opacity-40";

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
