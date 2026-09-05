/** 标签节点 · 纯文本编辑层（隐藏 {{样式}} 标记，框选改色后再序列化回 body） */

import {
  formatTagInlineStyleToken,
  splitTagMarkdownInlineStyles,
  type TagInlineStyle,
} from "./libtv-markdown-inline-style";

export type TagPlainStyleSpan = {
  start: number;
  end: number;
  style: TagInlineStyle;
};

export type TagPlainEditState = {
  plain: string;
  spans: TagPlainStyleSpan[];
};

function styleKey(style: TagInlineStyle): string {
  return formatTagInlineStyleToken(style);
}

function stylesEqual(a: TagInlineStyle, b: TagInlineStyle): boolean {
  return styleKey(a) === styleKey(b);
}

export function normalizeTagPlainSpans(
  plain: string,
  spans: TagPlainStyleSpan[],
): TagPlainStyleSpan[] {
  const len = plain.length;
  const clipped = spans
    .map((s) => ({
      start: Math.max(0, Math.min(s.start, len)),
      end: Math.max(0, Math.min(s.end, len)),
      style: { ...s.style },
    }))
    .filter((s) => s.end > s.start && styleKey(s.style))
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const out: TagPlainStyleSpan[] = [];
  for (const span of clipped) {
    const last = out[out.length - 1];
    if (last && stylesEqual(last.style, span.style) && span.start <= last.end) {
      last.end = Math.max(last.end, span.end);
      continue;
    }
    out.push(span);
  }
  return out;
}

export function bodyToTagPlainEdit(body: string): TagPlainEditState {
  const segments = splitTagMarkdownInlineStyles(body);
  let plain = "";
  const spans: TagPlainStyleSpan[] = [];

  for (const seg of segments) {
    if (seg.kind === "styled") {
      const start = plain.length;
      plain += seg.text;
      if (styleKey(seg.style)) {
        spans.push({ start, end: plain.length, style: { ...seg.style } });
      }
    } else {
      plain += seg.text;
    }
  }

  return { plain, spans: normalizeTagPlainSpans(plain, spans) };
}

export function tagPlainEditToBody(plain: string, spans: TagPlainStyleSpan[]): string {
  const normalized = normalizeTagPlainSpans(plain, spans);
  if (normalized.length === 0) return plain;

  let out = "";
  let pos = 0;
  for (const span of normalized) {
    if (span.start > pos) out += plain.slice(pos, span.start);
    out += `{{${styleKey(span.style)}}}${plain.slice(span.start, span.end)}{{/}}`;
    pos = span.end;
  }
  out += plain.slice(pos);
  return out;
}

function mergeStyle(existing: TagInlineStyle | undefined, patch: TagInlineStyle): TagInlineStyle {
  return {
    fontSizePx: patch.fontSizePx ?? existing?.fontSizePx,
    color: patch.color ?? existing?.color,
  };
}

export function applyTagPlainStyleSpan(
  state: TagPlainEditState,
  selectionStart: number,
  selectionEnd: number,
  patch: TagInlineStyle,
): TagPlainEditState & { selectionStart: number; selectionEnd: number } {
  const start = Math.min(selectionStart, selectionEnd);
  const end = Math.max(selectionStart, selectionEnd);
  if (end <= start || !formatTagInlineStyleToken(patch)) {
    return { ...state, selectionStart: start, selectionEnd: end };
  }

  const selected = state.plain.slice(start, end);
  if (!selected.trim()) {
    return { ...state, selectionStart: start, selectionEnd: end };
  }

  let mergedStyle = { ...patch };
  for (const span of state.spans) {
    if (span.start <= start && span.end >= end) {
      mergedStyle = mergeStyle(span.style, patch);
      break;
    }
  }

  const kept = state.spans.filter((s) => s.end <= start || s.start >= end);
  kept.push({ start, end, style: mergedStyle });
  const spans = normalizeTagPlainSpans(state.plain, kept);

  return { plain: state.plain, spans, selectionStart: start, selectionEnd: end };
}

export function diffPlainTextEdit(
  prev: string,
  next: string,
): { changeStart: number; changeEnd: number; delta: number } {
  let changeStart = 0;
  while (
    changeStart < prev.length &&
    changeStart < next.length &&
    prev[changeStart] === next[changeStart]
  ) {
    changeStart += 1;
  }
  let prevEnd = prev.length;
  let nextEnd = next.length;
  while (
    prevEnd > changeStart &&
    nextEnd > changeStart &&
    prev[prevEnd - 1] === next[nextEnd - 1]
  ) {
    prevEnd -= 1;
    nextEnd -= 1;
  }
  return { changeStart, changeEnd: prevEnd, delta: next.length - prev.length };
}

export function tagPlainEditOnTextChange(
  state: TagPlainEditState,
  nextPlain: string,
): TagPlainEditState {
  if (state.plain === nextPlain) return state;
  const { changeStart, changeEnd, delta } = diffPlainTextEdit(state.plain, nextPlain);
  const insertLen = nextPlain.length - state.plain.length + (changeEnd - changeStart);

  const spans: TagPlainStyleSpan[] = [];
  for (const span of state.spans) {
    if (span.end <= changeStart) {
      spans.push(span);
      continue;
    }
    if (span.start >= changeEnd) {
      spans.push({ start: span.start + delta, end: span.end + delta, style: span.style });
      continue;
    }
    if (span.start < changeStart) {
      spans.push({ start: span.start, end: changeStart, style: span.style });
    }
    if (span.end > changeEnd) {
      spans.push({
        start: changeStart + insertLen - (span.end - changeEnd),
        end: span.end + delta,
        style: span.style,
      });
    }
  }

  return {
    plain: nextPlain,
    spans: normalizeTagPlainSpans(nextPlain, spans),
  };
}

export function clearTagPlainStyleSpans(
  state: TagPlainEditState,
  selectionStart: number,
  selectionEnd: number,
): TagPlainEditState {
  const start = Math.min(selectionStart, selectionEnd);
  const end = Math.max(selectionStart, selectionEnd);
  if (end <= start) return state;

  const kept = state.spans.filter((s) => s.end <= start || s.start >= end);
  return { plain: state.plain, spans: normalizeTagPlainSpans(state.plain, kept) };
}
