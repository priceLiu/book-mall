import type { MentionableItem } from "@/components/canvas/mentions/MentionsTextarea";
import {
  INLINE_MENTION_BADGE_GAP_PX,
  INLINE_MENTION_THUMB_PX,
} from "@/lib/canvas/mention-inline-thumb-metrics";
import { LIBTV_INPUT_DOCK_BG } from "@/lib/canvas/libtv-node-chrome";

/** 存储字符串里的 mention token：@<nodeId> */
const STORE_TOKEN_RE = /@<([^>\s]+)>/g;

export const MENTION_BADGE_ATTR = "data-mention-id";

export function mentionBadgeBorderClass(edition: "pro2" | "sbv1"): string {
  return edition === "sbv1" ? "border-cyan-400/70" : "border-violet-400/70";
}

/**
 * 创建一个内联 mention 徽标（contenteditable=false 原子节点）：
 * `[16px 缩略图] @label`。图在左、标签在右，与 LibTV 一致。
 */
export function createMentionBadge(
  id: string,
  item: MentionableItem | undefined,
  edition: "pro2" | "sbv1",
): HTMLElement {
  const badge = document.createElement("span");
  badge.contentEditable = "false";
  badge.setAttribute(MENTION_BADGE_ATTR, id);
  badge.setAttribute("draggable", "false");
  badge.dataset.mentionLabel = item?.label ?? "";
  badge.className = [
    "mention-inline-badge align-middle inline-flex h-6 max-w-[220px] shrink-0 select-none items-center rounded-lg border border-white/10 px-1 text-[13px] leading-none text-white/90",
    mentionBadgeBorderClass(edition),
  ].join(" ");
  badge.style.backgroundColor = LIBTV_INPUT_DOCK_BG;
  badge.style.gap = `${INLINE_MENTION_BADGE_GAP_PX}px`;
  badge.style.marginInline = "1px";
  badge.style.verticalAlign = "middle";

  if (item?.previewUrl) {
    const img = document.createElement("img");
    img.src = item.previewUrl;
    img.alt = "";
    img.draggable = false;
    img.referrerPolicy = "no-referrer";
    img.className = "shrink-0 rounded-[4px] object-cover";
    img.style.width = `${INLINE_MENTION_THUMB_PX}px`;
    img.style.height = `${INLINE_MENTION_THUMB_PX}px`;
    badge.appendChild(img);
  }

  const label = document.createElement("span");
  label.className = "min-w-0 truncate";
  label.textContent = `@${item?.label ?? id}`;
  badge.appendChild(label);

  return badge;
}

/** 把一段普通文本（含换行）写入 fragment：换行用 <br> */
function appendTextWithBreaks(target: DocumentFragment, text: string): void {
  const parts = text.split("\n");
  parts.forEach((part, i) => {
    if (i > 0) target.appendChild(document.createElement("br"));
    if (part) target.appendChild(document.createTextNode(part));
  });
}

/** 存储字符串 → 编辑区 DOM 片段（mention 转徽标，换行转 <br>） */
export function buildEditableFragment(
  value: string,
  mentionables: MentionableItem[],
  edition: "pro2" | "sbv1",
): DocumentFragment {
  const frag = document.createDocumentFragment();
  if (!value) return frag;

  const byId = new Map(mentionables.map((m) => [m.id, m] as const));
  STORE_TOKEN_RE.lastIndex = 0;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = STORE_TOKEN_RE.exec(value)) !== null) {
    if (m.index > last) {
      appendTextWithBreaks(frag, value.slice(last, m.index));
    }
    frag.appendChild(createMentionBadge(m[1]!, byId.get(m[1]!), edition));
    last = STORE_TOKEN_RE.lastIndex;
  }
  if (last < value.length) {
    appendTextWithBreaks(frag, value.slice(last));
  }
  return frag;
}

/** 编辑区 DOM → 存储字符串（徽标转 @<id>，<br>/块级转换行） */
export function serializeEditable(root: HTMLElement): string {
  let out = "";

  const walk = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        out += child.textContent ?? "";
        continue;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      const el = child as HTMLElement;
      const mid = el.getAttribute(MENTION_BADGE_ATTR);
      if (mid) {
        out += `@<${mid}>`;
        continue;
      }
      if (el.tagName === "BR") {
        out += "\n";
        continue;
      }
      const isBlock =
        el.tagName === "DIV" || el.tagName === "P" || el.tagName === "LI";
      if (isBlock && out.length > 0 && !out.endsWith("\n")) {
        out += "\n";
      }
      walk(el);
    }
  };

  walk(root);
  // contenteditable 末尾常见为光标占位插入的多余 <br>，去掉尾随换行
  return out.replace(/\n+$/, "");
}
