import {
  addOverlayTextLayer,
  ECOM_COPY_OVERLAY_VERSION,
  newOverlayLayerId,
  patchOverlayLayerText,
  type EcomCopyOverlay,
  type EcomCopyOverlayLayer,
} from "@private/ecom-copy-overlay";

export const IMAGE_EDITOR_TEXT_PLACEHOLDER = "双击编辑文字";

export type ImageEditorTextQuickKind = "title" | "subtitle" | "body";

export type ImageEditorTextLayerExtras = {
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  lineHeight?: number;
  letterSpacing?: number;
  opacity?: number;
  rotateDeg?: number;
  /** 排版：横排左/中/右，竖排上/中/下。只决定文字框锚点，不改框内对齐 */
  layout?: ImageEditorTextLayout;
  /** 框内对齐。justify 为分散对齐，文字铺满边框宽度 */
  align?: "left" | "center" | "right" | "justify";
  flipH?: boolean;
  flipV?: boolean;
  /** 文字特效预设 id；空或 none 表示无花字 */
  effectId?: string;
  /** 填充透明度 0–100 */
  fillOpacity?: number;
  /** 描边透明度 0–100 */
  strokeOpacity?: number;
  strokeHidden?: boolean;
  /** 多条描边。多于 1 条时以此为准，最多 3 条；单条仍写在图层 strokeWidth 上 */
  strokes?: ImageEditorTextStroke[];
  /** 投影方向，0 向右，-90 向下 */
  shadowAngle?: number;
  /** 投影距离，成图像素 */
  shadowDistance?: number;
  shadowHidden?: boolean;
  glowHidden?: boolean;
  bgHidden?: boolean;
  /** 划重点样式；none 或空表示无 */
  highlightId?: string;
  highlightColor?: string;
  /** 文字变形路径 */
  warpId?: string;
  /** AI 花字样式 */
  flowerId?: string;
  /** 左栏文字模板。卖点清单等用专门排版，不走普通填充 */
  templateId?: string;
  /** 同一组卖点行。取消组合后仍保留，用来再合并 */
  groupId?: string;
  /** false 表示已拆成独立行 */
  grouped?: boolean;
  /** 行首勾、色块、编号 */
  mark?: "vip" | "checks" | "num" | "dot" | "star" | "line";
  /** 行首标记的颜色 */
  markColor?: string;
  /** 商品卖点贴纸编号。取消组合时按这个编号查库 */
  sellingPosterId?: string;
  /** 这一组已经用入库的拆层换过，再取消组合不再调模型 */
  sellingDecomposed?: boolean;
  /** 整张贴纸左上角，相对成片。拆层按原图比例铺回这个位置 */
  posterPlaceNx?: number;
  posterPlaceNy?: number;
  /** 卖点贴纸图，本地路径或拆开后的一块 */
  posterSrc?: string;
  /** 这一块在成片上的宽度，单位 em。整张贴纸按 7.2em 还原，各块按原图比例 */
  posterWidthEm?: number;
  /** 勾选图的高度，单位 em。和宽度一起写死，避免图片没载入时框是错的 */
  posterHeightEm?: number;
  /** 勾 / 色块 / 装饰框宽高，单位 em */
  markW?: number;
  markH?: number;
  /** 装饰与文字拆成同一组的两层。decor 是可拉伸的形，label 是字 */
  role?: "decor" | "label";
  shapeKind?: string;
  shapeColor?: string;
  shapeBg?: string;
};

export type ImageEditorTextStroke = {
  width: number;
  color: string;
  /** 0–100 */
  opacity: number;
  hidden?: boolean;
};

export type ImageEditorTextLayout =
  | "h-left"
  | "h-center"
  | "h-right"
  | "v-top"
  | "v-center"
  | "v-bottom";

export function textLayoutSpec(layout: ImageEditorTextLayout): {
  writingMode: "horizontal" | "vertical";
  textAlign: "left" | "center" | "right";
  ax: number;
  ay: number;
} {
  switch (layout) {
    case "h-left":
      return { writingMode: "horizontal", textAlign: "left", ax: 0, ay: 0 };
    case "h-right":
      return { writingMode: "horizontal", textAlign: "right", ax: 1, ay: 0 };
    case "v-top":
      return { writingMode: "vertical", textAlign: "left", ax: 0.5, ay: 0 };
    case "v-center":
      return { writingMode: "vertical", textAlign: "center", ax: 0.5, ay: 0.5 };
    case "v-bottom":
      return { writingMode: "vertical", textAlign: "right", ax: 0.5, ay: 1 };
    default:
      return { writingMode: "horizontal", textAlign: "center", ax: 0.5, ay: 0 };
  }
}

