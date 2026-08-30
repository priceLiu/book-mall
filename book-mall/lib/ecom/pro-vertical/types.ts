/** Pro Vertical 专业版带货 · 配置类型 */

export type ProVerticalId = "fashion_apparel" | "bags";

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

export type DimensionStepDef = {
  key: string;
  label: string;
  options?: readonly string[];
  freeText?: boolean;
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
