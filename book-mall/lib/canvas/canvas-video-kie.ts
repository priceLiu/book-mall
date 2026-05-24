/**
 * Canvas 视频引擎 · KIE 入参构造（复用 story 模型清单）。
 */
import {
  STORY_VIDEO_MODELS,
  STORY_VIDEO_MODEL_IDS,
  type StoryVideoModelId,
  type StoryVideoOptions,
} from "@/lib/story/story-ai-constants";

export function buildCanvasVideoKieInput(args: {
  modelKey: string;
  prompt: string;
  imageUrl: string | null;
  options?: StoryVideoOptions;
  aspectRatio?: "16:9" | "9:16";
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

  if (modelId === "bytedance/seedance-2") {
    return {
      model: "bytedance/seedance-2",
      input: {
        prompt: args.prompt,
        reference_image_urls: args.imageUrl ? [args.imageUrl] : [],
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

  return {
    model: "wan/2-7-image-to-video",
    input: {
      prompt: args.prompt,
      first_frame_url: args.imageUrl,
      resolution,
      duration,
      prompt_extend:
        args.options?.promptExtend ?? desc.defaults.promptExtend ?? true,
      watermark: args.options?.watermark ?? desc.defaults.watermark ?? false,
    },
  };
}
