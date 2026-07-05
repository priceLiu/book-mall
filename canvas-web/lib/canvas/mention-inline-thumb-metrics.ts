/** LibTV 内联 mention badge · 缩略图放大（约原 2 倍） */
export const INLINE_MENTION_THUMB_PX = 40;
export const INLINE_MENTION_BADGE_GAP_PX = 4;
/** badge 比纯 @文案多占的横向宽度（thumb + gap + 左右 padding） */
export const INLINE_MENTION_BADGE_EXTRA_PAD_PX = 8;

export function inlineMentionBadgeOverflowPx(): number {
  return (
    INLINE_MENTION_THUMB_PX +
    INLINE_MENTION_BADGE_GAP_PX +
    INLINE_MENTION_BADGE_EXTRA_PAD_PX
  );
}

/** 估算 textarea 空格宽度（13px 正文 ≈ 4px/space） */
export function estimateTextareaSpaceWidthPx(fontSizePx: number): number {
  return Math.max(3, fontSizePx * 0.31);
}

/** @mention 后需补的普通空格数，给 badge 缩略图扩展留出流式宽度 */
export function inlineMentionThumbReserveSpaces(fontSizePx = 13): number {
  return Math.max(
    5,
    Math.ceil(
      inlineMentionBadgeOverflowPx() / estimateTextareaSpaceWidthPx(fontSizePx),
    ) + 1,
  );
}

/** @mention 前补的空格数（前接汉字/标点时与 badge 拉开距离） */
export const INLINE_MENTION_LEADING_SPACES = 2;
