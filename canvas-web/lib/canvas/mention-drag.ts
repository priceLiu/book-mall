/**
 * Dock 参考图缩略图 → 正文拖拽插入 @mention 的数据通道。
 * 用自定义 MIME 携带 mention id；dragover 阶段浏览器不暴露 getData，
 * 故用 `types` 判存在性，drop 阶段再取真正的 id。
 */
export const MENTION_DRAG_MIME = "application/x-canvas-mention";

export function setMentionDragData(dt: DataTransfer, id: string): void {
  try {
    dt.setData(MENTION_DRAG_MIME, id);
    // 提供一个空文本兜底，避免某些浏览器把整块当普通文本拖拽
    dt.setData("text/plain", "");
    dt.effectAllowed = "copy";
  } catch {
    // 忽略：个别浏览器 setData 受限
  }
}

export function getMentionDragId(dt: DataTransfer | null): string | null {
  if (!dt) return null;
  const id = dt.getData(MENTION_DRAG_MIME);
  return id ? id : null;
}

export function hasMentionDrag(dt: DataTransfer | null): boolean {
  if (!dt) return false;
  return Array.from(dt.types ?? []).includes(MENTION_DRAG_MIME);
}
