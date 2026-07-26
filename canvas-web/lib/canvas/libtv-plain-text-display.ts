/** LibTV 纯文本展示 · 画布节点 / 全屏预览共用换行样式 */

export const LIBTV_PLAIN_TEXT_WRAP_CLASS =
  "min-w-0 max-w-full whitespace-pre-wrap break-words [overflow-wrap:anywhere] [word-break:break-word]";

/** 无 Markdown 标题 / GFM 表格时按纯文本换行展示 */
export function isPlainLibtvTextContent(md: string): boolean {
  const t = md.trim();
  if (!t) return true;
  if (/^\s*\|/m.test(t)) return false;
  if (/^#{1,6}\s/m.test(t)) return false;
  return true;
}
