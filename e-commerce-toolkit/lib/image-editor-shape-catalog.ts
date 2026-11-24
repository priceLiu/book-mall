/** 形状蒙版目录（viewBox 0 0 100 100，对齐美图可滚动列表） */
export type ImageEditorShapeMaskId =
  | "none"
  | "rounded-square"
  | "rect-portrait"
  | "rect-tall"
  | "circle"
  | "triangle"
  | "heart"
  | "rect-landscape"
  | "soft-square"
  | "star"
  | "diamond"
  | "pill-h"
  | "oval-v"
  | "oval-h"
  | "soft-landscape"
  | "arch"
  | "thin-portrait"
  | "flat-oval"
  | "hexagon"
  | "pentagon"
  | "scallop"
  | "clover"
  | "quatrefoil"
  | "ribbon"
  | "trapezoid"
  | "speech"
  | "teardrop"
  | "cloud"
  | "moon"
  | "wave-banner"
  | "shield"
  | "blob-a"
  | "blob-b"
  | "cat"
  | "burst"
  | "hex-mesh";

export type ImageEditorShapeDef = {
  id: ImageEditorShapeMaskId;
  /** SVG path d；none 无路径 */
  pathD: string | null;
};

export const IMAGE_EDITOR_SHAPE_CATALOG: ImageEditorShapeDef[] = [
  { id: "none", pathD: null },
  {
    id: "rounded-square",
    pathD: "M 22 8 H 78 Q 92 8 92 22 V 78 Q 92 92 78 92 H 22 Q 8 92 8 78 V 22 Q 8 8 22 8 Z",
  },
  {
    id: "rect-portrait",
    pathD: "M 32 6 H 68 Q 76 6 76 14 V 86 Q 76 94 68 94 H 32 Q 24 94 24 86 V 14 Q 24 6 32 6 Z",
  },
  {
    id: "rect-tall",
    pathD: "M 38 4 H 62 Q 68 4 68 10 V 90 Q 68 96 62 96 H 38 Q 32 96 32 90 V 10 Q 32 4 38 4 Z",
  },
  { id: "circle", pathD: "M 50 5 A 45 45 0 1 0 50 95 A 45 45 0 1 0 50 5 Z" },
  { id: "triangle", pathD: "M 50 8 L 92 88 L 8 88 Z" },
  {
    id: "heart",
    pathD: "M 50 88 C 20 62 8 42 18 26 C 28 12 42 14 50 28 C 58 14 72 12 82 26 C 92 42 80 62 50 88 Z",
  },
  {
    id: "rect-landscape",
    pathD: "M 6 32 H 94 Q 98 32 98 36 V 64 Q 98 68 94 68 H 6 Q 2 68 2 64 V 36 Q 2 32 6 32 Z",
  },
  {
    id: "soft-square",
    pathD: "M 18 10 H 82 Q 96 10 96 28 V 72 Q 96 90 82 90 H 18 Q 4 90 4 72 V 28 Q 4 10 18 10 Z",
  },
  {
    id: "star",
    pathD: "M 50 6 L 61 36 L 94 36 L 68 56 L 79 88 L 50 70 L 21 88 L 32 56 L 6 36 L 39 36 Z",
  },
  { id: "diamond", pathD: "M 50 6 L 94 50 L 50 94 L 6 50 Z" },
  {
    id: "pill-h",
    pathD: "M 12 38 H 88 Q 98 38 98 50 Q 98 62 88 62 H 12 Q 2 62 2 50 Q 2 38 12 38 Z",
  },
  { id: "oval-v", pathD: "M 50 4 C 68 4 78 22 78 50 C 78 78 68 96 50 96 C 32 96 22 78 22 50 C 22 22 32 4 50 4 Z" },
  { id: "oval-h", pathD: "M 50 28 C 78 28 96 38 96 50 C 96 62 78 72 50 72 C 22 72 4 62 4 50 C 4 38 22 28 50 28 Z" },
  {
    id: "soft-landscape",
    pathD: "M 8 42 H 92 Q 98 42 98 48 V 58 Q 98 64 92 64 H 8 Q 2 64 2 58 V 48 Q 2 42 8 42 Z",
  },
  { id: "arch", pathD: "M 8 92 V 42 Q 8 8 50 8 Q 92 8 92 42 V 92 Z" },
  {
    id: "thin-portrait",
    pathD: "M 42 6 H 58 Q 62 6 62 10 V 90 Q 62 94 58 94 H 42 Q 38 94 38 90 V 10 Q 38 6 42 6 Z",
  },
  { id: "flat-oval", pathD: "M 50 40 C 82 40 96 46 96 50 C 96 54 82 60 50 60 C 18 60 4 54 4 50 C 4 46 18 40 50 40 Z" },
  {
    id: "hexagon",
    pathD: "M 50 4 L 90 27 V 73 L 50 96 L 10 73 V 27 Z",
  },
  {
    id: "pentagon",
    pathD: "M 50 6 L 94 40 L 76 92 L 24 92 L 6 40 Z",
  },
  {
    id: "scallop",
    pathD: "M 50 12 C 30 12 14 28 14 48 C 14 72 32 92 50 92 C 68 92 86 72 86 48 C 86 28 70 12 50 12 Z M 50 20 C 64 20 74 32 74 46 C 74 64 62 80 50 80 C 38 80 26 64 26 46 C 26 32 36 20 50 20 Z",
  },
  {
    id: "clover",
    pathD: "M 50 38 A 14 14 0 1 1 50 62 A 14 14 0 1 1 50 38 M 32 32 A 12 12 0 1 1 32 44 A 12 12 0 1 1 32 32 M 68 32 A 12 12 0 1 1 68 44 A 12 12 0 1 1 68 32 M 32 68 A 12 12 0 1 1 32 56 A 12 12 0 1 1 32 68 M 68 68 A 12 12 0 1 1 68 56 A 12 12 0 1 1 68 68",
  },
  {
    id: "quatrefoil",
    pathD: "M 50 34 A 16 16 0 1 1 50 66 A 16 16 0 1 1 50 34 M 34 50 A 16 16 0 1 1 66 50 A 16 16 0 1 1 34 50",
  },
  {
    id: "ribbon",
    pathD: "M 8 28 H 92 V 58 H 68 L 50 78 L 32 58 H 8 Z",
  },
  { id: "trapezoid", pathD: "M 28 22 H 72 L 92 88 H 8 Z" },
  {
    id: "speech",
    pathD: "M 12 18 H 88 V 62 H 48 L 32 82 V 62 H 12 Z",
  },
  { id: "teardrop", pathD: "M 50 8 C 72 42 88 68 50 92 C 12 68 28 42 50 8 Z" },
  {
    id: "cloud",
    pathD: "M 24 58 C 10 58 8 46 18 40 C 20 24 36 18 50 26 C 62 16 82 22 84 40 C 96 44 94 58 80 58 Z",
  },
  {
    id: "moon",
    pathD: "M 62 8 C 38 8 22 30 22 52 C 22 76 40 92 66 88 C 48 78 42 58 48 38 C 52 24 56 14 62 8 Z",
  },
  {
    id: "wave-banner",
    pathD: "M 6 32 H 94 V 72 H 6 Z M 6 72 Q 25 58 50 72 Q 75 86 94 72 V 88 H 6 Z",
  },
  { id: "shield", pathD: "M 50 6 L 88 22 V 52 Q 88 82 50 94 Q 12 82 12 52 V 22 Z" },
  {
    id: "blob-a",
    pathD: "M 58 10 C 82 18 96 42 86 64 C 76 88 48 96 28 82 C 8 68 6 44 22 24 C 36 8 42 6 58 10 Z",
  },
  {
    id: "blob-b",
    pathD: "M 42 14 C 20 28 6 52 18 74 C 30 96 56 94 76 78 C 96 62 98 38 80 22 C 66 10 58 8 42 14 Z",
  },
  {
    id: "cat",
    pathD: "M 28 48 L 22 22 L 38 38 L 50 28 L 62 38 L 78 22 L 72 48 C 86 54 92 68 84 82 C 74 94 26 94 16 82 C 8 68 14 54 28 48 Z",
  },
  {
    id: "burst",
    pathD: "M 50 4 L 56 34 L 86 22 L 64 46 L 96 50 L 64 54 L 86 78 L 56 66 L 50 96 L 44 66 L 14 78 L 36 54 L 4 50 L 36 46 L 14 22 L 44 34 Z",
  },
  {
    id: "hex-mesh",
    pathD: "M 50 8 L 68 18 V 42 L 50 52 L 32 42 V 18 Z M 68 42 L 86 52 V 76 L 68 86 L 50 76 V 52 Z M 32 42 L 14 52 V 76 L 32 86 L 50 76 V 52 Z",
  },
];

export const IMAGE_EDITOR_SHAPE_MASK_ORDER: ImageEditorShapeMaskId[] =
  IMAGE_EDITOR_SHAPE_CATALOG.map((s) => s.id);

const SHAPE_BY_ID = new Map(IMAGE_EDITOR_SHAPE_CATALOG.map((s) => [s.id, s]));

export function getImageEditorShapeDef(id: ImageEditorShapeMaskId): ImageEditorShapeDef | undefined {
  return SHAPE_BY_ID.get(id);
}

export function svgMaskDataUrl(pathD: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="${pathD}" fill="black"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}