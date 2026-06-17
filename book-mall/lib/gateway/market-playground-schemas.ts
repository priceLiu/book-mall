/**
 * Gateway Market Playground · 动态表单 schema
 */

export type PlaygroundFieldType =
  | "textarea"
  | "text"
  | "select"
  | "number"
  | "boolean"
  | "image-url"
  | "video-url"
  | "image-urls";

export type PlaygroundField = {
  key: string;
  label: string;
  type: PlaygroundFieldType;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string | number | boolean;
  options?: Array<{ value: string; label: string }>;
  min?: number;
  max?: number;
};

export type PlaygroundSchema = {
  mode: "kie-async" | "chat";
  fields: PlaygroundField[];
  examples?: Array<{ label: string; input: Record<string, unknown> }>;
};

const GROK_ASPECT = [
  { value: "1:1", label: "1:1" },
  { value: "16:9", label: "16:9" },
  { value: "9:16", label: "9:16" },
];

const RESOLUTION_480_720 = [
  { value: "480p", label: "480p" },
  { value: "720p", label: "720p" },
];

const RESOLUTION_720_1080 = [
  { value: "720p", label: "720p" },
  { value: "1080p", label: "1080p" },
];

const GPT_RES = [
  { value: "1K", label: "1K" },
  { value: "2K", label: "2K" },
  { value: "4K", label: "4K" },
];

