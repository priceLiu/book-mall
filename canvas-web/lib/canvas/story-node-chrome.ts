/**
 * 漫剧节点 · 统一底栏按钮高度、故事主题/故事大纲固定尺寸。
 */

import { STORY_ORANGE_BTN_CLASS } from "@/components/canvas/story-column-batch-footer";
import { STORY_THEME_SYSTEM_PROMPT_TEMPLATES } from "./story-prompts";
import type { CanvasFlowNode } from "./types";

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

export const STORY_NODE_ACTION_BTN_CLASS = `nodrag inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md px-2 text-[12px] font-medium ${STORY_ORANGE_BTN_CLASS}`;

/** 故事大纲等 · 底栏并排双按钮 */
export const STORY_NODE_ACTION_BTN_SPLIT_CLASS = `nodrag inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-md px-2 text-[12px] font-medium leading-tight ${STORY_ORANGE_BTN_CLASS}`;

/** 故事主题 + 故事大纲 · 统一宽度（大纲原 720 + 200） */
export const STORY_CONTROL_NODE_WIDTH = 1020;

/** @deprecated 与 STORY_CONTROL_NODE_WIDTH 相同 */
export const STORY_COMIC_STARTER_WIDTH = STORY_CONTROL_NODE_WIDTH;

/** @deprecated 与 STORY_CONTROL_NODE_WIDTH 相同 */
export const STORY_SCRIPT_HUB_WIDTH = STORY_CONTROL_NODE_WIDTH;

/** 故事主题 + 故事大纲 · 统一固定高度（预览区 flex-1 内滚，底栏固定） */
export const STORY_CONTROL_NODE_HEIGHT = 1200;

/** 故事主题 · 底栏模型选择区（固定，不随预览滚动） */
export const STORY_NODE_ENGINE_DOCK_CLASS =
  "nodrag shrink-0 space-y-1.5 pb-2 pt-1";

/** 故事主题 / 大纲 · 预览滚动区外壳 */
export const STORY_NODE_PREVIEW_SCROLL_CLASS =
  "nodrag min-h-0 flex-1 overflow-y-auto";

function storyThemeTemplateOneContent(): string {
  const hit = STORY_THEME_SYSTEM_PROMPT_TEMPLATES.find(
    (t) => t.id === "full-pack-detailed",
  );
  return hit?.content ?? STORY_THEME_SYSTEM_PROMPT_TEMPLATES[0]?.content ?? "";
}

function storyStarterPreviewCharsPerLine(): number {
  return Math.max(28, Math.floor((STORY_CONTROL_NODE_WIDTH - 28) / 14));
}

function storyThemePromptVisualLines(raw: string): number {
  const cpl = storyStarterPreviewCharsPerLine();
  let total = 0;
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      total += 0.45;
      continue;
    }
    const isBracket = /^【.+】$/.test(trimmed);
    const isSection = /^[一二三四五六七八九十]+、/.test(trimmed);
    const isTheme = /^主题：/.test(trimmed);
    const wrapped = Math.max(1, Math.ceil(trimmed.length / cpl));
    total += wrapped;
    if (isBracket || isTheme) total += 0.6;
    if (isSection) total += 0.4;
  }
  return Math.ceil(total) + 1;
}

/** 模板一 · 视觉行数（弹层/估算用） */
export function storyThemeTemplateOneVisualLines(): number {
  return storyThemePromptVisualLines(storyThemeTemplateOneContent());
}

/** 用户文案是否长于模板一（弹层逻辑） */
export function storyThemePromptExceedsTemplateOne(systemPrompt?: string): boolean {
  if (!systemPrompt?.trim()) return false;
  return (
    storyThemePromptVisualLines(systemPrompt) >
    storyThemeTemplateOneVisualLines()
  );
}

/** 故事主题 + 故事大纲 · 固定节点高度 */
export function storyControlNodeHeight(): number {
  return STORY_CONTROL_NODE_HEIGHT;
}

/** @deprecated 使用 storyControlNodeHeight */
export function storyComicStarterNodeHeight(_systemPrompt?: string): number {
  return STORY_CONTROL_NODE_HEIGHT;
}

/** @deprecated 使用 storyControlNodeHeight */
export function storyScriptHubNodeHeight(
  _previewContent?: string,
  _previewPaneOverride?: number,
): number {
  return STORY_CONTROL_NODE_HEIGHT;
}

/** 同排节点高度（二者同高） */
export function storyControlRowHeight(_nodes?: CanvasFlowNode[]): number {
  return STORY_CONTROL_NODE_HEIGHT;
}
