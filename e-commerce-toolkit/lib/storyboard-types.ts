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

export type StoryboardDeliverable = {
  productName?: string;
  params?: Record<string, string>;
  analysis?: {
    audienceMarkdown: string;
    painPointsMarkdown: string;
    strategiesMarkdown: string;
  };
  schemes?: StoryboardScheme[];
};

export type StoryboardDeliverableSnapshot = {
  savedAt: string;
  title: string;
  productName?: string;
  productHighlight?: string;
  projectKeywords?: string;
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
    deliverable?: StoryboardDeliverable;
    deliverableMarkdown?: string;
    selectedSchemeIndex?: number;
    workflow?: {
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
      videoMode?: "full_sheet" | "merged_panels";
      pendingFullVideoJob?: {
        taskId: string;
        logId: string;
        modelKey: string;
        startedAt: string;
        durationSec?: number;
      };
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
};
