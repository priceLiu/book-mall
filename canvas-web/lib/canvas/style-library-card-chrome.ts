import { cn } from "@/lib/utils";

/** 与 StyleLibraryGrid 卡片一致的外壳（画布行 / 项目资产复用） */
export const STYLE_LIBRARY_CARD_SHELL =
  "group/card relative overflow-hidden rounded-[10px] bg-[#1a1a1a] transition hover:-translate-y-1 hover:shadow-[0_10px_25px_rgba(0,0,0,0.4)]";

export const STYLE_LIBRARY_MEDIA_FRAME =
  "relative w-full shrink-0 overflow-hidden bg-black/50";

/** 与 OSS 预览源图一致（400×550，见 book-mall generate-style-library-placeholders） */
export const STYLE_LIBRARY_PREVIEW_ASPECT = "aspect-[400/550]";

/** 预览图：由 img 自身 aspect 撑开高度（避免 absolute + 父级 aspect 在侧栏网格内塌陷） */
export const STYLE_LIBRARY_PREVIEW_IMG_CLASS =
  "block w-full aspect-[400/550] object-cover bg-black/40";

export function styleLibraryMediaHeightClass(opts?: {
  /** 画布分镜行与分镜列对齐（248px） */
  canvasRow?: boolean;
  compact?: boolean;
}): string {
  if (opts?.canvasRow) return "h-[248px]";
  /** 高度由 `STYLE_LIBRARY_PREVIEW_IMG_CLASS` 的 aspect 决定 */
  return "";
}

export const STYLE_LIBRARY_HOVER_PROMPT_OVERLAY =
  "pointer-events-none absolute inset-x-0 bottom-0 z-10 max-h-[70%] overflow-y-auto bg-black/85 p-2.5 text-[12px] leading-relaxed text-white opacity-0 transition-opacity duration-300 group-hover/card:opacity-100";

export const STYLE_LIBRARY_CARD_FOOTER = "p-3";

export const STYLE_LIBRARY_CARD_TITLE =
  "line-clamp-2 text-[14px] leading-snug text-[#eee]";

export const STYLE_LIBRARY_CARD_SUBTITLE = "mt-1 text-[12px] text-[#888]";

export const STYLE_LIBRARY_GRID_CLASS =
  "grid w-full grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5";

export function styleLibraryGridClass(compact?: boolean): string {
  return cn(
    compact
      ? "grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3"
      : STYLE_LIBRARY_GRID_CLASS,
  );
}
