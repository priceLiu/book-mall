/** 图片编辑 · 左侧工具（对齐醒图/美图能力名，交互用电商浅色工作区） */
export type ImageEditorToolId =
  | "add"
  | "adjust"
  | "text"
  | "erase"
  | "cutout"
  | "hd"
  | "color"
  | "assets"
  | "more";

export type ImageEditorAdjustTab = "resize" | "ratio" | "shape";

export type ImageEditorPresetSize = {
  id: string;
  label: string;
  width: number;
  height: number;
};

export type { ImageEditorShapeMaskId } from "@/lib/image-editor-shape-catalog";

export type ImageEditorRatioPreset = {
  id: string;
  label: string;
  w: number;
  h: number;
};