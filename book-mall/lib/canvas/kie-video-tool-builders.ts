/** KIE · 视频工具类 createTask 构造（v2v / motion-control / upscale）。 */

import { buildCanvasVideoKieInput } from "@/lib/canvas/canvas-video-kie";
import { buildCanvasVideoVolcengineInput } from "@/lib/canvas/canvas-video-volcengine";
import {
  buildKieGrokImageToVideoCreateArgs,
} from "@/lib/canvas/kie-grok-builders";

function filterHttpUrls(urls: string[]): string[] {
  return urls
    .map((u) => u.trim())
    .filter((u) => /^https?:\/\//.test(u));
}

function pickWanV2vResolution(raw: unknown): "720p" | "1080p" {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return s === "720p" ? "720p" : "1080p";
}

export function buildKieWan26VideoToVideoCreateArgs(args: {
  prompt: string;
  videoUrls: string[];
  duration?: number;
  resolution?: string;
  nsfwChecker?: boolean;
}): { model: string; input: Record<string, unknown> } {
  const dur = args.duration ?? 5;
  const duration = dur >= 10 ? "10" : "5";
  return {
    model: "wan/2-6-video-to-video",
    input: {
      prompt: args.prompt,
      video_urls: filterHttpUrls(args.videoUrls).slice(0, 3),
      duration,
      resolution: pickWanV2vResolution(args.resolution),
      nsfw_checker: args.nsfwChecker === true,
    },
  };
}

function normalizeKieMotionControlMode(raw: unknown): "720p" | "1080p" {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (s === "pro" || s === "1080p" || s === "hd" || s === "high") return "1080p";
  return "720p";
}

export function buildKieKlingMotionControlCreateArgs(args: {
  model: "kling-2.6/motion-control" | "kling-3.0/motion-control";
  prompt?: string;
  imageUrls: string[];
  videoUrls: string[];
  mode?: string;
  characterOrientation?: string;
  backgroundSource?: string;
}): { model: string; input: Record<string, unknown> } {
  const input: Record<string, unknown> = {
    input_urls: filterHttpUrls(args.imageUrls).slice(0, 1),
    video_urls: filterHttpUrls(args.videoUrls).slice(0, 1),
  };
  const prompt = args.prompt?.trim();
  if (prompt) input.prompt = prompt;
  // KIE motion-control 校验 mode 为 720p | 1080p（非 std/pro）
  input.mode = normalizeKieMotionControlMode(args.mode);
  input.character_orientation =
    args.characterOrientation === "image" ? "image" : "video";
  if (args.backgroundSource === "input_video" || args.backgroundSource === "input_image") {
    input.background_source = args.backgroundSource;
  }
  return { model: args.model, input };
}

export function buildKieTopazVideoUpscaleCreateArgs(args: {
  videoUrl: string;
  upscaleFactor?: string | number;
}): { model: string; input: Record<string, unknown> } {
  const raw = args.upscaleFactor ?? "2";
  const n = typeof raw === "number" ? raw : parseInt(String(raw).trim(), 10);
  const factor = n === 1 || n === 4 ? String(n) : "2";
  const url = args.videoUrl.trim();
  if (!/^https?:\/\//.test(url)) {
    throw new Error("videoUrl must be https URL");
  }
  return {
    model: "topaz/video-upscale",
    input: {
      video_url: url,
      upscale_factor: factor,
    },
  };
}

export function buildKieHappyHorseR2vCreateArgs(args: {
  prompt: string;
  referenceImages: string[];
  resolution?: string;
  aspectRatio?: string;
  duration?: number;
}): { model: string; input: Record<string, unknown> } {
  const refs = filterHttpUrls(args.referenceImages).slice(0, 9);
  if (!refs.length) throw new Error("reference_image required");
  const prompt = args.prompt.trim();
  if (!prompt) throw new Error("prompt required for reference-to-video");

  const resolutionRaw = typeof args.resolution === "string" ? args.resolution.trim().toLowerCase() : "";
  const resolution = resolutionRaw === "720p" ? "720p" : "1080p";

  const ratioRaw = typeof args.aspectRatio === "string" ? args.aspectRatio.trim() : "16:9";
  const allowed = new Set(["16:9", "9:16", "4:3", "3:4", "1:1"]);
  const aspect_ratio = allowed.has(ratioRaw) ? ratioRaw : "16:9";

  const durRaw = typeof args.duration === "number" ? args.duration : 5;
  const duration = Math.min(15, Math.max(3, Math.round(durRaw)));

  return {
    model: "happyhorse-1-1/reference-to-video",
    input: {
      prompt,
      reference_image: refs,
      resolution,
      aspect_ratio,
      duration,
    },
  };
}

export function buildKieKlingV3TurboTextToVideoCreateArgs(args: {
  prompt: string;
  resolution?: string;
  aspectRatio?: string;
  duration?: number;
}): { model: string; input: Record<string, unknown> } {
  const prompt = args.prompt.trim();
  if (!prompt) throw new Error("prompt required for text-to-video");
  const durRaw = typeof args.duration === "number" ? args.duration : 5;
  const duration = String(Math.min(15, Math.max(3, Math.round(durRaw))));
  const res =
    typeof args.resolution === "string" && args.resolution.trim().toLowerCase() === "1080p"
      ? "1080p"
      : "720p";
  const ratioRaw = typeof args.aspectRatio === "string" ? args.aspectRatio.trim() : "16:9";
  const aspect_ratio = (["16:9", "9:16", "1:1"] as const).includes(
    ratioRaw as "16:9" | "9:16" | "1:1",
  )
    ? ratioRaw
    : "16:9";
  return {
    model: "kling/v3-turbo-text-to-video",
    input: {
      prompt,
      duration,
      resolution: res,
      aspect_ratio,
    },
  };
}

export function buildKieWan27TextToVideoCreateArgs(args: {
  prompt: string;
  resolution?: string;
  aspectRatio?: string;
  duration?: number;
}): { model: string; input: Record<string, unknown> } {
  const prompt = args.prompt.trim();
  if (!prompt) throw new Error("prompt required for text-to-video");
  const resRaw = typeof args.resolution === "string" ? args.resolution.trim().toLowerCase() : "";
  const resolution = resRaw === "720p" ? "720p" : "1080p";
  const ratioRaw = typeof args.aspectRatio === "string" ? args.aspectRatio.trim() : "16:9";
  const allowed = new Set(["16:9", "9:16", "1:1", "4:3", "3:4"]);
  const ratio = allowed.has(ratioRaw) ? ratioRaw : "16:9";
  const durRaw = typeof args.duration === "number" ? args.duration : 5;
  const duration = Math.min(10, Math.max(5, Math.round(durRaw)));
  return {
    model: "wan/2-7-text-to-video",
    input: {
      prompt,
      resolution,
      ratio,
      duration,
    },
  };
}

/** QuickReplica · 文字转视频（含可选参考图） */
export function buildQrTextToVideoCreateArgs(args: {
  modelKey: string;
  prompt: string;
  imageUrls?: string[];
  resolution?: string;
  aspectRatio?: string;
  duration?: number;
  mode?: string;
  sound?: boolean;
}): { model: string; input: Record<string, unknown> } {
  const model = args.modelKey.trim();
  const prompt = args.prompt.trim();
  const imageUrls = filterHttpUrls(args.imageUrls ?? []);

  if (model === "happyhorse-1-1/reference-to-video") {
    return buildKieHappyHorseR2vCreateArgs({
      prompt,
      referenceImages: imageUrls,
      resolution: args.resolution ?? args.mode,
      aspectRatio: args.aspectRatio,
      duration: args.duration,
    });
  }

  if (model === "kling/v3-turbo-text-to-video") {
    return buildKieKlingV3TurboTextToVideoCreateArgs({
      prompt,
      resolution: args.resolution,
      aspectRatio: args.aspectRatio,
      duration: args.duration,
    });
  }

  if (model === "kling-3.0/video") {
    const aspect = (args.aspectRatio ?? "16:9") as "16:9" | "9:16" | "1:1";
    const urls = imageUrls;
    const lastFrame =
      urls.length === 2 && !args.mode?.includes("multi")
        ? urls[1]
        : undefined;
    return buildCanvasVideoKieInput({
      modelKey: model,
      prompt,
      imageUrl: urls[0] ?? null,
      lastFrameUrl: lastFrame ?? null,
      aspectRatio: aspect,
      options: {
        duration: args.duration,
        mode: args.mode === "std" || args.mode === "pro" ? args.mode : "pro",
        sound: args.sound !== false,
        generateAudio: args.sound !== false,
      },
    });
  }

  if (model === "grok-imagine/image-to-video") {
    return buildKieGrokImageToVideoCreateArgs({
      prompt,
      imageUrls,
      mode: args.mode,
      duration: args.duration,
      resolution: args.resolution,
      aspectRatio: args.aspectRatio,
    });
  }

  if (model === "wan/2-7-text-to-video") {
    return buildKieWan27TextToVideoCreateArgs({
      prompt,
      resolution: args.resolution,
      aspectRatio: args.aspectRatio,
      duration: args.duration,
    });
  }

  if (model === "doubao-seedance-2.0") {
    const built = buildCanvasVideoVolcengineInput({
      modelKey: model,
      prompt,
      imageUrl: imageUrls[0] ?? "",
      referenceImageUrls: imageUrls.slice(1),
      aspectRatio: args.aspectRatio ?? "16:9",
      forceReferenceMode: imageUrls.length > 1,
      options: {
        resolution: args.resolution ?? "1080p",
        duration: args.duration ?? 5,
        generateAudio: args.sound === true,
        watermark: false,
      },
    });
    return { model: built.model, input: built.body };
  }

  throw new Error(`unsupported text-to-video model: ${model}`);
}

export function buildKieToolVideoCreateArgs(args: {
  model: string;
  prompt?: string;
  imageUrls?: string[];
  videoUrls?: string[];
  videoUrl?: string;
  resolution?: string;
  duration?: number;
  mode?: string;
  aspectRatio?: string;
  characterOrientation?: string;
  backgroundSource?: string;
  upscaleFactor?: string | number;
  nsfwChecker?: boolean;
}): { model: string; input: Record<string, unknown> } {
  const model = args.model.trim();

  if (model === "happyhorse-1-1/reference-to-video") {
    const refs = args.imageUrls ?? [];
    return buildKieHappyHorseR2vCreateArgs({
      prompt: args.prompt ?? "",
      referenceImages: refs,
      resolution: args.resolution ?? args.mode,
      aspectRatio: typeof args.aspectRatio === "string" ? args.aspectRatio : undefined,
      duration: args.duration,
    });
  }

  if (model === "wan/2-6-video-to-video") {
    const prompt = args.prompt?.trim() ?? "";
    if (!prompt) throw new Error("prompt required for video-to-video");
    const videoUrls = args.videoUrls ?? [];
    if (!videoUrls.length) throw new Error("videoUrls required");
    return buildKieWan26VideoToVideoCreateArgs({
      prompt,
      videoUrls,
      duration: args.duration,
      resolution: args.resolution,
      nsfwChecker: args.nsfwChecker,
    });
  }

  if (model === "kling-2.6/motion-control" || model === "kling-3.0/motion-control") {
    const imageUrls = args.imageUrls ?? [];
    const videoUrls = args.videoUrls ?? [];
    if (!imageUrls.length || !videoUrls.length) {
      throw new Error("imageUrls and videoUrls required for motion-control");
    }
    return buildKieKlingMotionControlCreateArgs({
      model,
      prompt: args.prompt,
      imageUrls,
      videoUrls,
      mode: args.mode,
      characterOrientation: args.characterOrientation,
      backgroundSource: args.backgroundSource,
    });
  }

  if (model === "topaz/video-upscale") {
    const videoUrl = args.videoUrl?.trim() || args.videoUrls?.[0]?.trim();
    if (!videoUrl) throw new Error("videoUrl required");
    return buildKieTopazVideoUpscaleCreateArgs({
      videoUrl,
      upscaleFactor: args.upscaleFactor,
    });
  }

  throw new Error(`unsupported KIE video tool model: ${model}`);
}
