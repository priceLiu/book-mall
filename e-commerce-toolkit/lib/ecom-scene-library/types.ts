export type EcomSceneLibraryEntry = {
  id: string;
  name: string;
  visualPrompt: string;
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
