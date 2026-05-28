/**
 * 漫剧（快手版 orange）与影视专业版（cyan）列节点共用组件时的配色分流。
 */

export type StoryEdition = "comic" | "pro";

export const STORY_COMIC_ACCENT = "#fb923c";
export const STORY_COMIC_ACCENT_SOFT = "#fdba74";

export const STORY_PRO_ACCENT = "#22d3ee";
export const STORY_PRO_ACCENT_SOFT = "#67e8f9";

export function storyEditionFromNodeType(type: string | undefined): StoryEdition {
  return type?.startsWith("story-pro-") ? "pro" : "comic";
}

export function storyEditionAccent(edition: StoryEdition): string {
  return edition === "pro" ? STORY_PRO_ACCENT : STORY_COMIC_ACCENT;
}

export function storyEditionSoft(edition: StoryEdition): string {
  return edition === "pro" ? STORY_PRO_ACCENT_SOFT : STORY_COMIC_ACCENT_SOFT;
}

/** 底栏批量生成主按钮 */
export const STORY_COMIC_BATCH_BTN_CLASS =
  "rounded-md bg-[#fb923c] font-medium text-black hover:bg-[#fdba74] disabled:cursor-not-allowed disabled:bg-[#fb923c] disabled:text-black disabled:opacity-100 disabled:hover:bg-[#fb923c]";

export const STORY_PRO_BATCH_BTN_CLASS =
  "rounded-md border border-cyan-400/45 bg-cyan-500/25 font-medium text-cyan-50 hover:bg-cyan-500/35 disabled:cursor-not-allowed disabled:border-cyan-400/25 disabled:bg-cyan-500/10 disabled:text-cyan-200/40";

export function storyEditionBatchBtnClass(edition: StoryEdition): string {
  return edition === "pro" ? STORY_PRO_BATCH_BTN_CLASS : STORY_COMIC_BATCH_BTN_CLASS;
}

export function storyEditionActiveRefBorderClass(edition: StoryEdition): string {
  return edition === "pro"
    ? "border-cyan-400 shadow-[0_0_0_1px_#22d3ee,0_0_10px_rgba(34,211,238,0.4)]"
    : "border-[#fb923c] shadow-[0_0_0_1px_#fb923c,0_0_10px_rgba(251,146,60,0.4)]";
}

export function storyEditionGeneratingBorderClass(edition: StoryEdition): string {
  return edition === "pro"
    ? "canvas-story-media-generating canvas-story-media-generating-pro border-cyan-400/50"
    : "canvas-story-media-generating border-[#fb923c]/50";
}

export function storyEditionIconBtnClass(edition: StoryEdition): string {
  return edition === "pro"
    ? "nodrag inline-flex size-9 items-center justify-center rounded-full border border-cyan-400/45 bg-cyan-500/20 text-cyan-200 hover:bg-cyan-500/30"
    : "nodrag inline-flex size-9 items-center justify-center rounded-full border border-[#fb923c]/45 bg-[#fb923c]/20 text-[#fdba74] hover:bg-[#fb923c]/30";
}

export function storyEditionOverlayIconBtnClass(edition: StoryEdition): string {
  return edition === "pro"
    ? "nodrag inline-flex size-9 items-center justify-center rounded-full border border-cyan-400/40 bg-black/55 text-cyan-200 shadow-lg backdrop-blur-sm hover:bg-black/75"
    : "nodrag inline-flex size-9 items-center justify-center rounded-full border border-[#fb923c]/40 bg-black/55 text-[#fdba74] shadow-lg backdrop-blur-sm hover:bg-black/75";
}

export function storyEditionVideoOverlayBtnClass(edition: StoryEdition): string {
  return edition === "pro"
    ? "nodrag pointer-events-auto absolute bottom-1.5 right-1.5 z-20 inline-flex size-8 items-center justify-center rounded-full border border-cyan-400/50 bg-black/70 text-cyan-200 shadow-lg backdrop-blur-sm hover:bg-black/85"
    : "nodrag pointer-events-auto absolute bottom-1.5 right-1.5 z-20 inline-flex size-8 items-center justify-center rounded-full border border-[#fb923c]/50 bg-black/70 text-[#fdba74] shadow-lg backdrop-blur-sm hover:bg-black/85";
}

export function storyEditionSpinClass(
  edition: StoryEdition,
  size: "sm" | "lg" = "sm",
): string {
  const dim = size === "lg" ? "size-8" : "size-6";
  return edition === "pro"
    ? `${dim} animate-spin text-cyan-300`
    : `${dim} animate-spin text-[#fdba74]`;
}

export function storyEditionSectionChipRingClass(
  edition: StoryEdition,
  active: boolean,
): string {
  if (!active) return "";
  return edition === "pro" ? "ring-1 ring-cyan-400/60" : "ring-1 ring-[#fb923c]/60";
}

/** 视频列右上角「重新生成」 */
export function storyEditionCornerRegenBtnClass(edition: StoryEdition): string {
  return edition === "pro"
    ? "right-2 top-2 border-cyan-400/40 bg-black/55 text-cyan-200 hover:bg-black/75"
    : "right-2 top-2 border-[#fb923c]/40 bg-black/55 text-[#fdba74] hover:bg-black/75";
}