export function resolveTextLayout(
  layer: EcomCopyOverlayLayer,
  extras: ImageEditorTextLayerExtras | undefined,
): ImageEditorTextLayout {
  if (extras?.layout) return extras.layout;
  if (layer.writingMode === "vertical") {
    if (layer.textAlign === "right") return "v-bottom";
    if (layer.textAlign === "center") return "v-center";
    return "v-top";
  }
  if (layer.textAlign === "left") return "h-left";
  if (layer.textAlign === "right") return "h-right";
  return "h-center";
}

function estimateTextBoxPx(
  layer: EcomCopyOverlayLayer,
  extras: ImageEditorTextLayerExtras | undefined,
  exportW: number,
): { w: number; h: number } {
  const lines = layer.text.split("\n");
  const longest = Math.max(1, ...lines.map((line) => line.length));
  const lineCount = Math.max(1, lines.length);
  const lh = (extras?.lineHeight ?? 120) / 100;
  const vertical = resolveTextLayout(layer, extras).startsWith("v-");
  if (vertical) {
    return {
      w: Math.max(8, layer.fontSize * lh * lineCount),
      h: Math.max(8, layer.fontSize * longest),
    };
  }
  const hugged = Math.max(8, layer.fontSize * longest);
  return {
    w: Math.min(
      Math.max(8, exportW),
      layer.layoutBoxWidthPx != null && layer.layoutBoxWidthPx > 0 ? layer.layoutBoxWidthPx : hugged,
    ),
    h: Math.max(8, layer.fontSize * lh * lineCount),
  };
}

export function applyImageEditorTextLayout(
  doc: ImageEditorTextDocument,
  id: string,
  layout: ImageEditorTextLayout,
  exportW: number,
  exportH: number,
): ImageEditorTextDocument {
  const layer = doc.overlay.layers.find((l) => l.id === id);
  if (!layer) return doc;
  const extras = doc.extras[id];
  const prev = textLayoutSpec(resolveTextLayout(layer, extras));
  const next = textLayoutSpec(layout);
  const box = estimateTextBoxPx(layer, extras, exportW);
  const orientationChanged = prev.writingMode !== next.writingMode;
  const nextBox = orientationChanged ? { w: box.h, h: box.w } : box;
  const visualLeft = layer.nx * exportW - prev.ax * box.w;
  const visualTop = layer.ny * exportH - prev.ay * box.h;
  const nx = Math.max(-1, Math.min(2, (visualLeft + next.ax * nextBox.w) / Math.max(1, exportW)));
  const ny = Math.max(-1, Math.min(2, (visualTop + next.ay * nextBox.h) / Math.max(1, exportH)));
  let nextDoc = patchImageEditorTextLayer(doc, id, {
    textAlign: next.textAlign,
    writingMode: next.writingMode,
    nx,
    ny,
    layoutBoxWidthPx: orientationChanged ? undefined : layer.layoutBoxWidthPx,
  });
  nextDoc = patchImageEditorTextExtras(nextDoc, id, { layout });
  return nextDoc;
}

export type ImageEditorTextDocument = {
  overlay: EcomCopyOverlay;
  extras: Record<string, ImageEditorTextLayerExtras>;
};

function titleFontSize(exportW: number, exportH: number): number {
  const base = Math.max(exportW, exportH);
  return Math.round(Math.max(24, Math.min(220, base * 0.096)));
}

function kindFontScale(kind: ImageEditorTextQuickKind): number {
  if (kind === "title") return 1;
  if (kind === "subtitle") return 0.58;
  return 0.36;
}

export function emptyImageEditorTextDocument(exportWidthPx: number): ImageEditorTextDocument {
  return {
    overlay: {
      version: ECOM_COPY_OVERLAY_VERSION,
      exportWidthPx: Math.max(320, exportWidthPx),
      layers: [],
    },
    extras: {},
  };
}

export function syncTextDocumentExportSize(
  doc: ImageEditorTextDocument,
  exportWidthPx: number,
): ImageEditorTextDocument {
  const w = Math.max(320, exportWidthPx);
  if (doc.overlay.exportWidthPx === w) return doc;
  return {
    ...doc,
    overlay: { ...doc.overlay, exportWidthPx: w },
  };
}

