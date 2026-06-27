import type { MentionableItem } from "@/components/canvas/mentions/MentionsTextarea";
import { MENTION_BADGE_ATTR } from "@/lib/canvas/mention-editable-dom";

/** 与 MentionsTextarea.onTextChange 一致：从光标前向扫描，遇空白停止，遇 @ 即触发。 */
export function scanMentionTriggerBeforeCursor(
  textBeforeCursor: string,
  mentionables: Pick<MentionableItem, "label">[],
): { at: number; filter: string } | null {
  let i = textBeforeCursor.length - 1;
  while (i >= 0) {
    const ch = textBeforeCursor[i]!;
    if (/\s/.test(ch)) break;
    if (ch === "@") {
      const filter = textBeforeCursor.slice(i + 1);
      if (/\s/.test(filter)) return null;
      if (filter && mentionables.some((m) => m.label === filter)) return null;
      return { at: i, filter };
    }
    i--;
  }
  return null;
}

function isInsideMentionBadge(node: Node): boolean {
  return (
    node.nodeType === Node.ELEMENT_NODE &&
    (node as Element).hasAttribute(MENTION_BADGE_ATTR)
  ) ||
    (node.parentElement?.closest(`[${MENTION_BADGE_ATTR}]`) != null);
}

function findDeepestLastText(node: Node): Text | null {
  if (node.nodeType === Node.TEXT_NODE) {
    return isInsideMentionBadge(node) ? null : (node as Text);
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  if (isInsideMentionBadge(node)) return null;
  for (let i = node.childNodes.length - 1; i >= 0; i--) {
    const found = findDeepestLastText(node.childNodes[i]!);
    if (found) return found;
  }
  return null;
}

function findDeepestFirstText(node: Node): Text | null {
  if (node.nodeType === Node.TEXT_NODE) {
    return isInsideMentionBadge(node) ? null : (node as Text);
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  if (isInsideMentionBadge(node)) return null;
  for (let i = 0; i < node.childNodes.length; i++) {
    const found = findDeepestFirstText(node.childNodes[i]!);
    if (found) return found;
  }
  return null;
}

/** contenteditable 折叠选区 → 所在文本节点 + 偏移（含 caret 落在元素节点上的情况）。 */
export function resolveCaretTextAnchor(
  root: HTMLElement,
  range: Range,
): { node: Text; offset: number } | null {
  const { startContainer, startOffset } = range;
  if (!root.contains(startContainer)) return null;

  if (startContainer.nodeType === Node.TEXT_NODE) {
    const node = startContainer as Text;
    if (isInsideMentionBadge(node)) return null;
    return { node, offset: startOffset };
  }

  if (startContainer.nodeType === Node.ELEMENT_NODE) {
    const el = startContainer as Element;
    if (startOffset > 0) {
      const prev = el.childNodes[startOffset - 1];
      if (prev) {
        const lastText = findDeepestLastText(prev);
        if (lastText) {
          return { node: lastText, offset: lastText.length };
        }
      }
    }
    const at = el.childNodes[startOffset];
    if (at?.nodeType === Node.TEXT_NODE && !isInsideMentionBadge(at)) {
      return { node: at as Text, offset: 0 };
    }
    if (at) {
      const firstText = findDeepestFirstText(at);
      if (firstText) return { node: firstText, offset: 0 };
    }
  }

  return null;
}
