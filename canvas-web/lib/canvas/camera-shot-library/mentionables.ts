import type { MentionableItem } from "@/components/canvas/mentions/MentionsTextarea";
import { CAMERA_SHOT_PRESETS } from "./catalog";

/** 平台镜头描述 · Dock @ / slash 选用列表 */
export function buildCameraShotMentionables(): MentionableItem[] {
  return CAMERA_SHOT_PRESETS.map((p) => ({
    id: p.id,
    label: p.name,
    kind: "camera-shot",
  }));
}

export function filterCameraShotMentionables(filter: string): MentionableItem[] {
  const items = buildCameraShotMentionables();
  const f = filter.trim().toLowerCase();
  if (!f) return items;
  return items.filter((m) => {
    const preset = CAMERA_SHOT_PRESETS.find((p) => p.id === m.id);
    if (!preset) return m.label.toLowerCase().includes(f);
    return (
      m.label.toLowerCase().includes(f) ||
      preset.meaningZh.toLowerCase().includes(f) ||
      preset.sceneExampleZh.toLowerCase().includes(f)
    );
  });
}
