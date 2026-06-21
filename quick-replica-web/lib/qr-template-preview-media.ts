export function isImageMediaUrl(url: string): boolean {
  return /\.(webp|jpe?g|png|gif|avif|bmp|svg)(\?|$)/i.test(url.trim());
}

export function isVideoMediaUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url.trim());
}

export type QrPreviewMedia = {
  url: string;
  kind: "image" | "video";
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
    if (outputUrl && isVideoMediaUrl(outputUrl)) {
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
  if (outputUrl && isVideoMediaUrl(outputUrl)) {
    return { url: outputUrl, kind: "video", poster: thumb || undefined };
  }
  if (refVideo && isVideoMediaUrl(refVideo)) {
    return { url: refVideo, kind: "video", poster: thumb || undefined };
  }
  if (outputUrl && isImageMediaUrl(outputUrl)) {
    return { url: outputUrl, kind: "image" };
  }
  if (thumb) {
    return {
      url: thumb,
      kind: input.mediaType === "video" && isVideoMediaUrl(thumb) ? "video" : "image",
    };
  }
  return null;
}
