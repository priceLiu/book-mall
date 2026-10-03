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
  /** 预览 DOM 实测文字块宽（占成图宽 0–1），合成时优先于估算 */
  layoutTextWidthNorm?: number;
  /** 预览 DOM 实测衬底外框宽/高（相对成图），合成时优先于估算 */
  layoutBoxWidthNorm?: number;
  layoutBoxHeightNorm?: number;
  /** 预览 DOM 实测文字块高（占成图高 0–1） */
  layoutTextHeightNorm?: number;
  /** 预览 DOM 换算的衬底外框宽/高（成图像素），合成时最优先 */
  layoutBoxWidthPx?: number;
  layoutBoxHeightPx?: number;
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
