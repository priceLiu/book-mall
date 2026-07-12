import { HAPPYHORSE_IMAGE_REF_TOKEN_RE } from "@/lib/qr-template-types";

export const QR_IMAGE_REF_BADGE_ATTR = "data-qr-image-ref";

export type QrPromptImageRef = {
  url: string;
  /** 1-based index for [Image N] */
  index: number;
};

function appendTextWithBreaks(target: DocumentFragment, text: string): void {
  const parts = text.split("\n");
  parts.forEach((part, i) => {
    if (i > 0) target.appendChild(document.createElement("br"));
    if (part) target.appendChild(document.createTextNode(part));
  });
}

export function createImageRefBadge(
  index: number,
  item: QrPromptImageRef | undefined,
): HTMLElement {
  const badge = document.createElement("span");
  badge.contentEditable = "false";
  badge.setAttribute(QR_IMAGE_REF_BADGE_ATTR, String(index));
  badge.setAttribute("draggable", "false");
  badge.className =
    "mention-inline-badge align-middle inline-flex min-h-[1.15em] max-w-[200px] shrink-0 select-none items-center gap-1 rounded-lg border border-[rgba(59,130,246,0.45)] px-1 py-[1px] text-[1em] leading-none text-[var(--qr-text-primary)]";
  badge.style.backgroundColor = "var(--qr-bg-elevated)";
  badge.style.marginInline = "1px";
  badge.style.verticalAlign = "middle";

  if (item?.url) {
    const img = document.createElement("img");
    img.src = item.url;
    img.alt = "";
    img.draggable = false;
    img.referrerPolicy = "no-referrer";
    img.className = "h-4 w-4 shrink-0 rounded-[4px] object-cover";
    badge.appendChild(img);
  }

  const label = document.createElement("span");
  label.className = "min-w-0 truncate text-[0.92em]";
  label.textContent = `图 ${index}`;
  badge.appendChild(label);

  return badge;
}

export function buildPromptEditableFragment(
  value: string,
  refs: QrPromptImageRef[],
): DocumentFragment {
  const frag = document.createDocumentFragment();
  if (!value) return frag;

  const byIndex = new Map(refs.map((r) => [r.index, r] as const));
  const re = new RegExp(HAPPYHORSE_IMAGE_REF_TOKEN_RE.source, "gi");
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(value)) !== null) {
    if (m.index > last) {
      appendTextWithBreaks(frag, value.slice(last, m.index));
    }
    const n = Number.parseInt(m[1] ?? "", 10);
    if (Number.isFinite(n) && n > 0) {
      frag.appendChild(createImageRefBadge(n, byIndex.get(n)));
    } else {
      appendTextWithBreaks(frag, m[0]!);
    }
    last = re.lastIndex;
  }
  if (last < value.length) {
    appendTextWithBreaks(frag, value.slice(last));
  }
  return frag;
}

export function serializePromptEditable(root: HTMLElement): string {
  let out = "";

  const walk = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        out += child.textContent ?? "";
        continue;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      const el = child as HTMLElement;
      const idx = el.getAttribute(QR_IMAGE_REF_BADGE_ATTR);
      if (idx) {
        const n = Number.parseInt(idx, 10);
        if (Number.isFinite(n) && n > 0) {
          out += `[Image ${n}]`;
        }
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
  return out.replace(/\n+$/, "");
}

function isInsideImageRefBadge(node: Node): boolean {
  return (
    (node.nodeType === Node.ELEMENT_NODE &&
      (node as Element).hasAttribute(QR_IMAGE_REF_BADGE_ATTR)) ||
    node.parentElement?.closest(`[${QR_IMAGE_REF_BADGE_ATTR}]`) != null
  );
}

function findDeepestLastText(node: Node): Text | null {
  if (node.nodeType === Node.TEXT_NODE) {
    return isInsideImageRefBadge(node) ? null : (node as Text);
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  if (isInsideImageRefBadge(node)) return null;
  for (let i = node.childNodes.length - 1; i >= 0; i--) {
    const found = findDeepestLastText(node.childNodes[i]!);
    if (found) return found;
  }
  return null;
}

function findDeepestFirstText(node: Node): Text | null {
  if (node.nodeType === Node.TEXT_NODE) {
    return isInsideImageRefBadge(node) ? null : (node as Text);
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  if (isInsideImageRefBadge(node)) return null;
  for (let i = 0; i < node.childNodes.length; i++) {
    const found = findDeepestFirstText(node.childNodes[i]!);
    if (found) return found;
  }
  return null;
}

export function resolveCaretTextAnchor(
  root: HTMLElement,
  range: Range,
): { node: Text; offset: number } | null {
  const { startContainer, startOffset } = range;
  if (!root.contains(startContainer)) return null;

  if (startContainer.nodeType === Node.TEXT_NODE) {
    const node = startContainer as Text;
    if (isInsideImageRefBadge(node)) return null;
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
    if (at?.nodeType === Node.TEXT_NODE && !isInsideImageRefBadge(at)) {
      return { node: at as Text, offset: 0 };
    }
    if (at) {
      const firstText = findDeepestFirstText(at);
      if (firstText) return { node: firstText, offset: 0 };
    }
  }

  return null;
}

export function scanImageRefTriggerBeforeCursor(
  textBeforeCursor: string,
): { at: number; filter: string } | null {
  let i = textBeforeCursor.length - 1;
  while (i >= 0) {
    const ch = textBeforeCursor[i]!;
    if (/\s/.test(ch)) break;
    if (ch === "@") {
      const filter = textBeforeCursor.slice(i + 1);
      if (/\s/.test(filter)) return null;
      if (/[[\]]/.test(filter)) return null;
      return { at: i, filter };
    }
    i--;
  }
  return null;
}
