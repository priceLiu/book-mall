export type EcomCopyOverlayLayer = {
  id: string;
  text: string;
  /** 0–1，锚点横坐标（相对成图宽） */
  nx: number;
  /** 0–1，锚点纵坐标（相对成图高） */
  ny: number;
  fontSize: number;
  color?: string;
  fontWeight?: "normal" | "bold";
  /** 字体预设 id，见 copy-fonts.ts */
  fontFamily?: string;
  /** 投影模糊（成图像素）；0 或未设=关 */
  shadowBlur?: number;
  shadowColor?: string;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  shadowOpacity?: number;
  /** 外发光模糊；0=关 */
  glowBlur?: number;
  glowColor?: string;
  glowOpacity?: number;
  /** 描边宽度（成图像素）；0=关 */
  strokeWidth?: number;
  strokeColor?: string;
  /** 字底衬底 */
  textBgEnabled?: boolean;
  textBgColor?: string;
  textBgOpacity?: number;
  textBgPaddingPx?: number;
  textBgRadiusPx?: number;
  textAlign?: "left" | "center" | "right";
  maxWidthNorm?: number;
  maxHeightNorm?: number;
  writingMode?: "horizontal" | "vertical";
};

export type EcomCopyOverlay = {
  version: 1;
  exportWidthPx: number;
  baseImageUrl?: string;
  layers: EcomCopyOverlayLayer[];
};

export const ECOM_COPY_OVERLAY_VERSION = 1 as const;
