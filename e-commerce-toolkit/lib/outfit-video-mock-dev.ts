/** 前端是否展示穿搭视频 Mock（默认关，走 Gateway 实链） */
export function isOutfitVideoMockDevUiEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ECOM_OUTFIT_VIDEO_MOCK === "1";
}
