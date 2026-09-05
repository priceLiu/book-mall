/** 标签节点 · 选区局部字号/颜色（Markdown 内嵌语法） */

export type TagInlineStyle = {
  fontSizePx?: number;
  color?: string;
};

/** `{{14px|#ff6600}}文本{{/}}` · 至少一项 */
export const TAG_INLINE_STYLE_BLOCK_RE = /\{\{([^}]+)\}\}([\s\S]*?)\{\{\/\}\}/g;

export const TAG_INLINE_FONT_SIZE_OPTIONS = [10, 11, 13, 14, 16, 18, 20] as const;

export const TAG_INLINE_COLOR_PRESETS = [
  { label: "白", value: "#ffffff" },
  { label: "黄", value: "#fbbf24" },
  { label: "橙", value: "#fb923c" },
  { label: "红", value: "#f87171" },
  { label: "绿", value: "#4ade80" },
  { label: "蓝", value: "#60a5fa" },
  { label: "紫", value: "#c084fc" },
  { label: "粉", value: "#f472b6" },
] as const;

export function parseTagInlineStyleToken(token: string): TagInlineStyle {
  const out: TagInlineStyle = {};
  for (const part of token.split("|").map((s) => s.trim()).filter(Boolean)) {
    if (/^\d+px$/i.test(part)) {
      out.fontSizePx = Number.parseInt(part, 10);
    } else if (/^#[0-9a-fA-F]{3,8}$/.test(part)) {
      out.color = part.toLowerCase();
    }
  }
  return out;
}

export function formatTagInlineStyleToken(style: TagInlineStyle): string {
  const parts: string[] = [];
  if (style.fontSizePx && Number.isFinite(style.fontSizePx)) {
    parts.push(`${style.fontSizePx}px`);
  }
  if (style.color) parts.push(style.color);
  return parts.join("|");
}

export function stripTagInlineStyleMarkers(text: string): string {
  return text.replace(TAG_INLINE_STYLE_BLOCK_RE, "$2");
}

export type TagMarkdownSegment =
  | { kind: "md"; text: string }
  | { kind: "styled"; text: string; style: TagInlineStyle };

/** 将 Markdown 拆成普通段与局部样式段（仅顶层，不嵌套解析） */
export function splitTagMarkdownInlineStyles(content: string): TagMarkdownSegment[] {
  if (!content) return [];
  const parts: TagMarkdownSegment[] = [];
  let lastIndex = 0;
  const re = new RegExp(TAG_INLINE_STYLE_BLOCK_RE.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ kind: "md", text: content.slice(lastIndex, match.index) });
    }
    parts.push({
      kind: "styled",
      style: parseTagInlineStyleToken(match[1] ?? ""),
      text: match[2] ?? "",
    });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) {
    parts.push({ kind: "md", text: content.slice(lastIndex) });
  }
  if (parts.length === 0) parts.push({ kind: "md", text: content });
  return parts;
}

function mergeInlineStyle(existing: TagInlineStyle, next: TagInlineStyle): TagInlineStyle {
  return {
    fontSizePx: next.fontSizePx ?? existing.fontSizePx,
    color: next.color ?? existing.color,
  };
}

function findWrappingStyleBlock(
  value: string,
  start: number,
  end: number,
): { open: number; close: number; token: string; innerStart: number; innerEnd: number } | null {
  const re = new RegExp(TAG_INLINE_STYLE_BLOCK_RE.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(value)) !== null) {
    const full = match[0];
    const token = match[1] ?? "";
    const inner = match[2] ?? "";
    const open = match.index;
    const innerStart = open + `{{${token}}}`.length;
    const innerEnd = innerStart + inner.length;
    const close = open + full.length;
    if (start >= innerStart && end <= innerEnd) {
      return { open, close, token, innerStart, innerEnd };
    }
  }
  return null;
}

/** 对当前选区应用/更新局部字号或颜色 */
export function applyTagInlineStyleAction(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  patch: TagInlineStyle,
): { next: string; selectionStart: number; selectionEnd: number } {
  const start = Math.min(selectionStart, selectionEnd);
  const end = Math.max(selectionStart, selectionEnd);
  const hasSelection = end > start;

  const wrapped = findWrappingStyleBlock(value, start, end);
  if (wrapped) {
    const existing = parseTagInlineStyleToken(wrapped.token);
    const merged = mergeInlineStyle(existing, patch);
    const token = formatTagInlineStyleToken(merged);
    const inner = value.slice(wrapped.innerStart, wrapped.innerEnd);
    const openOld = `{{${wrapped.token}}}`;
    const closeOld = "{{/}}";

    if (
      hasSelection &&
      (start > wrapped.innerStart || end < wrapped.innerEnd)
    ) {
      const relStart = start - wrapped.innerStart;
      const relEnd = end - wrapped.innerStart;
      const before = inner.slice(0, relStart);
      const selected = inner.slice(relStart, relEnd);
      const after = inner.slice(relEnd);
      if (!token || !selected) {
        return { next: value, selectionStart: start, selectionEnd: end };
      }
      const openNew = `{{${token}}}`;
      const chunks: string[] = [];
      if (before) chunks.push(`${openOld}${before}${closeOld}`);
      chunks.push(`${openNew}${selected}${closeOld}`);
      if (after) chunks.push(`${openOld}${after}${closeOld}`);
      const replacement = chunks.join("");
      const next = `${value.slice(0, wrapped.open)}${replacement}${value.slice(wrapped.close)}`;
      const selStart =
        wrapped.open +
        (before ? openOld.length + before.length + closeOld.length : 0) +
        openNew.length;
      const selEnd = selStart + selected.length;
      return { next, selectionStart: selStart, selectionEnd: selEnd };
    }

    const oldOpenLen = openOld.length;

    if (!token) {
      const next = `${value.slice(0, wrapped.open)}${inner}${value.slice(wrapped.close)}`;
      const delta = -oldOpenLen - closeOld.length;
      return {
        next,
        selectionStart: hasSelection ? start + delta : wrapped.open + inner.length,
        selectionEnd: hasSelection ? end + delta : wrapped.open + inner.length,
      };
    }

    const openTag = `{{${token}}}`;
    const nextInner = `${openTag}${inner}${closeOld}`;
    const next = `${value.slice(0, wrapped.open)}${nextInner}${value.slice(wrapped.close)}`;
    const delta = openTag.length - oldOpenLen;

    return {
      next,
      selectionStart: hasSelection ? start + delta : wrapped.open + openTag.length + inner.length,
      selectionEnd: hasSelection ? end + delta : wrapped.open + openTag.length + inner.length,
    };
  }

  const token = formatTagInlineStyleToken(patch);
  if (!token) {
    return { next: value, selectionStart: start, selectionEnd: end };
  }

  if (!hasSelection) {
    return { next: value, selectionStart: start, selectionEnd: end };
  }

  let selected = stripTagInlineStyleMarkers(value.slice(start, end));
  if (!selected.trim()) {
    return { next: value, selectionStart: start, selectionEnd: end };
  }
  if (selected.includes("{{") || selected.includes("{{/}}")) {
    return { next: value, selectionStart: start, selectionEnd: end };
  }

  const openTag = `{{${token}}}`;
  const wrappedText = `${openTag}${selected}{{/}}`;
  const next = `${value.slice(0, start)}${wrappedText}${value.slice(end)}`;
  const selStart = start + openTag.length;
  const selEnd = selStart + selected.length;
  return { next, selectionStart: selStart, selectionEnd: selEnd };
}
