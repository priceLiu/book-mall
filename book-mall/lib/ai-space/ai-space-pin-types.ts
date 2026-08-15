/**
 * 我的 AI 空间 · Pin 指针类型定义
 *
 * 设计见 doc/product/我的AI空间.md：Pin 表只存 { sourceApp, sourceType, sourceId }，
 * 展示字段一律读时 resolve 源记录，禁止在 Pin 上缓存 prompt / ossUrl / thumbnailUrl。
 */

/** 支持展示到作品墙的源记录类型 */
export const AI_SPACE_PIN_SOURCE_TYPES = [
  "ecom_asset",
  "t2i_library",
  "i2v_library",
  "ai_space_audio",
  "ai_space_video",
  "ai_space_digital_human",
] as const;

export type AiSpacePinSourceType = (typeof AI_SPACE_PIN_SOURCE_TYPES)[number];

export function isAiSpacePinSourceType(v: unknown): v is AiSpacePinSourceType {
  return (
    typeof v === "string" &&
    (AI_SPACE_PIN_SOURCE_TYPES as readonly string[]).includes(v)
  );
}

/** 展示形态：决定作品墙卡片用哪种预览器 */
export type AiSpacePinMediaKind = "image" | "video" | "audio";

/** 各源类型归属的应用 navKey（POST 时可省略，由此表推导） */
export const AI_SPACE_PIN_SOURCE_APP: Record<AiSpacePinSourceType, string> = {
  ecom_asset: "ecom",
  t2i_library: "tool",
  i2v_library: "tool",
  ai_space_audio: "ai-space",
  ai_space_video: "ai-space",
  ai_space_digital_human: "ai-space",
};

/** 源类型中文名（UI 与确认文案共用） */
export const AI_SPACE_PIN_SOURCE_LABEL: Record<AiSpacePinSourceType, string> = {
  ecom_asset: "电商工具箱",
  t2i_library: "我的图片库",
  i2v_library: "我的视频库",
  ai_space_audio: "音频库",
  ai_space_video: "视频创作库",
  ai_space_digital_human: "数字人库",
};

/**
 * 深链规格：点击作品墙卡片时回到原应用工作流。
 * Book 不内嵌编辑器，经 SSO re-enter 带上 path 与 query。
 */
export type WorkflowLaunchSpec = {
  /** navKey / 子站标识 */
  app: string;
  /** 子站路由 */
  path: string;
  mode: "open_project" | "reuse_snapshot" | "open_studio";
  projectId?: string;
  query?: Record<string, string>;
};

/** 作品墙卡片 DTO（resolve 后组装，不落库） */
export type AiSpacePinEntry = {
  pinId: string;
  sourceApp: string;
  sourceType: AiSpacePinSourceType;
  sourceId: string;
  sortOrder: number;
  /** 用户自定义标题；为空时前端回落 resolved.title */
  caption: string | null;
  pinnedAt: string;
  resolved: {
    kind: AiSpacePinMediaKind;
    title: string | null;
    prompt: string | null;
    /** 主媒体地址（图片 / 视频 / 音频） */
    mediaUrl: string;
    /** 视频封面；图片类与 mediaUrl 相同 */
    thumbnailUrl: string | null;
    createdAt: string;
    durationSec: number | null;
    /** 来源子模块，如电商 module、视频库 mode */
    moduleLabel: string | null;
    launch: WorkflowLaunchSpec | null;
  };
};

/** 删源前检测结果 */
export type AiSpacePinCheckResult = {
  /** 该源记录是否已展示在作品墙 */
  pinned: boolean;
  pinIds: string[];
};
