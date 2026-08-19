/**
 * MiniMax H3 · 请求体构建（V2 content 数组）
 */

import {
  MINIMAX_H3_UPSTREAM_MODEL,
  resolveMinimaxVideoModel,
  type MinimaxVideoMode,
} from "@/lib/gateway/minimax-video-models";

export type MinimaxVideoContentItem =
  | { type: "text"; text: string }
  | {
      type: "image_url";
      image_url: { url: string };
      role?:
        | "first_frame"
        | "last_frame"
        | "reference_image"
        | "middle_frame";
    }
  | {
      type: "video_url";
      video_url: { url: string };
      role?: "reference_video" | "base_video";
    }
  | {
      type: "audio_url";
      audio_url: { url: string };
      role?: "reference_audio";
    };

function isHttpUrl(u: string): boolean {
  return /^https?:\/\//i.test(u.trim());
}

function normalizeUrl(u: unknown): string | null {
  if (typeof u !== "string") return null;
  const t = u.trim();
  return isHttpUrl(t) ? t : null;
}

function pickText(input: Record<string, unknown>): string {
  return String(
    input.prompt ?? input.text ?? input.content_text ?? "",
  ).trim();
}

function pickUrls(input: Record<string, unknown>, key: string): string[] {
  const raw = input[key];
  if (Array.isArray(raw)) {
    return raw
      .map((u) => normalizeUrl(u))
      .filter((u): u is string => Boolean(u));
  }
  const single = normalizeUrl(raw);
  return single ? [single] : [];
}

export function buildMinimaxVideoSubmitBody(opts: {
  modelKey: string;
  input: Record<string, unknown>;
}): Record<string, unknown> {
  const spec = resolveMinimaxVideoModel(opts.modelKey);
  if (!spec) {
    throw new Error(`unsupported MiniMax video model: ${opts.modelKey}`);
  }

  if (spec.taskKind === "regeneration") {
    return buildRegenerationBody(opts.input);
  }
  if (spec.taskKind === "h3_context_ir") {
    return buildContextIrBody(opts.input);
  }

  const mode = spec.mode as MinimaxVideoMode;
  const text = pickText(opts.input);
  if (!text) {
    throw new Error("MiniMax H3 视频生成需要非空 text/prompt");
  }

  const content: MinimaxVideoContentItem[] = [{ type: "text", text }];
  const imageUrl = normalizeUrl(opts.input.image_url ?? opts.input.imageUrl);
  const lastFrameUrl = normalizeUrl(
    opts.input.last_frame_url ?? opts.input.lastFrameUrl,
  );
  const refImages = pickUrls(opts.input, "reference_image_urls").concat(
    pickUrls(opts.input, "referenceImageUrls"),
  );
  const refVideos = pickUrls(opts.input, "reference_video_urls").concat(
    pickUrls(opts.input, "referenceVideoUrls"),
  );
  const refAudios = pickUrls(opts.input, "reference_audio_urls").concat(
    pickUrls(opts.input, "referenceAudioUrls"),
  );

  const hasReferenceRoles =
    refImages.length > 0 || refVideos.length > 0 || refAudios.length > 0;

  if (hasReferenceRoles) {
    if (imageUrl || lastFrameUrl) {
      throw new Error(
        "MiniMax H3：reference_* 与 first_frame/last_frame 不可混用",
      );
    }
    for (const url of refImages) {
      content.push({
        type: "image_url",
        image_url: { url },
        role: mode === "s2v" ? "reference_image" : "reference_image",
      });
    }
    for (const url of refVideos) {
      content.push({
        type: "video_url",
        video_url: { url },
        role: "reference_video",
      });
    }
    for (const url of refAudios) {
      content.push({
        type: "audio_url",
        audio_url: { url },
        role: "reference_audio",
      });
    }
  } else if (mode === "fl2v") {
    if (!imageUrl || !lastFrameUrl) {
      throw new Error("首尾帧生视频需要 first_frame 与 last_frame 图片");
    }
    content.push({
      type: "image_url",
      image_url: { url: imageUrl },
      role: "first_frame",
    });
    content.push({
      type: "image_url",
      image_url: { url: lastFrameUrl },
      role: "last_frame",
    });
  } else if (mode === "i2v" || mode === "s2v") {
    if (!imageUrl && refImages.length === 0) {
      throw new Error("图生/主体参考视频需要至少一张图片");
    }
    if (imageUrl) {
      content.push({
        type: "image_url",
        image_url: { url: imageUrl },
        role: mode === "s2v" ? "reference_image" : "first_frame",
      });
    }
    for (const url of refImages) {
      content.push({
        type: "image_url",
        image_url: { url },
        role: "reference_image",
      });
    }
  } else if (mode === "t2v" && imageUrl) {
    throw new Error("文生视频不应包含首帧图片");
  }

  const resolution = String(opts.input.resolution ?? "2K").trim();
  const duration = Number(opts.input.duration ?? 5);
  let ratio = String(opts.input.ratio ?? "16:9").trim();

  if (mode === "t2v") {
    if (!ratio || ratio === "adaptive") ratio = "16:9";
  } else if (mode === "i2v" || mode === "fl2v") {
    ratio = "adaptive";
  }

  const body: Record<string, unknown> = {
    model: MINIMAX_H3_UPSTREAM_MODEL,
    content,
    resolution,
    duration: Math.min(15, Math.max(4, Math.round(duration))),
    ratio,
  };

  if (opts.input.callback_url) body.callback_url = opts.input.callback_url;
  if (opts.input.aigc_watermark === true) body.aigc_watermark = true;

  return body;
}

