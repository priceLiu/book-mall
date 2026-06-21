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

export function resolveQrTemplatePreviewMedia(input: {
  thumbnailUrl?: string;
  mediaType?: "image" | "video" | "audio";
  outputUrl?: string | null;
  referenceVideoUrl?: string | null;
}): QrPreviewMedia | null {
  const thumb = input.thumbnailUrl?.trim() ?? "";
  const outputUrl = input.outputUrl?.trim() ?? "";
  const refVideo = input.referenceVideoUrl?.trim() ?? "";

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
