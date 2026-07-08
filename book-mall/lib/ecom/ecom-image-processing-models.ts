/**
 * 电商工具箱 · 图像处理 · Gateway 模型与参数定义
 */

export const ECOM_IMAGE_PROCESSING_TOOL_KEY = "ecom-toolkit__image-processing";

export const ECOM_QWEN_EDIT_MODEL_KEYS = [
  "qwen-image-edit-max",
  "qwen-image-edit",
] as const;

export const ECOM_OUTPAINT_MODEL_KEY = "image-out-painting";
export const ECOM_WANX_PAINTING_MODEL_KEY = "wanx-x-painting";
export const ECOM_WAN_I2I_MODEL_KEY = "wan2.5-i2i-preview";
export const ECOM_SEEDREAM_EDITOR_MODEL_KEY = "doubao-seedream-5-0-260128";
export const ECOM_KIE_NANO_PRO_MODEL_KEY = "lib-nano-pro";

export const ECOM_IMAGE_PROCESSING_MODEL_KEYS = [
  ...ECOM_QWEN_EDIT_MODEL_KEYS,
  "doubao-seedream-5-0-lite",
  ECOM_SEEDREAM_EDITOR_MODEL_KEY,
  ECOM_KIE_NANO_PRO_MODEL_KEY,
  "nano-banana-pro",
  ECOM_OUTPAINT_MODEL_KEY,
  ECOM_WANX_PAINTING_MODEL_KEY,
  ECOM_WAN_I2I_MODEL_KEY,
] as const;

export type ImageProcessingMode =
  | "retouch"
  | "editor"
  | "enhancer"
  | "outpaint"
  | "restore"
  | "face-swap"
  | "bg-remove"
  | "object-remove"
  | "deblur"
  | "camera-angle"
  | "poster"
  | "meme"
  | "avatar"
  | "gif";

export type QwenEditModelKey = (typeof ECOM_QWEN_EDIT_MODEL_KEYS)[number];

export function isQwenEditModelKey(modelKey: string): modelKey is QwenEditModelKey {
  return (ECOM_QWEN_EDIT_MODEL_KEYS as readonly string[]).includes(modelKey);
}

export function isQwenEditMaxModelKey(modelKey: string): boolean {
  return modelKey === "qwen-image-edit-max";
}

/** Qwen 图像编辑 API 输入图上限：Max 6 张，标准版 3 张 */
export function maxQwenInputImages(modelKey: string): number {
  if (isQwenEditMaxModelKey(modelKey)) return 6;
  if (modelKey === "qwen-image-edit") return 3;
  return 1;
}

export function isSeedreamEditorModelKey(modelKey: string): boolean {
  return (
    modelKey === ECOM_SEEDREAM_EDITOR_MODEL_KEY ||
    modelKey === "doubao-seedream-5-0-lite" ||
    modelKey.includes("doubao-seedream-5")
  );
}

export function isWanI2iModelKey(modelKey: string): boolean {
  return modelKey === ECOM_WAN_I2I_MODEL_KEY;
}

export function isWanxPaintingModelKey(modelKey: string): boolean {
  return modelKey === ECOM_WANX_PAINTING_MODEL_KEY;
}

export function isOutpaintModelKey(modelKey: string): boolean {
  return modelKey === ECOM_OUTPAINT_MODEL_KEY;
}

export function isKieNanoProModelKey(modelKey: string): boolean {
  return (
    modelKey === ECOM_KIE_NANO_PRO_MODEL_KEY ||
    modelKey === "nano-banana-pro" ||
    modelKey.includes("nano-banana")
  );
}

export function resolveKieNanoProApiModel(modelKey: string): string {
  if (modelKey === ECOM_KIE_NANO_PRO_MODEL_KEY) return "nano-banana-pro";
  return modelKey;
}

export type ImageProcessingParamField = {
  name: string;
  label: string;
  type: "string" | "boolean" | "integer" | "select" | "number";
  defaultValue?: string | number | boolean;
  options?: Array<{ value: string; label: string }>;
  min?: number;
  max?: number;
  hint?: string;
};

