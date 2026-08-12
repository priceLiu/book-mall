/** @图片N 引用 token（与自定义 Prompt 模板一致） */
export const ECOM_IMAGE_REF_TOKEN_RE = /@图片(\d+)/g;

export type EcomPromptImageRef = {
  url: string;
  /** 1-based，@图片 N */
  index: number;
  label: string;
  role: "product" | "main-style" | "detail-style" | string;
};

export const ECOM_IMAGE_REF_BADGE_ATTR = "data-ecom-image-ref";

function appendTextWithBreaks(target: DocumentFragment, text: string): void {
  const parts = text.split("\n");
  parts.forEach((part, i) => {
    if (i > 0) target.appendChild(document.createElement("br"));
    if (part) target.appendChild(document.createTextNode(part));
  });
}

export function createEcomImageRefBadge(
  index: number,
  item: EcomPromptImageRef | undefined,
): HTMLElement {
  const badge = document.createElement("span");
  badge.contentEditable = "false";
  badge.setAttribute(ECOM_IMAGE_REF_BADGE_ATTR, String(index));
  badge.setAttribute("draggable", "false");
  badge.className =
    "mention-inline-badge align-middle inline-flex min-h-[1.15em] max-w-[220px] shrink-0 select-none items-center gap-1 rounded-lg border border-[#0071e3]/35 bg-[#f0f6ff] px-1 py-[1px] text-[1em] leading-none text-[#1d1d1f]";
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
  label.textContent = `图片 ${index}`;
  badge.appendChild(label);

  return badge;
}

export function buildPromptEditableFragment(
  value: string,
  refs: EcomPromptImageRef[],
): DocumentFragment {
  const frag = document.createDocumentFragment();
  if (!value) return frag;

  const byIndex = new Map(refs.map((r) => [r.index, r] as const));
  const re = new RegExp(ECOM_IMAGE_REF_TOKEN_RE.source, "g");
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(value)) !== null) {
    if (m.index > last) {
      appendTextWithBreaks(frag, value.slice(last, m.index));
    }
    const n = Number.parseInt(m[1] ?? "", 10);
    if (Number.isFinite(n) && n > 0) {
      frag.appendChild(createEcomImageRefBadge(n, byIndex.get(n)));
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
      const idx = el.getAttribute(ECOM_IMAGE_REF_BADGE_ATTR);
      if (idx) {
        const n = Number.parseInt(idx, 10);
        if (Number.isFinite(n) && n > 0) {
          out += `@图片${n}`;
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
      (node as Element).hasAttribute(ECOM_IMAGE_REF_BADGE_ATTR)) ||
    node.parentElement?.closest(`[${ECOM_IMAGE_REF_BADGE_ATTR}]`) != null
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
      return { at: i, filter };
    }
    i--;
  }
  return null;
}
