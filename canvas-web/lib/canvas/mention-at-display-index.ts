import type { MentionableItem } from "@/components/canvas/mentions/MentionsTextarea";
import {
  MENTION_THUMB_PAD_CHAR,
  MENTION_THUMB_SLOT_CHAR,
} from "@/lib/canvas/mention-inline-thumb-placeholder";

function isMentionTokenBreak(ch: string | undefined): boolean {
  if (!ch) return false;
  if (ch === MENTION_THUMB_SLOT_CHAR || ch === MENTION_THUMB_PAD_CHAR) {
    return false;
  }
  return /\s/.test(ch);
}

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
    if (isMentionTokenBreak(display[i])) break;
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

/** 展示文案中全部完整 @mention 区间（从左到右扫描） */
export function findAllMentionRangesInDisplay(
  display: string,
  mentionables: MentionableItem[],
): { item: MentionableItem; start: number; end: number }[] {
  if (!display || mentionables.length === 0) return [];

  const byId = new Map(mentionables.filter((m) => m.id).map((m) => [m.id, m]));
  const sorted = [...mentionables].sort(
    (a, b) => b.label.length - a.label.length,
  );
  const out: { item: MentionableItem; start: number; end: number }[] = [];
  let i = 0;

  while (i < display.length) {
    if (display[i] !== "@") {
      i += 1;
      continue;
    }
    const afterAt = display.slice(i + 1);

    if (afterAt.startsWith("<")) {
      const tokenEnd = afterAt.indexOf(">");
      if (tokenEnd > 1) {
        const id = afterAt.slice(1, tokenEnd).trim();
        const m = byId.get(id);
        if (m) {
          const end = i + 1 + tokenEnd + 1;
          out.push({ item: m, start: i, end });
          i = end;
          continue;
        }
      }
    }

    let matched = false;
    for (const m of sorted) {
      if (!m.label || !afterAt.startsWith(m.label)) continue;
      const end = i + 1 + m.label.length;
      out.push({ item: m, start: i, end });
      i = end;
      matched = true;
      break;
    }
    if (!matched) i += 1;
  }

  return out;
}