export const QWEN_IMAGE_EDIT_PARAM_FIELDS: ImageProcessingParamField[] = [
  {
    name: "negative_prompt",
    label: "负面提示（应避免的情况）",
    type: "string",
    defaultValue: "",
    hint: "模糊、低质量、带水印、失真……",
  },
  {
    name: "prompt_extend",
    label: "智能扩写提示词",
    type: "boolean",
    defaultValue: true,
  },
  {
    name: "watermark",
    label: "添加 Qwen 水印",
    type: "boolean",
    defaultValue: false,
  },
  {
    name: "seed",
    label: "随机种子",
    type: "integer",
    min: 0,
    max: 2147483647,
    hint: "留空则随机",
  },
];

export const QWEN_IMAGE_EDIT_MAX_EXTRA_FIELDS: ImageProcessingParamField[] = [
  {
    name: "n",
    label: "生成张数",
    type: "select",
    defaultValue: "1",
    options: ["1", "2", "3", "4", "5", "6"].map((v) => ({
      value: v,
      label: v,
    })),
  },
  {
    name: "size",
    label: "输出尺寸",
    type: "select",
    defaultValue: "",
    options: [
      { value: "", label: "与输入图一致" },
      { value: "1024*1024", label: "1024×1024" },
      { value: "1328*1328", label: "1328×1328" },
      { value: "1664*928", label: "1664×928 (16:9)" },
      { value: "928*1664", label: "928×1664 (9:16)" },
      { value: "1472*1140", label: "1472×1140 (4:3)" },
      { value: "1140*1472", label: "1140×1472 (3:4)" },
    ],
  },
];

export const SEEDREAM_EDITOR_PARAM_FIELDS: ImageProcessingParamField[] = [
  {
    name: "size",
    label: "输出尺寸",
    type: "select",
    defaultValue: "2K",
    options: [
      { value: "2K", label: "2K（推荐）" },
      { value: "4K", label: "4K" },
      { value: "2048x2048", label: "2048×2048" },
      { value: "2048x1152", label: "2048×1152 (16:9)" },
      { value: "1152x2048", label: "1152×2048 (9:16)" },
    ],
  },
  {
    name: "watermark",
    label: "添加水印",
    type: "boolean",
    defaultValue: false,
  },
  {
    name: "stream",
    label: "流式输出",
    type: "boolean",
    defaultValue: false,
  },
  {
    name: "seed",
    label: "随机种子",
    type: "integer",
    min: 0,
    max: 2147483647,
    hint: "留空则随机",
  },
];

export const WANX_PAINTING_PARAM_FIELDS: ImageProcessingParamField[] = [
  {
    name: "size",
    label: "输出尺寸",
    type: "select",
    defaultValue: "1024*1024",
    options: [
      { value: "1024*1024", label: "1024×1024" },
      { value: "720*1280", label: "720×1280" },
      { value: "1280*720", label: "1280×720" },
    ],
  },
  {
    name: "n",
    label: "生成张数",
    type: "select",
    defaultValue: "1",
    options: ["1", "2", "3", "4"].map((v) => ({ value: v, label: v })),
  },
  {
    name: "style",
    label: "输出风格",
    type: "select",
    defaultValue: "<auto>",
    options: [
      { value: "<auto>", label: "默认" },
      { value: "<3d cartoon>", label: "3D 卡通" },
      { value: "<anime>", label: "动漫" },
      { value: "<oil painting>", label: "油画" },
      { value: "<watercolor>", label: "水彩" },
      { value: "<sketch>", label: "素描" },
    ],
  },
];

export const WAN_I2I_PARAM_FIELDS: ImageProcessingParamField[] = [
  {
    name: "size",
    label: "输出尺寸",
    type: "select",
    defaultValue: "",
    options: [
      { value: "", label: "默认（约 1280×1280）" },
      { value: "1280*1280", label: "1280×1280" },
      { value: "1024*1024", label: "1024×1024" },
      { value: "720*1280", label: "720×1280 (9:16)" },
      { value: "1280*720", label: "1280×720 (16:9)" },
    ],
  },
  {
    name: "negative_prompt",
    label: "反向提示词",
    type: "string",
    defaultValue: "",
  },
  {
    name: "prompt_extend",
    label: "智能扩写提示词",
    type: "boolean",
    defaultValue: true,
  },
  {
    name: "watermark",
    label: "添加水印",
    type: "boolean",
    defaultValue: false,
  },
  {
    name: "n",
    label: "生成张数",
    type: "select",
    defaultValue: "1",
    options: ["1", "2", "3", "4"].map((v) => ({ value: v, label: v })),
  },
  {
    name: "seed",
    label: "随机种子",
    type: "integer",
    min: 0,
    max: 2147483647,
    hint: "留空则随机",
  },
];

