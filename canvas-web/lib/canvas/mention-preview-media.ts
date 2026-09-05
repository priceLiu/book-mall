import type { MentionableItem } from "@/components/canvas/mentions/MentionsTextarea";
import { isLikelyVideoUrl } from "./task-media-url";

/** @ 列表 / 内联徽标 · 是否用 `<video>` 而非 `<img>` */
export function mentionPreviewShouldUseVideo(
  item: Pick<MentionableItem, "kind" | "previewUrl">,
): boolean {
  const url = item.previewUrl?.trim();
  if (!url) return false;
  if (item.kind === "video") {
    return isLikelyVideoUrl(url) || url.startsWith("blob:");
  }
  return isLikelyVideoUrl(url);
}

const MENTION_THUMB_MEDIA_CLASS = "shrink-0 rounded-[4px] object-cover";

/** 内联 mention 徽标 · 16px 缩略图（图片或视频首帧） */
export function createMentionPreviewThumbEl(
  item: Pick<MentionableItem, "kind" | "previewUrl" | "label">,
  sizePx: number,
): HTMLImageElement | HTMLVideoElement {
  const url = item.previewUrl!.trim();
  if (mentionPreviewShouldUseVideo(item)) {
    const video = document.createElement("video");
    video.src = url;
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.draggable = false;
    video.dataset.mentionThumb = "";
    video.className = MENTION_THUMB_MEDIA_CLASS;
    video.style.width = `${sizePx}px`;
    video.style.height = `${sizePx}px`;
    return video;
  }
  const img = document.createElement("img");
  img.src = url;
  img.alt = item.label ?? "";
  img.draggable = false;
  img.referrerPolicy = "no-referrer";
  img.dataset.mentionThumb = "";
  img.className = MENTION_THUMB_MEDIA_CLASS;
  img.style.width = `${sizePx}px`;
  img.style.height = `${sizePx}px`;
  return img;
}
