export type ImageLayerBbox = {
  normalized?: [number, number, number, number];
  absolute?: [number, number, number, number];
};

export type ImageLayerStackItem = {
  id: string;
  url: string;
  zIndex: number;
  bbox?: ImageLayerBbox;
  name?: string;
  isBackground: boolean;
  /** 画布偏移（像素，相对显示尺寸） */
  offsetX?: number;
  offsetY?: number;
};

export type ImageLayerStack = {
  sourceImageUrl?: string;
  background: ImageLayerStackItem;
  layers: ImageLayerStackItem[];
  logId?: string;
};

export type ImageLayerEditEntry = {
  layerId: string;
  prompt: string;
};

export type ImageLayerSavedImage = {
  url: string;
  title?: string;
  at?: string;
  /** 仅「保存图片」入库的才进左侧翻页，上传/生成不自动进 */
  source?: "library" | "auto";
};

export function appendSavedSessionImage(
  list: ImageLayerSavedImage[] | undefined,
  item: ImageLayerSavedImage,
): ImageLayerSavedImage[] {
  const next = [...(list ?? [])];
  const idx = next.findIndex((row) => row.url === item.url);
  const row = { ...item, source: item.source ?? "library" as const };
  if (idx >= 0) {
    next[idx] = { ...next[idx], ...row };
    return next;
  }
  next.push(row);
  return next.slice(-40);
}

export function mergeSavedSessionImages(
  ...lists: Array<ImageLayerSavedImage[] | undefined>
): ImageLayerSavedImage[] {
  const seen = new Set<string>();
  const out: ImageLayerSavedImage[] = [];
  for (const list of lists) {
    for (const row of list ?? []) {
      const url = row.url.trim();
      if (!url || seen.has(url)) continue;
      seen.add(url);
      out.push({ ...row, url });
    }
  }
  return out;
}

/** 左侧翻页只展示用户点过「保存图片」的图，不含上传原图自动占位 */
export function explicitSavedSessionImages(
  list: ImageLayerSavedImage[] | undefined,
  implicitUrls: Array<string | null | undefined> = [],
): ImageLayerSavedImage[] {
  const implicit = new Set(
    implicitUrls.map((url) => url?.trim()).filter((url): url is string => Boolean(url)),
  );
  return (list ?? []).filter((row) => {
    const url = row.url.trim();
    if (!url) return false;
    if (row.source === "library") return true;
    if (row.source === "auto") return false;
    if ((row.title ?? "原图") === "原图" && implicit.has(url)) return false;
    return true;
  });
}

export type ImageLayerWorkspace = {
  sourceImageUrl?: string | null;
  /** 首次上传的原图，擦除/重绘后仍保留给中栏对照 */
  originalImageUrl?: string | null;
  savedImages?: ImageLayerSavedImage[];
  savedImageIndex?: number;
  firstOrigin?: string;
  stack?: ImageLayerStack | null;
  /** @deprecated 使用 pendingBboxes */
  pendingBbox?: [number, number, number, number] | null;
  pendingBboxes?: Array<[number, number, number, number]> | null;
  canvasDims?: { w: number; h: number };
  displayDims?: { w: number; h: number };
  selectedLayerId?: string | null;
  /** @deprecated 使用 editEntries */
  editPrompt?: string;
  editEntries?: ImageLayerEditEntry[];
  toolMode?: "layer-view" | "bg-replace" | "retouch" | "erase" | "decompose-bbox";
  bgReplace?: {
    refPrompt?: string;
    refImageUrl?: string;
    refBbox?: [number, number, number, number] | null;
  };
};

export type ImageLayerGenerationKind =
  | "upload"
  | "decompose"
  | "edit"
  | "export"
  | "bg-replace"
  | "retouch";

export type ImageLayerGenerationRef = {
  url: string;
  label?: string;
};

export type ImageLayerProjectGeneration = {
  id: string;
  kind: ImageLayerGenerationKind;
  at: string;
  title: string;
  prompt?: string | null;
  ossUrl: string;
  logId?: string | null;
  modelKey?: string | null;
  /** 生成前左边原图 / 输入图 */
  compareFromUrl?: string | null;
  /** 右栏引用、上传的参考图 */
  refImages?: ImageLayerGenerationRef[];
  workspace?: ImageLayerWorkspace;
};

export type ImageLayerProject = {
  id: string;
  title: string | null;
  module: string;
  status: string;
  workspace: ImageLayerWorkspace;
  generations: ImageLayerProjectGeneration[];
  meta: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};
