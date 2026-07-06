/**
 * 漫剧（橙）/ 影视专业 1.0（青）/ 影视专业 2.0（紫罗兰）列节点共用组件配色分流。
 */

import { PRO2_NODE_ACCENT, PRO2_NODE_ACCENT_SOFT } from "./story-pro2-node-chrome";
import {
  PRO_MODAL_OUTLINE_BTN_CLASS,
  PRO_MODAL_SAVE_BTN_CLASS,
  PRO_MODAL_TAB_IDLE_CLASS,
  PRO_MODAL_TAB_SELECTED_CLASS,
} from "./story-pro-node-chrome";

export type StoryEdition = "comic" | "pro" | "pro2";

export const STORY_COMIC_ACCENT = "#fb923c";
export const STORY_COMIC_ACCENT_SOFT = "#fdba74";

export const STORY_PRO_ACCENT = "#22d3ee";
export const STORY_PRO_ACCENT_SOFT = "#67e8f9";

export const STORY_PRO2_ACCENT = PRO2_NODE_ACCENT;
export const STORY_PRO2_ACCENT_SOFT = PRO2_NODE_ACCENT_SOFT;

export function storyEditionFromNodeType(type: string | undefined): StoryEdition {
  if (
    type?.startsWith("story-pro2-") ||
    type === "jianying-export-pro2" ||
    type === "jianying-auto-render-pro2"
  ) {
    return "pro2";
  }
  return type?.startsWith("story-pro-") ? "pro" : "comic";
}

/** 专业版工作区（1.0 + 2.0）共享的资产 / 三视图 / 场景库能力 */
export function storyEditionUsesProWorkspace(edition: StoryEdition): boolean {
  return edition === "pro" || edition === "pro2";
}

export function storyEditionAccent(edition: StoryEdition): string {
  if (edition === "pro2") return STORY_PRO2_ACCENT;
  return edition === "pro" ? STORY_PRO_ACCENT : STORY_COMIC_ACCENT;
}

export function storyEditionSoft(edition: StoryEdition): string {
  if (edition === "pro2") return STORY_PRO2_ACCENT_SOFT;
  return edition === "pro" ? STORY_PRO_ACCENT_SOFT : STORY_COMIC_ACCENT_SOFT;
}

export const STORY_COMIC_BATCH_BTN_CLASS =
  "rounded-md bg-[#fb923c] font-medium text-black hover:bg-[#fdba74] disabled:cursor-not-allowed disabled:bg-[#fb923c] disabled:text-black disabled:opacity-100 disabled:hover:bg-[#fb923c]";

export const STORY_PRO_BATCH_BTN_CLASS =
  "rounded-md border border-cyan-400/45 bg-cyan-500/25 font-medium text-cyan-50 hover:bg-cyan-500/35 disabled:cursor-not-allowed disabled:border-cyan-400/25 disabled:bg-cyan-500/10 disabled:text-cyan-200/40";

export const STORY_PRO2_BATCH_BTN_CLASS =
  "rounded-md bg-[var(--canvas-accent)] font-medium text-white hover:bg-[var(--canvas-accent-soft)] disabled:cursor-not-allowed disabled:opacity-50";

export function storyEditionBatchBtnClass(edition: StoryEdition): string {
  if (edition === "pro2") return STORY_PRO2_BATCH_BTN_CLASS;
  return edition === "pro" ? STORY_PRO_BATCH_BTN_CLASS : STORY_COMIC_BATCH_BTN_CLASS;
}

export function storyEditionActiveRefBorderClass(edition: StoryEdition): string {
  if (edition === "pro2") {
    return "border-violet-400 shadow-[0_0_0_1px_#238636,0_0_10px_rgba(35,134,54,0.4)]";
  }
  return edition === "pro"
    ? "border-cyan-400 shadow-[0_0_0_1px_#22d3ee,0_0_10px_rgba(34,211,238,0.4)]"
    : "border-[#fb923c] shadow-[0_0_0_1px_#fb923c,0_0_10px_rgba(251,146,60,0.4)]";
}

export function storyEditionGeneratingBorderClass(edition: StoryEdition): string {
  if (edition === "pro2") {
    return "canvas-story-media-generating canvas-story-media-generating-pro2 border-violet-400/50";
  }
  return edition === "pro"
    ? "canvas-story-media-generating canvas-story-media-generating-pro border-cyan-400/50"
    : "canvas-story-media-generating border-[#fb923c]/50";
}

export function storyEditionIconBtnClass(edition: StoryEdition): string {
  if (edition === "pro2") {
    return "nodrag inline-flex size-9 items-center justify-center rounded-full border border-violet-400/45 bg-violet-500/20 text-violet-200 hover:bg-violet-500/30";
  }
  return edition === "pro"
    ? "nodrag inline-flex size-9 items-center justify-center rounded-full border border-cyan-400/45 bg-cyan-500/20 text-cyan-200 hover:bg-cyan-500/30"
    : "nodrag inline-flex size-9 items-center justify-center rounded-full border border-[#fb923c]/45 bg-[#fb923c]/20 text-[#fdba74] hover:bg-[#fb923c]/30";
}

