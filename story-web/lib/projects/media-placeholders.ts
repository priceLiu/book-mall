import type { AspectRatio } from "./types";

/** 按画幅比返回占位图（开源 picsum） */
export function placeholderImage(aspectRatio: AspectRatio, seed: string | number): string {
  if (aspectRatio === "9:16") {
    return `https://picsum.photos/seed/${seed}/540/960`;
  }
  return `https://picsum.photos/seed/${seed}/960/540`;
}

export const DEMO_VIDEO_16_9 =
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";

export const DEMO_VIDEO_9_16 =
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4";

export function placeholderVideo(aspectRatio: AspectRatio): string {
  return aspectRatio === "9:16" ? DEMO_VIDEO_9_16 : DEMO_VIDEO_16_9;
}
