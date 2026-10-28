export function isImageMediaUrl(url: string): boolean {
  return /\.(webp|jpe?g|png|gif|avif|bmp|svg)(\?|$)/i.test(url.trim());
}

export function isVideoMediaUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url.trim());
}

export function isAudioMediaUrl(url: string): boolean {
  return /\.(mp3|wav|m4a|aac|ogg|flac)(\?|$)/i.test(url.trim());
}

const QR_BUILTIN_OSS_BASE =
  "https://tool-mall.oss-cn-guangzhou.aliyuncs.com/quick-replica/builtin";

/** 内置视频库 id → 成片 mp4（output 被覆盖或快照缺失时回退） */
export function resolveQrBuiltinVideoGalleryUrlFromId(id: string | undefined): string | null {
  const trimmed = id?.trim() ?? "";
  const match = /^qr-video-gallery-(\d+)$/i.exec(trimmed);
  if (!match) return null;
  const pad = match[1].padStart(2, "0");
  return `${QR_BUILTIN_OSS_BASE}/qr-video-gallery-${pad}-video.mp4`;
}

export type QrPreviewMedia = {
  url: string;
  kind: "image" | "video" | "audio";
  poster?: string;
};

/** 管理后台 / 表格预览：封面 webp 走 img，mp4 走 video（可带 poster） */
export function resolveQrTemplatePreviewMedia(input: {
  thumbnailUrl?: string;
  mediaType?: "image" | "video" | "audio";
  outputUrl?: string | null;
  referenceVideoUrl?: string | null;
  /** 大预览区：有视频 URL 时优先播视频，封面仅作 poster */
  preferVideo?: boolean;
}): QrPreviewMedia | null {
  const thumb = input.thumbnailUrl?.trim() ?? "";
  const outputUrl = input.outputUrl?.trim() ?? "";
  const refVideo = input.referenceVideoUrl?.trim() ?? "";

  if (input.preferVideo) {
    if (outputUrl && (isVideoMediaUrl(outputUrl) || input.mediaType === "video")) {
      return { url: outputUrl, kind: "video", poster: thumb || undefined };
    }
    if (refVideo && isVideoMediaUrl(refVideo)) {
      return { url: refVideo, kind: "video", poster: thumb || undefined };
    }
  }

  if (thumb && isImageMediaUrl(thumb)) {
    return { url: thumb, kind: "image" };
  }
  if (thumb && isVideoMediaUrl(thumb)) {
    return { url: thumb, kind: "video" };
  }
  if (outputUrl && isAudioMediaUrl(outputUrl)) {
    return { url: outputUrl, kind: "audio" };
  }
  if (input.mediaType === "audio" && outputUrl) {
    return { url: outputUrl, kind: "audio" };
  }
  if (outputUrl && isVideoMediaUrl(outputUrl)) {
    return { url: outputUrl, kind: "video", poster: thumb || undefined };
  }
  if (thumb) {
    return {
      url: thumb,
      kind: input.mediaType === "video" && isVideoMediaUrl(thumb) ? "video" : "image",
    };
  }
  return null;
}

/** 模板卡片 / 全屏预览：优先成片 output，避免只用缩略图封面 */
export function resolveQrTemplateFullOutputImageUrl(input: {
  output?: { mediaType?: "image" | "video" | "audio"; url?: string };
  thumbnailUrl?: string;
  reference?: {
    slots?: {
      sceneImages?: Array<{ url?: string }>;
      targetImage?: { url?: string };
      characterRefs?: Array<{ url?: string }>;
    };
  };
}): string | undefined {
  const outputUrl = input.output?.url?.trim() ?? "";
  if (input.output?.mediaType === "image" && outputUrl) return outputUrl;
  if (outputUrl && isImageMediaUrl(outputUrl)) return outputUrl;

  const thumb = input.thumbnailUrl?.trim() ?? "";
  if (thumb && isImageMediaUrl(thumb)) return thumb;

  const slots = input.reference?.slots;
  const scene = slots?.sceneImages?.find((s) => s.url?.trim() && isImageMediaUrl(s.url));
  if (scene?.url?.trim()) return scene.url.trim();
  const target = slots?.targetImage?.url?.trim();
  if (target && isImageMediaUrl(target)) return target;
  const character = slots?.characterRefs?.find((s) => s.url?.trim() && isImageMediaUrl(s.url));
  if (character?.url?.trim()) return character.url.trim();
  return undefined;
}

function templateExpectsVideoOutput(input: {
  category?: string;
  output?: { mediaType?: "image" | "video" | "audio"; gatewayRequestLogId?: string };
  reference?: { model?: { role?: string } };
}): boolean {
  if (input.output?.mediaType === "video") return true;
  if (input.category === "video") return true;
  if (input.reference?.model?.role === "VIDEO") return true;
  if (input.output?.gatewayRequestLogId?.trim()) return true;
  return false;
}

/** 全屏 / 卡片悬停：优先 output 成片，禁止误回退 referenceVideo */
export function resolveQrTemplateFullOutputVideoUrl(input: {
  id?: string;
  category?: string;
  output?: {
    mediaType?: "image" | "video" | "audio";
    url?: string;
    gatewayRequestLogId?: string;
  };
  thumbnailUrl?: string;
  reference?: {
    slots?: { referenceVideo?: { url?: string } };
    model?: { role?: string };
  };
}): string | null {
  const outputUrl = input.output?.url?.trim() ?? "";
  const refVideo = input.reference?.slots?.referenceVideo?.url?.trim() ?? "";

  if (outputUrl) {
    const mediaType = input.output?.mediaType;
    if (mediaType === "video" || isVideoMediaUrl(outputUrl)) return outputUrl;
    if (mediaType !== "audio" && !isAudioMediaUrl(outputUrl) && !isImageMediaUrl(outputUrl)) {
      if (templateExpectsVideoOutput(input) && (!refVideo || outputUrl !== refVideo)) {
        return outputUrl;
      }
    }
    if (
      mediaType === "image" &&
      !isImageMediaUrl(outputUrl) &&
      templateExpectsVideoOutput(input) &&
      (!refVideo || outputUrl !== refVideo)
    ) {
      return outputUrl;
    }
  }

  if (refVideo && isVideoMediaUrl(refVideo)) return refVideo;

  const fromId = resolveQrBuiltinVideoGalleryUrlFromId(input.id);
  if (fromId) return fromId;

  const thumb = input.thumbnailUrl?.trim() ?? "";
  if (thumb && isVideoMediaUrl(thumb)) return thumb;
  return null;
}

/** 模板详情 / 复制：reference.slots.sceneImages 中的引用图 URL */
export function resolveTemplateSceneImageUrls(input: {
  reference?: {
    slots?: {
      sceneImages?: Array<{ url?: string }>;
    };
  };
}): string[] {
  return (
    input.reference?.slots?.sceneImages
      ?.map((s) => s.url?.trim() ?? "")
      .filter(Boolean) ?? []
  );
}
