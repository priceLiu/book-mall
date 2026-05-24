import type { Edge, Node, Viewport } from "@xyflow/react";
import {
  AI_ENGINE_PROMPT_TEMPLATE,
  THREE_VIEW_ENGINE_PROMPT_DEFAULT,
} from "./builtin-prompt-templates";

export {
  AI_ENGINE_PROMPT_TEMPLATE,
  AI_ENGINE_PROMPT_TEMPLATE_V2,
  IMAGE_ENGINE_PROMPT_TEMPLATE_DEFAULT,
  THREE_VIEW_ENGINE_PROMPT_DEFAULT,
  THREE_VIEW_ENGINE_MODEL_KEYS,
} from "./builtin-prompt-templates";

/**
 * 节点类型清单（v2 · 已清理 v1）
 * - 旧 `ai-text` / `image-gen` / `product-params` 由 lib/canvas/migrate.ts 在 hydrate 时
 *   in-memory 转成 `ai-engine` / `image-engine` / `text`，渲染层不再需要识别
 * - `group` 为容器，不参与拓扑
 */
export type CanvasNodeType =
  | "image"
  | "text"
  | "ai-engine"
  | "image-engine"
  | "three-view-engine"
  | "output"
  | "group";

/** "可放进画布、用户能添加" 的内容节点类型 — 不含 group + 不含 v1 兼容。 */
export type CanvasContentNodeType =
  | "image"
  | "text"
  | "ai-engine"
  | "image-engine"
  | "three-view-engine"
  | "output";

/** 内容节点（非 group / 非 v1 兼容）按钮面板用。 */
export const CONTENT_NODE_TYPES: CanvasContentNodeType[] = [
  "image",
  "text",
  "ai-engine",
  "image-engine",
  "three-view-engine",
  "output",
];

export type CanvasNodeRunStatus =
  | "idle"
  | "pending"
  | "running"
  | "done"
  | "error";

/** 节点上"运行结果"片段。前端用于渲染缩略图 + 错误提示。 */
export type CanvasNodeRuntime = {
  status: CanvasNodeRunStatus;
  taskId?: string;
  ossUrl?: string;
  ephemeralUrl?: string;
  textOutput?: string;
  failCode?: string;
  failMessage?: string;
};

// —— 各节点 data 形状 ——

export type ImageNodeData = {
  /** 已上传到 OSS 的稳定 URL（首选） */
  ossUrl?: string;
  /** 拖入即时显示的 blob URL（仅本会话有效） */
  blobUrl?: string;
  /** 是否仍在后台上传中 */
  uploading?: boolean;
  label?: string;
  /** 上传错误信息 */
  uploadError?: string;
  runtime?: CanvasNodeRuntime;
};

export type TextNodeData = {
  text: string;
  /**
   * v2: 文本节点也是双向的——
   * - manual：用户手写（默认）
   * - piped：来自上游 ai-engine 的 textOutput；展示 runtime.textOutput 优先；用户点 ✎ 切回 manual
   */
  mode?: "manual" | "piped";
  runtime?: CanvasNodeRuntime;
};

/**
 * v2 · AI 引擎节点：调 LLM 出文本。
 * provider+model 二级选择；params 由 model.paramsSchema 动态渲染。
 */
export type AiEngineNodeData = {
  /** 引用的 user CanvasProvider id；空表示尚未选择 */
  providerId: string;
  /** Provider 端 model key */
  modelKey: string;
  /**
   * 富文本 prompt：包含 `@<nodeId>` mention token；序列化由 MentionsTextarea 处理
   * 三段式默认结构（用户可一键插入）：
   *   【输入变量】... 【系统任务】... 【强制运算逻辑】...
   */
  prompt: string;
  /** prompt 里被引用到的上游 nodeId 列表，用于"高亮 chip" */
  referencedNodeIds?: string[];
  /** 最近一次选用的提示词模板 id（含内置 id；归档后仍可追溯） */
  promptTemplateId?: string;
  /** 选用时的模板名称快照 */
  promptTemplateNameSnap?: string;
  /** 模型参数（temperature / max_tokens / reasoning_effort 等） */
  params?: Record<string, unknown>;
  runtime?: CanvasNodeRuntime;
};

/** v2 · 生图引擎节点：调图像模型，支持重复生成（历史 / 对比由 store 不直接保存）。 */
export type ImageEngineNodeData = {
  providerId: string;
  modelKey: string;
  prompt: string;
  referencedNodeIds?: string[];
  promptTemplateId?: string;
  promptTemplateNameSnap?: string;
  params?: Record<string, unknown>;
  /** 阶段 4：当前展示的 task id（来自历史 chip 切换） */
  activeTaskId?: string;
  runtime?: CanvasNodeRuntime;
};