export function createQuickTextLayer(
  doc: ImageEditorTextDocument,
  kind: ImageEditorTextQuickKind,
  exportW: number,
  exportH: number,
): { doc: ImageEditorTextDocument; layerId: string } {
  const id = newOverlayLayerId(doc.overlay);
  const fontSize = Math.round(titleFontSize(exportW, exportH) * kindFontScale(kind));
  const layer: EcomCopyOverlayLayer = {
    id,
    text: IMAGE_EDITOR_TEXT_PLACEHOLDER,
    nx: 0.5,
    ny: kind === "title" ? 0.42 : kind === "subtitle" ? 0.52 : 0.62,
    fontSize,
    color: "#ffffff",
    fontWeight: kind === "body" ? "normal" : "bold",
    fontFamily: "yahei",
    textAlign: "center",
    maxWidthNorm: kind === "body" ? 0.78 : 0.88,
    maxHeightNorm: 0.55,
    writingMode: "horizontal",
  };
  return {
    doc: {
      overlay: { ...doc.overlay, layers: [...doc.overlay.layers, layer] },
      extras: doc.extras,
    },
    layerId: id,
  };
}

export function patchImageEditorTextLayer(
  doc: ImageEditorTextDocument,
  id: string,
  patch: Partial<EcomCopyOverlayLayer>,
): ImageEditorTextDocument {
  return {
    ...doc,
    overlay: {
      ...doc.overlay,
      layers: doc.overlay.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    },
  };
}

export function patchImageEditorTextExtras(
  doc: ImageEditorTextDocument,
  id: string,
  patch: Partial<ImageEditorTextLayerExtras>,
): ImageEditorTextDocument {
  const prev = doc.extras[id] ?? {};
  return {
    ...doc,
    extras: { ...doc.extras, [id]: { ...prev, ...patch } },
  };
}

export function isTextGrouped(extras: ImageEditorTextLayerExtras | undefined): boolean {
  return Boolean(extras?.groupId) && extras?.grouped !== false;
}

export function layersSharingGroup(
  layers: EcomCopyOverlayLayer[],
  extras: Record<string, ImageEditorTextLayerExtras>,
  groupId: string,
): EcomCopyOverlayLayer[] {
  return layers.filter((layer) => extras[layer.id]?.groupId === groupId);
}

export function groupTextLayers(doc: ImageEditorTextDocument, ids: string[]): ImageEditorTextDocument {
  const unique = [...new Set(ids)].filter((id) => doc.overlay.layers.some((layer) => layer.id === id));
  if (!unique.length) return doc;
  const groupId = `grp-${Math.random().toString(36).slice(2, 10)}`;
  const extras = { ...doc.extras };
  for (const id of unique) extras[id] = { ...(extras[id] ?? {}), groupId, grouped: true };
  return { ...doc, extras };
}

export function setTextLayersGrouped(
  doc: ImageEditorTextDocument,
  groupId: string,
  grouped: boolean,
): ImageEditorTextDocument {
  const extras = { ...doc.extras };
  for (const layer of doc.overlay.layers) {
    const prev = extras[layer.id];
    if (prev?.groupId !== groupId) continue;
    extras[layer.id] = { ...prev, grouped };
  }
  return { ...doc, extras };
}

export function removeImageEditorTextLayer(doc: ImageEditorTextDocument, id: string): ImageEditorTextDocument {
  const { [id]: _, ...rest } = doc.extras;
  return {
    overlay: {
      ...doc.overlay,
      layers: doc.overlay.layers.filter((l) => l.id !== id),
    },
    extras: rest,
  };
}

export function duplicateImageEditorTextLayer(
  doc: ImageEditorTextDocument,
  id: string,
): { doc: ImageEditorTextDocument; layerId: string } {
  const src = doc.overlay.layers.find((l) => l.id === id);
  if (!src) return { doc, layerId: id };
  const { overlay: next, layerId } = addOverlayTextLayer(doc.overlay);
  const dup: EcomCopyOverlayLayer = {
    ...src,
    id: layerId,
    nx: Math.min(0.92, src.nx + 0.04),
    ny: Math.min(0.92, src.ny + 0.04),
    text: src.text,
  };
  return {
    doc: {
      overlay: {
        ...next,
        layers: next.layers.map((l) => (l.id === layerId ? dup : l)),
      },
      extras: { ...doc.extras, [layerId]: { ...(doc.extras[id] ?? {}) } },
    },
    layerId,
  };
}

export function removeImageEditorTextSelection(doc: ImageEditorTextDocument, id: string): ImageEditorTextDocument {
  const extras = doc.extras[id];
  const ids =
    isTextGrouped(extras) && extras?.groupId
      ? layersSharingGroup(doc.overlay.layers, doc.extras, extras.groupId).map((layer) => layer.id)
      : [id];
  return ids.reduce((next, layerId) => removeImageEditorTextLayer(next, layerId), doc);
}

