/** KIE · Grok Imagine 系列 createTask model + input 构造（Gateway modelKey 与上游一致）。 */

const GROK_ASPECT = new Set([
  "2:3",
  "3:2",
  "1:1",
  "16:9",
  "9:16",
  "auto",
]);

export function pickGrokAspect(raw: unknown, fallback = "16:9"): string {
  const v = typeof raw === "string" ? raw.trim() : "";
  return GROK_ASPECT.has(v) ? v : fallback;
}

export function pickGrokResolution(raw: unknown): "480p" | "720p" {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return s === "720p" || s === "1080p" ? "720p" : "480p";
}

function filterHttpUrls(urls: string[]): string[] {
  return urls
    .map((u) => u.trim())
    .filter((u) => /^https?:\/\//.test(u));
}

export function buildKieGrokTextToImageCreateArgs(args: {
  prompt: string;
  aspectRatio?: string;
  enablePro?: boolean;
}): { model: string; input: Record<string, unknown> } {
  return {
    model: "grok-imagine/text-to-image",
    input: {
      prompt: args.prompt,
      aspect_ratio: pickGrokAspect(args.aspectRatio, "1:1"),
      ...(args.enablePro ? { enable_pro: true } : {}),
    },
  };
}

export function buildKieGrokImageToVideoCreateArgs(args: {
  prompt: string;
  imageUrls: string[];
  mode?: string;
  duration?: number;
  resolution?: string;
  aspectRatio?: string;
}): { model: string; input: Record<string, unknown> } {
  const dur = args.duration ?? 6;
  const mode =
    args.mode === "fun" || args.mode === "spicy" ? args.mode : "normal";
  return {
    model: "grok-imagine/image-to-video",
    input: {
      prompt: args.prompt,
      image_urls: filterHttpUrls(args.imageUrls).slice(0, 7),
      mode,
      duration: String(Math.min(30, Math.max(6, Math.floor(dur)))),
      resolution: pickGrokResolution(args.resolution),
      aspect_ratio: pickGrokAspect(args.aspectRatio, "16:9"),
    },
  };
}

export function buildKieGrokVideo15PreviewCreateArgs(args: {
  prompt: string;
  imageUrls: string[];
  duration?: number;
  resolution?: string;
  aspectRatio?: string;
}): { model: string; input: Record<string, unknown> } {
  const urls = filterHttpUrls(args.imageUrls).slice(0, 1);
  const dur = Math.min(15, Math.max(1, Math.floor(args.duration ?? 8)));
  return {
    model: "grok-imagine-video-1-5-preview",
    input: {
      prompt: args.prompt,
      image_urls: urls,
      aspect_ratio: pickGrokAspect(args.aspectRatio, "auto"),
      resolution: pickGrokResolution(args.resolution),
      duration: dur,
    },
  };
}

export function buildKieToolI2vCreateArgs(args: {
  model: string;
  prompt: string;
  imageUrls: string[];
  resolution?: string;
  duration?: number;
  aspectRatio?: string;
  mode?: string;
}): { model: string; input: Record<string, unknown> } {
  const model = args.model.trim();
  if (model === "grok-imagine-video-1-5-preview") {
    return buildKieGrokVideo15PreviewCreateArgs(args);
  }
  if (model === "grok-imagine/image-to-video") {
    return buildKieGrokImageToVideoCreateArgs(args);
  }
  throw new Error(`unsupported KIE i2v model: ${model}`);
}
