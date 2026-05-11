/** 外链图加载失败时的同源占位（SVG data URI），避免卡片只剩灰块 */
export const FITTING_ROOM_IMG_FALLBACK =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="533" viewBox="0 0 400 533"><rect fill="#e4e4e7" width="400" height="533"/><text x="50%" y="48%" dominant-baseline="middle" text-anchor="middle" fill="#71717a" font-family="system-ui,sans-serif" font-size="20">预览不可用</text><text x="50%" y="56%" dominant-baseline="middle" text-anchor="middle" fill="#a1a1aa" font-family="system-ui,sans-serif" font-size="13">请检查网络或图床证书</text></svg>`,
  );
