import type { SimpleFusionLook } from "./types";
import { SIMPLE_FUSION_BGM_PRESETS } from "./constants";

export function fromSimpleFusionLooks(
  looks: SimpleFusionLook[],
): { version: 1; clips: Array<{ order: number; videoUrl: string; durationSec?: number }> } {
  const clips = looks
    .filter((l) => l.clipVideoUrl?.trim() && l.status === "success")
    .map((l, order) => ({
      order,
      videoUrl: l.clipVideoUrl!.trim(),
    }));
  if (clips.length < 1) throw new Error("没有可合成的视频片段");
  return { version: 1, clips };
}

export function resolveSimpleFusionBgmUrl(presetId?: string): string | undefined {
  const id = presetId?.trim();
  if (!id) return undefined;
  const preset = SIMPLE_FUSION_BGM_PRESETS.find((p) => p.id === id);
  return preset?.bgmUrl?.trim() || undefined;
}
