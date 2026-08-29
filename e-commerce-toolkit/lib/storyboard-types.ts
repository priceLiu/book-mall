import type { FashionDeliverable, FashionPhase } from "@/lib/fashion-types";

export type StoryboardChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type StoryboardReference = {
  id: string;
  label: string;
  role: "character" | "product" | "scene" | "other";
  ossUrl: string;
};

export type StoryboardProductInteraction =
  | "none"
  | "hold"
  | "wear"
  | "use"
  | "apply"
  | "display"
  | "unbox";

export type StoryboardProductVisibility = "off" | "hint" | "partial" | "hero";

export type StoryboardSellingPoint = {
  id: string;
  text: string;
  source: "user" | "inferred" | "painpoint";
};

export type StoryboardPanel = {
  index: number;
  timeline?: string;
  shotType: string;
  scene: string;
  action: string;
  dialogue?: string;
  camera?: string;
  emotion?: string;
  durationHintSec?: number;
  videoPromptEn?: string;
  imageUrl?: string;
  videoUrl?: string;
  productInteraction?: StoryboardProductInteraction;
  productVisibility?: StoryboardProductVisibility;
  sellpointTags?: string[];
  imagePrompt?: string;
  protagonistBeat?: string;
  productBeat?: string;
};

export type StoryboardSheet = {
  overview: {
    title: string;
    logline: string;
    productHighlight?: string;
  };
  cast: Array<{
    name: string;
    role: string;
    refId?: string;
    appearance?: string;
  }>;
  panels: StoryboardPanel[];
  totalDurationHintSec?: number;
};

export type StoryboardScheme = {
  id: string;
  title: string;
  summary?: string;
  strategy?: string;
  panels: StoryboardPanel[];
  totalDurationHintSec?: number;
};

export type StoryboardAnalysisStructured = {
  audience: Array<{ segment: string; description: string }>;
  painPoints: Array<{ level: string; description: string }>;
  strategies: Array<{
    name: string;
    hook3s: string;
    middle: string;
    closing: string;
  }>;
};

/** @deprecated v0.1 legacy */
export type StoryboardAnalysisLegacyMarkdown = {
  audienceMarkdown: string;
  painPointsMarkdown: string;
  strategiesMarkdown: string;
};


export type StoryboardDeliverable = {
  productName?: string;
  params?: Record<string, string>;
  productSellingPoints?: StoryboardSellingPoint[];
  creativeBrief?: {
    audienceHook: string;
    viralStructure: string;
    scenarioExpansion: string;
  };
  cast?: Array<{ name: string; role: string; appearance?: string }>;
  analysis?: StoryboardAnalysisStructured | StoryboardAnalysisLegacyMarkdown;
  schemes?: StoryboardScheme[];
};

export type StoryboardDeliverableSnapshot = {
  savedAt: string;
  title: string;
  productName?: string;
  productHighlight?: string;
  projectKeywords?: string;
  /** 策划定稿 Markdown（剧本 / 话术） */
  deliverableMarkdown?: string;
  sheet: StoryboardSheet;
  references: StoryboardReference[];
  sheetPngUrl?: string;
  videoUrl?: string;
  videoAssetId?: string;
  videoMode?: "full_sheet" | "merged_panels";
  renderJobId?: string;
  renderExpiresAt?: string;
  panelVideos: Array<{ index: number; videoUrl: string }>;
};

export type StoryboardProject = {
  id: string;
  title: string | null;
  module: string;
  status: string;
  brief: Record<string, unknown> | null;
  settings: Record<string, unknown> | null;
  references: StoryboardReference[];
  chatHistory: StoryboardChatMessage[];
  sheet: StoryboardSheet | null;
  sheetPngUrl: string | null;
  sheetHtmlUrl: string | null;
  videoAssetId: string | null;
  videoOssUrl?: string | null;
  meta: {
    deliverable?: StoryboardDeliverable | FashionDeliverable;
    deliverableMarkdown?: string;
    selectedSchemeIndex?: number;
    workflow?: {
      vertical?: "fashion_apparel" | "bags";
      fashionPhase?: FashionPhase;
      dimensionStep?: number;
      productName?: string;
      phase?: "planning" | "finalized" | "refs" | "image" | "video" | "done";
      replanning?: boolean;
      /** 自定义参数胶囊收集中 */
      paramCollecting?: boolean;
      /** 第 11 项选「输入卖点」后等待用户打字 */
      paramAwaitingSellpoint?: boolean;
      /** 0=品类，1–11=参数项 */
      paramStep?: number;
      collectedParams?: Record<string, string>;
      productCategory?: string;
      /** 品类由产品名关键词自动推断 */
      categoryAutoMatched?: boolean;
      planMode?: "quick" | "custom" | "default_a";
      imageModelKey?: string;
      videoModelKey?: string;
      imageSize?: string;
      videoResolution?: string;
      autoGenCharacter?: boolean;
      /** 无上传角色图时：female_ugc | male_ugc */
      characterPresetKey?: string;
      skippedProduct?: boolean;
      skippedCharacter?: boolean;
      skippedRefs?: boolean;
      /** 无场景图时用户选的预设环境 key（见 storyboard-scene-presets）；custom=自定义 */
      scenePreset?: string;
      /** 自定义场景描述（scenePreset=custom 时） */
      scenePresetCustom?: string;
      /** 场景步骤选「自定义场景」后等待用户输入 */
      awaitingCustomSceneInput?: boolean;
      /** 已记录场景描述，等待用户选择「自定义 / AI 生成」 */
      awaitingSceneApplyMode?: boolean;
      /** 用户已从多套方案中选定一套（定稿前仅记选择，不立即写 sheet） */
      schemePicked?: boolean;
      /** 开场上传产品图后用户已确认 */
      initialProductRefAcknowledged?: boolean;
      videoMode?: "full_sheet" | "merged_panels";
      pendingFullVideoJob?: {
        taskId: string;
        logId: string;
        modelKey: string;
        startedAt: string;
        durationSec?: number;
      };
      /** 分镜图生成中（刷新后可恢复 busy 态） */
      pendingPanelImages?: Record<
        string,
        { startedAt: string; modelKey?: string }
      >;
    };
    deliverableSnapshot?: StoryboardDeliverableSnapshot;
    deliverableSnapshotHistory?: StoryboardDeliverableSnapshot[];
  } | null;
  createdAt: string;
  updatedAt: string;
};

export type StoryboardGatewayModel = {
  modelKey: string;
  displayName: string;
  description: string;
  role: "LLM" | "IMAGE" | "VIDEO";
  providerKind?: string;
  credentialBound: boolean;
  platformOffering?: boolean;
  scenarioKey?: string;
  /** 用户可见来源（模型运营中心 sourceLabel） */
  sourceLabel?: string;
  sortOrder?: number;
};
