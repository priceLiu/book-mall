/** 服装专业版 deliverable 类型（与 book-mall fashion-deliverable-spec-v4 对齐） */

export type FashionVersionKey = "A" | "B" | "C" | "D" | "E";

export type FashionSellpoint = {
  id: string;
  text: string;
  layer: "core" | "visual" | "aux";
  source: "user" | "ai" | "supplemented";
};

export type FashionVoiceover = {
  id: string;
  type: string;
  narrative: string;
  script: string;
};

export type FashionPanelRow = {
  index: 1 | 2 | 3 | 4 | 5 | 6;
  shotScale: string;
  durationSec: number;
  cameraMove: string;
  sceneDesc: string;
  modelAction: string;
  garmentFocus: string;
  dialogue?: string;
  toneTexture?: string;
  sellpointIds: string[];
  imagePrompt: string;
};

export type FashionStoryboardVersion = {
  id: FashionVersionKey;
  title: string;
  summary?: string;
  panels: FashionPanelRow[];
  totalDurationSec?: number;
};

export type FashionCoverageRow = {
  sellpointId: string;
  sellpointText: string;
  layer: "core" | "visual" | "aux";
  panelIndexes: number[];
  covered: boolean;
};

export type FashionOpsPack = {
  titles?: string[];
  coverWords?: string[];
  tags?: string[];
  xiaohongshuBody?: string;
  detailBullets?: string[];
};

export type FashionDeliverable = {
  schemaVersion: "fashion-v4";
  vertical: "fashion_apparel";
  productName: string;
  dimensions: Partial<Record<string, string>>;
  sellpoints: FashionSellpoint[];
  sellpointsLocked: boolean;
  voiceovers: FashionVoiceover[];
  selectedVoiceoverId: string | null;
  storyboardVersions?: Partial<Record<FashionVersionKey, FashionStoryboardVersion>>;
  selectedVersion: FashionVersionKey | null;
  /** 用户在中栏定稿分镜后锁定，resolve 以 meta 为准 */
  storyboardLocked?: boolean;
  coverageChecklist: FashionCoverageRow[];
  opsPack?: FashionOpsPack;
  outputMode: "script_compose" | "direct_video" | null;
};

export type FashionPhase =
  | "product_ref"
  | "dimensions"
  | "sellpoints"
  | "voiceover_pick"
  | "storyboard_pick"
  | "storyboard_confirm"
  | "ops_pack"
  | "output_mode"
  | "produce"
  | "done";

export function isFashionDeliverable(raw: unknown): raw is FashionDeliverable {
  if (!raw || typeof raw !== "object") return false;
  const o = raw as Record<string, unknown>;
  return o.schemaVersion === "fashion-v4" && o.vertical === "fashion_apparel";
}
