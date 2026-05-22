/** 新空间默认启用的主模型 modelKey（按 role） */
export const STORY_DEFAULT_PRIMARY_MODEL_KEYS = {
  LLM: "gemini-2.5-flash",
  IMAGE: "nano-banana-pro",
  VIDEO: "veo-2",
} as const;

export const STORY_DEMO_VIDEO_URL =
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";

export const STORY_DEFAULT_COVER =
  "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800&h=800&fit=crop";

export function slugifyStorySpace(userId: string, name?: string | null, email?: string | null): string {
  const base =
    (name ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24) ||
    (email?.split("@")[0] ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 24) ||
    `creator-${userId.slice(-8)}`;
  return base || `creator-${userId.slice(-8)}`;
}
