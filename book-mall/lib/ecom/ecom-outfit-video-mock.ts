/**
 * 穿搭视频 Mock（拆镜 / 逐镜生成）默认关闭，便于直连 Gateway 实链。
 * - `ECOM_OUTFIT_VIDEO_MOCK=1` 强制开
 * - `ECOM_OUTFIT_VIDEO_MOCK=0` 强制关（默认）
 */
export function isOutfitVideoMockAllowed(): boolean {
  const flag = process.env.ECOM_OUTFIT_VIDEO_MOCK?.trim();
  if (flag === "1") return true;
  if (flag === "0") return false;
  return false;
}
