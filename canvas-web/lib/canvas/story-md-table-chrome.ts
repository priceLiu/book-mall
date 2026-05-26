/** 漫剧文案 · GFM 表格预览/编辑统一版式（与角色设定表、分镜脚本表一致） */

export type StoryMdTableVariant = "document" | "nodePreview" | "editor";

export function storyMdTableTextClass(variant: StoryMdTableVariant): string {
  if (variant === "nodePreview") return "text-[12px] leading-relaxed";
  return "text-[15px] leading-relaxed";
}

export function storyMdTablePadClass(variant: StoryMdTableVariant): string {
  if (variant === "nodePreview") return "px-2.5 py-1.5";
  return "px-4 py-2.5";
}

export function storyMdTableWrapperClass(variant: StoryMdTableVariant): string {
  const text = storyMdTableTextClass(variant);
  const layout = variant === "editor" ? "table-auto" : "table-fixed";
  const minW = variant === "editor" ? "min-w-[880px]" : "min-w-full";
  return `w-full ${minW} ${layout} border-collapse border border-neutral-300 text-left ${text}`;
}

export function storyMdThClass(variant: StoryMdTableVariant): string {
  return `border border-neutral-300 bg-neutral-100 font-semibold text-neutral-900 ${storyMdTablePadClass(variant)}`;
}

export function storyMdTdClass(variant: StoryMdTableVariant): string {
  const overflow = variant === "editor" ? "overflow-visible" : "";
  return `border border-neutral-200 bg-white align-top text-neutral-800 ${storyMdTablePadClass(variant)} ${overflow}`;
}
