/** 外链图加载失败时的同源占位（SVG data URI），避免卡片只剩灰块 */
export const FITTING_ROOM_IMG_FALLBACK =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="533" viewBox="0 0 400 533"><rect fill="#e4e4e7" width="400" height="533"/><text x="50%" y="46%" dominant-baseline="middle" text-anchor="middle" fill="#71717a" font-family="system-ui,sans-serif" font-size="20">套装图暂不可用</text><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#a1a1aa" font-family="system-ui,sans-serif" font-size="13">图床 static-main.aiyeshi.cn 无法访问</text><text x="50%" y="61%" dominant-baseline="middle" text-anchor="middle" fill="#a1a1aa" font-family="system-ui,sans-serif" font-size="12">开发环境可将图放到 public/ai-fitroom/</text></svg>`,
  );