const EXPLICIT: Record<string, PlaygroundSchema> = {
  "grok-imagine/text-to-image": {
    mode: "kie-async",
    fields: [
      { key: "prompt", label: "Prompt", type: "textarea", required: true },
      { key: "aspect_ratio", label: "Aspect ratio", type: "select", options: GROK_ASPECT, defaultValue: "1:1" },
    ],
    examples: [
      {
        label: "Cinematic portrait",
        input: { prompt: "Cinematic portrait, soft rim light, 85mm lens", aspect_ratio: "16:9" },
      },
    ],
  },
  "grok-imagine/image-to-video": {
    mode: "kie-async",
    fields: [
      { key: "prompt", label: "Prompt", type: "textarea", required: true },
      { key: "image_urls", label: "Reference image", type: "image-url", required: true },
      { key: "mode", label: "Mode", type: "select", options: [
        { value: "normal", label: "normal" },
        { value: "fun", label: "fun" },
        { value: "spicy", label: "spicy" },
      ], defaultValue: "normal" },
      { key: "resolution", label: "Resolution", type: "select", options: RESOLUTION_480_720, defaultValue: "720p" },
      { key: "duration", label: "Duration (sec)", type: "number", min: 6, max: 30, defaultValue: 6 },
    ],
  },
  "grok-imagine-video-1-5-preview": {
    mode: "kie-async",
    fields: [
      { key: "prompt", label: "Prompt", type: "textarea", required: true },
      { key: "image_urls", label: "First frame", type: "image-url", required: true },
      { key: "resolution", label: "Resolution", type: "select", options: RESOLUTION_480_720, defaultValue: "720p" },
      { key: "duration", label: "Duration (sec)", type: "number", min: 1, max: 15, defaultValue: 8 },
    ],
  },
  "gpt-image-2": {
    mode: "kie-async",
    fields: [
      { key: "prompt", label: "Prompt", type: "textarea", required: true },
      { key: "aspect_ratio", label: "Aspect ratio", type: "select", options: GROK_ASPECT, defaultValue: "1:1" },
      { key: "resolution", label: "Resolution", type: "select", options: GPT_RES, defaultValue: "2K" },
      { key: "input_urls", label: "Reference images (optional)", type: "image-urls" },
    ],
    examples: [
      {
        label: "Poster layout",
        input: { prompt: "Minimalist product poster, studio lighting", aspect_ratio: "16:9", resolution: "2K" },
      },
    ],
  },
  "gpt-image-1": {
    mode: "kie-async",
    fields: [
      { key: "prompt", label: "Prompt", type: "textarea", required: true },
      { key: "aspect_ratio", label: "Aspect ratio", type: "select", options: GROK_ASPECT, defaultValue: "1:1" },
      {
        key: "quality",
        label: "Quality",
        type: "select",
        options: [
          { value: "medium", label: "medium" },
          { value: "high", label: "high" },
        ],
        defaultValue: "medium",
      },
      { key: "input_urls", label: "Reference images (optional)", type: "image-urls" },
    ],
    examples: [
      {
        label: "Typography poster",
        input: { prompt: "Bold typography poster, red and white", aspect_ratio: "3:2", quality: "high" },
      },
    ],
  },
  "lib-nano-pro": {
    mode: "kie-async",
    fields: [
      { key: "prompt", label: "Prompt", type: "textarea", required: true },
      { key: "aspect_ratio", label: "Aspect ratio", type: "select", options: GROK_ASPECT, defaultValue: "1:1" },
      {
        key: "resolution",
        label: "Resolution",
        type: "select",
        options: [
          { value: "1K", label: "1K" },
          { value: "2K", label: "2K" },
          { value: "4K", label: "4K" },
        ],
        defaultValue: "2K",
      },
      { key: "input_urls", label: "Reference images (optional)", type: "image-urls" },
    ],
    examples: [
      {
        label: "Character with refs",
        input: {
          prompt: "Same character, new outfit, studio portrait",
          aspect_ratio: "1:1",
          resolution: "2K",
        },
      },
    ],
  },
  "wan/2-6-video-to-video": {
    mode: "kie-async",
    fields: [
      { key: "prompt", label: "Prompt", type: "textarea", required: true },
      { key: "video_urls", label: "Source video", type: "video-url", required: true },
      { key: "duration", label: "Duration", type: "select", options: [
        { value: "5", label: "5s" },
        { value: "10", label: "10s" },
      ], defaultValue: "5" },
      { key: "resolution", label: "Resolution", type: "select", options: RESOLUTION_720_1080, defaultValue: "1080p" },
    ],
  },
  "kling-2.6/motion-control": {
    mode: "kie-async",
    fields: [
      { key: "prompt", label: "Prompt (optional)", type: "textarea" },
      { key: "input_urls", label: "Character image", type: "image-url", required: true },
      { key: "video_urls", label: "Motion reference video", type: "video-url", required: true },
      { key: "mode", label: "Quality", type: "select", options: [
        { value: "std", label: "std (720p)" },
        { value: "pro", label: "pro (1080p)" },
      ], defaultValue: "std" },
    ],
  },
  "kling-3.0/motion-control": {
    mode: "kie-async",
    fields: [
      { key: "prompt", label: "Prompt (optional)", type: "textarea" },
      { key: "input_urls", label: "Character image", type: "image-url", required: true },
      { key: "video_urls", label: "Motion reference video", type: "video-url", required: true },
      { key: "mode", label: "Quality", type: "select", options: [
        { value: "std", label: "std (720p)" },
        { value: "pro", label: "pro (1080p)" },
      ], defaultValue: "pro" },
    ],
  },
  "topaz/video-upscale": {
    mode: "kie-async",
    fields: [
      { key: "video_url", label: "Source video", type: "video-url", required: true },
      { key: "upscale_factor", label: "Upscale factor", type: "select", options: [
        { value: "1", label: "1×" },
        { value: "2", label: "2×" },
        { value: "4", label: "4×" },
      ], defaultValue: "2" },
    ],
  },
};

export function getPlaygroundSchema(canonicalKey: string, requestKind: string): PlaygroundSchema {
  const explicit = EXPLICIT[canonicalKey];
  if (explicit) return explicit;

  if (requestKind === "CHAT") {
    return {
      mode: "chat",
      fields: [
        { key: "message", label: "Message", type: "textarea", required: true },
      ],
    };
  }

  return {
    mode: "kie-async",
    fields: [
      { key: "prompt", label: "Prompt", type: "textarea", required: true },
    ],
  };
}

export function isPlaygroundSupported(canonicalKey: string): boolean {
  return (
    canonicalKey in EXPLICIT ||
    canonicalKey.includes("qwen") ||
    canonicalKey.includes("deepseek") ||
    canonicalKey === "lib-nano-pro"
  );
}
