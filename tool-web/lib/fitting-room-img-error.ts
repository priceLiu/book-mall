import { FITTING_ROOM_IMG_FALLBACK } from "@/lib/fitting-room-fallback-image";

const LOCAL_PREFIX = "/ai-fitroom/";

/** 从 CDN URL 推导同源 public 路径（开发可把图放到 tool-web/public/ai-fitroom/） */
export function fittingRoomLocalPublicSrc(remoteUrl: string): string | null {
  try {
    const u = new URL(remoteUrl);
    if (!u.pathname.startsWith(LOCAL_PREFIX)) return null;
    return u.pathname;
  } catch {
    return null;
  }
}

/**
 * 试衣间图片加载失败时的回退链（禁止 picsum 等无关占位图）：
 * 1. 同源代理失败 → 尝试直连 CDN
 * 2. 仍失败 → 尝试 public/ai-fitroom/ 本地副本
 * 3. 仍失败 → 灰色「套装图暂不可用」SVG
 */
export function handleFittingRoomImgError(
  el: HTMLImageElement,
  remoteUrl: string,
): void {
  const step = el.dataset.frbStep ?? "";

  if (step === "") {
    el.dataset.frbStep = "direct";
    el.src = remoteUrl;
    return;
  }

  if (step === "direct") {
    const local = fittingRoomLocalPublicSrc(remoteUrl);
    if (local) {
      el.dataset.frbStep = "local";
      el.src = local;
      return;
    }
  }

  el.dataset.frbStep = "svg";
  el.src = FITTING_ROOM_IMG_FALLBACK;
}
