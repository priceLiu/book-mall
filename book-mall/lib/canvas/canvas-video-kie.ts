/**
 * Canvas 视频引擎 · KIE 入参构造（复用 story 模型清单）。
 */
import {
  STORY_VIDEO_MODELS,
  STORY_VIDEO_MODEL_IDS,
  type StoryVideoModelId,
  type StoryVideoOptions,
} from "@/lib/story/story-ai-constants";
import {
  buildKieGrokImageToVideoCreateArgs,
  buildKieGrokVideo15PreviewCreateArgs,
} from "@/lib/canvas/kie-grok-builders";

export function buildCanvasVideoKieInput(args: {
  modelKey: string;
  prompt: string;
  imageUrl: string | null;
  /** Seedance 等多图模型：三视图等附加参考（分镜图已在 imageUrl） */
  referenceImageUrls?: string[];
  /** Kling 3.0 · multi_shots=false 时 image_urls[1] 为尾帧 */
  lastFrameUrl?: string | null;
  options?: StoryVideoOptions;
  aspectRatio?: "16:9" | "9:16" | "1:1";
}): { model: string; input: Record<string, unknown> } {
  const requested = args.modelKey;
  if (!(STORY_VIDEO_MODEL_IDS as readonly string[]).includes(requested)) {
    throw new Error(`unsupported video model: ${requested}`);
  }
  const modelId = requested as StoryVideoModelId;
  const desc = STORY_VIDEO_MODELS[modelId];
  const resolution = args.options?.resolution ?? desc.defaults.resolution;
  const duration = args.options?.duration ?? desc.defaults.duration;
  const aspect = args.aspectRatio ?? "16:9";
  const mainUrl = args.imageUrl?.trim() || null;
  const extraRefs = (args.referenceImageUrls ?? [])
    .map((u) => u.trim())
    .filter((u) => /^https?:\/\//.test(u) && u !== mainUrl);

  if (modelId === "bytedance/seedance-2") {
    const reference_image_urls = [
      ...(mainUrl ? [mainUrl] : []),
      ...extraRefs,
    ].slice(0, 8);
    return {
      model: "bytedance/seedance-2",
      input: {
        prompt: args.prompt,
        reference_image_urls,
        aspect_ratio: aspect,
        resolution,
        duration,
        generate_audio:
          args.options?.generateAudio ?? desc.defaults.generateAudio ?? false,
      },
    };
  }

  if (modelId === "happyhorse/image-to-video") {
    return {
      model: "happyhorse/image-to-video",
      input: {
        prompt: args.prompt,
        image_urls: args.imageUrl ? [args.imageUrl] : [],
        resolution,
        duration,
      },
    };
  }

  if (modelId === "kling-2.6/image-to-video") {
    const rawDur = Number(args.options?.duration ?? desc.defaults.duration);
    const dur = Number.isFinite(rawDur) && rawDur >= 10 ? "10" : "5";
    return {
      model: "kling-2.6/image-to-video",
      input: {
        prompt: args.prompt,
        image_urls: args.imageUrl ? [args.imageUrl] : [],
        sound:
          args.options?.generateAudio ?? desc.defaults.generateAudio ?? false,
        duration: dur,
      },
    };
  }

  if (modelId === "kling/v3-turbo-image-to-video") {
    const rawDur = Number(args.options?.duration ?? desc.defaults.duration);
    const dur = Number.isFinite(rawDur) && rawDur >= 3 ? String(Math.round(rawDur)) : "5";
    const res = resolution === "1080p" ? "1080p" : "720p";
    const lastUrl = args.lastFrameUrl?.trim() || null;
    let image_urls: string[] = [];
    if (mainUrl && lastUrl) image_urls = [mainUrl, lastUrl];
    else if (mainUrl) image_urls = [mainUrl];
    return {
      model: "kling/v3-turbo-image-to-video",
      input: {
        prompt: args.prompt,
        image_urls,
        duration: dur,
        resolution: res,
      },
    };
  }

  if (modelId === "kling-3.0/video") {
    const rawDur = Number(args.options?.duration ?? desc.defaults.duration);
    const dur = Number.isFinite(rawDur) && rawDur >= 3 ? String(Math.round(rawDur)) : "5";
    const mode =
      typeof args.options?.mode === "string" &&
      (args.options.mode === "std" || args.options.mode === "pro")
        ? args.options.mode
        : "pro";
    const multiShots = args.options?.multi_shots === true;
    const lastUrl = args.lastFrameUrl?.trim() || null;
    const sound =
      args.options?.sound ??
      args.options?.generateAudio ??
      desc.defaults.generateAudio ??
      true;
    let image_urls: string[] = [];
    if (multiShots) {
      if (mainUrl) image_urls = [mainUrl];
    } else if (mainUrl && lastUrl) {
      image_urls = [mainUrl, lastUrl];
    } else if (mainUrl) {
      image_urls = [mainUrl];
    }
    return {
      model: "kling-3.0/video",
      input: {
        prompt: args.prompt,
        image_urls,
        duration: dur,
        aspect_ratio: aspect,
        mode,
        sound: sound !== false,
        multi_shots: multiShots,
      },
    };
  }

  if (modelId === "grok-imagine/image-to-video") {
    return buildKieGrokImageToVideoCreateArgs({
      prompt: args.prompt,
      imageUrls: mainUrl ? [mainUrl, ...extraRefs] : extraRefs,
      mode:
        typeof args.options?.mode === "string" ? args.options.mode : undefined,
      duration: args.options?.duration ?? desc.defaults.duration,
      resolution: args.options?.resolution ?? desc.defaults.resolution,
      aspectRatio: aspect,
    });
  }

  if (modelId === "grok-imagine-video-1-5-preview") {
    return buildKieGrokVideo15PreviewCreateArgs({
      prompt: args.prompt,
      imageUrls: mainUrl ? [mainUrl] : [],
      duration: args.options?.duration ?? desc.defaults.duration,
      resolution: args.options?.resolution ?? desc.defaults.resolution,
      aspectRatio: aspect,
    });
  }

  return {
    model: "wan/2-7-image-to-video",
    input: {
      prompt: args.prompt,
      first_frame_url: mainUrl ?? undefined,
      last_frame_url: args.lastFrameUrl?.trim() || undefined,
      resolution,
      duration,
      prompt_extend:
        args.options?.promptExtend ?? desc.defaults.promptExtend ?? true,
      watermark: args.options?.watermark ?? desc.defaults.watermark ?? false,
    },
  };
}

/** 参考生视频 · 多图 Seedance（无单独主图） */
export function buildCanvasRefVideoKieInput(args: {
  modelKey: string;
  prompt: string;
  referenceImageUrls: string[];
  options?: StoryVideoOptions;
  aspectRatio?: string;
}): { model: string; input: Record<string, unknown> } {
  if (args.modelKey !== "bytedance/seedance-2") {
    throw new Error(`unsupported ref video kie model: ${args.modelKey}`);
  }
  const desc = STORY_VIDEO_MODELS["bytedance/seedance-2"];
  const resolution = args.options?.resolution ?? desc.defaults.resolution;
  const duration = args.options?.duration ?? desc.defaults.duration;
  const aspect = args.aspectRatio?.trim() || "16:9";
  const reference_image_urls = args.referenceImageUrls
    .map((u) => u.trim())
    .filter((u) => /^https?:\/\//.test(u))
    .slice(0, 8);

  return {
    model: "bytedance/seedance-2",
    input: {
      prompt: args.prompt,
      reference_image_urls,
      aspect_ratio: aspect,
      resolution,
      duration,
      generate_audio:
        args.options?.generateAudio ?? desc.defaults.generateAudio ?? false,
    },
  };
}