export function duplicateImageEditorTextSelection(
  doc: ImageEditorTextDocument,
  id: string,
): { doc: ImageEditorTextDocument; layerId: string } {
  const extras = doc.extras[id];
  if (!isTextGrouped(extras) || !extras?.groupId) {
    const single = duplicateImageEditorTextLayer(doc, id);
    const copied = { ...(single.doc.extras[single.layerId] ?? {}) };
    delete copied.groupId;
    delete copied.grouped;
    return {
      doc: { ...single.doc, extras: { ...single.doc.extras, [single.layerId]: copied } },
      layerId: single.layerId,
    };
  }
  const members = layersSharingGroup(doc.overlay.layers, doc.extras, extras.groupId);
  const groupId = `grp-${Math.random().toString(36).slice(2, 10)}`;
  let next = doc;
  let first = id;
  members.forEach((layer, index) => {
    const copied = duplicateImageEditorTextLayer(next, layer.id);
    next = patchImageEditorTextExtras(copied.doc, copied.layerId, { groupId, grouped: true });
    if (index === 0) first = copied.layerId;
  });
  return { doc: next, layerId: first };
}

const TEXT_LAYER_STYLE_KEYS = [
  "fontSize",
  "color",
  "fontWeight",
  "fontFamily",
  "textAlign",
  "maxWidthNorm",
  "maxHeightNorm",
  "writingMode",
  "shadowBlur",
  "shadowColor",
  "shadowOffsetX",
  "shadowOffsetY",
  "shadowOpacity",
  "glowBlur",
  "glowColor",
  "glowOpacity",
  "strokeWidth",
  "strokeColor",
  "textBgEnabled",
  "textBgColor",
  "textBgOpacity",
  "textBgPaddingPx",
  "textBgRadiusPx",
] as const satisfies ReadonlyArray<keyof EcomCopyOverlayLayer>;

export type ImageEditorTextStyleClipboard = {
  layer: Partial<EcomCopyOverlayLayer>;
  extras: ImageEditorTextLayerExtras;
};

export function extractTextLayerStyle(
  layer: EcomCopyOverlayLayer,
  extras: ImageEditorTextLayerExtras | undefined,
): ImageEditorTextStyleClipboard {
  const layerPatch: Partial<EcomCopyOverlayLayer> = {};
  for (const key of TEXT_LAYER_STYLE_KEYS) {
    const val = layer[key];
    if (val !== undefined) {
      (layerPatch as Record<string, unknown>)[key] = val;
    }
  }
  return { layer: layerPatch, extras: { ...(extras ?? {}) } };
}

export function applyTextLayerStyle(
  doc: ImageEditorTextDocument,
  targetId: string,
  clip: ImageEditorTextStyleClipboard,
): ImageEditorTextDocument {
  let next = patchImageEditorTextLayer(doc, targetId, clip.layer);
  next = patchImageEditorTextExtras(next, targetId, clip.extras);
  return next;
}

export function updateImageEditorTextContent(
  doc: ImageEditorTextDocument,
  id: string,
  text: string,
): ImageEditorTextDocument {
  return {
    ...doc,
    overlay: patchOverlayLayerText(doc.overlay, id, text),
  };
}

export function layerPositionExportPx(
  layer: EcomCopyOverlayLayer,
  exportW: number,
  exportH: number,
): { x: number; y: number; w: number; h: number } {
  const w = Math.round((layer.maxWidthNorm ?? 0.88) * exportW);
  const h = Math.round((layer.maxHeightNorm ?? 0.2) * exportH);
  const x = Math.round(layer.nx * exportW);
  const y = Math.round(layer.ny * exportH);
  return { x, y, w, h };
}

export function patchLayerPositionFromPx(
  doc: ImageEditorTextDocument,
  id: string,
  exportW: number,
  exportH: number,
  patch: Partial<{ x: number; y: number; w: number; h: number }>,
): ImageEditorTextDocument {
  const layer = doc.overlay.layers.find((l) => l.id === id);
  if (!layer) return doc;
  const next: Partial<EcomCopyOverlayLayer> = {};
  if (patch.x != null) next.nx = Math.max(0, Math.min(1, patch.x / Math.max(1, exportW)));
  if (patch.y != null) next.ny = Math.max(0, Math.min(1, patch.y / Math.max(1, exportH)));
  if (patch.w != null) next.maxWidthNorm = Math.max(0.08, Math.min(0.96, patch.w / Math.max(1, exportW)));
  if (patch.h != null) next.maxHeightNorm = Math.max(0.12, Math.min(0.92, patch.h / Math.max(1, exportH)));
  return patchImageEditorTextLayer(doc, id, next);
}