export type EcomSceneLibraryEntry = {
  id: string;
  name: string;
  visualPrompt: string;
  tags?: Record<string, unknown>;
  enabled?: boolean;
  sortOrder?: number;
};

export type EcomSceneLibraryCatalog = {
  scenes: EcomSceneLibraryEntry[];
};
