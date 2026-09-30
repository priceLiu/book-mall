export type EcomSceneLibraryEntry = {
  id: string;
  name: string;
  visualPrompt: string;
  ossUrl?: string | null;
  thumbUrl?: string | null;
  sourceImageKey?: string | null;
  /** 服务端聚合：列表/卡片展示图（无自有图时为平台默认） */
  displayImageUrl?: string;
  tags?: Record<string, unknown>;
  scope?: "platform" | "user";
  userId?: string | null;
  lockedAt?: string | null;
  enabled?: boolean;
  sortOrder?: number;
};

export type EcomSceneLibraryCatalog = {
  scenes: EcomSceneLibraryEntry[];
  platform?: EcomSceneLibraryEntry[];
  user?: EcomSceneLibraryEntry[];
};
