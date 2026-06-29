/**
 * canvas-web/lib/canvas/pro2-text-purpose.ts 须保持同步（服务端 run 守卫）
 */

export type Pro2TextPurpose = "story-outline" | "general";

const GENERAL_PRESETS = new Set<string>([
  "image-to-prompt",
  "video-to-prompt",
  "text-to-video",
]);

export function resolvePro2TextPurpose(data: Record<string, unknown>): Pro2TextPurpose {
  if (data.pro2TextPurpose === "story-outline") return "story-outline";
  if (data.pro2TextPurpose === "general") return "general";
  const preset = String(data.pro2PresetKind ?? "").trim();
  if (preset && GENERAL_PRESETS.has(preset)) return "general";
  return "story-outline";
}

export function isPro2StoryOutlineTextNode(data: Record<string, unknown>): boolean {
  return resolvePro2TextPurpose(data) === "story-outline";
}

export function isPro2GeneralTextNode(data: Record<string, unknown>): boolean {
  return resolvePro2TextPurpose(data) === "general";
}
