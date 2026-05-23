/**
 * canvas-web 内置画布模板（v2 三套）。
 *
 * v2 节点规范：
 * - 用 `ai-engine` / `image-engine` 替代 v1 的 `ai-text` / `image-gen`
 * - `text` 节点支持双向（mode = manual / piped）
 * - `product-params` 已删，参数并入 text + 模板插入
 *
 * 注意：providerId / modelKey 留空，强制用户在节点上选自己的 Provider。
 * 这样即使从模板新建画布，也能跑通用户的 Key。
 */

import {
  AI_ENGINE_PROMPT_TEMPLATE,
  CANVAS_SCHEMA_VERSION,
  type CanvasGraph,
} from "./types";

export type BuiltinCanvasTemplate = {
  id: string;
  category: "builtin";
  name: string;
  description: string;
  thumbnail?: string;
  /** 给「新建画布」当作初始 graph 的 JSON */
  canvas: CanvasGraph;
};

const SPACING_X = 360;

function col(i: number, y: number) {
  return { x: 80 + i * SPACING_X, y };
}

const POSTER_TEMPLATE: CanvasGraph = {
  schemaVersion: CANVAS_SCHEMA_VERSION,
  viewport: { x: 0, y: 0, zoom: 0.85 },
  nodes: [
    {
      id: "tpl-product-img",
      type: "image",
      position: col(0, 60),
      data: { label: "产品主图（替换我）" },
    },
    {
      id: "tpl-style-img",
      type: "image",
      position: col(0, 460),
      data: { label: "风格参考图（替换我）" },
    },
    {
      id: "tpl-params",
      type: "text",
      position: col(0, 860),
      data: {
        text: `品牌：你的品牌
名称：型号 / 名称
规格：尺寸 / 容量 / 颜色
价格：¥ —
卖点：极简、轻盈、性价比`,
        mode: "manual",
      },
    },
    {
      id: "tpl-ai-engine",
      type: "ai-engine",
      position: col(1, 460),
      data: {
        providerId: "",
        modelKey: "",
        prompt: AI_ENGINE_PROMPT_TEMPLATE,
        referencedNodeIds: [],
        params: { reasoning_effort: "low", max_tokens: 4000, temperature: 0.7 },
      },
    },
    {
      id: "tpl-plan-text",
      type: "text",
      position: col(2, 460),
      data: { text: "", mode: "piped" },
    },
    {
      id: "tpl-image-engine",
      type: "image-engine",
      position: col(3, 460),
      data: {
        providerId: "",
        modelKey: "",
        prompt: "电商海报，简洁排版，保留产品主体，融合参考图风格。",
        referencedNodeIds: [],
        params: { aspect_ratio: "1:1", resolution: "2K", output_format: "png" },
      },
    },
    {
      id: "tpl-out",
      type: "output",
      position: col(4, 460),
      data: { title: "电商产品海报", saveToGallery: true },
    },
  ],
  edges: [
    {
      id: "e-product-ai",
      source: "tpl-product-img",
      sourceHandle: "image",
      target: "tpl-ai-engine",
      targetHandle: "in_image",
    },
    {
      id: "e-style-ai",
      source: "tpl-style-img",
      sourceHandle: "image",
      target: "tpl-ai-engine",
      targetHandle: "in_image",
    },
    {
      id: "e-params-ai",
      source: "tpl-params",
      sourceHandle: "text",
      target: "tpl-ai-engine",
      targetHandle: "in_text",
    },
    {
      id: "e-ai-plan",
      source: "tpl-ai-engine",
      sourceHandle: "text",
      target: "tpl-plan-text",
      targetHandle: "in_text",
    },
    {
      id: "e-plan-image",
      source: "tpl-plan-text",
      sourceHandle: "text",
      target: "tpl-image-engine",
      targetHandle: "in_text",
    },
    {
      id: "e-product-image",
      source: "tpl-product-img",
      sourceHandle: "image",
      target: "tpl-image-engine",
      targetHandle: "in_image",
    },
    {
      id: "e-image-out",
      source: "tpl-image-engine",
      sourceHandle: "image",
      target: "tpl-out",
      targetHandle: "in_image",
    },
  ],
};

const COVER_TEMPLATE: CanvasGraph = {
  schemaVersion: CANVAS_SCHEMA_VERSION,
  viewport: { x: 0, y: 0, zoom: 0.9 },
  nodes: [
    {
      id: "cv-style",
      type: "image",
      position: col(0, 60),
      data: { label: "风格 / 主视觉参考" },
    },
    {
      id: "cv-text",
      type: "text",
      position: col(0, 460),
      data: {
        text: "短视频标题：例如「夏日新品上线」+ 5 字以内 punch line",
        mode: "manual",
      },
    },
    {
      id: "cv-image",
      type: "image-engine",
      position: col(1, 240),
      data: {
        providerId: "",
        modelKey: "",
        prompt:
          "竖版短视频封面，主体居中，标题大字醒目，强对比配色，整体氛围清晰传达。",
        referencedNodeIds: [],
        params: { aspect_ratio: "9:16", resolution: "2K", output_format: "jpeg" },
      },
    },
    {
      id: "cv-out",
      type: "output",
      position: col(2, 240),
      data: { title: "短视频封面", saveToGallery: true },
    },
  ],
  edges: [
    {
      id: "e-cv-style-image",
      source: "cv-style",
      sourceHandle: "image",
      target: "cv-image",
      targetHandle: "in_image",
    },
    {
      id: "e-cv-text-image",
      source: "cv-text",
      sourceHandle: "text",
      target: "cv-image",
      targetHandle: "in_text",
    },
    {
      id: "e-cv-image-out",
      source: "cv-image",
      sourceHandle: "image",
      target: "cv-out",
      targetHandle: "in_image",
    },
  ],
};

