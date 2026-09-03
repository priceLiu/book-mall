import type { Pro2PackProfile } from "./data/pro2-production-script-schema";
import type { Pro2DockUpstreamLink } from "./pro2-dock-upstream-links";

const FILM_PULL_INTENT_RE = /拉片|逐镜分析|跟镜复刻|film[\s-]?pull/i;

export function dockTextHasFilmPullIntent(dockInput: string): boolean {
  return FILM_PULL_INTENT_RE.test(dockInput.trim());
}

export function listPro2UpstreamVideoUrls(
  upstreamLinks: Pro2DockUpstreamLink[],
): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const link of upstreamLinks) {
    if (link.kind !== "video" && link.kind !== "image") continue;
    const url = link.previewUrl?.trim();
    if (!url || !/^https?:\/\//.test(url)) continue;
    const isVideo =
      link.kind === "video" ||
      /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url) ||
      /video/i.test(url);
    if (!isVideo && link.kind !== "video") continue;
    if (seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
  }
  return urls;
}

export function resolvePro2HubFilmPullIntent(opts: {
  packProfile?: Pro2PackProfile | string | null;
  dockInput: string;
  hasUpstreamVideo: boolean;
  hasOutline?: boolean;
}): "none" | "blocked_need_industrial" | "film_pull" {
  const industrial = opts.packProfile === "industrial";
  const wantsPull =
    dockTextHasFilmPullIntent(opts.dockInput) ||
    (opts.hasUpstreamVideo && !opts.hasOutline && !opts.dockInput.trim());
  if (!wantsPull || !opts.hasUpstreamVideo) return "none";
  if (!industrial) return "blocked_need_industrial";
  return "film_pull";
}

export const PRO2_FILM_PULL_NEED_INDUSTRIAL_MESSAGE =
  "跟镜拉片请先将制作档改为「专业版」，再发送。简版只生成导演表，不会逐镜还原原片。";
