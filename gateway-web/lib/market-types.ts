export function marketModelHref(canonicalKey: string): string {
  return `/dashboard/market/${canonicalKey
    .split("/")
    .map((s) => encodeURIComponent(s))
    .join("/")}`;
}

/** gateway-web 服务端 gatewayJson → book-mall 直连 */
export function marketModelGatewayPath(canonicalKey: string): string {
  return `/api/gateway/market/models/${canonicalKey
    .split("/")
    .map((s) => encodeURIComponent(s))
    .join("/")}`;
}

/** 浏览器经 BFF 代理 */
export function marketModelApiPath(canonicalKey: string): string {
  return `/api/book-mall/api/gateway/market/models/${canonicalKey
    .split("/")
    .map((s) => encodeURIComponent(s))
    .join("/")}`;
}

export type MarketModelCard = {
  canonicalKey: string;
  displayName: string;
  description: string;
  vendor: string;
  providerLabel: string;
  providerKind: string;
  mediaKind: string | null;
  mediaKindLabel: string | null;
  requestKind: string;
  role: string;
  activeModelKey: string;
  taskTags: string[];
  coverUrl: string;
  creditsPerUnit: number | null;
  platformOffering: boolean;
  runnable: boolean;
  readme: string;
};

export type MarketListResponse = {
  models: MarketModelCard[];
  featured: MarketModelCard[];
  providers: string[];
  tasks: string[];
  heroSlides: Array<{ canonicalKey: string; heroUrl: string }>;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type PlaygroundField = {
  key: string;
  label: string;
  type: string;
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

export type MarketDetailResponse = {
  model: MarketModelCard;
  playground: {
    supported: boolean;
    schema: PlaygroundSchema;
  };
};

export type MarketHistoryItem = {
  logId: string;
  taskId: string | null;
  submittedAt: string;
  previewUrl: string | null;
  mediaKind: "image" | "video" | "text";
  inputSummary: unknown;
};

export const TASK_LABELS: Record<string, string> = {
  "text-to-image": "Text to Image",
  "image-to-image": "Image to Image",
  "image-to-video": "Image to Video",
  "video-to-video": "Video to Video",
  "motion-control": "Motion Control",
  "video-upscale": "Video Upscale",
  chat: "Chat",
};