function buildRegenerationBody(input: Record<string, unknown>): Record<string, unknown> {
  const sourceTaskId = String(
    input.source_task_id ?? input.sourceTaskId ?? "",
  ).trim();
  const baseVideoUrl = normalizeUrl(
    input.base_video_url ?? input.baseVideoUrl ?? input.video_url,
  );

  const body: Record<string, unknown> = {
    model: MINIMAX_H3_UPSTREAM_MODEL,
    resolution: "2K",
  };

  if (sourceTaskId) {
    body.source_task_id = sourceTaskId;
    return body;
  }

  const contentFromInput = input.content;
  if (Array.isArray(contentFromInput) && contentFromInput.length > 0) {
    body.content = contentFromInput;
    return body;
  }

  const text = pickText(input);
  if (!baseVideoUrl) {
    throw new Error("视频再生成需要 source_task_id 或 base_video");
  }
  const content: MinimaxVideoContentItem[] = [];
  if (text) content.push({ type: "text", text });
  content.push({
    type: "video_url",
    video_url: { url: baseVideoUrl },
    role: "base_video",
  });
  body.content = content;
  if (input.aigc_watermark === true) body.aigc_watermark = true;
  return body;
}

function buildContextIrBody(input: Record<string, unknown>): Record<string, unknown> {
  const contentFromInput = input.content;
  if (Array.isArray(contentFromInput) && contentFromInput.length > 0) {
    return {
      model: MINIMAX_H3_UPSTREAM_MODEL,
      content: contentFromInput,
      duration: Number(input.duration ?? 5),
      ratio: String(input.ratio ?? "16:9"),
    };
  }

  const text = pickText(input);
  if (!text) throw new Error("H3-Context-IR 需要非空 prompt/text");

  const content: MinimaxVideoContentItem[] = [{ type: "text", text }];
  const imageUrl = normalizeUrl(input.image_url ?? input.imageUrl);
  if (imageUrl) {
    content.push({ type: "image_url", image_url: { url: imageUrl } });
  }
  for (const url of pickUrls(input, "reference_image_urls").concat(
    pickUrls(input, "referenceImageUrls"),
  )) {
    content.push({ type: "image_url", image_url: { url }, role: "reference_image" });
  }
  for (const url of pickUrls(input, "reference_video_urls").concat(
    pickUrls(input, "referenceVideoUrls"),
  )) {
    content.push({
      type: "video_url",
      video_url: { url },
      role: "reference_video",
    });
  }
  for (const url of pickUrls(input, "reference_audio_urls").concat(
    pickUrls(input, "referenceAudioUrls"),
  )) {
    content.push({
      type: "audio_url",
      audio_url: { url },
      role: "reference_audio",
    });
  }

  return {
    model: MINIMAX_H3_UPSTREAM_MODEL,
    content,
    duration: Number(input.duration ?? 5),
    ratio: String(input.ratio ?? "16:9"),
  };
}

/** 电商 720p/1080p → MiniMax H3 分辨率 */
export function minimaxResolutionFromEcom(
  resolution: "720p" | "1080p" | string | undefined,
): "2K" | "768P" {
  const v = String(resolution ?? "1080p").trim().toLowerCase();
  return v === "720p" || v === "768p" ? "768P" : "2K";
}

/** Canvas 分镜视频入参 → MiniMax V2 body */
export function buildCanvasVideoMinimaxInput(args: {
  modelKey: string;
  prompt: string;
  imageUrl?: string;
  lastFrameUrl?: string;
  referenceImageUrls?: string[];
  referenceVideoUrls?: string[];
  referenceAudioUrls?: string[];
  options?: {
    resolution?: string;
    duration?: number;
    ratio?: string;
    aigc_watermark?: boolean;
  };
}): { modelKey: string; input: Record<string, unknown> } {
  return {
    modelKey: args.modelKey,
    input: {
      prompt: args.prompt,
      image_url: args.imageUrl,
      last_frame_url: args.lastFrameUrl,
      reference_image_urls: args.referenceImageUrls ?? [],
      reference_video_urls: args.referenceVideoUrls ?? [],
      reference_audio_urls: args.referenceAudioUrls ?? [],
      resolution: args.options?.resolution ?? "2K",
      duration: args.options?.duration ?? 5,
      ratio: args.options?.ratio,
      aigc_watermark: args.options?.aigc_watermark ?? false,
    },
  };
}
