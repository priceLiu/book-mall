import type { CSSProperties } from "react";

import type { EcomCopyOverlayLayer } from "@private/ecom-copy-overlay";

import {
  patchImageEditorTextExtras,
  patchImageEditorTextLayer,
  type ImageEditorTextDocument,
} from "@/lib/image-editor-text";

export type ImageEditorFlowerStyle = {
  id: string;
  label: string;
  fill: CSSProperties;
  layer: Partial<EcomCopyOverlayLayer>;
};

function outline(color: string, radius: number): string {
  const steps = 8;
  const parts: string[] = [];
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    parts.push(`${(Math.cos(angle) * radius).toFixed(1)}px ${(Math.sin(angle) * radius).toFixed(1)}px 0 ${color}`);
  }
  return parts.join(", ");
}

function solid(color: string, shadow?: string): CSSProperties {
  return { color, textShadow: shadow };
}

function gradient(image: string, shadow?: string): CSSProperties {
  return {
    color: "transparent",
    backgroundImage: image,
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    WebkitTextFillColor: "transparent",
    textShadow: shadow,
  };
}

export const IMAGE_EDITOR_FLOWER_STYLES: ImageEditorFlowerStyle[] = [
  { id: "balloon", label: "气泡气球", fill: gradient("linear-gradient(180deg,#ffffff 0%,#ffe3f3 36%,#7ec8ff 100%)", outline("#ffffff", 4) + ", 0 7px 0 #3d8ed4, 0 9px 0 #2f74b0"), layer: { color: "#7ec8ff", strokeWidth: 0, strokeColor: "#ffffff" } },
  { id: "plush", label: "毛绒", fill: solid("#ffd0c2", "0 0 6px #ffb4a2, 0 0 14px #ff8f9a"), layer: { color: "#ffd0c2", glowBlur: 16, glowColor: "#ffb4a2", glowOpacity: 0.9 } },
  { id: "honey", label: "蜜合", fill: gradient("linear-gradient(180deg,#fff6d0 0%,#f0b429 100%)", "0 2px 0 #a87412"), layer: { color: "#f0b429", strokeWidth: 2, strokeColor: "#a87412" } },
  { id: "metal", label: "金属质感", fill: gradient("linear-gradient(180deg,#ffffff 0%,#b9c2cc 42%,#6d7680 100%)", "0 2px 0 #3a4148"), layer: { color: "#b9c2cc", strokeWidth: 2, strokeColor: "#3a4148" } },
  { id: "metal-light", label: "金属光线", fill: gradient("linear-gradient(100deg,#e8eef5 0%,#9fd0ff 40%,#ffffff 55%,#8aa0b5 100%)", "0 1px 0 #5c6b7a"), layer: { color: "#9fd0ff", strokeWidth: 1, strokeColor: "#5c6b7a" } },
  { id: "frost", label: "磨砂", fill: solid("#f3e4ff", "0 3px 8px rgba(120,90,160,0.45)"), layer: { color: "#f3e4ff", shadowBlur: 8, shadowColor: "#7860a0", shadowOpacity: 0.45 } },
  { id: "drop", label: "水滴", fill: gradient("linear-gradient(180deg,#f4ffff 0%,#7ee7ff 70%,#2f9ed4 100%)", "0 3px 0 #1d6f99"), layer: { color: "#7ee7ff", strokeWidth: 2, strokeColor: "#1d6f99" } },
  { id: "clay", label: "粘土", fill: solid("#ff8a5b", "0 3px 0 #d65a32, 0 5px 0 #b84422"), layer: { color: "#ff8a5b", shadowOffsetY: 4, shadowBlur: 0, shadowColor: "#d65a32", shadowOpacity: 1 } },
  { id: "paint", label: "颜料", fill: gradient("linear-gradient(120deg,#ff5d8f 0%,#ffd15c 40%,#5ddeb0 100%)", "2px 2px 0 #1a1a1a"), layer: { color: "#ff5d8f", strokeWidth: 2, strokeColor: "#1a1a1a" } },
  { id: "bronze", label: "青铜", fill: gradient("linear-gradient(180deg,#e7f6c8 0%,#7d9a3a 55%,#3e5a22 100%)", "0 2px 0 #243314"), layer: { color: "#7d9a3a", strokeWidth: 2, strokeColor: "#243314" } },
  { id: "stitch", label: "刺绣", fill: solid("#e23b4a", "1px 0 0 #fff, -1px 0 0 #fff, 0 1px 0 #fff, 0 -1px 0 #fff"), layer: { color: "#e23b4a", strokeWidth: 2, strokeColor: "#ffffff" } },
  { id: "macaron", label: "马卡龙气球", fill: gradient("linear-gradient(180deg,#ffe4f2 0%,#b8f3d8 100%)", "0 3px 0 #7dcfb0"), layer: { color: "#b8f3d8", strokeWidth: 2, strokeColor: "#ffffff" } },
  { id: "grass", label: "草地", fill: gradient("linear-gradient(180deg,#d8ffb0 0%,#3caf4a 100%)", "0 2px 0 #1d6b28"), layer: { color: "#3caf4a", strokeWidth: 2, strokeColor: "#1d6b28" } },
  { id: "neon", label: "霓虹灯", fill: solid("#ffffff", "0 0 6px #ff4fd8, 0 0 14px #49e1ff"), layer: { color: "#ffffff", glowBlur: 18, glowColor: "#ff4fd8", glowOpacity: 0.95 } },
  { id: "cloud", label: "云朵", fill: solid("#ffffff", "0 4px 10px rgba(120,170,220,0.85)"), layer: { color: "#ffffff", shadowBlur: 10, shadowColor: "#78aadf", shadowOpacity: 0.8 } },
  { id: "glitch", label: "故障艺术", fill: solid("#ffffff", "2px 0 0 #49e1ff, -2px 0 0 #ff4fd8"), layer: { color: "#ffffff", shadowOffsetX: 3, shadowBlur: 0, shadowColor: "#49e1ff", shadowOpacity: 1 } },
  { id: "graffiti", label: "涂鸦", fill: solid("#ffe14a", "3px 3px 0 #1a1a1a, -1px 0 0 #1a1a1a, 0 1px 0 #1a1a1a"), layer: { color: "#ffe14a", strokeWidth: 3, strokeColor: "#1a1a1a" } },
];

