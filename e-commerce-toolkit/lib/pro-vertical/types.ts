/** Pro Vertical 前端 deliverable 类型（与 book-mall pro-v1 对齐） */

export type ProVerticalId = "fashion_apparel" | "bags" | "digital_3c";

export type DimensionStepDef = {
  key: string;
  label: string;
  options?: readonly string[];
  freeText?: boolean;
  ui?: "chips" | "searchSelect";
  parentKey?: string;
  subOptionsMap?: Record<string, readonly string[]>;
};

export type MirrorRoleDef = {
  index: number;
  role: string;
  shotScale: string;
};

export type StoryboardVersionDef = {
  id: "A" | "B" | "C" | "D" | "E";
  title: string;
  summary: string;
};

export type CharacterRefPolicy = "required" | "optional" | "none";

export type ProVerticalConfig = {
  id: ProVerticalId;
  label: string;
  projectTitle: string;
  schemaVersion: "pro-v1" | "fashion-v4";
  legacySchemaVersion?: "fashion-v4";
  panelFocusLabel: string;
  productRefAckMessage: string;
  welcomeMessage: string;
  productRefAdvanceHint: string;
  dimensionSteps: DimensionStepDef[];
  mirrorRoles: MirrorRoleDef[];
  storyboardVersions: StoryboardVersionDef[];
  imagePromptCategory: string;
  characterRefPolicy: CharacterRefPolicy;
  keywordDimensionKeys: string[];
  llmRoleName: string;
  rulesDocRef: string;
  voiceoverTypes: string[];
  sellpointVocabHint: string;
  internalTriggerPrefix: "pro-step" | "fashion-step";
};

export type ProVersionKey = "A" | "B" | "C" | "D" | "E";

export type ProSellpoint = {
  id: string;
  text: string;
  layer: "core" | "visual" | "aux";
  source: "user" | "ai" | "supplemented";
};

export type ProVoiceover = {
  id: string;
  type: string;
  narrative: string;
  script: string;
};

export type ProPanelRow = {
  index: 1 | 2 | 3 | 4 | 5 | 6;
  shotScale: string;
  durationSec: number;
  cameraMove: string;
  sceneDesc: string;
  scenePrompt: string;
  modelAction: string;
  productFocus: string;
  /** legacy fashion panels */
  garmentFocus?: string;
  dialogue?: string;
  toneTexture?: string;
  sellpointIds: string[];
  imagePrompt: string;
  videoPrompt: string;
};

export type ProStoryboardVersion = {
  id: ProVersionKey;
  title: string;
  summary?: string;
  panels: ProPanelRow[];
  totalDurationSec?: number;
};

export type ProCoverageRow = {
  sellpointId: string;
  sellpointText: string;
  layer: "core" | "visual" | "aux";
  panelIndexes: number[];
  covered: boolean;
};

export type ProOpsPack = {
  titles?: string[];
  coverWords?: string[];
  tags?: string[];
  xiaohongshuBody?: string;
  detailBullets?: string[];
};

export type ProDeliverable = {
  schemaVersion: "pro-v1" | "fashion-v4";
  vertical: "fashion_apparel" | "bags" | "digital_3c";
  productName: string;
  dimensions: Partial<Record<string, string>>;
  sellpoints: ProSellpoint[];
  sellpointsLocked: boolean;
  voiceovers: ProVoiceover[];
  selectedVoiceoverId: string | null;
  storyboardVersions?: Partial<Record<ProVersionKey, ProStoryboardVersion>>;
  selectedVersion: ProVersionKey | null;
  storyboardLocked?: boolean;
  coverageChecklist: ProCoverageRow[];
  opsPack?: ProOpsPack;
  outputMode: "script_compose" | "direct_video" | null;
};

export type ProPhase =
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

export function isProDeliverable(raw: unknown): raw is ProDeliverable {
  if (!raw || typeof raw !== "object") return false;
  const o = raw as Record<string, unknown>;
  if (o.schemaVersion === "pro-v1" && (o.vertical === "bags" || o.vertical === "fashion_apparel" || o.vertical === "digital_3c"))
    return true;
  return o.schemaVersion === "fashion-v4" && o.vertical === "fashion_apparel";
}

export type { FashionDeliverable, FashionPanelRow, FashionSellpoint } from "@/lib/fashion-types";
