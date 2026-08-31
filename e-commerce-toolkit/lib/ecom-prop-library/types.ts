export type EcomPropLibraryEntry = {
  id: string;
  name: string;
  visualDescription: string;
  conflictTags?: string[];
  ossUrl?: string;
  scope?: "platform" | "user";
  userId?: string | null;
  lockedAt?: string | null;
  enabled?: boolean;
  sortOrder?: number;
};

export type EcomPropLibraryCatalog = {
  props: EcomPropLibraryEntry[];
  platform?: EcomPropLibraryEntry[];
  user?: EcomPropLibraryEntry[];
};
