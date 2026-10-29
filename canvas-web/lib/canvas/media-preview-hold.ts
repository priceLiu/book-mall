/**
 * 预览地址切换（临时链 → OSS）时，新图尚未解码成功前继续显示上一张。
 * 避免中间闪出品牌 loading / 裂图。
 */
export function heldMediaPreviewSrc(
  currentSrc: string,
  settledSrc: string,
  currentReady: boolean,
  currentFailed: boolean,
): string {
  const current = currentSrc.trim();
  const settled = settledSrc.trim();
  if (!current || !settled || settled === current) return "";
  if (currentReady || currentFailed) return "";
  return settled;
}
