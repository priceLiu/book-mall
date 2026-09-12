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

export type ImageLayerWorkspace = {
  sourceImageUrl?: string | null;
  stack?: ImageLayerStack | null;
  pendingBbox?: [number, number, number, number] | null;
  canvasDims?: { w: number; h: number };
  displayDims?: { w: number; h: number };
  selectedLayerId?: string | null;
  /** @deprecated 使用 editEntries */
  editPrompt?: string;
  editEntries?: ImageLayerEditEntry[];
};

export type ImageLayerProjectGeneration = {
  id: string;
  kind: "upload" | "decompose" | "edit" | "export";
  at: string;
  title: string;
  prompt?: string | null;
  ossUrl: string;
  logId?: string | null;
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
