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