export function storyEditionOverlayIconBtnClass(edition: StoryEdition): string {
  if (edition === "pro2") {
    return "nodrag inline-flex size-9 items-center justify-center rounded-full border border-violet-400/40 bg-black/55 text-violet-200 shadow-lg backdrop-blur-sm hover:bg-black/75";
  }
  return edition === "pro"
    ? "nodrag inline-flex size-9 items-center justify-center rounded-full border border-cyan-400/40 bg-black/55 text-cyan-200 shadow-lg backdrop-blur-sm hover:bg-black/75"
    : "nodrag inline-flex size-9 items-center justify-center rounded-full border border-[#fb923c]/40 bg-black/55 text-[#fdba74] shadow-lg backdrop-blur-sm hover:bg-black/75";
}

export function storyEditionVideoOverlayBtnClass(edition: StoryEdition): string {
  if (edition === "pro2") {
    return "nodrag pointer-events-auto absolute bottom-1.5 right-1.5 z-20 inline-flex size-8 items-center justify-center rounded-full border border-violet-400/50 bg-black/70 text-violet-200 shadow-lg backdrop-blur-sm hover:bg-black/85";
  }
  return edition === "pro"
    ? "nodrag pointer-events-auto absolute bottom-1.5 right-1.5 z-20 inline-flex size-8 items-center justify-center rounded-full border border-cyan-400/50 bg-black/70 text-cyan-200 shadow-lg backdrop-blur-sm hover:bg-black/85"
    : "nodrag pointer-events-auto absolute bottom-1.5 right-1.5 z-20 inline-flex size-8 items-center justify-center rounded-full border border-[#fb923c]/50 bg-black/70 text-[#fdba74] shadow-lg backdrop-blur-sm hover:bg-black/85";
}

export function storyEditionSpinClass(
  edition: StoryEdition,
  size: "sm" | "lg" = "sm",
): string {
  const dim = size === "lg" ? "size-8" : "size-6";
  if (edition === "pro2") return `${dim} animate-spin text-violet-300`;
  return edition === "pro"
    ? `${dim} animate-spin text-cyan-300`
    : `${dim} animate-spin text-[#fdba74]`;
}

export function storyEditionSectionChipRingClass(
  edition: StoryEdition,
  active: boolean,
): string {
  if (!active) return "";
  if (edition === "pro2") return "ring-1 ring-violet-400/60";
  return edition === "pro" ? "ring-1 ring-cyan-400/60" : "ring-1 ring-[#fb923c]/60";
}

export function storyEditionCornerRegenBtnClass(edition: StoryEdition): string {
  if (edition === "pro2") {
    return "right-2 top-2 border-violet-400/40 bg-black/55 text-violet-200 hover:bg-black/75";
  }
  return edition === "pro"
    ? "right-2 top-2 border-cyan-400/40 bg-black/55 text-cyan-200 hover:bg-black/75"
    : "right-2 top-2 border-[#fb923c]/40 bg-black/55 text-[#fdba74] hover:bg-black/75";
}

const STORY_MODAL_TAB_BASE =
  "rounded-md px-2.5 py-1.5 text-[12px] font-medium transition disabled:opacity-50";

const STORY_COMIC_MODAL_TAB_SELECTED = "bg-[#fb923c]/25 text-[#fdba74]";
const STORY_COMIC_MODAL_TAB_IDLE =
  "text-white/60 hover:bg-white/10 hover:text-white";

const PRO2_MODAL_TAB_SELECTED = "bg-violet-500/25 text-violet-100";
const PRO2_MODAL_TAB_IDLE =
  "text-white/60 hover:bg-violet-500/10 hover:text-violet-100";

const PRO2_MODAL_SAVE_BTN_CLASS =
  "inline-flex shrink-0 items-center gap-1 rounded-md bg-[var(--canvas-accent)] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[var(--canvas-accent-soft)] disabled:opacity-40";

const PRO2_MODAL_OUTLINE_BTN_CLASS =
  "inline-flex shrink-0 items-center gap-1 rounded-md border border-violet-400/45 bg-violet-500/15 px-3 py-1.5 text-[12px] font-medium text-violet-100 disabled:opacity-40";

export function storyEditionModalTabClass(
  edition: StoryEdition,
  active: boolean,
): string {
  if (edition === "pro2") {
    return `${STORY_MODAL_TAB_BASE} ${
      active ? PRO2_MODAL_TAB_SELECTED : PRO2_MODAL_TAB_IDLE
    }`;
  }
  if (edition === "pro") {
    return `${STORY_MODAL_TAB_BASE} ${
      active ? PRO_MODAL_TAB_SELECTED_CLASS : PRO_MODAL_TAB_IDLE_CLASS
    }`;
  }
  return `${STORY_MODAL_TAB_BASE} ${
    active ? STORY_COMIC_MODAL_TAB_SELECTED : STORY_COMIC_MODAL_TAB_IDLE
  }`;
}

export function storyEditionModalSaveBtnClass(edition: StoryEdition): string {
  if (edition === "pro2") return PRO2_MODAL_SAVE_BTN_CLASS;
  return edition === "pro"
    ? PRO_MODAL_SAVE_BTN_CLASS
    : "inline-flex shrink-0 items-center gap-1 rounded-md bg-[#fb923c] px-3 py-1.5 text-[12px] font-medium text-black disabled:opacity-40";
}

export function storyEditionModalOutlineBtnClass(edition: StoryEdition): string {
  if (edition === "pro2") return PRO2_MODAL_OUTLINE_BTN_CLASS;
  return edition === "pro"
    ? PRO_MODAL_OUTLINE_BTN_CLASS
    : "inline-flex shrink-0 items-center gap-1 rounded-md border border-[#fb923c]/50 bg-[#fb923c]/15 px-3 py-1.5 text-[12px] font-medium text-[#fdba74] disabled:opacity-40";
}
