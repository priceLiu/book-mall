/** 服装专业版 deliverable 类型（与 book-mall fashion-deliverable-spec-v4 对齐） */

import type {
  ProductionMode,
  StoryTheaterTopicRef,
  StoryTheaterVersionKey,
} from "@/lib/story-theater-types";

export type { ProductionMode, StoryTheaterTopicRef, StoryTheaterVersionKey };

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
  /** 生图/生视频共用的场景描述 prompt */
  scenePrompt: string;
  modelAction: string;
  /** @deprecated 读入兼容；新 vertical 用 productFocus */
  garmentFocus: string;
  productFocus?: string;
  dialogue?: string;
  toneTexture?: string;
  /** 故事剧场 · 字幕文案（只读展示） */
  subtitle?: string;
  sellpointIds: string[];
  imagePrompt: string;
  /** 单镜视频 motion prompt */
  videoPrompt: string;
};

export type FashionStoryboardVersion = {
  id: FashionVersionKey;
  title: string;
  summary?: string;
  panels: FashionPanelRow[];
  totalDurationSec?: number;
};

export type StoryTheaterVersion = {
  id: StoryTheaterVersionKey;
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
  bgmDirection?: string;
  subtitleGuide?: string;
  sfxNotes?: string;
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
  /** 七维完成后前置：标准分镜线 / 故事剧场线；空视为 standard_script */
  productionMode?: ProductionMode | null;
  /** 故事主题 5 选 1 时展示的候选（持久化供历史回放） */
  storyTopicCandidates?: StoryTheaterTopicRef[];
  selectedStoryTopic?: StoryTheaterTopicRef | null;
  storyTheaterVersions?: Partial<Record<StoryTheaterVersionKey, StoryTheaterVersion>>;
  selectedStoryTheaterVersion?: StoryTheaterVersionKey | null;
  storyTheaterLocked?: boolean;
};

export type FashionPhase =
  | "product_ref"
  | "category_pick"
  | "dimensions"
  | "production_mode"
  | "sellpoints"
  | "story_topic_pick"
  | "story_theater_pick"
  | "story_theater_confirm"
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
