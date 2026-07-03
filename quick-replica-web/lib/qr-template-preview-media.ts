export function isImageMediaUrl(url: string): boolean {
  return /\.(webp|jpe?g|png|gif|avif|bmp|svg)(\?|$)/i.test(url.trim());
}

export function isVideoMediaUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url.trim());
}

export function isAudioMediaUrl(url: string): boolean {
  return /\.(mp3|wav|m4a|aac|ogg|flac)(\?|$)/i.test(url.trim());
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
  if (outputUrl && isAudioMediaUrl(outputUrl)) {
    return { url: outputUrl, kind: "audio" };
  }
  if (input.mediaType === "audio" && outputUrl) {
    return { url: outputUrl, kind: "audio" };
  }
  if (outputUrl && isVideoMediaUrl(outputUrl)) {
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
