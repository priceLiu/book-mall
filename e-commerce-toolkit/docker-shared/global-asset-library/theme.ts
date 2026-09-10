import type { GlobalAssetLibraryVariant } from "./types";

/** GALD 弹层 · 固定 50vw × 60vh，避免加载前后尺寸跳动 */
export const GALD_DIALOG_SHELL_CLASS =
  "flex h-[60vh] w-[50vw] min-w-[480px] max-w-[1200px] flex-col overflow-hidden rounded-2xl border shadow-xl";

/** 主内容区最小高度（加载中也占位） */
export const GALD_BODY_CLASS = "flex min-h-0 flex-1 overflow-hidden";

/** 素材网格 · 固定 6 列 */
export const GALD_GRID_CLASS = "grid grid-cols-6 gap-2";

/** 缩略图格 · 固定高度，避免 3:4 人像撑满 */
export const GALD_TILE_CLASS = "relative h-[108px] w-full overflow-hidden rounded-md border";

/** 首屏条数（约 3 行 × 6 列） */
export const GALD_PAGE_SIZE = 18;

/** 统一圆形关闭钮 */
export const GALD_CLOSE_BTN_CLASS =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors";

/** 「官方」角标 · 全站统一（与 canvas-web --canvas-bg 一致） */
export const GALD_OFFICIAL_BADGE_BG = "#191919";
export const GALD_OFFICIAL_BADGE_CLASS =
  "pointer-events-none absolute bottom-2 right-2 z-[4] select-none rounded px-1 py-0.5 text-[7px] font-medium leading-none text-white";

export type GlobalAssetTheme = {
  overlay: string;
  shell: string;
  header: string;
  sidebar: string;
  filterBar: string;
  footer: string;
  textPrimary: string;
  textSecondary: string;
  border: string;
  borderStrong: string;
  cardHover: string;
  cardSelected: string;
  navActive: string;
  navIdle: string;
  pill: string;
  segmentedTrack: string;
  segmentedActive: string;
  segmentedIdle: string;
  btnSecondary: string;
  btnPrimary: string;
};

const LIGHT: GlobalAssetTheme = {
  overlay: "bg-black/80",
  shell: "bg-white border-[#e8e8ed]",
  header: "border-[#f0f0f2]",
  sidebar: "bg-[#fafafa] border-[#f0f0f2]",
  filterBar: "bg-[#fafafa] border-[#f0f0f2]",
  footer: "bg-[#fafafa] border-[#f0f0f2]",
  textPrimary: "text-[#1d1d1f]",
  textSecondary: "text-[#86868b]",
  border: "border-[#e8e8ed]",
  borderStrong: "border-[#1d1d1f]",
  cardHover: "hover:border-[#d2d2d7] hover:bg-[#f5f5f7]",
  cardSelected: "border-2 border-[#1d1d1f] bg-[#fafafa]",
  navActive: "bg-[#ebebed] font-medium text-[#1d1d1f]",
  navIdle:
    "text-[#86868b] hover:bg-[#f0f0f2] hover:text-[#1d1d1f] active:bg-[#e8e8ed]",
  pill: "bg-[#f0f0f2] text-[#6e6e73]",
  segmentedTrack: "bg-[#f0f0f2]",
  segmentedActive: "bg-white text-[#1d1d1f] shadow-sm",
  segmentedIdle:
    "text-[#86868b] hover:bg-white/60 hover:text-[#424245] active:text-[#1d1d1f]",
  btnSecondary: "border border-[#d2d2d7] bg-white text-[#1d1d1f] hover:bg-[#f5f5f7]",
  btnPrimary: "bg-[#1d1d1f] text-white hover:bg-[#333]",
};

const DARK: GlobalAssetTheme = {
  overlay: "bg-black/85",
  shell: "bg-[#1c1c1e] border-white/10",
  header: "border-white/10",
  sidebar: "bg-[#2c2c2e] border-white/10",
  filterBar: "bg-[#2c2c2e] border-white/10",
  footer: "bg-[#2c2c2e] border-white/10",
  textPrimary: "text-[#f5f5f7]",
  textSecondary: "text-[#aeaeb2]",
  border: "border-white/10",
  borderStrong: "border-[#f5f5f7]",
  cardHover: "hover:border-white/20 hover:bg-[#2c2c2e]",
  cardSelected: "border-2 border-[#f5f5f7] bg-[#2c2c2e]",
  navActive: "bg-white/[0.12] font-medium text-white",
  navIdle:
    "text-[#c5c5ca] hover:bg-white/[0.08] hover:text-[#fafafa] active:bg-white/[0.12] active:text-white",
  pill: "bg-[#3a3a3c] text-[#aeaeb2]",
  segmentedTrack: "bg-[#3a3a3c]",
  segmentedActive: "bg-[#1c1c1e] text-[#f5f5f7] shadow-sm",
  segmentedIdle:
    "text-[#c5c5ca] hover:bg-white/[0.06] hover:text-[#f5f5f7] active:text-white",
  btnSecondary: "border border-white/15 bg-[#1c1c1e] text-[#f5f5f7] hover:bg-[#2c2c2e]",
  btnPrimary: "bg-[#f5f5f7] text-[#1d1d1f] hover:bg-white",
};

export function globalAssetTheme(variant: GlobalAssetLibraryVariant): GlobalAssetTheme {
  return variant === "dark" ? DARK : LIGHT;
}
