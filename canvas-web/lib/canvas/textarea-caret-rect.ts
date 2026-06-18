/** textarea 光标在视口中的 client 坐标（用于 @ 选择层定位） */
export type TextareaCaretClientRect = {
  left: number;
  top: number;
  bottom: number;
  height: number;
};

const MIRROR_PROPS = [
  "direction",
  "boxSizing",
  "width",
  "height",
  "overflowX",
  "overflowY",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "borderStyle",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "fontStyle",
  "fontVariant",
  "fontWeight",
  "fontStretch",
  "fontSize",
  "fontSizeAdjust",
  "lineHeight",
  "fontFamily",
  "textAlign",
  "textTransform",
  "textIndent",
  "textDecoration",
  "letterSpacing",
  "wordSpacing",
  "tabSize",
] as const;

const mirrorByTextarea = new WeakMap<HTMLTextAreaElement, HTMLDivElement>();

function syncMirrorStyles(
  textarea: HTMLTextAreaElement,
  mirror: HTMLDivElement,
): CSSStyleDeclaration {
  const computed = window.getComputedStyle(textarea);
  const style = mirror.style;
  style.position = "fixed";
  style.visibility = "hidden";
  style.pointerEvents = "none";
  style.whiteSpace = "pre-wrap";
  style.wordWrap = "break-word";
  style.overflow = "auto";
  for (const prop of MIRROR_PROPS) {
    style[prop] = computed[prop];
  }
  const rect = textarea.getBoundingClientRect();
  style.top = `${rect.top}px`;
  style.left = `${rect.left}px`;
  style.width = `${rect.width}px`;
  style.height = `${rect.height}px`;
  mirror.scrollTop = textarea.scrollTop;
  mirror.scrollLeft = textarea.scrollLeft;
  return computed;
}

function getMirror(textarea: HTMLTextAreaElement): HTMLDivElement {
  let mirror = mirrorByTextarea.get(textarea);
  if (!mirror) {
    mirror = document.createElement("div");
    mirror.setAttribute("aria-hidden", "true");
    document.body.appendChild(mirror);
    mirrorByTextarea.set(textarea, mirror);
  }
  return mirror;
}

/** textarea 卸载时释放 mirror，避免泄漏 */
export function disposeTextareaCaretMirror(textarea: HTMLTextAreaElement): void {
  const mirror = mirrorByTextarea.get(textarea);
  if (!mirror) return;
  mirror.remove();
  mirrorByTextarea.delete(textarea);
}

export function getTextareaCaretClientRect(
  textarea: HTMLTextAreaElement,
  position: number,
): TextareaCaretClientRect | null {
  if (position < 0) return null;

  const mirror = getMirror(textarea);
  const computed = syncMirrorStyles(textarea, mirror);

  const clamped = Math.min(position, textarea.value.length);
  mirror.textContent = textarea.value.substring(0, clamped);
  const marker = document.createElement("span");
  marker.textContent = "\u200b";
  marker.style.display = "inline-block";
  marker.style.width = "0";
  marker.style.overflow = "visible";
  mirror.appendChild(marker);

  const markerRect = marker.getBoundingClientRect();
  mirror.textContent = "";

  const height =
    markerRect.height ||
    parseFloat(computed.lineHeight) ||
    parseFloat(computed.fontSize) ||
    16;

  return {
    left: markerRect.left,
    top: markerRect.top,
    bottom: markerRect.bottom,
    height,
  };
}

/** 视口坐标 → textarea 字符索引（用于 @ 悬停命中） */
export function getTextareaIndexFromClientPoint(
  textarea: HTMLTextAreaElement,
  clientX: number,
  clientY: number,
): number {
  const len = textarea.value.length;
  if (len === 0) return 0;

  let lo = 0;
  let hi = len;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const r = getTextareaCaretClientRect(textarea, mid);
    if (!r) return 0;
    const midY = r.top + r.height / 2;
    if (midY < clientY) lo = mid + 1;
    else hi = mid;
  }

  const lineRect = getTextareaCaretClientRect(textarea, lo);
  if (!lineRect) return lo;

  let start = lo;
  while (start > 0) {
    const r = getTextareaCaretClientRect(textarea, start - 1);
    if (!r || r.top < lineRect.top - 1) break;
    start--;
  }
  let end = lo;
  while (end < len) {
    const r = getTextareaCaretClientRect(textarea, end + 1);
    if (!r || r.top > lineRect.bottom + 1) break;
    end++;
  }

  let best = start;
  let bestDist = Infinity;
  for (let i = start; i <= end; i++) {
    const r = getTextareaCaretClientRect(textarea, i);
    if (!r) continue;
    const dist = Math.abs(r.left - clientX);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}

/** @mention 在 textarea 中的视口矩形（用于悬停预览锚点） */
export function getMentionRangeClientRect(
  textarea: HTMLTextAreaElement,
  start: number,
  end: number,
): DOMRect | null {
  const startR = getTextareaCaretClientRect(textarea, start);
  const endR = getTextareaCaretClientRect(
    textarea,
    Math.min(end, textarea.value.length),
  );
  if (!startR || !endR) return null;
  const top = Math.min(startR.top, endR.top);
  const bottom = Math.max(startR.bottom, endR.bottom);
  const left = startR.left;
  const width = Math.max(endR.left - startR.left, startR.height * 0.5);
  return new DOMRect(left, top, width, bottom - top);
}
