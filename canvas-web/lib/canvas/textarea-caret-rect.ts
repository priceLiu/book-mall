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

export function getTextareaCaretClientRect(
  textarea: HTMLTextAreaElement,
  position: number,
): TextareaCaretClientRect | null {
  if (position < 0) return null;

  const computed = window.getComputedStyle(textarea);
  const mirror = document.createElement("div");
  mirror.setAttribute("aria-hidden", "true");
  document.body.appendChild(mirror);

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

  const clamped = Math.min(position, textarea.value.length);
  mirror.textContent = textarea.value.substring(0, clamped);
  const marker = document.createElement("span");
  marker.textContent = textarea.value.substring(clamped) || ".";
  mirror.appendChild(marker);

  const markerRect = marker.getBoundingClientRect();
  document.body.removeChild(mirror);

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
