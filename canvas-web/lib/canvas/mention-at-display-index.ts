import type { MentionableItem } from "@/components/canvas/mentions/MentionsTextarea";

/** 光标/鼠标在展示文案中的位置是否落在某个 @mention 上 */
export function findMentionAtDisplayIndex(
  display: string,
  index: number,
  mentionables: MentionableItem[],
): MentionableItem | null {
  const hit = findMentionRangeAtDisplayIndex(display, index, mentionables);
  return hit?.item ?? null;
}

export function findMentionRangeAtDisplayIndex(
  display: string,
  index: number,
  mentionables: MentionableItem[],
): { item: MentionableItem; start: number; end: number } | null {
  if (!display || index < 0 || mentionables.length === 0) return null;

  const clamped = Math.min(index, Math.max(0, display.length - 1));
  let atPos = -1;
  for (let i = clamped; i >= 0; i--) {
    if (display[i] === "@") {
      atPos = i;
      break;
    }
    if (i < clamped && /\s/.test(display[i]!)) break;
  }
  if (atPos < 0) return null;

  const afterAt = display.slice(atPos + 1);
  const sorted = [...mentionables].sort(
    (a, b) => b.label.length - a.label.length,
  );
  for (const m of sorted) {
    if (!m.label) continue;
    if (afterAt.startsWith(m.label)) {
      const end = atPos + 1 + m.label.length;
      if (index >= atPos && index < end) {
        return { item: m, start: atPos, end };
      }
    }
  }
  return null;
}
