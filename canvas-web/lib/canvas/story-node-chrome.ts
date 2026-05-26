/**
 * 漫剧节点 · 统一底栏按钮高度、NodeShell footer 内边距、故事主题节点高度推算。
 */

import { STORY_ORANGE_BTN_CLASS } from "@/components/canvas/story-column-batch-footer";
import { STORY_THEME_SYSTEM_PROMPT_TEMPLATES } from "./story-prompts";

/** NodeShell 底栏容器（所有带 footer 的漫剧/引擎节点共用） */
export const STORY_NODE_SHELL_FOOTER_CLASS =
  "shrink-0 border-t border-white/10 bg-[var(--canvas-surface)] px-3 pb-3 pt-2.5";

/** 主操作按钮可视高度（py-2 + 12px 字行） */
export const STORY_NODE_ACTION_BTN_H = 36;

/** 单行底栏提示（如「自动连接故事大纲」） */
export const STORY_NODE_FOOTER_HINT_H = 16;

/** 底栏内按钮与提示间距（与 Tailwind gap-2 一致） */
export const STORY_NODE_FOOTER_INNER_GAP = 8;

/** 底栏内容区最小高度（按钮 + gap + 提示行），见 story-node-footer-shell */
export const STORY_NODE_FOOTER_CONTENT_MIN_H =
  STORY_NODE_ACTION_BTN_H + STORY_NODE_FOOTER_INNER_GAP + STORY_NODE_FOOTER_HINT_H;

/** 系统提示词 textarea · 每行约高（12px 字 + 行距） */
export const STORY_STARTER_PROMPT_LINE_PX = 18;

export const STORY_NODE_ACTION_BTN_CLASS = `nodrag inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md px-2 text-[12px] font-medium ${STORY_ORANGE_BTN_CLASS}`;

/** 故事大纲等 · 底栏并排双按钮 */
export const STORY_NODE_ACTION_BTN_SPLIT_CLASS = `nodrag inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-md px-2 text-[12px] font-medium leading-tight ${STORY_ORANGE_BTN_CLASS}`;

export function storyThemeLongestTemplateLineCount(): number {
  return Math.max(
    ...STORY_THEME_SYSTEM_PROMPT_TEMPLATES.map(
      (t) => t.content.split("\n").length,
    ),
    1,
  );
}

export function storyStarterPromptTextareaMinHeight(): number {
  return (
    storyThemeLongestTemplateLineCount() * STORY_STARTER_PROMPT_LINE_PX + 16
  );
}

/**
 * 故事主题节点总高度：最长模板全文可见（无内滚）+ 模型区 + 统一底栏。
 */
export function storyComicStarterNodeHeight(): number {
  const shellHeader = 52;
  const bodyPad = 24;
  const templateTabs = 28;
  const textarea = storyStarterPromptTextareaMinHeight();
  const engineBlock = 88;
  const footerBlock = STORY_NODE_FOOTER_CONTENT_MIN_H;
  const shellFooterPad = 22;
  return (
    shellHeader +
    bodyPad +
    templateTabs +
    textarea +
    8 +
    engineBlock +
    footerBlock +
    shellFooterPad
  );
}
