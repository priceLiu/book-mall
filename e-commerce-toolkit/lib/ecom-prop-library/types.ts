export type EcomPropLibraryEntry = {
  id: string;
  name: string;
  visualDescription: string;
  conflictTags?: string[];
  ossUrl?: string;
  enabled?: boolean;
  sortOrder?: number;
};

export type EcomPropLibraryCatalog = {
  props: EcomPropLibraryEntry[];
};
