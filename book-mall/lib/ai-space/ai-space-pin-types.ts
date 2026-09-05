/**
 * 我的 AI 空间 · Pin 指针类型定义
 *
 * 设计见 doc/product/我的AI空间.md：Pin 表只存 { sourceApp, sourceType, sourceId }，
 * 展示字段一律读时 resolve 源记录，禁止在 Pin 上缓存 prompt / ossUrl / thumbnailUrl。
 */

/**
 * 全局资产库支持的源记录类型。
 *
 * 新增一种即同时打通：作品墙自由画布、素材抽屉、资产库聚合浏览、公开页、级联删除。
 * 见 doc/product/AI 空间功能设计文档.md §11。
 */
export const AI_SPACE_PIN_SOURCE_TYPES = [
  // 用户主动收进空间的成品（原 6 种）
  "ecom_asset",
  "t2i_library",
  "i2v_library",
  "ai_space_audio",
  "ai_space_video",
  "ai_space_digital_human",
  // 影视项目（story-web）
  "story_character",
  "story_frame_image",
  "story_frame_video",
  // 统一项目资产与画布产物（canvas-web · Pro2 / sbv1 / Story-Pro）
  "project_asset",
  "canvas_task",
  // AI 试衣（tool-web）
  "aifit_model",
  "aifit_closet",
  // 快速复制（quick-replica-web）
  "qr_template",
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
  story_character: "story",
  story_frame_image: "story",
  story_frame_video: "story",
  project_asset: "canvas",
  canvas_task: "canvas",
  aifit_model: "tool",
  aifit_closet: "tool",
  qr_template: "quick-replica",
};

/** 源类型中文名（UI 与确认文案共用） */
export const AI_SPACE_PIN_SOURCE_LABEL: Record<AiSpacePinSourceType, string> = {
  ecom_asset: "电商工具箱",
  t2i_library: "我的图片库",
  i2v_library: "我的视频库",
  ai_space_audio: "我的音频库",
  ai_space_video: "视频创作库",
  ai_space_digital_human: "数字人库",
  story_character: "影视角色",
  story_frame_image: "影视分镜图",
  story_frame_video: "影视分镜视频",
  project_asset: "项目资产库",
  canvas_task: "画布生成",
  aifit_model: "我的模特",
  aifit_closet: "我的衣柜",
  qr_template: "快速复制作品",
};

/**
 * 该源类型的媒体地址能否直接给公网访客。
 *
 * `false` 表示媒体经 Book 鉴权路由代理（如 AI 试衣模特存的是 base64 Data URL，
 * 由 `/api/platform/v1/ai-space/assets/aifit-model/[id]/image` 解码后输出），
 * 公开页会跳过这些引用，避免访客拿到 401 破图。
 */
export const AI_SPACE_PIN_SOURCE_PUBLIC_SAFE: Record<AiSpacePinSourceType, boolean> = {
  ecom_asset: true,
  t2i_library: true,
  i2v_library: true,
  ai_space_audio: true,
  ai_space_video: true,
  ai_space_digital_human: true,
  story_character: true,
  story_frame_image: true,
  story_frame_video: true,
  project_asset: true,
  canvas_task: true,
  aifit_model: false,
  aifit_closet: true,
  qr_template: true,
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