export const OUTPAINT_PARAM_FIELDS: ImageProcessingParamField[] = [
  {
    name: "expand_mode",
    label: "扩图方式",
    type: "select",
    defaultValue: "scale",
    options: [
      { value: "scale", label: "等比例扩展" },
      { value: "ratio", label: "指定宽高比" },
      { value: "offset", label: "四向添加像素" },
      { value: "rotate", label: "旋转后扩展" },
    ],
  },
  {
    name: "x_scale",
    label: "横向比例",
    type: "number",
    defaultValue: 1.5,
    min: 1,
    max: 3,
    hint: "等比例/旋转模式",
  },
  {
    name: "y_scale",
    label: "纵向比例",
    type: "number",
    defaultValue: 1.5,
    min: 1,
    max: 3,
    hint: "等比例/旋转模式",
  },
  {
    name: "output_ratio",
    label: "目标宽高比",
    type: "select",
    defaultValue: "4:3",
    options: [
      { value: "1:1", label: "1:1" },
      { value: "4:3", label: "4:3" },
      { value: "3:4", label: "3:4" },
      { value: "16:9", label: "16:9" },
      { value: "9:16", label: "9:16" },
    ],
  },
  {
    name: "angle",
    label: "旋转角度",
    type: "select",
    defaultValue: "0",
    options: [
      { value: "0", label: "不旋转" },
      { value: "90", label: "逆时针 90°" },
      { value: "180", label: "180°" },
      { value: "45", label: "45°" },
    ],
  },
  {
    name: "left_offset",
    label: "左侧扩展像素",
    type: "integer",
    min: 0,
    max: 4096,
    hint: "定向扩图",
  },
  {
    name: "right_offset",
    label: "右侧扩展像素",
    type: "integer",
    min: 0,
    max: 4096,
  },
  {
    name: "top_offset",
    label: "上方扩展像素",
    type: "integer",
    min: 0,
    max: 4096,
  },
  {
    name: "bottom_offset",
    label: "下方扩展像素",
    type: "integer",
    min: 0,
    max: 4096,
  },
  {
    name: "best_quality",
    label: "最佳质量",
    type: "boolean",
    defaultValue: false,
  },
  {
    name: "limit_image_size",
    label: "限制输出尺寸",
    type: "boolean",
    defaultValue: true,
  },
];

export const SEEDREAM_ASPECT_TO_SIZE: Record<string, string> = {
  "1:1": "2048x2048",
  "16:9": "2048x1152",
  "9:16": "1152x2048",
  "4:5": "1638x2048",
  "3:4": "1536x2048",
  "4:3": "2048x1536",
};

export const DEFAULT_ENHANCE_PROMPT =
  "Enhance image quality: reduce noise, sharpen details, restore natural colors and clarity. Keep the original composition and subjects unchanged.";

export function qwenEditParamFields(modelKey: string): ImageProcessingParamField[] {
  const base = [...QWEN_IMAGE_EDIT_PARAM_FIELDS];
  if (modelKey === "qwen-image-edit-max") {
    return [...base, ...QWEN_IMAGE_EDIT_MAX_EXTRA_FIELDS];
  }
  return base;
}

export function buildOutpaintApiParameters(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const mode = String(raw.expand_mode ?? "scale");
  const out: Record<string, unknown> = {};

  if (mode === "ratio") {
    if (raw.output_ratio) out.output_ratio = raw.output_ratio;
    out.angle = Number(raw.angle ?? 0);
    if (raw.best_quality !== undefined) out.best_quality = raw.best_quality;
    if (raw.limit_image_size !== undefined) {
      out.limit_image_size = raw.limit_image_size;
    }
    return out;
  }

  if (mode === "offset") {
    for (const key of [
      "left_offset",
      "right_offset",
      "top_offset",
      "bottom_offset",
    ] as const) {
      const v = raw[key];
      if (v !== undefined && v !== "" && Number(v) > 0) out[key] = Number(v);
    }
    return out;
  }

  if (mode === "rotate") {
    const angle = Number(raw.angle ?? 90);
    if (angle) out.angle = angle;
    out.x_scale = Number(raw.x_scale ?? 1.5);
    out.y_scale = Number(raw.y_scale ?? 1.5);
    return out;
  }

  out.x_scale = Number(raw.x_scale ?? 1.5);
  out.y_scale = Number(raw.y_scale ?? 1.5);
  return out;
}
