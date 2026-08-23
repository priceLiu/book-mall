/** 标签节点 · 旧 Markdown/{{样式}} → HTML 迁移（仅首次加载） */

import {
  splitTagMarkdownInlineStyles,
  type TagMarkdownSegment,
} from "./libtv-markdown-inline-style";

export function isTagRichTextHtml(body: string): boolean {
  const t = body.trim();
  if (!t) return false;
  return /^</.test(t) || /<(?:p|h[1-6]|ul|ol|li|span|div|strong|em|u|br|hr)\b/i.test(t);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inlineMarkdownToHtml(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
}

function styledSegmentToHtml(seg: Extract<TagMarkdownSegment, { kind: "styled" }>): string {
  const styles: string[] = [];
  if (seg.style.fontSizePx) styles.push(`font-size:${seg.style.fontSizePx}px`);
  if (seg.style.color) styles.push(`color:${seg.style.color}`);
  const inner = inlineMarkdownToHtml(seg.text);
  if (!styles.length) return inner;
  return `<span style="${styles.join(";")}">${inner}</span>`;
}

function markdownSegmentToHtml(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  let inUl = false;
  let inOl = false;

  const closeLists = () => {
    if (inUl) {
      out.push("</ul>");
      inUl = false;
    }
    if (inOl) {
      out.push("</ol>");
      inOl = false;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      closeLists();
      continue;
    }
    if (/^---+$/.test(line.trim())) {
      closeLists();
      out.push("<hr>");
      continue;
    }
    if (/^###\s+/.test(line)) {
      closeLists();
      out.push(`<h3>${inlineMarkdownToHtml(line.replace(/^###\s+/, ""))}</h3>`);
      continue;
    }
    if (/^##\s+/.test(line)) {
      closeLists();
      out.push(`<h2>${inlineMarkdownToHtml(line.replace(/^##\s+/, ""))}</h2>`);
      continue;
    }
    if (/^#\s+/.test(line)) {
      closeLists();
      out.push(`<h1>${inlineMarkdownToHtml(line.replace(/^#\s+/, ""))}</h1>`);
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      if (inOl) {
        out.push("</ol>");
        inOl = false;
      }
      if (!inUl) {
        out.push("<ul>");
        inUl = true;
      }
      out.push(`<li>${inlineMarkdownToHtml(line.replace(/^[-*]\s+/, ""))}</li>`);
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      if (inUl) {
        out.push("</ul>");
        inUl = false;
      }
      if (!inOl) {
        out.push("<ol>");
        inOl = true;
      }
      out.push(`<li>${inlineMarkdownToHtml(line.replace(/^\d+\.\s+/, ""))}</li>`);
      continue;
    }
    closeLists();
    out.push(`<p>${inlineMarkdownToHtml(line)}</p>`);
  }
  closeLists();
  return out.join("") || "<p></p>";
}

/** 将存盘 body 规范为 TipTap HTML（仅 legacy Markdown / {{样式}} 迁移） */
export function normalizeTagRichTextBody(body: string): string {
  const raw = body?.trim() ?? "";
  if (!raw) return "<p></p>";
  if (isTagRichTextHtml(raw)) return raw;

  const segments = splitTagMarkdownInlineStyles(raw);
  let html = "";
  for (const seg of segments) {
    if (seg.kind === "styled") html += styledSegmentToHtml(seg);
    else html += markdownSegmentToHtml(seg.text);
  }
  return html || "<p></p>";
}

export function ensureTagRichTextHtmlDocument(html: string): string {
  const t = html?.trim() ?? "";
  return t || "<p></p>";
}

export function tagRichTextToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