const THREE_VIEW_TEMPLATE: CanvasGraph = {
  schemaVersion: CANVAS_SCHEMA_VERSION,
  viewport: { x: 0, y: 0, zoom: 0.8 },
  nodes: [
    {
      id: "tv-product",
      type: "image",
      position: col(0, 240),
      data: { label: "产品主体（一张图即可）" },
    },
    {
      id: "tv-front",
      type: "text",
      position: col(1, 60),
      data: {
        text: "正视图：水平视角，产品居中，干净背景。",
        mode: "manual",
      },
    },
    {
      id: "tv-side",
      type: "text",
      position: col(1, 280),
      data: {
        text: "侧视图：90° 侧面，比例与材质需保持一致。",
        mode: "manual",
      },
    },
    {
      id: "tv-back",
      type: "text",
      position: col(1, 500),
      data: {
        text: "后视图：背面细节、接口、Logo 可见。",
        mode: "manual",
      },
    },
    {
      id: "tv-image-front",
      type: "image-engine",
      position: col(2, 60),
      data: {
        providerId: "",
        modelKey: "",
        prompt: "工业产品三视图：正视图。",
        referencedNodeIds: [],
        params: { aspect_ratio: "1:1", resolution: "2K", output_format: "png" },
      },
    },
    {
      id: "tv-image-side",
      type: "image-engine",
      position: col(2, 280),
      data: {
        providerId: "",
        modelKey: "",
        prompt: "工业产品三视图：侧视图。",
        referencedNodeIds: [],
        params: { aspect_ratio: "1:1", resolution: "2K", output_format: "png" },
      },
    },
    {
      id: "tv-image-back",
      type: "image-engine",
      position: col(2, 500),
      data: {
        providerId: "",
        modelKey: "",
        prompt: "工业产品三视图：后视图。",
        referencedNodeIds: [],
        params: { aspect_ratio: "1:1", resolution: "2K", output_format: "png" },
      },
    },
    {
      id: "tv-out-front",
      type: "output",
      position: col(3, 60),
      data: { title: "三视图 · 正", saveToGallery: true },
    },
    {
      id: "tv-out-side",
      type: "output",
      position: col(3, 280),
      data: { title: "三视图 · 侧", saveToGallery: true },
    },
    {
      id: "tv-out-back",
      type: "output",
      position: col(3, 500),
      data: { title: "三视图 · 后", saveToGallery: true },
    },
  ],
  edges: [
    { id: "e-tv-p-f", source: "tv-product", sourceHandle: "image", target: "tv-image-front", targetHandle: "in_image" },
    { id: "e-tv-p-s", source: "tv-product", sourceHandle: "image", target: "tv-image-side", targetHandle: "in_image" },
    { id: "e-tv-p-b", source: "tv-product", sourceHandle: "image", target: "tv-image-back", targetHandle: "in_image" },
    { id: "e-tv-tf-if", source: "tv-front", sourceHandle: "text", target: "tv-image-front", targetHandle: "in_text" },
    { id: "e-tv-ts-is", source: "tv-side", sourceHandle: "text", target: "tv-image-side", targetHandle: "in_text" },
    { id: "e-tv-tb-ib", source: "tv-back", sourceHandle: "text", target: "tv-image-back", targetHandle: "in_text" },
    { id: "e-tv-if-of", source: "tv-image-front", sourceHandle: "image", target: "tv-out-front", targetHandle: "in_image" },
    { id: "e-tv-is-os", source: "tv-image-side", sourceHandle: "image", target: "tv-out-side", targetHandle: "in_image" },
    { id: "e-tv-ib-ob", source: "tv-image-back", sourceHandle: "image", target: "tv-out-back", targetHandle: "in_image" },
  ],
};

export const BUILTIN_CANVAS_TEMPLATES: BuiltinCanvasTemplate[] = [
  {
    id: "builtin/product-poster",
    category: "builtin",
    name: "产品风格化海报",
    description:
      "产品 + 风格图 + 参数 → AI 引擎出方案 → 文本(可改)→ 生图引擎出海报 → 输出。完整双引擎流。",
    canvas: POSTER_TEMPLATE,
  },
  {
    id: "builtin/short-video-cover",
    category: "builtin",
    name: "短视频封面",
    description: "风格参考 + 标题 → 生图引擎(竖版高分辨率) → 短视频封面输出。",
    canvas: COVER_TEMPLATE,
  },
  {
    id: "builtin/three-view",
    category: "builtin",
    name: "工业三视图",
    description: "同一产品图 + 三视角描述 → 三个生图引擎并行 → 正/侧/后三张视图。",
    canvas: THREE_VIEW_TEMPLATE,
  },
];

/** 空白模板（默认使用） */
export const BLANK_CANVAS: CanvasGraph = {
  schemaVersion: CANVAS_SCHEMA_VERSION,
  viewport: { x: 0, y: 0, zoom: 1 },
  nodes: [],
  edges: [],
};
