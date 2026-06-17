/** KIE · 视频工具类 createTask 构造（v2v / motion-control / upscale）。 */

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
  if (args.mode === "std" || args.mode === "pro" || args.mode === "720p" || args.mode === "1080p") {
    input.mode = args.mode;
  }
  if (args.characterOrientation === "image" || args.characterOrientation === "video") {
    input.character_orientation = args.characterOrientation;
  }
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

export function buildKieToolVideoCreateArgs(args: {
  model: string;
  prompt?: string;
  imageUrls?: string[];
  videoUrls?: string[];
  videoUrl?: string;
  resolution?: string;
  duration?: number;
  mode?: string;
  characterOrientation?: string;
  backgroundSource?: string;
  upscaleFactor?: string | number;
  nsfwChecker?: boolean;
}): { model: string; input: Record<string, unknown> } {
  const model = args.model.trim();

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
