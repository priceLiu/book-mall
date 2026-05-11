const ALLOWED_HOST = "static-main.aiyeshi.cn";
const ALLOWED_PATH_PREFIX = "/ai-fitroom/";

/**
 * 试衣间外链图：对允许的 CDN 走同源代理，便于开发环境绕过过期 HTTPS 证书（见 `/api/fit-image`）。
 */
export function fittingRoomImageSrc(remoteUrl: string): string {
  try {
    const u = new URL(remoteUrl);
    if (u.hostname !== ALLOWED_HOST || !u.pathname.startsWith(ALLOWED_PATH_PREFIX)) {
      return remoteUrl;
    }
    return `/api/fit-image?url=${encodeURIComponent(remoteUrl)}`;
  } catch {
    return remoteUrl;
  }
}