/** 三视图引擎：结构与生图引擎相同，默认 prompt / 模型白名单不同。 */
export type ThreeViewEngineNodeData = ImageEngineNodeData;

export type OutputNodeData = {
  title: string;
  saveToGallery: boolean;
  runtime?: CanvasNodeRuntime;
};

export type GroupNodeData = {
  /** 组名（用户输入） */
  label: string;
  /** 主色（hex），用于边框 / 背景透明度叠加 */
  color: string;
};

export type CanvasNodeData =
  | (ImageNodeData & { __t: "image" })
  | (TextNodeData & { __t: "text" })
  | (AiEngineNodeData & { __t: "ai-engine" })
  | (ImageEngineNodeData & { __t: "image-engine" })
  | (ThreeViewEngineNodeData & { __t: "three-view-engine" })
  | (OutputNodeData & { __t: "output" })
  | (GroupNodeData & { __t: "group" });

export type CanvasFlowNode = Node<Record<string, unknown>, CanvasNodeType>;
export type CanvasFlowEdge = Edge;

export type CanvasGraph = {
  schemaVersion: number;
  nodes: CanvasFlowNode[];
  edges: CanvasFlowEdge[];
  viewport?: Viewport;
};

/**
 * Schema 版本：
 * - 1 = v1（含 ai-text / image-gen / product-params）
 * - 2 = v2（双引擎）
 * 加载 schemaVersion < 2 的 graph 时由 lib/canvas/migrate.ts 做 in-memory 迁移
 */
export const CANVAS_SCHEMA_VERSION = 2;

export const NODE_DEFAULT_DATA: Record<CanvasNodeType, Record<string, unknown>> = {
  image: {} satisfies ImageNodeData as Record<string, unknown>,
  text: { text: "", mode: "manual" } satisfies TextNodeData as Record<string, unknown>,
  "ai-engine": {
    providerId: "",
    modelKey: "",
    prompt: AI_ENGINE_PROMPT_TEMPLATE,
    referencedNodeIds: [],
    params: { reasoning_effort: "low", max_tokens: 4000, temperature: 0.7 },
  } satisfies AiEngineNodeData as Record<string, unknown>,
  "image-engine": {
    providerId: "",
    modelKey: "",
    prompt: "",
    referencedNodeIds: [],
    params: { aspect_ratio: "1:1", resolution: "2K", output_format: "png" },
  } satisfies ImageEngineNodeData as Record<string, unknown>,
  "three-view-engine": {
    providerId: "",
    modelKey: "",
    prompt: THREE_VIEW_ENGINE_PROMPT_DEFAULT,
    referencedNodeIds: [],
    params: { aspect_ratio: "16:9", resolution: "2K", output_format: "png" },
  } satisfies ThreeViewEngineNodeData as Record<string, unknown>,
  output: {
    title: "未命名画作",
    saveToGallery: true,
  } satisfies OutputNodeData as Record<string, unknown>,
  group: {
    label: "未命名分组",
    color: "#a78bfa",
  } satisfies GroupNodeData as Record<string, unknown>,
};

/**
 * 各节点默认尺寸：用于 addNode 落 `node.style` 给 NodeResizer 提供初值。
 * 所有非 group 节点都允许用户拖角调整大小。
 */
export const NODE_DEFAULT_SIZE: Record<
  CanvasNodeType,
  { width: number; height: number }
> = {
  image: { width: 280, height: 360 },
  text: { width: 380, height: 260 },
  "ai-engine": { width: 480, height: 540 },
  "image-engine": { width: 460, height: 720 },
  "three-view-engine": { width: 460, height: 680 },
  output: { width: 340, height: 360 },
  group: { width: 360, height: 240 },
};

/** 6 个预设分组色（与暗紫主题搭） */
export const GROUP_COLOR_PRESETS = [
  "#a78bfa", // 主紫
  "#60a5fa", // 蓝
  "#34d399", // 绿
  "#fbbf24", // 琥珀
  "#f472b6", // 粉
  "#94a3b8", // 中性
] as const;

export const NODE_OUTPUT_KIND: Record<CanvasNodeType, "image" | "text" | "none"> = {
  image: "image",
  text: "text",
  "ai-engine": "text",
  "image-engine": "image",
  "three-view-engine": "image",
  output: "none",
  group: "none",
};

/** 节点是否实际触发后端任务（其它节点为"被动数据源"） */
export function isRunnableNodeType(t: CanvasNodeType): boolean {
  return t === "ai-engine" || t === "image-engine" || t === "three-view-engine";
}

/** group 节点是容器、不参与拓扑 / 输入解析。 */
export function isGroupNode(t: string | undefined): boolean {
  return t === "group";
}
