import type { ComposeWorkbenchState } from "@private/platform-compose-ui/types";

export function composeWorkbenchStructuralEquals(
  a: ComposeWorkbenchState | null | undefined,
  b: ComposeWorkbenchState | null | undefined,
): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  if (a.orderedClipIds.join("\0") !== b.orderedClipIds.join("\0")) return false;
  if ((a.orderedAudioClipIds ?? []).join("\0") !== (b.orderedAudioClipIds ?? []).join("\0")) {
    return false;
  }
  if (a.clips.length !== b.clips.length) return false;
  const byId = new Map(b.clips.map((c) => [c.id, c]));
  for (const clip of a.clips) {
    const other = byId.get(clip.id);
    if (!other) return false;
    if (clip.videoUrl.trim() !== other.videoUrl.trim()) return false;
  }
  const audioA = a.audioClips ?? [];
  const audioB = b.audioClips ?? [];
  if (audioA.length !== audioB.length) return false;
  const audioById = new Map(audioB.map((c) => [c.id, c]));
  for (const clip of audioA) {
    const other = audioById.get(clip.id);
    if (!other) return false;
    if ((clip.audioUrl?.trim() ?? "") !== (other.audioUrl?.trim() ?? "")) {
      return false;
    }
  }
  return true;
}

export function libtvOrderNodeIdsEqual(
  a: readonly string[] | undefined,
  b: readonly string[] | undefined,
): boolean {
  return (a ?? []).join("\0") === (b ?? []).join("\0");
}
