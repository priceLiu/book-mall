export type EcomStylePresetKind = "sellpoint_layout" | "trending_visual";

export type EcomStylePresetVertical =
  | "fashion_apparel"
  | "bags"
  | "digital_3c"
  | "generic";

export type EcomStylePreset = {
  id: string;
  kind: EcomStylePresetKind;
  verticals: EcomStylePresetVertical[];
  title: string;
  subtitle?: string;
  palette?: string[];
  thumbUrl?: string;
  layoutPrompt?: string;
  visualPrompt?: string;
  sortOrder: number;
};

export type EcomStylePresetListResponse = {
  catalogVersion: string;
  presets: EcomStylePreset[];
};
