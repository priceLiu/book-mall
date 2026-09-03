import type { SeedVideoShot } from "@/lib/seed-video-types";

/** 单镜是否可合成：有视频；有口播则须已有 TTS */
export function isSeedVideoShotComposeReady(shot: SeedVideoShot): boolean {
  if (!shot.videoUrl?.trim()) return false;
  if (shot.voiceover?.trim() && !shot.ttsUrl?.trim()) return false;
  return true;
}

/** 勾选且可合成的镜头 */
export function listSelectedComposeShotIndices(
  shots: SeedVideoShot[],
  selectedIndices: Iterable<number>,
): number[] {
  const selected = new Set(selectedIndices);
  return shots
    .filter((s) => selected.has(s.index) && isSeedVideoShotComposeReady(s))
    .map((s) => s.index)
    .sort((a, b) => a - b);
}

/** 勾选且含口播文案的镜头（批量 TTS 目标） */
export function listSelectedTtsShotIndices(
  shots: SeedVideoShot[],
  selectedIndices: Iterable<number>,
): number[] {
  const selected = new Set(selectedIndices);
  return shots
    .filter((s) => selected.has(s.index) && Boolean(s.voiceover?.trim()))
    .map((s) => s.index)
    .sort((a, b) => a - b);
}

export function batchTtsButtonLabel(opts: {
  busy?: boolean;
  selectedCount: number;
}): string {
  if (opts.busy) return "TTS…";
  if (opts.selectedCount > 0) return `批量 TTS (${opts.selectedCount})`;
  return "批量 TTS";
}

export function batchComposeButtonLabel(opts: {
  busy?: boolean;
  selectedCount: number;
}): string {
  if (opts.busy) return "合成中…";
  if (opts.selectedCount > 0) return `合成成片 (${opts.selectedCount})`;
  return "合成成片";
}