const byId = new Map(IMAGE_EDITOR_FLOWER_STYLES.map((item) => [item.id, item]));

export function imageEditorFlowerStyle(id: string | undefined, fontPx: number): { fill: CSSProperties; underlayShadow?: string } | null {
  if (!id) return null;
  const style = byId.get(id);
  if (!style) return null;
  const scale = Math.max(0.85, fontPx / 42);
  const shadow = style.fill.textShadow;
  const scaled = typeof shadow === "string" ? shadow.replace(/(-?\d*\.?\d+)px/g, (_, n) => `${(Number(n) * scale).toFixed(1)}px`) : shadow;
  if (style.fill.backgroundImage) {
    const { textShadow: _drop, ...fill } = style.fill;
    return { fill, underlayShadow: typeof scaled === "string" ? scaled : undefined };
  }
  return { fill: { ...style.fill, textShadow: scaled } };
}

export function applyImageEditorFlower(
  doc: ImageEditorTextDocument,
  layerId: string,
  flowerId: string,
): ImageEditorTextDocument {
  const style = byId.get(flowerId);
  if (!style) return doc;
  let next = patchImageEditorTextLayer(doc, layerId, {
    strokeWidth: 0,
    shadowBlur: 0,
    glowBlur: 0,
    textBgEnabled: false,
    ...style.layer,
  });
  next = patchImageEditorTextExtras(next, layerId, {
    flowerId,
    effectId: undefined,
    strokes: undefined,
    highlightId: undefined,
    warpId: undefined,
    templateId: undefined,
  });
  return next;
}
