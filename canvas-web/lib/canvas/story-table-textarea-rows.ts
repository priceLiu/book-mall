/** 表格单元格 textarea 行数：按换行 + 列宽折行估算，避免内容被裁切 */
export function storyTableTextareaRows(
  text: string,
  min: number,
  charsPerLine: number,
): number {
  if (!text.trim()) return min;
  const lines = text.split("\n");
  let total = 0;
  for (const line of lines) {
    total += Math.max(1, Math.ceil(line.length / Math.max(charsPerLine, 4)));
  }
  return Math.max(min, total + 1);
}
