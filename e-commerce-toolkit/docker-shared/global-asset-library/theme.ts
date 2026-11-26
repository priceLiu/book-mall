import type { GlobalAssetLibraryVariant } from "./types";

/** GALD 弹层 · 固定 50vw × 60vh，避免加载前后尺寸跳动 */
export const GALD_DIALOG_SHELL_CLASS =
  "flex h-[60vh] w-[50vw] min-w-[480px] max-w-[1200px] flex-col overflow-hidden rounded-2xl border shadow-xl";

/** 主内容区最小高度（加载中也占位） */
export const GALD_BODY_CLASS = "flex min-h-0 flex-1 overflow-hidden";

/** 素材网格 · 固定 6 列（仅纯提示词等固定高度卡片） */
export const GALD_GRID_CLASS = "grid grid-cols-6 gap-2";

/** 瀑布流 · 有图素材按原图比例自适应高度 */
export const GALD_MASONRY_CLASS =
  "columns-3 gap-2 sm:columns-4 md:columns-5 lg:columns-6 [column-fill:_balance]";

export const GALD_MASONRY_ITEM_CLASS = "mb-2 break-inside-avoid";

/** 缩略图格 · 固定高度（姿势纯提示词等） */
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
  shell: "bg-white border-[var(--ecom-divider)]",
  header: "border-[#f0f0f2]",
  sidebar: "bg-[#fafafa] border-[#f0f0f2]",
  filterBar: "bg-[#fafafa] border-[#f0f0f2]",
  footer: "bg-[#fafafa] border-[#f0f0f2]",
  textPrimary: "text-[var(--ecom-ink)]",
  textSecondary: "text-[var(--ecom-subtle)]",
  border: "border-[var(--ecom-divider)]",
  borderStrong: "border-[var(--ecom-ink)]",
  cardHover: "hover:border-[var(--ecom-border-soft)] hover:bg-[var(--ecom-parchment)]",
  cardSelected: "border-2 border-[var(--ecom-ink)] bg-[#fafafa]",
  navActive: "bg-[#ebebed] font-medium text-[var(--ecom-ink)]",
  navIdle:
    "text-[var(--ecom-subtle)] hover:bg-[#f0f0f2] hover:text-[var(--ecom-ink)] active:bg-[var(--ecom-divider)]",
  pill: "bg-[#f0f0f2] text-[var(--ecom-muted)]",
  segmentedTrack: "bg-[#f0f0f2]",
  segmentedActive: "bg-white text-[var(--ecom-ink)] shadow-sm",
  segmentedIdle:
    "text-[var(--ecom-subtle)] hover:bg-white/60 hover:text-[#424245] active:text-[var(--ecom-ink)]",
  btnSecondary: "border border-[var(--ecom-border-soft)] bg-white text-[var(--ecom-ink)] hover:bg-[var(--ecom-parchment)]",
  btnPrimary: "bg-[var(--ecom-ink)] text-white hover:bg-[#333]",
};

const DARK: GlobalAssetTheme = {
  overlay: "bg-black/85",
  shell: "bg-[#1c1c1e] border-white/10",
  header: "border-white/10",
  sidebar: "bg-[#2c2c2e] border-white/10",
  filterBar: "bg-[#2c2c2e] border-white/10",
  footer: "bg-[#2c2c2e] border-white/10",
  textPrimary: "text-[var(--ecom-parchment)]",
  textSecondary: "text-[#aeaeb2]",
  border: "border-white/10",
  borderStrong: "border-[var(--ecom-parchment)]",
  cardHover: "hover:border-white/20 hover:bg-[#2c2c2e]",
  cardSelected: "border-2 border-[var(--ecom-parchment)] bg-[#2c2c2e]",
  navActive: "bg-white/[0.12] font-medium text-white",
  navIdle:
    "text-[#c5c5ca] hover:bg-white/[0.08] hover:text-[#fafafa] active:bg-white/[0.12] active:text-white",
  pill: "bg-[#3a3a3c] text-[#aeaeb2]",
  segmentedTrack: "bg-[#3a3a3c]",
  segmentedActive: "bg-[#1c1c1e] text-[var(--ecom-parchment)] shadow-sm",
  segmentedIdle:
    "text-[#c5c5ca] hover:bg-white/[0.06] hover:text-[var(--ecom-parchment)] active:text-white",
  btnSecondary: "border border-white/15 bg-[#1c1c1e] text-[var(--ecom-parchment)] hover:bg-[#2c2c2e]",
  btnPrimary: "bg-[var(--ecom-parchment)] text-[var(--ecom-ink)] hover:bg-white",
};

export function globalAssetTheme(variant: GlobalAssetLibraryVariant): GlobalAssetTheme {
  return variant === "dark" ? DARK : LIGHT;
}
